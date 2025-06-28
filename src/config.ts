// Improved type safety and validation
import * as vscode from 'vscode';
import { MCPClientConfig } from './types';
import { ConfigurationError, Validator } from './utils/errors';
import { configLogger } from './utils/logging';

// Constants for better maintainability
export const defaultPort = 59603;
export const minPort = 1024;
export const maxPort = 65535;
export const defaultModel = 'gpt-4.1';

export const systemPromptFormats = ['merge', 'assistant_acknowledgment', 'simple_prepend'] as const;

export type SystemPromptFormat = (typeof systemPromptFormats)[number];

export interface Config {
  /**
   * The port number to use for the server.
   */
  readonly port: number;

  /**
   * Default model to use when the requested model is not available.
   */
  readonly defaultModel: string;

  /**
   * MCP client configurations
   */
  readonly mcpClients: Record<string, MCPClientConfig>;

  /**
   * Default system prompt to prepend to all conversations
   */
  readonly systemPrompt: string;

  /**
   * How to handle system prompts with VS Code LM API
   */
  readonly systemPromptFormat: SystemPromptFormat;

  /**
   * Enable intelligent system prompt processing
   */
  readonly enableSystemPromptProcessing: boolean;

  /**
   * Enable tool calling support
   */
  readonly enableToolCalling: boolean;

  /**
   * Start server automatically
   */
  readonly startServerAutomatically: boolean;
}

function validateSystemPromptFormat(format: string): SystemPromptFormat {
  try {
    return Validator.requireEnum(format, systemPromptFormats, 'systemPromptFormat');
  } catch {
    configLogger.warn('Invalid system prompt format, using default', {
      invalidValue: format,
      defaultValue: 'merge',
    });
    return 'merge';
  }
}

function validatePort(port: number): number {
  try {
    Validator.requireNumber(port, 'port');
    if (!isValidPort(port)) {
      throw new ConfigurationError('Port out of valid range', {
        setting: 'port',
        value: port,
        validValues: [`${minPort}-${maxPort}`],
      });
    }
    return port;
  } catch {
    configLogger.warn('Invalid port configuration, using default', {
      invalidValue: port,
      defaultValue: defaultPort,
    });
    return defaultPort;
  }
}

function validateMCPClients(clients: unknown): Record<string, MCPClientConfig> {
  if (!clients || typeof clients !== 'object') {
    configLogger.warn('Invalid MCP clients configuration, using empty object');
    return {};
  }

  // Type assertion is safe here as we've validated the structure
  return clients as Record<string, MCPClientConfig>;
}

export function getConfig(): Config {
  configLogger.debug('Loading configuration from VS Code settings');

  try {
    const config = vscode.workspace.getConfiguration('http-lm-api');

    // Validate and sanitize all configuration values with detailed logging
    const systemPromptFormat = validateSystemPromptFormat(
      config.get<string>('systemPromptFormat', 'merge')
    );
    const port = validatePort(config.get<number>('port', defaultPort));
    const mcpClients = validateMCPClients(config.get('mcpClients', {}));

    const finalConfig = {
      port,
      defaultModel: config.get<string>('defaultModel', defaultModel),
      mcpClients,
      systemPrompt: config.get<string>('systemPrompt', ''),
      systemPromptFormat,
      enableSystemPromptProcessing: config.get<boolean>('enableSystemPromptProcessing', true),
      enableToolCalling: config.get<boolean>('enableToolCalling', true),
      startServerAutomatically: config.get<boolean>('startServerAutomatically', true),
    } as const;

    configLogger.info('Configuration loaded successfully', {
      port: finalConfig.port,
      defaultModel: finalConfig.defaultModel,
      systemPromptFormat: finalConfig.systemPromptFormat,
      mcpClientCount: Object.keys(finalConfig.mcpClients).length,
    });

    return finalConfig;
  } catch (error) {
    configLogger.error('Failed to load configuration', error);
    throw new ConfigurationError('Configuration loading failed', {
      originalError: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

/**
 * Validates if a port number is valid
 * @param port The port number to validate
 * @returns true if the port is valid, false otherwise
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= minPort && port <= maxPort;
}

/**
 * Gets a list of common ports that might be in use and should be avoided
 * @returns Array of port numbers that are commonly used
 */
export function getCommonPorts(): number[] {
  return [
    3000,
    3001,
    3002,
    3003, // Common dev servers
    4200,
    4201, // Angular dev server
    5000,
    5001,
    5002, // Various frameworks
    8000,
    8001,
    8080,
    8081,
    8888, // HTTP servers
    9000,
    9001,
    9002, // Various tools
  ];
}

/**
 * Suggests alternative ports if the current one is problematic
 * @param currentPort The current port number
 * @returns Array of suggested alternative ports
 */
const safeDefaultPorts = [defaultPort, 59604, 59605, 58000, 58001, 57000, 57001] as const;
const maxSuggestions = 5;
const portSearchRange = 10;

export function suggestAlternativePorts(currentPort: number): number[] {
  const suggestions: number[] = [];
  const commonPorts = getCommonPorts();

  // Helper function to check if port is usable
  const isUsablePort = (port: number): boolean => isValidPort(port) && !commonPorts.includes(port);

  // Start with ports near the current one
  for (let i = 1; i <= portSearchRange; i++) {
    const candidate = currentPort + i;
    if (isUsablePort(candidate)) {
      suggestions.push(candidate);
    }
  }

  // Add safe default ports that aren't already included
  for (const port of safeDefaultPorts) {
    if (!suggestions.includes(port) && isUsablePort(port)) {
      suggestions.push(port);
    }
  }

  return suggestions.slice(0, maxSuggestions);
}
