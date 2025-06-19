import { getConfig } from '../../src/config';

// Mock VS Code workspace
const mockWorkspace = {
  getConfiguration: jest.fn(),
};

jest.mock('vscode', () => ({
  workspace: mockWorkspace,
}));

describe('Config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return default configuration when no settings provided', () => {
      mockWorkspace.getConfiguration.mockReturnValue({
        get: jest.fn().mockImplementation((key: string) => {
          const defaults: any = {
            port: 68686,
            startAutomatically: true,
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

      expect(config.port).toBe(68686);
      expect(config.startAutomatically).toBe(true);
      expect(config.defaultModel).toBe('gpt-4.1');
      expect(config.systemPromptFormat).toBe('merge');
      expect(config.enableSystemPromptProcessing).toBe(true);
    });

    it('should return custom configuration when settings provided', () => {
      mockWorkspace.getConfiguration.mockReturnValue({
        get: jest.fn().mockImplementation((key: string) => {
          const custom: any = {
            port: 8080,
            startAutomatically: false,
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
      expect(config.startAutomatically).toBe(false);
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

      mockWorkspace.getConfiguration.mockReturnValue({
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'mcpClients') {return mcpClients;}
          return undefined;
        }),
      });

      const config = getConfig();

      expect(config.mcpClients).toEqual(mcpClients);
    });

    it('should validate system prompt format', () => {
      mockWorkspace.getConfiguration.mockReturnValue({
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'systemPromptFormat') {return 'invalid_format';}
          return undefined;
        }),
      });

      const config = getConfig();

      // Should fallback to default when invalid format provided
      expect(config.systemPromptFormat).toBe('merge');
    });
  });
});
