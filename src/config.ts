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

  // Validate port number
  let port = config.get<number>('port', 59603);
  if (!isValidPort(port)) {
    // Use default port for invalid ports
    port = 59603;
  }

  return {
    port,
    defaultModel: config.get<string>('defaultModel', 'gpt-4.1'),
    mcpClients: config.get<Record<string, MCPClientConfig>>('mcpClients', {}),
    systemPrompt: config.get<string>('systemPrompt', ''),
    systemPromptFormat: validatedFormat,
    enableSystemPromptProcessing: config.get<boolean>('enableSystemPromptProcessing', true),
    enableToolCalling: config.get<boolean>('enableToolCalling', true),
    startServerAutomatically: config.get<boolean>('startServerAutomatically', true),
  };
}

/**
 * Validates if a port number is valid
 * @param port The port number to validate
 * @returns true if the port is valid, false otherwise
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1024 && port <= 65535;
}

/**
 * Gets a list of common ports that might be in use and should be avoided
 * @returns Array of port numbers that are commonly used
 */
export function getCommonPorts(): number[] {
  return [
    3000, 3001, 3002, 3003, // Common dev servers
    4200, 4201, // Angular dev server
    5000, 5001, 5002, // Various frameworks
    8000, 8001, 8080, 8081, 8888, // HTTP servers
    9000, 9001, 9002, // Various tools
  ];
}

/**
 * Suggests alternative ports if the current one is problematic
 * @param currentPort The current port number
 * @returns Array of suggested alternative ports
 */
export function suggestAlternativePorts(currentPort: number): number[] {
  const suggestions = [];
  const commonPorts = getCommonPorts();

  // Start with ports near the current one
  for (let i = 1; i <= 10; i++) {
    const candidate = currentPort + i;
    if (isValidPort(candidate) && !commonPorts.includes(candidate)) {
      suggestions.push(candidate);
    }
  }

  // Add some safe default ports
  const safeDefaults = [59603, 59604, 59605, 58000, 58001, 57000, 57001];
  for (const port of safeDefaults) {
    if (!suggestions.includes(port) && !commonPorts.includes(port)) {
      suggestions.push(port);
    }
  }

  return suggestions.slice(0, 5); // Return top 5 suggestions
}
