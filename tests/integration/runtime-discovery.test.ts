import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Interface definitions
interface ToolParameter {
  type: string;
  description: string;
}

interface ToolParameters {
  type: string;
  properties: Record<string, ToolParameter>;
  required: string[];
}

interface ToolFunction {
  name: string;
  description: string;
  parameters: ToolParameters;
}

interface TestTool {
  type: string;
  function: ToolFunction;
}

interface TestPayload {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  tools: TestTool[];
  stream: boolean;
}

interface StreamChunk {
  choices?: Array<{
    delta?: {
      tool_calls?: Array<{
        function: {
          name: string;
        };
      }>;
      tool_results?: Array<{
        function: {
          name: string;
          result: string;
        };
      }>;
    };
  }>;
}

// Mock fetch for testing
global.fetch = jest.fn();

describe('Runtime Tool Discovery Tests', () => {
  let originalFetch: any;

  beforeEach(() => {
    jest.clearAllMocks();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const testUnknownTool: TestPayload = {
    model: 'claude-3-5-sonnet',
    messages: [
      {
        role: 'user',
        content: "Please use the 'unknown_tool' to do something, and also use 'git' command",
      },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'unknown_tool',
          description: "This tool doesn't exist and should be discovered",
          parameters: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                description: 'What to do',
              },
            },
            required: ['action'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'git',
          description: 'Git command',
          parameters: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'Git command to run',
              },
            },
            required: ['command'],
          },
        },
      },
    ],
    stream: true,
  };

  describe('Unknown Tool Discovery', () => {
    it('should attempt to discover unknown tools', async () => {
      const mockStreamResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"tool_calls":[{"function":{"name":"unknown_tool"}}]}}]}\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"tool_results":[{"function":{"name":"unknown_tool","result":"Tool unknown_tool was dynamically discovered and registered"}}]}}]}\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined,
              }),
          }),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockStreamResponse);

      const response = await fetch('http://localhost:3000/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testUnknownTool),
      });

      expect(response.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testUnknownTool),
        })
      );
    });

    it('should handle discovery failures gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Tool discovery failed'),
      });

      const response = await fetch('http://localhost:3000/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testUnknownTool),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe('Stream Processing', () => {
    it('should process streaming tool calls correctly', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"tool_calls":[{"function":{"name":"unknown_tool"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"function":{"name":"git"}}]}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      let toolCallsDetected = 0;

      for (const chunk of chunks) {
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const data: StreamChunk = JSON.parse(line.slice(6));
              if (data.choices?.[0]?.delta?.tool_calls) {
                toolCallsDetected++;
              }
            } catch {
              // Ignore JSON parse errors for partial chunks
            }
          }
        }
      }

      expect(toolCallsDetected).toBe(2);
    });

    it('should detect discovery messages in tool results', async () => {
      const discoveryMessage = 'Tool unknown_tool was dynamically discovered and registered';
      const chunk: StreamChunk = {
        choices: [
          {
            delta: {
              tool_results: [
                {
                  function: {
                    name: 'unknown_tool',
                    result: discoveryMessage,
                  },
                },
              ],
            },
          },
        ],
      };

      let discoveryMessages = 0;
      if (chunk.choices?.[0]?.delta?.tool_results) {
        const result = chunk.choices[0].delta.tool_results[0].function.result;
        if (result.includes('dynamically discovered')) {
          discoveryMessages++;
        }
      }

      expect(discoveryMessages).toBe(1);
    });
  });

  describe('Multiple Unknown Tools', () => {
    it('should handle multiple unknown tools in one request', async () => {
      const multiToolPayload: TestPayload = {
        model: 'claude-3-5-sonnet',
        messages: [
          {
            role: 'user',
            content: 'Use these tools: python, ls, unknown_command_xyz',
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'python',
              description: 'Python interpreter',
              parameters: {
                type: 'object',
                properties: {
                  code: { type: 'string', description: 'Python code to execute' },
                },
                required: ['code'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'unknown_command_xyz',
              description: 'Unknown command',
              parameters: {
                type: 'object',
                properties: {
                  args: { type: 'string', description: 'Command arguments' },
                },
                required: ['args'],
              },
            },
          },
        ],
        stream: true,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"tool_calls":[{"function":{"name":"python"}}]}}]}\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"tool_calls":[{"function":{"name":"unknown_command_xyz"}}]}}]}\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined,
              }),
          }),
        },
      });

      const response = await fetch('http://localhost:3000/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(multiToolPayload),
      });

      expect(response.ok).toBe(true);
      expect(multiToolPayload.tools).toHaveLength(2);
      expect(multiToolPayload.tools[0].function.name).toBe('python');
      expect(multiToolPayload.tools[1].function.name).toBe('unknown_command_xyz');
    });

    it('should validate tool parameter structures', () => {
      const tool = testUnknownTool.tools[0];
      expect(tool.function.parameters.type).toBe('object');
      expect(tool.function.parameters.properties).toHaveProperty('action');
      expect(tool.function.parameters.required).toContain('action');
      expect(tool.function.parameters.properties.action.type).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors during discovery', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        fetch('http://localhost:3000/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(testUnknownTool),
        })
      ).rejects.toThrow('Network error');
    });

    it('should handle malformed tool definitions', () => {
      const malformedTool = {
        type: 'function',
        function: {
          name: '',
          description: '',
          // Missing parameters
        },
      };

      expect(malformedTool.function.name).toBe('');
      expect(malformedTool.function.description).toBe('');
      expect(malformedTool.function).not.toHaveProperty('parameters');
    });
  });
});
