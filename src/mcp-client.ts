import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { MCPClientConfig, MCPTool, MCPCallResult, JSONSchema } from './types';
import { MCPError } from './utils/errors';
import { mcpLogger, LoggingUtils } from './utils/logging';

// Enhanced type definitions for better type safety
interface MCPListToolsResponse {
  tools: Tool[];
}

interface MCPRequest {
  method: string;
  params?: Record<string, unknown>;
}

interface MCPClientState {
  client: Client;
  config: MCPClientConfig;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastConnected?: Date;
  retryCount: number;
}

// Constants for better maintainability
const connectionTimeoutMs = 10000;

export class MCPManager {
  private clients: Map<string, MCPClientState> = new Map();
  private tools: Map<string, Tool> = new Map();
  private connectionTimeouts: Map<string, NodeJS.Timeout> = new Map();

  async addClient(name: string, config: MCPClientConfig): Promise<void> {
    return LoggingUtils.logTiming(
      `MCP client '${name}' connection`,
      async () => {
        try {
          mcpLogger.info('Connecting MCP client', { clientName: name, command: config.command });

          // Validate configuration
          this.validateClientConfig(config, name);

          const transport = new StdioClientTransport({
            command: config.command,
            args: config.args || [],
            env: config.env,
          });

          const client = new Client(
            {
              name: `vscode-http-lm-api-${name}`,
              version: '1.0.0',
            },
            {
              capabilities: {
                tools: {},
              },
            }
          );

          // Set connection timeout
          const timeoutPromise = new Promise<never>((_, reject) => {
            const timeout = setTimeout(() => {
              reject(
                new MCPError('Connection timeout', { clientName: name, operation: 'connect' })
              );
            }, connectionTimeoutMs);
            this.connectionTimeouts.set(name, timeout);
          });

          // Race between connection and timeout
          await Promise.race([client.connect(transport), timeoutPromise]);

          // Clear timeout on successful connection
          const timeout = this.connectionTimeouts.get(name);
          if (timeout) {
            clearTimeout(timeout);
            this.connectionTimeouts.delete(name);
          }

          // Store client state
          const clientState: MCPClientState = {
            client,
            config,
            status: 'connected',
            lastConnected: new Date(),
            retryCount: 0,
          };
          this.clients.set(name, clientState);

          // Load tools from this client
          await this.loadToolsFromClient(name, client);

          mcpLogger.info('MCP client connected successfully', {
            clientName: name,
            toolCount: Array.from(this.tools.keys()).filter(key => key.startsWith(`${name}:`))
              .length,
          });
        } catch (error: unknown) {
          // Clean up on failure
          const timeout = this.connectionTimeouts.get(name);
          if (timeout) {
            clearTimeout(timeout);
            this.connectionTimeouts.delete(name);
          }

          const mcpError = new MCPError(`Failed to connect MCP client '${name}'`, {
            clientName: name,
            operation: 'connect',
            originalError: error instanceof Error ? error : new Error(String(error)),
          });

          mcpLogger.error('MCP client connection failed', mcpError);
          throw mcpError;
        }
      },
      { clientName: name }
    );
  }

  private async loadToolsFromClient(clientName: string, client: Client): Promise<void> {
    return LoggingUtils.logTiming(
      `tool loading from '${clientName}'`,
      async () => {
        try {
          const request: MCPRequest = { method: 'tools/list' };
          const response = (await client.request(
            request as ListToolsRequest,
            z.object({})
          )) as MCPListToolsResponse;

          if (response.tools && Array.isArray(response.tools)) {
            let loadedCount = 0;
            for (const tool of response.tools) {
              const toolKey = `${clientName}:${tool.name}`;
              this.tools.set(toolKey, tool);
              loadedCount++;
              mcpLogger.debug('Loaded tool', { clientName, toolName: tool.name, toolKey });
            }

            mcpLogger.info('Tools loaded from client', {
              clientName,
              toolCount: loadedCount,
            });
          } else {
            mcpLogger.warn('No tools found in client response', { clientName });
          }
        } catch (error: unknown) {
          const mcpError = new MCPError(`Failed to load tools from client '${clientName}'`, {
            clientName,
            operation: 'load_tools',
            originalError: error instanceof Error ? error : new Error(String(error)),
          });

          mcpLogger.error('Tool loading failed', mcpError);
          throw mcpError;
        }
      },
      { clientName }
    );
  }

  async callTool(toolName: string, parameters: Record<string, unknown>): Promise<MCPCallResult> {
    return LoggingUtils.logTiming(
      `MCP tool call '${toolName}'`,
      async () => {
        // Find which client has this tool
        const { clientName, actualToolName } = this.resolveToolClient(toolName);

        const clientState = this.clients.get(clientName);
        if (!clientState) {
          throw new MCPError(`MCP client '${clientName}' not found`, {
            clientName,
            toolName,
            operation: 'call_tool',
          });
        }

        // Check client status
        if (clientState.status !== 'connected') {
          throw new MCPError(`MCP client '${clientName}' is not connected`, {
            clientName,
            toolName,
            status: clientState.status,
            operation: 'call_tool',
          });
        }

        try {
          const request: MCPRequest = {
            method: 'tools/call',
            params: {
              name: actualToolName,
              arguments: parameters,
            },
          };

          mcpLogger.debug('Calling MCP tool', {
            clientName,
            toolName,
            actualToolName,
            parameterCount: Object.keys(parameters).length,
          });

          const result = (await clientState.client.request(
            request as CallToolRequest,
            z.object({})
          )) as CallToolResult;

          // Convert to our MCPCallResult format with proper type checking
          const mcpResult: MCPCallResult = {
            content: (result.content || []).map(item => ({
              type: this.validateContentType(item.type),
              text: typeof item.text === 'string' ? item.text : undefined,
              data: typeof item.data === 'string' ? item.data : undefined,
              mimeType: typeof item.mimeType === 'string' ? item.mimeType : undefined,
            })),
            isError: Boolean(result.isError),
          };

          mcpLogger.debug('MCP tool call successful', {
            clientName,
            toolName,
            contentItems: mcpResult.content.length,
            isError: mcpResult.isError,
          });

          return mcpResult;
        } catch (error: unknown) {
          const mcpError = new MCPError(`Tool call failed for '${toolName}'`, {
            clientName,
            toolName,
            operation: 'call_tool',
            originalError: error instanceof Error ? error : new Error(String(error)),
          });

          mcpLogger.error('MCP tool call failed', mcpError);
          throw mcpError;
        }
      },
      { toolName }
    );
  }

  getAvailableTools(): MCPTool[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description || `MCP tool: ${tool.name}`,
      inputSchema: this.normalizeInputSchema(tool.inputSchema),
    }));
  }

  private normalizeInputSchema(schema: unknown): JSONSchema {
    // Provide safe defaults for input schema
    const defaultSchema: JSONSchema = {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    };

    if (!schema || typeof schema !== 'object') {
      return defaultSchema;
    }

    // Type assertion is safe here due to validation above
    return {
      ...defaultSchema,
      ...(schema as JSONSchema),
    };
  }

  async disconnect(): Promise<void> {
    mcpLogger.info('Disconnecting all MCP clients', {
      clientCount: this.clients.size,
    });

    // Clear all timeouts first
    for (const timeout of this.connectionTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.connectionTimeouts.clear();

    // Disconnect all clients
    const disconnectPromises = Array.from(this.clients.entries()).map(
      async ([name, clientState]) => {
        try {
          await clientState.client.close();
          mcpLogger.info('MCP client disconnected', { clientName: name });
        } catch (error: unknown) {
          mcpLogger.error('Error disconnecting MCP client', error, { clientName: name });
        }
      }
    );

    await Promise.allSettled(disconnectPromises);

    this.clients.clear();
    this.tools.clear();

    mcpLogger.info('All MCP clients disconnected');
  }

  // Helper methods for better maintainability
  private validateClientConfig(config: MCPClientConfig, name: string): void {
    if (!config.command || config.command.trim() === '') {
      throw new MCPError('MCP client command cannot be empty', {
        clientName: name,
        operation: 'validate_config',
      });
    }
  }

  private resolveToolClient(toolName: string): { clientName: string; actualToolName: string } {
    let clientName: string | undefined;
    let actualToolName = '';

    if (toolName.includes(':')) {
      [clientName, actualToolName] = toolName.split(':', 2);
    } else {
      // Search for the tool across all clients
      for (const [key, tool] of this.tools.entries()) {
        if (tool.name === toolName) {
          [clientName, actualToolName] = key.split(':', 2);
          break;
        }
      }
    }

    if (!clientName) {
      throw new MCPError(`Tool '${toolName}' not found`, {
        toolName,
        operation: 'resolve_tool',
        availableTools: Array.from(this.tools.keys()),
      });
    }

    return { clientName, actualToolName };
  }

  private validateContentType(type: unknown): 'text' | 'image' | 'resource' {
    const validTypes = ['text', 'image', 'resource'] as const;
    return validTypes.includes(type as (typeof validTypes)[number])
      ? (type as 'text' | 'image' | 'resource')
      : 'text';
  }

  // Additional utility methods
  getClientStatus(clientName: string): MCPClientState['status'] | undefined {
    return this.clients.get(clientName)?.status;
  }

  getConnectedClients(): string[] {
    return Array.from(this.clients.entries())
      .filter(([, state]) => state.status === 'connected')
      .map(([name]) => name);
  }

  getToolsForClient(clientName: string): string[] {
    return Array.from(this.tools.keys())
      .filter(key => key.startsWith(`${clientName}:`))
      .map(key => key.split(':', 2)[1]);
  }
}
