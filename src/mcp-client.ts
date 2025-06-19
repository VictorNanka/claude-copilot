import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolRequest, CallToolResult, ListToolsRequest, Tool } from '@modelcontextprotocol/sdk/types.js';
import { logger } from './logger';

export interface MCPClientConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
}

export class MCPManager {
    private clients: Map<string, Client> = new Map();
    private tools: Map<string, Tool> = new Map();

    async addClient(name: string, config: MCPClientConfig): Promise<void> {
        try {
            const transport = new StdioClientTransport({
                command: config.command,
                args: config.args || [],
                env: config.env
            });

            const client = new Client({
                name: `vscode-http-lm-api-${name}`,
                version: '1.0.0'
            }, {
                capabilities: {
                    tools: {}
                }
            });

            await client.connect(transport);
            this.clients.set(name, client);

            // Load tools from this client
            await this.loadToolsFromClient(name, client);
            
            logger.info(`MCP client '${name}' connected successfully`);
        } catch (error) {
            logger.error(`Failed to connect MCP client '${name}':`, error);
            throw error;
        }
    }

    private async loadToolsFromClient(clientName: string, client: Client): Promise<void> {
        try {
            const response = await client.request(
                { method: 'tools/list' } as ListToolsRequest,
                {} as any
            ) as any;

            if (response.tools) {
                for (const tool of response.tools) {
                    const toolKey = `${clientName}:${tool.name}`;
                    this.tools.set(toolKey, tool);
                    logger.debug(`Loaded tool: ${toolKey}`);
                }
            }
        } catch (error) {
            logger.error(`Failed to load tools from client '${clientName}':`, error);
        }
    }

    async callTool(toolName: string, parameters: any): Promise<CallToolResult> {
        // Find which client has this tool
        let clientName: string | undefined;
        let actualToolName: string = '';

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
            const result = await client.request(
                {
                    method: 'tools/call',
                    params: {
                        name: actualToolName,
                        arguments: parameters
                    }
                } as CallToolRequest,
                {} as any
            ) as CallToolResult;

            logger.debug(`Tool call result for '${toolName}':`, result);
            return result;
        } catch (error) {
            logger.error(`Tool call failed for '${toolName}':`, error);
            throw error;
        }
    }

    getAvailableTools(): Tool[] {
        return Array.from(this.tools.values());
    }

    async disconnect(): Promise<void> {
        for (const [name, client] of this.clients.entries()) {
            try {
                await client.close();
                logger.info(`MCP client '${name}' disconnected`);
            } catch (error) {
                logger.error(`Error disconnecting MCP client '${name}':`, error);
            }
        }
        this.clients.clear();
        this.tools.clear();
    }
}