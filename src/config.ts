import * as vscode from 'vscode';
import { MCPClientConfig } from './mcp-client';

export interface Config {
  /**
   * The port number to use for the server.
   */
  port: number;

  /**
   * Start the server automatically when the extension is activated.
   */
  startAutomatically: boolean;

  /**
   * Default model to use when the requested model is not available.
   */
  defaultModel: string;

  /**
   * MCP client configurations
   */
  mcpClients: Record<string, MCPClientConfig>;

  /**
   * Default system prompt to prepend to all conversations
   */
  systemPrompt: string;

  /**
   * How to handle system prompts with VS Code LM API
   */
  systemPromptFormat: 'merge' | 'assistant_acknowledgment' | 'simple_prepend';

  /**
   * Enable intelligent system prompt processing
   */
  enableSystemPromptProcessing: boolean;
}

export function getConfig(): Config {
  const config = vscode.workspace.getConfiguration('http-lm-api');
  return {
    port: config.get<number>('port', 68686),
    startAutomatically: config.get<boolean>('startAutomatically', true),
    defaultModel: config.get<string>('defaultModel', 'gpt-4.1'),
    mcpClients: config.get<Record<string, MCPClientConfig>>('mcpClients', {}),
    systemPrompt: config.get<string>('systemPrompt', ''),
    systemPromptFormat: config.get<'merge' | 'assistant_acknowledgment' | 'simple_prepend'>('systemPromptFormat', 'merge'),
    enableSystemPromptProcessing: config.get<boolean>('enableSystemPromptProcessing', true),
  };
}
