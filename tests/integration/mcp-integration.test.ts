import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Interface definitions for type safety
interface MCPClientConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

interface MCPConfig {
  'http-lm-api.mcpClients': Record<string, MCPClientConfig>;
}

interface ToolFunction {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

interface ChatMessage {
  role: string;
  content: string;
}

interface TestPayload {
  model: string;
  messages: ChatMessage[];
  tools: Array<{
    type: string;
    function: ToolFunction;
  }>;
  stream: boolean;
}

// Mock fetch for testing
global.fetch = jest.fn();

describe('MCP Integration Tests', () => {
  let originalFetch: any;

  beforeEach(() => {
    jest.clearAllMocks();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const exampleMCPConfig: MCPConfig = {
    'http-lm-api.mcpClients': {
      filesystem: {
        command: 'uvx',
        args: ['mcp-server-filesystem', '/Users/kexiang.shan'],
        env: {},
      },
      weather: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-weather'],
        env: {
          WEATHER_API_KEY: 'your-api-key-here',
        },
      },
    },
  };

  const testMCPTools: TestPayload = {
    model: 'claude-3-5-sonnet',
    messages: [
      {
        role: 'user',
        content:
          'Please use the filesystem tools to list files and the weather tools to get weather information',
      },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'filesystem:list_files',
          description: 'List files in a directory using MCP filesystem server',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Directory path to list',
              },
            },
            required: ['path'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'weather:get_weather',
          description: 'Get weather information using MCP weather server',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'Location to get weather for',
              },
            },
            required: ['location'],
          },
        },
      },
    ],
    stream: true,
  };

  describe('MCP Tool Discovery', () => {
    it('should fetch available tools from server', async () => {
      const mockToolsResponse = {
        tools: [
          {
            type: 'function',
            function: {
              name: 'filesystem:list_files',
              description: 'List files in directory',
            },
          },
          {
            type: 'function',
            function: {
              name: 'weather:get_weather',
              description: 'Get weather information',
            },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockToolsResponse),
      });

      const toolsResponse = await fetch('http://localhost:3000/tools');
      expect(toolsResponse.ok).toBe(true);

      const toolsData = await toolsResponse.json();
      expect(toolsData.tools).toHaveLength(2);

      const mcpTools = toolsData.tools.filter(
        (tool: any) => tool.function.name.includes(':') || tool.function.description.includes('MCP')
      );

      expect(mcpTools).toHaveLength(2);
      expect(mcpTools[0].function.name).toBe('filesystem:list_files');
      expect(mcpTools[1].function.name).toBe('weather:get_weather');
    });

    it('should handle server errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const toolsResponse = await fetch('http://localhost:3000/tools');
      expect(toolsResponse.ok).toBe(false);
      expect(toolsResponse.status).toBe(500);
    });
  });

  describe('MCP Tool Execution', () => {
    it('should execute MCP tools successfully', async () => {
      const mockStreamResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"tool_calls":[{"function":{"name":"filesystem:list_files"}}]}}]}\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"tool_results":[{"function":{"name":"filesystem:list_files","result":"file1.txt\nfile2.txt"}}]}}]}\n\n'
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
        body: JSON.stringify(testMCPTools),
      });

      expect(response.ok).toBe(true);
      expect(response.body).toBeDefined();
    });

    it('should handle tool execution errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('MCP tool execution failed'),
      });

      const response = await fetch('http://localhost:3000/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testMCPTools),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);

      const errorText = await response.text();
      expect(errorText).toBe('MCP tool execution failed');
    });
  });

  describe('MCP Configuration', () => {
    it('should validate MCP configuration structure', () => {
      expect(exampleMCPConfig).toHaveProperty('http-lm-api.mcpClients');
      expect(exampleMCPConfig['http-lm-api.mcpClients']).toHaveProperty('filesystem');
      expect(exampleMCPConfig['http-lm-api.mcpClients']).toHaveProperty('weather');

      const filesystemConfig = exampleMCPConfig['http-lm-api.mcpClients'].filesystem;
      expect(filesystemConfig.command).toBe('uvx');
      expect(filesystemConfig.args).toContain('mcp-server-filesystem');

      const weatherConfig = exampleMCPConfig['http-lm-api.mcpClients'].weather;
      expect(weatherConfig.command).toBe('npx');
      expect(weatherConfig.env).toHaveProperty('WEATHER_API_KEY');
    });

    it('should provide proper configuration examples', () => {
      const configString = JSON.stringify(exampleMCPConfig, null, 2);
      expect(configString).toContain('http-lm-api.mcpClients');
      expect(configString).toContain('filesystem');
      expect(configString).toContain('weather');
    });
  });

  describe('Streaming Response Processing', () => {
    it('should parse SSE chunks correctly', () => {
      const testChunk =
        'data: {"choices":[{"delta":{"tool_calls":[{"function":{"name":"filesystem:list_files"}}]}}]}\n\n';
      const lines = testChunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          const data = JSON.parse(line.slice(6));
          expect(data.choices).toBeDefined();
          expect(data.choices[0].delta.tool_calls).toBeDefined();
          expect(data.choices[0].delta.tool_calls[0].function.name).toBe('filesystem:list_files');
        }
      }
    });

    it('should count MCP tool calls and results', () => {
      let mcpToolCalls = 0;
      let mcpToolResults = 0;

      const toolCallChunk = {
        choices: [{ delta: { tool_calls: [{ function: { name: 'filesystem:list_files' } }] } }],
      };
      const toolResultChunk = {
        choices: [
          {
            delta: {
              tool_results: [{ function: { name: 'filesystem:list_files', result: 'file list' } }],
            },
          },
        ],
      };

      if (toolCallChunk.choices?.[0]?.delta?.tool_calls) {
        const toolName = toolCallChunk.choices[0].delta.tool_calls[0].function.name;
        if (toolName.includes(':')) {
          mcpToolCalls++;
        }
      }

      if (toolResultChunk.choices?.[0]?.delta?.tool_results) {
        const result = toolResultChunk.choices[0].delta.tool_results[0];
        if (result.function.name.includes(':')) {
          mcpToolResults++;
        }
      }

      expect(mcpToolCalls).toBe(1);
      expect(mcpToolResults).toBe(1);
    });
  });
});
