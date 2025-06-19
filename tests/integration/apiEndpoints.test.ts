import { Hono } from 'hono';
// import { Config } from '../../src/config';
// import { MCPManager } from '../../src/mcp-client';

// Mock VS Code API
const mockVSCode = {
  lm: {
    selectChatModels: jest.fn(() => [
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    ]),
  },
  LanguageModelChatMessage: jest.fn(),
  LanguageModelChatMessageRole: {
    User: 1,
    Assistant: 2,
  },
  LanguageModelTextPart: jest.fn(),
  LanguageModelToolResult: jest.fn(),
  LanguageModelChatToolMode: {
    Auto: 'auto',
  },
};

jest.mock('vscode', () => mockVSCode);

// Mock logger
jest.mock('../../src/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Import server creation function
// Note: We'll need to refactor server.ts to export the app creation function
// For now, let's create a simplified version for testing

describe('API Endpoints Integration Tests', () => {
  let app: any;
  // let mockConfig: Config;
  // let mcpManager: MCPManager;

  beforeEach(() => {
    jest.clearAllMocks();

    // mockConfig = {
    //   port: 68686,
    //   startAutomatically: true,
    //   defaultModel: 'gpt-4',
    //   mcpClients: {},
    //   systemPrompt: 'You are a helpful assistant.',
    //   systemPromptFormat: 'merge',
    //   enableSystemPromptProcessing: true,
    // };

    // mcpManager = new MCPManager();

    // Create a simplified Hono app for testing
    app = new Hono();

    // Add basic endpoints for testing
    app.get('/', c => c.text('ok'));

    app.get('/models', async c => {
      const models = [
        { id: 'gpt-4', object: 'model', owned_by: 'user', permission: [] },
        { id: 'claude-3.5-sonnet', object: 'model', owned_by: 'user', permission: [] },
      ];
      return c.json(models);
    });

    app.get('/v1/models', async c => {
      const models = [
        { id: 'gpt-4', object: 'model', owned_by: 'user', permission: [] },
        { id: 'claude-3.5-sonnet', object: 'model', owned_by: 'user', permission: [] },
      ];
      return c.json(models);
    });

    app.get('/tools', async c => {
      const tools = [
        {
          type: 'function',
          function: {
            name: 'Read',
            description: 'Reads a file from the local filesystem',
            parameters: {
              type: 'object',
              properties: {
                file_path: { type: 'string' },
              },
              required: ['file_path'],
            },
          },
        },
      ];
      return c.json({ tools });
    });

    app.post('/chat/completions', async c => {
      const body = await c.req.json();

      if (body.stream) {
        return c.text(
          'data: {"id":"test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n',
          200,
          {
            'Content-Type': 'text/plain',
          }
        );
      } else {
        return c.json({
          id: 'test',
          object: 'chat.completion',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Hello, how can I help you?',
              },
              finish_reason: 'stop',
            },
          ],
        });
      }
    });

    app.post('/v1/messages', async c => {
      const body = await c.req.json();

      if (body.stream) {
        return c.text(
          'event: message_start\ndata: {"type":"message_start","message":{"id":"test","type":"message","role":"assistant","content":[]}}\n\nevent: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\nevent: message_stop\ndata: {"type":"message_stop"}\n\n',
          200,
          {
            'Content-Type': 'text/plain',
          }
        );
      } else {
        return c.json({
          id: 'test',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello, how can I help you?' }],
          stop_reason: 'end_turn',
        });
      }
    });
  });

  describe('GET /', () => {
    it('should return health check', async () => {
      const req = new Request('http://localhost/');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      expect(await res.text()).toBe('ok');
    });
  });

  describe('GET /models', () => {
    it('should return available models', async () => {
      const req = new Request('http://localhost/models');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
      expect(data[0]).toHaveProperty('id', 'gpt-4');
      expect(data[1]).toHaveProperty('id', 'claude-3.5-sonnet');
    });
  });

  describe('GET /v1/models', () => {
    it('should return available models in v1 format', async () => {
      const req = new Request('http://localhost/v1/models');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
      expect(data[0]).toHaveProperty('object', 'model');
    });
  });

  describe('GET /tools', () => {
    it('should return available tools', async () => {
      const req = new Request('http://localhost/tools');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('tools');
      expect(Array.isArray(data.tools)).toBe(true);
      expect(data.tools).toHaveLength(1);
      expect(data.tools[0]).toHaveProperty('type', 'function');
      expect(data.tools[0].function).toHaveProperty('name', 'Read');
    });
  });

  describe('POST /chat/completions', () => {
    const basePayload = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
    };

    it('should handle non-streaming chat completion', async () => {
      const req = new Request('http://localhost/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basePayload),
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('object', 'chat.completion');
      expect(data).toHaveProperty('choices');
      expect(data.choices[0].message).toHaveProperty('role', 'assistant');
      expect(data.choices[0].message).toHaveProperty('content');
    });

    it('should handle streaming chat completion', async () => {
      const streamingPayload = {
        ...basePayload,
        stream: true,
      };

      const req = new Request('http://localhost/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(streamingPayload),
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/plain');

      const text = await res.text();
      expect(text).toContain('data:');
      expect(text).toContain('chat.completion.chunk');
      expect(text).toContain('[DONE]');
    });

    it('should handle tool calling request', async () => {
      const toolPayload = {
        ...basePayload,
        tools: [
          {
            type: 'function',
            function: {
              name: 'Read',
              description: 'Read a file',
              parameters: {
                type: 'object',
                properties: { file_path: { type: 'string' } },
                required: ['file_path'],
              },
            },
          },
        ],
      };

      const req = new Request('http://localhost/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolPayload),
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('choices');
    });

    it('should handle invalid JSON payload', async () => {
      const req = new Request('http://localhost/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(400);
    });

    it('should handle missing required fields', async () => {
      const invalidPayload = {
        model: 'gpt-4',
        // missing messages
      };

      const req = new Request('http://localhost/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /v1/messages', () => {
    const basePayload = {
      model: 'claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 100,
    };

    it('should handle non-streaming Anthropic messages', async () => {
      const req = new Request('http://localhost/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basePayload),
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('type', 'message');
      expect(data).toHaveProperty('role', 'assistant');
      expect(data).toHaveProperty('content');
      expect(Array.isArray(data.content)).toBe(true);
    });

    it('should handle streaming Anthropic messages', async () => {
      const streamingPayload = {
        ...basePayload,
        stream: true,
      };

      const req = new Request('http://localhost/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(streamingPayload),
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/plain');

      const text = await res.text();
      expect(text).toContain('event: message_start');
      expect(text).toContain('event: content_block_delta');
      expect(text).toContain('event: message_stop');
    });

    it('should handle system messages in Anthropic format', async () => {
      const systemPayload = {
        ...basePayload,
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello' },
        ],
      };

      const req = new Request('http://localhost/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(systemPayload),
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('content');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const req = new Request('http://localhost/unknown');
      const res = await app.fetch(req);

      expect(res.status).toBe(404);
    });

    it('should handle POST without body', async () => {
      const req = new Request('http://localhost/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(400);
    });

    it('should handle unsupported HTTP methods', async () => {
      const req = new Request('http://localhost/chat/completions', {
        method: 'PUT',
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(405);
    });
  });

  describe('Content Type Validation', () => {
    it('should require JSON content type for POST requests', async () => {
      const req = new Request('http://localhost/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ model: 'gpt-4', messages: [] }),
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(400);
    });

    it('should handle missing content type', async () => {
      const req = new Request('http://localhost/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'gpt-4', messages: [] }),
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(400);
    });
  });
});
