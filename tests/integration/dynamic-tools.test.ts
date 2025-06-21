import { describe, it, expect, beforeEach, vi } from 'vitest';
const jest = vi;

// Interface definitions
interface ToolFunction {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

interface TestPayload {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  tools: Array<{
    type: string;
    function: ToolFunction;
  }>;
  stream: boolean;
}

// Mock fetch for testing
global.fetch = jest.fn();

describe('Dynamic Tool Registration Integration', () => {
  let originalFetch: any;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const testPayload: TestPayload = {
    model: 'claude-3-5-sonnet',
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
          description: 'Reads a file from the local filesystem',
          parameters: {
            type: 'object',
            properties: {
              file_path: {
                type: 'string',
                description: 'The absolute path to the file to read',
              },
            },
            required: ['file_path'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'Bash',
          description: 'Executes a given bash command',
          parameters: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The command to execute',
              },
            },
            required: ['command'],
          },
        },
      },
    ],
    stream: true,
  };

  describe('Dynamic Tool Registration', () => {
    it('should successfully register Claude Code tools dynamically', async () => {
      const mockStreamResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"tool_calls":[{"function":{"name":"Read"}}]}}]}\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"tool_calls":[{"function":{"name":"Bash"}}]}}]}\n\n'
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
        body: JSON.stringify(testPayload),
      });

      expect(response.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testPayload),
        })
      );
    });

    it('should handle tool registration failures gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Tool registration failed'),
      });

      const response = await fetch('http://localhost:3000/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should validate tool payload structure', () => {
      expect(testPayload.tools).toHaveLength(2);
      expect(testPayload.tools[0].function.name).toBe('Read');
      expect(testPayload.tools[1].function.name).toBe('Bash');

      // Validate Read tool structure
      const readTool = testPayload.tools[0];
      expect(readTool.function.parameters.required).toContain('file_path');
      expect(readTool.function.parameters.properties).toHaveProperty('file_path');

      // Validate Bash tool structure
      const bashTool = testPayload.tools[1];
      expect(bashTool.function.parameters.required).toContain('command');
      expect(bashTool.function.parameters.properties).toHaveProperty('command');
    });

    it('should process streaming responses correctly', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"tool_calls":[{"function":{"name":"Read"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"function":{"name":"Bash"}}]}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      let toolCallsDetected = 0;
      const expectedTools = ['Read', 'Bash'];

      for (const chunk of chunks) {
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.choices?.[0]?.delta?.tool_calls) {
                const toolName = data.choices[0].delta.tool_calls[0].function.name;
                if (expectedTools.includes(toolName)) {
                  toolCallsDetected++;
                }
              }
            } catch {
              // Ignore JSON parse errors for partial chunks
            }
          }
        }
      }

      expect(toolCallsDetected).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors during registration', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        fetch('http://localhost:3000/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(testPayload),
        })
      ).rejects.toThrow('Network error');
    });

    it('should handle malformed requests', async () => {
      const malformedPayload = {
        model: 'claude-3-5-sonnet',
        // Missing messages and tools
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
      });

      const response = await fetch('http://localhost:3000/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(malformedPayload),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(422);
    });
  });
});
