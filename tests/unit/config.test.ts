import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the logging utilities first
vi.mock('../../src/utils/logging', () => ({
  configLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(),
  },
}));

import { getConfig } from '../../src/config';

import * as vscode from 'vscode';
const mockGetConfiguration = vscode.workspace.getConfiguration as ReturnType<typeof vi.fn>;

describe('Config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return default configuration when no settings provided', () => {
      mockGetConfiguration.mockReturnValue({
        get: vi.fn().mockImplementation((key: string) => {
          const defaults: any = {
            port: 59603,
            startServerAutomatically: true,
            defaultModel: 'gpt-4.1',
            mcpClients: {},
            systemPrompt: '',
            systemPromptFormat: 'merge',
            enableSystemPromptProcessing: true,
          };
          return defaults[key];
        }),
      });

      const config = getConfig();

      expect(config.port).toBe(59603);
      expect(config.startServerAutomatically).toBe(true);
      expect(config.defaultModel).toBe('gpt-4.1');
      expect(config.systemPromptFormat).toBe('merge');
      expect(config.enableSystemPromptProcessing).toBe(true);
    });

    it('should return custom configuration when settings provided', () => {
      mockGetConfiguration.mockReturnValue({
        get: vi.fn().mockImplementation((key: string) => {
          const custom: any = {
            port: 8080,
            startServerAutomatically: false,
            defaultModel: 'claude-3.5-sonnet',
            systemPrompt: 'You are a helpful assistant',
            systemPromptFormat: 'assistant_acknowledgment',
            enableSystemPromptProcessing: false,
          };
          return custom[key];
        }),
      });

      const config = getConfig();

      expect(config.port).toBe(8080);
      expect(config.startServerAutomatically).toBe(false);
      expect(config.defaultModel).toBe('claude-3.5-sonnet');
      expect(config.systemPrompt).toBe('You are a helpful assistant');
      expect(config.systemPromptFormat).toBe('assistant_acknowledgment');
      expect(config.enableSystemPromptProcessing).toBe(false);
    });

    it('should handle MCP client configuration', () => {
      const mcpClients = {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/path'],
          env: { VAR: 'value' },
        },
      };

      mockGetConfiguration.mockReturnValue({
        get: vi.fn().mockImplementation((key: string) => {
          if (key === 'mcpClients') {
            return mcpClients;
          }
          return undefined;
        }),
      });

      const config = getConfig();

      expect(config.mcpClients).toEqual(mcpClients);
    });

    it('should validate system prompt format', () => {
      mockGetConfiguration.mockReturnValue({
        get: vi.fn().mockImplementation((key: string) => {
          if (key === 'systemPromptFormat') {
            return 'invalid_format';
          }
          return undefined;
        }),
      });

      const config = getConfig();

      // Should fallback to default when invalid format provided
      expect(config.systemPromptFormat).toBe('merge');
    });
  });
});
