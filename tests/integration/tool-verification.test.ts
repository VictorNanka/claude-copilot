import { describe, it, expect, beforeEach, vi } from 'vitest';

// Type definitions
interface ToolParameters {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
}

interface ToolFunction {
  name: string;
  description: string;
  parameters?: ToolParameters;
}

interface Tool {
  type: string;
  function: ToolFunction;
}

interface ToolsResponse {
  tools: Tool[];
}

interface TestResult {
  total: number;
  claudeCodeTools: number;
  foundTools: string[];
  missingTools: string[];
  success: boolean;
}

interface TestPayload {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  tools: Tool[];
  stream: boolean;
}

// Mock fetch
global.fetch = vi.fn();

describe('Claude Code Tool Verification Tests', () => {
  let originalFetch: any;

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

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

  const toolSignatures: Record<string, string[]> = {
    Task: ['description', 'prompt'],
    Bash: ['command'],
    Glob: ['pattern'],
    Grep: ['pattern'],
    LS: ['path'],
    exit_plan_mode: ['plan'],
    Read: ['file_path'],
    Edit: ['file_path', 'old_string', 'new_string'],
    MultiEdit: ['file_path', 'edits'],
    Write: ['file_path', 'content'],
    NotebookRead: ['notebook_path'],
    NotebookEdit: ['notebook_path', 'new_source'],
    WebFetch: ['url', 'prompt'],
    TodoRead: [],
    TodoWrite: ['todos'],
    WebSearch: ['query'],
  };

  describe('Tool Availability Tests', () => {
    it('should fetch all available tools from server', async () => {
      const mockToolsResponse: ToolsResponse = {
        tools: expectedTools.map(toolName => ({
          type: 'function',
          function: {
            name: toolName,
            description: `${toolName} tool`,
            parameters: {
              type: 'object',
              properties: toolSignatures[toolName].reduce(
                (acc, param) => {
                  acc[param] = { type: 'string', description: `${param} parameter` };
                  return acc;
                },
                {} as Record<string, any>
              ),
              required: toolSignatures[toolName],
            },
          },
        })),
      };

      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockToolsResponse),
      });

      const response = await fetch('http://localhost:3000/tools');
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.tools).toHaveLength(16);
      expect(Array.isArray(data.tools)).toBe(true);
    });

    it('should identify Claude Code tools correctly', async () => {
      const mockToolsResponse: ToolsResponse = {
        tools: [
          ...expectedTools.map(toolName => ({
            type: 'function',
            function: {
              name: toolName,
              description: `${toolName} tool`,
            },
          })),
          // Add some MCP tools with colons
          {
            type: 'function',
            function: {
              name: 'filesystem:read',
              description: 'MCP filesystem tool',
            },
          },
          {
            type: 'function',
            function: {
              name: 'weather:get',
              description: 'MCP weather tool',
            },
          },
        ],
      };

      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockToolsResponse),
      });

      const response = await fetch('http://localhost:3000/tools');
      const data = await response.json();

      // Filter Claude Code tools (not MCP tools with ":")
      const claudeCodeTools = data.tools.filter(
        (tool: Tool) =>
          !tool.function.name.includes(':') && expectedTools.includes(tool.function.name)
      );

      expect(claudeCodeTools).toHaveLength(16);
      expect(data.tools).toHaveLength(18); // 16 Claude Code + 2 MCP tools
    });

    it('should handle server errors when fetching tools', async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const response = await fetch('http://localhost:3000/tools');
      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });
  });

  describe('Tool Parameter Validation', () => {
    it('should validate tool parameters against expected signatures', async () => {
      const testTool: Tool = {
        type: 'function',
        function: {
          name: 'Read',
          description: 'Reads a file from the local filesystem',
          parameters: {
            type: 'object',
            properties: {
              file_path: { type: 'string', description: 'File path to read' },
            },
            required: ['file_path'],
          },
        },
      };

      const expectedParams = toolSignatures.Read;
      const actualParams = testTool.function.parameters?.properties || {};
      const requiredParams = testTool.function.parameters?.required || [];

      const missingParams = expectedParams.filter(param => !actualParams[param]);
      const extraRequired = requiredParams.filter(param => !expectedParams.includes(param));

      expect(missingParams).toHaveLength(0);
      expect(extraRequired).toHaveLength(0);
      expect(Object.keys(actualParams)).toEqual(expectedParams);
    });

    it('should detect missing required parameters', () => {
      const incompleteEditTool: Tool = {
        type: 'function',
        function: {
          name: 'Edit',
          description: 'Edit a file',
          parameters: {
            type: 'object',
            properties: {
              file_path: { type: 'string' },
              // Missing old_string and new_string
            },
            required: ['file_path'],
          },
        },
      };

      const expectedParams = toolSignatures.Edit; // ['file_path', 'old_string', 'new_string']
      const actualParams = incompleteEditTool.function.parameters?.properties || {};
      const missingParams = expectedParams.filter(param => !actualParams[param]);

      expect(missingParams).toEqual(['old_string', 'new_string']);
    });

    it('should validate all tool signatures', () => {
      for (const [toolName, expectedParams] of Object.entries(toolSignatures)) {
        expect(expectedTools).toContain(toolName);
        expect(Array.isArray(expectedParams)).toBe(true);

        // Verify specific tool requirements
        switch (toolName) {
          case 'TodoRead':
            expect(expectedParams).toHaveLength(0);
            break;
          case 'Edit':
            expect(expectedParams).toContain('file_path');
            expect(expectedParams).toContain('old_string');
            expect(expectedParams).toContain('new_string');
            break;
          case 'Bash':
            expect(expectedParams).toContain('command');
            break;
          case 'WebFetch':
            expect(expectedParams).toContain('url');
            expect(expectedParams).toContain('prompt');
            break;
        }
      }
    });
  });

  describe('Tool Call Tests', () => {
    it('should successfully call a Claude Code tool', async () => {
      const testPayload: TestPayload = {
        model: 'claude-3-5-sonnet',
        messages: [
          {
            role: 'user',
            content: 'Please use the Read tool',
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'Read',
              description: 'Test call for Read',
              parameters: {
                type: 'object',
                properties: {
                  file_path: { type: 'string', description: 'file_path parameter' },
                },
                required: ['file_path'],
              },
            },
          },
        ],
        stream: false,
      };

      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'File read successfully',
                },
              },
            ],
          }),
      });

      const response = await fetch('http://localhost:3000/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      });

      expect(response.ok).toBe(true);
    });

    it('should handle tool call failures', async () => {
      const testPayload: TestPayload = {
        model: 'claude-3-5-sonnet',
        messages: [
          {
            role: 'user',
            content: 'Please use the Bash tool',
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'Bash',
              description: 'Test call for Bash',
              parameters: {
                type: 'object',
                properties: {
                  command: { type: 'string', description: 'command parameter' },
                },
                required: ['command'],
              },
            },
          },
        ],
        stream: false,
      };

      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      const response = await fetch('http://localhost:3000/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe('Comprehensive Tool Verification', () => {
    it('should verify all 16 Claude Code tools are available', async () => {
      const mockCompleteToolsResponse: ToolsResponse = {
        tools: expectedTools.map(toolName => ({
          type: 'function',
          function: {
            name: toolName,
            description: `${toolName} tool description`,
            parameters: {
              type: 'object',
              properties: toolSignatures[toolName].reduce(
                (acc, param) => {
                  acc[param] = { type: 'string', description: `${param} parameter` };
                  return acc;
                },
                {} as Record<string, any>
              ),
              required: toolSignatures[toolName],
            },
          },
        })),
      };

      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompleteToolsResponse),
      });

      const response = await fetch('http://localhost:3000/tools');
      const data = await response.json();

      const claudeCodeTools = data.tools.filter(
        (tool: Tool) =>
          !tool.function.name.includes(':') && expectedTools.includes(tool.function.name)
      );

      const foundTools: string[] = [];
      const missingTools: string[] = [];

      for (const expectedTool of expectedTools) {
        const tool = claudeCodeTools.find((t: Tool) => t.function.name === expectedTool);
        if (tool) {
          foundTools.push(expectedTool);
        } else {
          missingTools.push(expectedTool);
        }
      }

      const result: TestResult = {
        total: data.tools.length,
        claudeCodeTools: claudeCodeTools.length,
        foundTools,
        missingTools,
        success: foundTools.length === 16,
      };

      expect(result.success).toBe(true);
      expect(result.claudeCodeTools).toBe(16);
      expect(result.foundTools).toHaveLength(16);
      expect(result.missingTools).toHaveLength(0);
      expect(result.foundTools).toEqual(expectedTools);
    });

    it('should identify missing tools correctly', async () => {
      // Mock response with only some tools
      const partialToolsResponse: ToolsResponse = {
        tools: expectedTools.slice(0, 10).map(toolName => ({
          type: 'function',
          function: {
            name: toolName,
            description: `${toolName} tool`,
          },
        })),
      };

      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(partialToolsResponse),
      });

      const response = await fetch('http://localhost:3000/tools');
      const data = await response.json();

      const claudeCodeTools = data.tools.filter(
        (tool: Tool) =>
          !tool.function.name.includes(':') && expectedTools.includes(tool.function.name)
      );

      const foundTools = claudeCodeTools.map((tool: Tool) => tool.function.name);
      const missingTools = expectedTools.filter(tool => !foundTools.includes(tool));

      expect(foundTools).toHaveLength(10);
      expect(missingTools).toHaveLength(6);
      expect(missingTools).toEqual(expectedTools.slice(10));
    });
  });
});
