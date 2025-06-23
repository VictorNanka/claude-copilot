import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MCPManager, MCPClientConfig } from '../../src/mcp-client';

// Mock the MCP SDK
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    request: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn(),
}));

// Mock winston logger
vi.mock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('MCPManager', () => {
  let mcpManager: MCPManager;
  let mockClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mcpManager = new MCPManager();

    // Mock client instance
    mockClient = {
      connect: vi.fn(),
      request: vi.fn(),
      close: vi.fn(),
    };

    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    vi.mocked(Client).mockImplementation(() => mockClient);
  });

  describe('addClient', () => {
    const testConfig: MCPClientConfig = {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/path'],
      env: { VAR: 'value' },
    };

    it('should successfully add MCP client', async () => {
      mockClient.request.mockResolvedValue({
        tools: [
          {
            name: 'list_files',
            description: 'List files in directory',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string' },
              },
              required: ['path'],
            },
          },
        ],
      });

      await mcpManager.addClient('filesystem', testConfig);

      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.request).toHaveBeenCalledWith({ method: 'tools/list' }, expect.any(Object));
    });

    it('should handle client connection failure', async () => {
      mockClient.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(mcpManager.addClient('filesystem', testConfig)).rejects.toThrow(
        'Connection failed'
      );
    });

    it('should handle tools loading failure gracefully', async () => {
      mockClient.request.mockRejectedValue(new Error('Tools request failed'));

      // Should not throw, just log error
      await expect(mcpManager.addClient('filesystem', testConfig)).resolves.toBeUndefined();
      expect(mockClient.connect).toHaveBeenCalled();
    });

    it('should load tools from successful response', async () => {
      const mockTools = [
        {
          name: 'read_file',
          description: 'Read file contents',
          inputSchema: { type: 'object' },
        },
        {
          name: 'write_file',
          description: 'Write file contents',
          inputSchema: { type: 'object' },
        },
      ];

      mockClient.request.mockResolvedValue({ tools: mockTools });

      await mcpManager.addClient('filesystem', testConfig);

      const availableTools = mcpManager.getAvailableTools();
      expect(availableTools).toHaveLength(2);
      expect(availableTools[0].name).toBe('read_file');
      expect(availableTools[1].name).toBe('write_file');
    });
  });

  describe('callTool', () => {
    beforeEach(async () => {
      mockClient.request.mockResolvedValue({
        tools: [
          {
            name: 'list_files',
            description: 'List files',
            inputSchema: { type: 'object' },
          },
        ],
      });

      await mcpManager.addClient('filesystem', {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
      });
    });

    it('should call tool with client prefix', async () => {
      const mockResult = {
        content: [{ type: 'text', text: 'File list result' }],
      };

      mockClient.request.mockResolvedValue(mockResult);

      const result = await mcpManager.callTool('filesystem:list_files', { path: '/test' });

      expect(mockClient.request).toHaveBeenCalledWith(
        {
          method: 'tools/call',
          params: {
            name: 'list_files',
            arguments: { path: '/test' },
          },
        },
        expect.any(Object)
      );
      expect(result).toEqual({
        content: [{ type: 'text', text: 'File list result' }],
        isError: false,
      });
    });

    it('should call tool without client prefix if tool exists', async () => {
      const mockResult = {
        content: [{ type: 'text', text: 'File list result' }],
      };

      mockClient.request.mockResolvedValue(mockResult);

      const result = await mcpManager.callTool('list_files', { path: '/test' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'File list result' }],
        isError: false,
      });
    });

    it('should throw error for unknown tool', async () => {
      await expect(mcpManager.callTool('unknown_tool', {})).rejects.toThrow(
        "Tool 'unknown_tool' not found"
      );
    });

    it('should throw error for unknown client', async () => {
      await expect(mcpManager.callTool('unknown:tool', {})).rejects.toThrow(
        "MCP client 'unknown' not found"
      );
    });

    it('should handle tool execution error', async () => {
      mockClient.request.mockRejectedValue(new Error('Tool execution failed'));

      await expect(mcpManager.callTool('filesystem:list_files', {})).rejects.toThrow(
        'Tool execution failed'
      );
    });
  });

  describe('getAvailableTools', () => {
    it('should return empty array when no clients added', () => {
      const tools = mcpManager.getAvailableTools();
      expect(tools).toEqual([]);
    });

    it('should return all tools from all clients', async () => {
      // Add first client
      mockClient.request.mockResolvedValueOnce({
        tools: [{ name: 'file_op', description: 'File operation' }],
      });

      await mcpManager.addClient('filesystem', {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
      });

      // Add second client with different tools
      mockClient.request.mockResolvedValueOnce({
        tools: [{ name: 'weather_get', description: 'Get weather' }],
      });

      await mcpManager.addClient('weather', {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-weather'],
      });

      const tools = mcpManager.getAvailableTools();
      expect(tools).toHaveLength(2);
      expect(tools.find(t => t.name === 'file_op')).toBeDefined();
      expect(tools.find(t => t.name === 'weather_get')).toBeDefined();
    });
  });

  describe('disconnect', () => {
    it('should disconnect all clients', async () => {
      mockClient.request.mockResolvedValue({ tools: [] });

      await mcpManager.addClient('client1', { command: 'test1' });
      await mcpManager.addClient('client2', { command: 'test2' });

      await mcpManager.disconnect();

      expect(mockClient.close).toHaveBeenCalledTimes(2);
    });

    it('should handle disconnection errors gracefully', async () => {
      mockClient.request.mockResolvedValue({ tools: [] });
      mockClient.close.mockRejectedValue(new Error('Close failed'));

      await mcpManager.addClient('client1', { command: 'test1' });

      // Should not throw
      await expect(mcpManager.disconnect()).resolves.toBeUndefined();
    });

    it('should clear internal state after disconnect', async () => {
      mockClient.request.mockResolvedValue({
        tools: [{ name: 'test_tool', description: 'Test tool' }],
      });

      await mcpManager.addClient('client1', { command: 'test1' });

      expect(mcpManager.getAvailableTools()).toHaveLength(1);

      await mcpManager.disconnect();

      expect(mcpManager.getAvailableTools()).toHaveLength(0);
    });
  });
});
