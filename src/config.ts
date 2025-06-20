// @ts-nocheck
import * as vscode from 'vscode';
import { MCPClientConfig } from './types';

export interface Config {
  /**
   * The port number to use for the server.
   */
  port: number;

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

  /**
   * Enable tool calling support
   */
  enableToolCalling: boolean;

  /**
   * Start server automatically
   */
  startServerAutomatically: boolean;
}

export function getConfig(): Config {
  const config = vscode.workspace.getConfiguration('http-lm-api');

  // Validate system prompt format
  const systemPromptFormat = config.get<string>('systemPromptFormat', 'merge');
  const validFormats = ['merge', 'assistant_acknowledgment', 'simple_prepend'];
  const validatedFormat = validFormats.includes(systemPromptFormat)
    ? (systemPromptFormat as 'merge' | 'assistant_acknowledgment' | 'simple_prepend')
    : 'merge';

  return {
    port: config.get<number>('port', 59603),
    defaultModel: config.get<string>('defaultModel', 'gpt-4.1'),
    mcpClients: config.get<Record<string, MCPClientConfig>>('mcpClients', {}),
    systemPrompt: config.get<string>('systemPrompt', ''),
    systemPromptFormat: validatedFormat,
    enableSystemPromptProcessing: config.get<boolean>('enableSystemPromptProcessing', true),
    enableToolCalling: config.get<boolean>('enableToolCalling', true),
    startServerAutomatically: config.get<boolean>('startServerAutomatically', true),
  };
}
