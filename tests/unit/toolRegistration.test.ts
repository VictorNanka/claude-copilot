import { claudeToolSignatures } from '../../src/claudeTools';

// Mock VS Code API
const mockVSCode = {
  lm: {
    registerTool: jest.fn(() => ({
      dispose: jest.fn(),
    })),
  },
  LanguageModelToolResult: jest.fn(),
  LanguageModelTextPart: jest.fn(),
  ExtensionContext: jest.fn(() => ({
    subscriptions: [],
  })),
};

jest.mock('vscode', () => mockVSCode);

// Import after mocking
import { registerToolDynamically, addDiscoveredTool, registerMCPTool } from '../../src/extension';

describe('Tool Registration', () => {
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext = {
      subscriptions: [],
    };
  });

  describe('Claude Code Tools', () => {
    it('should have correct number of official tools', () => {
      expect(claudeToolSignatures).toHaveLength(16);
    });

    it('should include all expected Claude Code tools', () => {
      const expectedTools = [
        'Task',
        'Bash',
        'Glob',
        'Grep',
        'LS',
        'exit_plan_mode',
        'Read',
        'Edit',
        'MultiEdit',
        'Write',
        'NotebookRead',
        'NotebookEdit',
        'WebFetch',
        'TodoRead',
        'TodoWrite',
        'WebSearch',
      ];

      const toolNames = claudeToolSignatures.map(tool => tool.name);
      expectedTools.forEach(expectedTool => {
        expect(toolNames).toContain(expectedTool);
      });
    });

    it('should have valid tool signatures', () => {
      claudeToolSignatures.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.parameters).toBe('object');
        expect(tool.parameters.type).toBe('object');
      });
    });

    it('should have required parameters for each tool', () => {
      claudeToolSignatures.forEach(tool => {
        if (tool.parameters.required && tool.parameters.required.length > 0) {
          tool.parameters.required.forEach((requiredParam: string) => {
            expect(tool.parameters.properties).toHaveProperty(requiredParam);
          });
        }
      });
    });
  });

  describe('registerToolDynamically', () => {
    it('should register existing Claude Code tool', () => {
      const result = registerToolDynamically('Read', mockContext);

      expect(result).toBe(true);
      expect(mockVSCode.lm.registerTool).toHaveBeenCalledWith(
        'Read',
        expect.objectContaining({
          invoke: expect.any(Function),
        })
      );
      expect(mockContext.subscriptions).toHaveLength(1);
    });

    it('should return false for non-existent tool', () => {
      const result = registerToolDynamically('NonExistentTool', mockContext);

      expect(result).toBe(false);
      expect(mockVSCode.lm.registerTool).not.toHaveBeenCalled();
    });

    it('should handle registration errors', () => {
      mockVSCode.lm.registerTool.mockImplementationOnce(() => {
        throw new Error('Registration failed');
      });

      const result = registerToolDynamically('Read', mockContext);

      expect(result).toBe(false);
    });

    it('should not register already registered tool', () => {
      // First registration
      registerToolDynamically('Read', mockContext);
      mockVSCode.lm.registerTool.mockClear();

      // Second registration attempt
      const result = registerToolDynamically('Read', mockContext);

      expect(result).toBe(true);
      expect(mockVSCode.lm.registerTool).not.toHaveBeenCalled();
    });
  });

  describe('addDiscoveredTool', () => {
    const mockToolSignature = {
      name: 'TestTool',
      description: 'A test tool',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string' },
        },
        required: ['input'],
      },
    };

    it('should add new tool signature', () => {
      const originalLength = claudeToolSignatures.length;

      const result = addDiscoveredTool(mockToolSignature);

      expect(result).toBe(true);
      expect(claudeToolSignatures).toHaveLength(originalLength + 1);
      expect(claudeToolSignatures[claudeToolSignatures.length - 1]).toEqual(mockToolSignature);
    });

    it('should update existing tool signature', () => {
      const existingToolName = claudeToolSignatures[0].name;
      const updatedTool = {
        ...mockToolSignature,
        name: existingToolName,
        description: 'Updated description',
      };

      const originalLength = claudeToolSignatures.length;

      const result = addDiscoveredTool(updatedTool);

      expect(result).toBe(true);
      expect(claudeToolSignatures).toHaveLength(originalLength);

      const updatedToolInArray = claudeToolSignatures.find(t => t.name === existingToolName);
      expect(updatedToolInArray?.description).toBe('Updated description');
    });

    it('should handle errors during tool addition', () => {
      const invalidTool = null as any;

      const result = addDiscoveredTool(invalidTool);

      expect(result).toBe(false);
    });
  });

  describe('registerMCPTool', () => {
    const mockToolSchema = {
      name: 'mcp:test_tool',
      description: 'MCP test tool',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string' },
        },
      },
    };

    const mockMCPCallHandler = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'MCP result' }],
    });

    beforeEach(() => {
      // Mock extension context
      (require('../../src/extension') as any).getExtensionContext = jest.fn(() => mockContext);
    });

    it('should register MCP tool successfully', () => {
      const result = registerMCPTool('mcp:test_tool', mockToolSchema, mockMCPCallHandler);

      expect(result).toBe(true);
      expect(mockVSCode.lm.registerTool).toHaveBeenCalledWith(
        'mcp:test_tool',
        expect.objectContaining({
          invoke: expect.any(Function),
        })
      );
    });

    it('should return false when extension context not available', () => {
      (require('../../src/extension') as any).getExtensionContext = jest.fn(() => undefined);

      const result = registerMCPTool('mcp:test_tool', mockToolSchema, mockMCPCallHandler);

      expect(result).toBe(false);
      expect(mockVSCode.lm.registerTool).not.toHaveBeenCalled();
    });

    it('should not register already registered MCP tool', () => {
      // First registration
      registerMCPTool('mcp:test_tool', mockToolSchema, mockMCPCallHandler);
      mockVSCode.lm.registerTool.mockClear();

      // Second registration attempt
      const result = registerMCPTool('mcp:test_tool', mockToolSchema, mockMCPCallHandler);

      expect(result).toBe(true);
      expect(mockVSCode.lm.registerTool).not.toHaveBeenCalled();
    });

    it('should handle MCP tool registration errors', () => {
      mockVSCode.lm.registerTool.mockImplementationOnce(() => {
        throw new Error('MCP registration failed');
      });

      const result = registerMCPTool('mcp:test_tool', mockToolSchema, mockMCPCallHandler);

      expect(result).toBe(false);
    });

    it('should create working MCP tool invoke function', async () => {
      registerMCPTool('mcp:test_tool', mockToolSchema, mockMCPCallHandler);

      const registerCall = mockVSCode.lm.registerTool.mock.calls[0];
      const toolConfig = registerCall?.[1];
      const invokeFunction = toolConfig?.invoke;

      const mockRequest = {
        input: { param: 'value' },
      };

      if (invokeFunction) {
        await invokeFunction(mockRequest, {});
        expect(mockMCPCallHandler).toHaveBeenCalledWith('mcp:test_tool', { param: 'value' });
      } else {
        throw new Error('Invoke function not found');
      }
    });
  });
});
