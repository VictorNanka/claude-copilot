import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from './logger';
import { MCPClientConfig, MCPTool, MCPCallResult, JSONSchema } from './types';

// Type for MCP SDK response format
interface MCPListToolsResponse {
  tools: Tool[];
}

interface MCPRequest {
  method: string;
  params?: Record<string, unknown>;
}

export class MCPManager {
  private clients: Map<string, Client> = new Map();
  private tools: Map<string, Tool> = new Map();

  async addClient(name: string, config: MCPClientConfig): Promise<void> {
    try {
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

      await client.connect(transport);
      this.clients.set(name, client);

      // Load tools from this client
      await this.loadToolsFromClient(name, client);

      logger.info(`MCP client '${name}' connected successfully`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to connect MCP client '${name}': ${errorMessage}`);
      throw error;
    }
  }

  private async loadToolsFromClient(clientName: string, client: Client): Promise<void> {
    try {
      const request: MCPRequest = { method: 'tools/list' };
      const response = (await client.request(
        request as ListToolsRequest,
        z.object({})
      )) as MCPListToolsResponse;

      if (response.tools && Array.isArray(response.tools)) {
        for (const tool of response.tools) {
          const toolKey = `${clientName}:${tool.name}`;
          this.tools.set(toolKey, tool);
          logger.debug(`Loaded tool: ${toolKey}`);
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load tools from client '${clientName}': ${errorMessage}`);
    }
  }

  async callTool(toolName: string, parameters: Record<string, unknown>): Promise<MCPCallResult> {
    // Find which client has this tool
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
      throw new Error(`Tool '${toolName}' not found`);
    }

    const client = this.clients.get(clientName);
    if (!client) {
      throw new Error(`MCP client '${clientName}' not found`);
    }

    try {
      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: actualToolName,
          arguments: parameters,
        },
      };
      const result = (await client.request(
        request as CallToolRequest,
        z.object({})
      )) as CallToolResult;

      logger.debug(`Tool call result for '${toolName}':`, result);

      // Convert to our MCPCallResult format
      const mcpResult: MCPCallResult = {
        content: (result.content || []).map(item => ({
          type: (item.type || 'text') as 'text' | 'image' | 'resource',
          text: typeof item.text === 'string' ? item.text : undefined,
          data: typeof item.data === 'string' ? item.data : undefined,
          mimeType: typeof item.mimeType === 'string' ? item.mimeType : undefined,
        })),
        isError: result.isError || false,
      };

      return mcpResult;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Tool call failed for '${toolName}': ${errorMessage}`);
      throw error;
    }
  }

  getAvailableTools(): MCPTool[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description || `MCP tool: ${tool.name}`,
      inputSchema: {
        type: (tool.inputSchema?.type || 'object') as string,
        properties: {},
        required: tool.inputSchema?.required || [],
        ...tool.inputSchema,
      } as JSONSchema, // Type assertion needed due to MCP SDK compatibility
    }));
  }

  async disconnect(): Promise<void> {
    for (const [name, client] of this.clients.entries()) {
      try {
        await client.close();
        logger.info(`MCP client '${name}' disconnected`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error disconnecting MCP client '${name}': ${errorMessage}`);
      }
    }
    this.clients.clear();
    this.tools.clear();
  }
}
