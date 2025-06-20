import { claudeToolSignatures } from '../../src/claudeTools';

// Mock fetch for HTTP testing
global.fetch = jest.fn();

describe('Tool Workflows Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Claude Code Tool Discovery', () => {
    it('should extract tool names from request payload', () => {
      const payload = {
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: 'Please use the Read tool to read a file and the Bash tool to run a command',
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'Read',
              description: 'Reads a file',
              parameters: { type: 'object' },
            },
          },
          {
            type: 'function',
            function: {
              name: 'Bash',
              description: 'Executes bash commands',
              parameters: { type: 'object' },
            },
          },
        ],
      };

      // Simulate the tool name extraction logic
      const extractToolNamesFromRequest = (body: any): string[] => {
        const toolNames: string[] = [];

        if (body.tools && Array.isArray(body.tools)) {
          for (const tool of body.tools) {
            if (tool.function?.name) {
              toolNames.push(tool.function.name);
            }
          }
        }

        if (body.messages && Array.isArray(body.messages)) {
          for (const message of body.messages) {
            if (typeof message.content === 'string') {
              for (const toolSig of claudeToolSignatures) {
                if (message.content.toLowerCase().includes(toolSig.name.toLowerCase())) {
                  toolNames.push(toolSig.name);
                }
              }
            }
          }
        }

        return [...new Set(toolNames)];
      };

      const extractedTools = extractToolNamesFromRequest(payload);

      expect(extractedTools).toContain('Read');
      expect(extractedTools).toContain('Bash');
      expect(extractedTools).toHaveLength(2);
    });

    it('should handle tool discovery from message content', () => {
      const payload = {
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: 'Use the Glob tool to find files and Edit tool to modify them',
          },
        ],
      };

      const extractToolNamesFromRequest = (body: any): string[] => {
        const toolNames: string[] = [];

        if (body.messages && Array.isArray(body.messages)) {
          for (const message of body.messages) {
            if (typeof message.content === 'string') {
              for (const toolSig of claudeToolSignatures) {
                if (message.content.toLowerCase().includes(toolSig.name.toLowerCase())) {
                  toolNames.push(toolSig.name);
                }
              }
            }
          }
        }

        return [...new Set(toolNames)];
      };

      const extractedTools = extractToolNamesFromRequest(payload);

      expect(extractedTools).toContain('Glob');
      expect(extractedTools).toContain('Edit');
    });

    it('should handle mixed tool specification methods', () => {
      const payload = {
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: 'Use the WebSearch tool to find information',
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'TodoWrite',
              description: 'Write todos',
              parameters: { type: 'object' },
            },
          },
        ],
      };

      const extractToolNamesFromRequest = (body: any): string[] => {
        const toolNames: string[] = [];

        if (body.tools && Array.isArray(body.tools)) {
          for (const tool of body.tools) {
            if (tool.function?.name) {
              toolNames.push(tool.function.name);
            }
          }
        }

        if (body.messages && Array.isArray(body.messages)) {
          for (const message of body.messages) {
            if (typeof message.content === 'string') {
              for (const toolSig of claudeToolSignatures) {
                if (message.content.toLowerCase().includes(toolSig.name.toLowerCase())) {
                  toolNames.push(toolSig.name);
                }
              }
            }
          }
        }

        return [...new Set(toolNames)];
      };

      const extractedTools = extractToolNamesFromRequest(payload);

      expect(extractedTools).toContain('WebSearch');
      expect(extractedTools).toContain('TodoWrite');
      expect(extractedTools).toHaveLength(2);
    });
  });

  describe('Tool Registration Workflow', () => {
    it('should simulate tool registration process', async () => {
      const mockContext = {
        subscriptions: [],
      };

      const mockVSCode = {
        lm: {
          registerTool: jest.fn(() => ({
            dispose: jest.fn(),
          })),
        },
        LanguageModelToolResult: jest.fn(),
        LanguageModelTextPart: jest.fn(),
      };

      // Simulate the tool registration workflow
      const simulateToolRegistration = (toolNames: string[], context: any) => {
        const registeredTools: string[] = [];
        const failedTools: string[] = [];

        for (const toolName of toolNames) {
          try {
            const toolSig = claudeToolSignatures.find(t => t.name === toolName);
            if (toolSig) {
              mockVSCode.lm.registerTool(toolName, {
                invoke: jest.fn(),
              });
              context.subscriptions.push({ dispose: jest.fn() });
              registeredTools.push(toolName);
            } else {
              failedTools.push(toolName);
            }
          } catch {
            failedTools.push(toolName);
          }
        }

        return { registeredTools, failedTools };
      };

      const toolsToRegister = ['Read', 'Write', 'Bash', 'NonExistentTool'];
      const result = simulateToolRegistration(toolsToRegister, mockContext);

      expect(result.registeredTools).toContain('Read');
      expect(result.registeredTools).toContain('Write');
      expect(result.registeredTools).toContain('Bash');
      expect(result.failedTools).toContain('NonExistentTool');
      expect(mockVSCode.lm.registerTool).toHaveBeenCalledTimes(3);
    });

    it('should handle duplicate tool registration attempts', () => {
      const mockRegistry = new Set<string>();

      const simulateRegistrationWithDeduplication = (toolNames: string[]) => {
        const newRegistrations: string[] = [];
        const skippedDuplicates: string[] = [];

        for (const toolName of toolNames) {
          if (mockRegistry.has(toolName)) {
            skippedDuplicates.push(toolName);
          } else {
            mockRegistry.add(toolName);
            newRegistrations.push(toolName);
          }
        }

        return { newRegistrations, skippedDuplicates };
      };

      // First registration attempt
      const firstAttempt = simulateRegistrationWithDeduplication(['Read', 'Write', 'Bash']);
      expect(firstAttempt.newRegistrations).toHaveLength(3);
      expect(firstAttempt.skippedDuplicates).toHaveLength(0);

      // Second registration attempt with overlapping tools
      const secondAttempt = simulateRegistrationWithDeduplication(['Read', 'Edit', 'Bash']);
      expect(secondAttempt.newRegistrations).toContain('Edit');
      expect(secondAttempt.skippedDuplicates).toContain('Read');
      expect(secondAttempt.skippedDuplicates).toContain('Bash');
    });
  });

  describe('Tool Execution Simulation', () => {
    it('should simulate tool invocation workflow', async () => {
      const mockToolResults: Record<string, any> = {
        Read: { content: [{ type: 'text', text: 'File contents here' }] },
        Bash: { content: [{ type: 'text', text: 'Command executed successfully' }] },
        Write: { content: [{ type: 'text', text: 'File written successfully' }] },
      };

      const simulateToolInvocation = async (toolName: string, params: any) => {
        // Simulate delay for tool execution
        await new Promise(resolve => setTimeout(resolve, 10));
        // Use params to avoid unused parameter warning
        console.log(`Simulating ${toolName} with params:`, params);

        if (mockToolResults[toolName]) {
          return mockToolResults[toolName];
        } else {
          throw new Error(`Tool ${toolName} not found`);
        }
      };

      // Test successful tool invocations
      const readResult = await simulateToolInvocation('Read', { file_path: '/test/file.txt' });
      expect(readResult.content[0].text).toBe('File contents here');

      const bashResult = await simulateToolInvocation('Bash', { command: 'ls -la' });
      expect(bashResult.content[0].text).toBe('Command executed successfully');

      // Test failed tool invocation
      await expect(simulateToolInvocation('UnknownTool', {})).rejects.toThrow(
        'Tool UnknownTool not found'
      );
    });

    it('should handle tool execution errors gracefully', async () => {
      const simulateToolInvocationWithErrors = async (toolName: string, params: any) => {
        // Use params to avoid unused parameter warning
        console.log(`Simulating ${toolName} with params:`, params);
        const errorProbability = 0.3; // 30% chance of error

        if (Math.random() < errorProbability) {
          throw new Error(`Tool ${toolName} execution failed`);
        }

        return { content: [{ type: 'text', text: `${toolName} executed successfully` }] };
      };

      // Mock Math.random to control error simulation
      const originalRandom = Math.random;
      Math.random = jest.fn();

      // Force success
      (Math.random as jest.Mock).mockReturnValue(0.5);
      const successResult = await simulateToolInvocationWithErrors('Read', {});
      expect(successResult.content[0].text).toBe('Read executed successfully');

      // Force error
      (Math.random as jest.Mock).mockReturnValue(0.1);
      await expect(simulateToolInvocationWithErrors('Read', {})).rejects.toThrow(
        'Tool Read execution failed'
      );

      // Restore original Math.random
      Math.random = originalRandom;
    });
  });

  describe('Streaming Response Workflow', () => {
    it('should simulate streaming response with tool calls', async () => {
      const mockStreamChunks = [
        { type: 'text', content: 'I will help you read the file.' },
        { type: 'tool_call', name: 'Read', callId: 'call_1', input: { file_path: '/test.txt' } },
        { type: 'tool_result', callId: 'call_1', content: 'File contents: Hello World' },
        { type: 'text', content: 'The file contains: Hello World' },
      ];

      const simulateStreamProcessing = async (chunks: any[]) => {
        const results: any[] = [];

        for (const chunk of chunks) {
          switch (chunk.type) {
            case 'text':
              results.push({ type: 'text', data: chunk.content });
              break;
            case 'tool_call':
              results.push({
                type: 'tool_call',
                name: chunk.name,
                callId: chunk.callId,
                input: chunk.input,
              });
              break;
            case 'tool_result':
              results.push({
                type: 'tool_result',
                callId: chunk.callId,
                result: chunk.content,
              });
              break;
          }

          // Simulate processing delay
          await new Promise(resolve => setTimeout(resolve, 5));
        }

        return results;
      };

      const results = await simulateStreamProcessing(mockStreamChunks);

      expect(results).toHaveLength(4);
      expect(results[0]).toMatchObject({ type: 'text', data: 'I will help you read the file.' });
      expect(results[1]).toMatchObject({
        type: 'tool_call',
        name: 'Read',
        callId: 'call_1',
      });
      expect(results[2]).toMatchObject({
        type: 'tool_result',
        callId: 'call_1',
        result: 'File contents: Hello World',
      });
      expect(results[3]).toMatchObject({ type: 'text', data: 'The file contains: Hello World' });
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should simulate retry mechanism for failed tool discovery', async () => {
      const maxRetries = 2;
      let discoveryAttempts = 0;

      const simulateToolDiscovery = async (toolName: string): Promise<any> => {
        discoveryAttempts++;

        if (discoveryAttempts <= maxRetries) {
          throw new Error('Tool discovery failed');
        }

        return {
          name: toolName,
          description: `Dynamically discovered ${toolName}`,
          parameters: { type: 'object', properties: {} },
        };
      };

      const simulateRetryMechanism = async (toolName: string) => {
        let retries = 0;

        while (retries <= maxRetries) {
          try {
            const result = await simulateToolDiscovery(toolName);
            return { success: true, result, retries };
          } catch (error) {
            retries++;
            if (retries > maxRetries) {
              return { success: false, error: error.message, retries };
            }
          }
        }
      };

      const result = await simulateRetryMechanism('CustomTool');

      expect(result.success).toBe(true);
      expect(result.retries).toBe(2); // Failed twice, succeeded on third attempt (2 retries)
      expect(result.result).toMatchObject({
        name: 'CustomTool',
        description: 'Dynamically discovered CustomTool',
      });
    });

    it('should handle maximum retry limit exceeded', async () => {
      const maxRetries = 1;
      let attempts = 0;

      const simulateAlwaysFailingDiscovery = async (): Promise<any> => {
        attempts++;
        throw new Error('Discovery always fails');
      };

      const simulateRetryWithLimit = async () => {
        let retries = 0;

        while (retries <= maxRetries) {
          try {
            return await simulateAlwaysFailingDiscovery();
          } catch (error) {
            retries++;
            if (retries > maxRetries) {
              return { success: false, error: error.message, totalAttempts: attempts };
            }
          }
        }
      };

      const result = await simulateRetryWithLimit();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Discovery always fails');
      expect(result.totalAttempts).toBe(2); // Initial attempt + 1 retry
    });
  });
});
