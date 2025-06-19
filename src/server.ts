import * as vscode from 'vscode';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { logger } from 'hono/logger';
import { exec } from 'child_process';

import { Config } from './config';
import { logger as winstonLogger } from './logger';
import { MCPManager } from './mcp-client';
import { claudeToolSignatures } from './claudeTools';
import {
  getExtensionContext,
  registerToolDynamically,
  addDiscoveredTool,
  registerMCPTool,
} from './extension';
import {
  OpenAIMessage,
  AnthropicMessage,
  ToolSignature,
  ModelInfo,
  ServerInstance,
  ProcessedMessages,
  SystemPromptFormat,
} from './types';

export function newServer(config: Config): ServerInstance {
  const mcpManager = new MCPManager();
  const server = newHonoServer(() => config, mcpManager);
  let startedServer: { stop(): void } | undefined;

  // Initialize MCP clients
  initializeMCPClients(mcpManager, config);

  return {
    start: () => {
      const port = config.port;
      if (startedServer) {
        vscode.window.showInformationMessage('LM API server is already running');
        return;
      }
      const { serve } = require('@hono/node-server');
      startedServer = serve({
        fetch: server.fetch,
        port,
      });
      vscode.window.showInformationMessage(`LM API server is running on port ${port}`);
    },
    stop: () => {
      if (startedServer) {
        startedServer.stop();
        vscode.window.showInformationMessage('LM API server stopped');
        startedServer = undefined;
      } else {
        vscode.window.showInformationMessage('LM API server is not running');
      }
    },
    updateConfig: (newConfig: Config) => {
      initializeMCPClients(mcpManager, newConfig);
    },
  };
}

async function findModelWithFallback(
  requestedModel: string,
  defaultModel: string
): Promise<vscode.LanguageModelChat | null> {
  try {
    const models = await vscode.lm.selectChatModels({ id: requestedModel });
    const model = models.find(m => m.id === requestedModel);
    if (model) {
      return model;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    winstonLogger.warn(
      `Model ${requestedModel} not found, trying default: ${defaultModel}. Error: ${errorMessage}`
    );
  }

  try {
    const models = await vscode.lm.selectChatModels({ id: defaultModel });
    return models.find(m => m.id === defaultModel);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    winstonLogger.error(`Default model ${defaultModel} also not found. Error: ${errorMessage}`);
    return null;
  }
}

async function initializeMCPClients(mcpManager: MCPManager, config: Config): Promise<void> {
  if (!config.mcpClients) {
    return;
  }

  for (const [name, clientConfig] of Object.entries(config.mcpClients)) {
    try {
      await mcpManager.addClient(name, clientConfig);
      winstonLogger.info(`MCP client '${name}' initialized successfully`);

      // Auto-register MCP tools to VS Code LM
      await registerMCPToolsToVSCode(mcpManager, name);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      winstonLogger.error(`Failed to initialize MCP client '${name}': ${errorMessage}`);
    }
  }
}

// Register all MCP tools from a client to VS Code LM
async function registerMCPToolsToVSCode(
  mcpManager: MCPManager,
  clientName?: string
): Promise<void> {
  const mcpTools = mcpManager.getAvailableTools();

  for (const tool of mcpTools) {
    // Create tool name with optional client prefix
    const toolName = clientName ? `${clientName}:${tool.name}` : tool.name;

    // Convert MCP tool schema to VS Code LM format
    const toolSchema = {
      name: toolName,
      description: tool.description || `MCP tool: ${tool.name}`,
      parameters: tool.inputSchema || {
        type: 'object',
        properties: {},
        required: [],
      },
    };

    // Create MCP call handler that routes to the correct client
    const mcpCallHandler = async (name: string, params: Record<string, unknown>) => {
      try {
        const result = await mcpManager.callTool(tool.name, params);
        winstonLogger.info(`MCP tool ${name} executed successfully`);
        return result;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        winstonLogger.error(`MCP tool ${name} execution failed: ${errorMessage}`);
        throw error;
      }
    };

    // Register the tool
    const registered = registerMCPTool(toolName, toolSchema, mcpCallHandler);
    if (registered) {
      winstonLogger.info(`🔧 Auto-registered MCP tool: ${toolName}`);
    }
  }
}

// Intelligent system prompt processing for VS Code LM API
function processSystemPrompts(
  messages: OpenAIMessage[] | AnthropicMessage[],
  config: Config
): ProcessedMessages {
  if (!config.enableSystemPromptProcessing) {
    // Fallback to simple conversion for backward compatibility
    const processedMessages = messages.map(message => {
      if ('role' in message && message.role === 'system') {
        return { ...message, role: 'user' as const };
      }
      return message;
    });
    return {
      messages: processedMessages,
      hasSystemPrompt: false,
    };
  }

  const systemMessages: Array<OpenAIMessage | AnthropicMessage> = [];
  const nonSystemMessages: Array<OpenAIMessage | AnthropicMessage> = [];

  // Separate system and non-system messages
  messages.forEach(message => {
    if ('role' in message && message.role === 'system') {
      systemMessages.push(message);
    } else {
      nonSystemMessages.push(message);
    }
  });

  // Add configured default system prompt if exists
  let allSystemContent = '';
  if (config.systemPrompt.trim()) {
    allSystemContent += `${config.systemPrompt.trim()}\n\n`;
  }

  // Add system messages content
  if (systemMessages.length > 0) {
    const systemContent = systemMessages
      .map(msg => (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)))
      .join('\n\n');
    allSystemContent += systemContent;
  }

  // If no system content, return original messages (except convert system to user for compatibility)
  if (!allSystemContent.trim()) {
    const processedMessages = messages.map(message => {
      if ('role' in message && message.role === 'system') {
        return { ...message, role: 'user' as const };
      }
      return message;
    });
    return {
      messages: processedMessages,
      hasSystemPrompt: false,
    };
  }

  // Apply system prompt processing based on format setting
  const processedMessages = applySystemPromptFormat(
    nonSystemMessages,
    allSystemContent.trim(),
    config.systemPromptFormat
  );
  return {
    messages: processedMessages,
    hasSystemPrompt: true,
    systemContent: allSystemContent.trim(),
  };
}

function applySystemPromptFormat(
  messages: Array<OpenAIMessage | AnthropicMessage>,
  systemContent: string,
  format: SystemPromptFormat
): Array<OpenAIMessage | AnthropicMessage> {
  if (messages.length === 0) {
    // If no messages, create a user message with system content
    return [
      {
        role: 'user',
        content: formatSystemPrompt(systemContent, '', format),
      },
    ];
  }

  const firstMessage = messages[0];
  const restMessages = messages.slice(1);

  switch (format) {
    case 'merge':
      // Merge system content with first user message using clear formatting
      const firstUserContent =
        typeof firstMessage.content === 'string'
          ? firstMessage.content
          : JSON.stringify(firstMessage.content);

      return [
        {
          ...firstMessage,
          role: firstMessage.role === 'system' ? 'user' : firstMessage.role,
          content: formatSystemPrompt(systemContent, firstUserContent, 'merge'),
        },
        ...restMessages,
      ];

    case 'assistant_acknowledgment':
      // Convert to assistant acknowledgment + user instruction pattern
      return [
        {
          role: 'assistant',
          content: 'I understand and will follow these instructions carefully.',
        },
        {
          role: 'user',
          content: `${formatSystemPrompt(systemContent, '', 'assistant_acknowledgment')}\n\nPlease proceed with following these instructions.`,
        },
        ...messages.map(msg => ({
          ...msg,
          role: msg.role === 'system' ? 'user' : msg.role,
        })),
      ];

    case 'simple_prepend':
      // Simple prepend to first message
      const content =
        typeof firstMessage.content === 'string'
          ? firstMessage.content
          : JSON.stringify(firstMessage.content);

      return [
        {
          ...firstMessage,
          role: firstMessage.role === 'system' ? 'user' : firstMessage.role,
          content: `${systemContent}\n\n${content}`,
        },
        ...restMessages,
      ];

    default:
      return messages;
  }
}

function formatSystemPrompt(
  systemContent: string,
  userContent: string,
  format: SystemPromptFormat
): string {
  switch (format) {
    case 'merge':
      if (!userContent.trim()) {
        return `<SYSTEM_INSTRUCTIONS>\n${systemContent}\n</SYSTEM_INSTRUCTIONS>`;
      }
      return `<SYSTEM_INSTRUCTIONS>\n${systemContent}\n</SYSTEM_INSTRUCTIONS>\n\n<USER_MESSAGE>\n${userContent}\n</USER_MESSAGE>`;

    case 'assistant_acknowledgment':
      return `<INSTRUCTIONS>\n${systemContent}\n</INSTRUCTIONS>`;

    case 'simple_prepend':
      return systemContent;

    default:
      return systemContent;
  }
}

function convertMessagesToVSCode(
  messages: Array<OpenAIMessage | AnthropicMessage>
): vscode.LanguageModelChatMessage[] {
  return messages.map(message => {
    const role =
      message.role === 'assistant'
        ? vscode.LanguageModelChatMessageRole.Assistant
        : vscode.LanguageModelChatMessageRole.User;
    let content: string | Array<vscode.LanguageModelTextPart>;
    if (Array.isArray(message.content)) {
      content = message.content.map(part => {
        if (typeof part === 'object' && part !== null && 'text' in part) {
          return new vscode.LanguageModelTextPart(part.text || '');
        }
        return new vscode.LanguageModelTextPart(String(part));
      });
    } else {
      content = message.content || '';
    }
    return new vscode.LanguageModelChatMessage(role, content);
  });
}

function createRequestOptions(): vscode.LanguageModelChatRequestOptions {
  return {
    toolMode: vscode.LanguageModelChatToolMode.Auto,
  };
}

function createErrorResponse(
  message: string,
  _statusCode = 500,
  type = 'internal_error'
): { error: { type: string; message: string } } {
  return {
    error: {
      type,
      message,
    },
  };
}

async function getModelsResponse(): Promise<ModelInfo[]> {
  const models = await vscode.lm.selectChatModels();
  return models.map(
    (model): ModelInfo => ({
      id: model.id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'user',
    })
  );
}

// Function to extract tool names from request body
function extractToolNamesFromRequest(body: Record<string, unknown>): string[] {
  const toolNames: string[] = [];

  // Check if tools are specified in the request
  if (body.tools && Array.isArray(body.tools)) {
    for (const tool of body.tools) {
      if (tool.function?.name) {
        toolNames.push(tool.function.name);
      } else if (tool.name) {
        toolNames.push(tool.name);
      }
    }
  }

  // Also check message content for potential tool references
  if (body.messages && Array.isArray(body.messages)) {
    for (const message of body.messages) {
      if (typeof message.content === 'string') {
        // Simple heuristic: look for Claude Code tool names in message content
        for (const toolSig of claudeToolSignatures) {
          if (message.content.toLowerCase().includes(toolSig.name.toLowerCase())) {
            toolNames.push(toolSig.name);
          }
        }
      }
    }
  }

  return [...new Set(toolNames)]; // Remove duplicates
}

// Function to dynamically register tools before making request
async function ensureToolsRegistered(toolNames: string[], mcpManager: MCPManager): Promise<void> {
  const context = getExtensionContext();
  if (!context) {
    winstonLogger.warn('Extension context not available for dynamic tool registration');
    return;
  }

  for (const toolName of toolNames) {
    // First try to register as Claude Code tool
    let isRegistered = registerToolDynamically(toolName, context);
    if (isRegistered) {
      winstonLogger.info(`🔧 Dynamically registered Claude Code tool: ${toolName}`);
      continue;
    }

    // If not found as Claude Code tool, check if it's an MCP tool
    const mcpTools = mcpManager.getAvailableTools();
    const mcpTool = mcpTools.find(
      tool => tool.name === toolName || `${toolName}`.includes(tool.name)
    );

    if (mcpTool) {
      const toolSchema = {
        name: toolName,
        description: mcpTool.description || `MCP tool: ${mcpTool.name}`,
        parameters: mcpTool.inputSchema || { type: 'object', properties: {}, required: [] },
      };

      const mcpCallHandler = async (name: string, params: Record<string, unknown>) => {
        return await mcpManager.callTool(mcpTool.name, params);
      };

      isRegistered = registerMCPTool(toolName, toolSchema, mcpCallHandler);
      if (isRegistered) {
        winstonLogger.info(`🔧 Dynamically registered MCP tool: ${toolName}`);
      }
    }
  }

  // Give VS Code a moment to process the registrations
  await new Promise(resolve => setTimeout(resolve, 100));
}

// Store retry context for failed tool calls
interface RetryContext {
  chatRequest: vscode.LanguageModelChatMessage[];
  requestOptions: vscode.LanguageModelChatRequestOptions;
  model: vscode.LanguageModelChat;
  onText: (chunk: vscode.LanguageModelTextPart) => Promise<void> | void;
  onToolCall: (chunk: vscode.LanguageModelToolCallPart) => Promise<void> | void;
  onToolResult?: (
    callId: string,
    toolName: string,
    result: vscode.LanguageModelToolResult
  ) => Promise<void> | void;
  retryCount: number;
}

// Global retry context storage
const retryContexts = new Map<string, RetryContext>();

// Function to create a retry-enabled stream processor
async function createRetryableStreamProcessor(
  model: vscode.LanguageModelChat,
  chatRequest: vscode.LanguageModelChatMessage[],
  requestOptions: vscode.LanguageModelChatRequestOptions,
  onText: (chunk: vscode.LanguageModelTextPart) => Promise<void> | void,
  onToolCall: (chunk: vscode.LanguageModelToolCallPart) => Promise<void> | void,
  onToolResult?: (
    callId: string,
    toolName: string,
    result: vscode.LanguageModelToolResult
  ) => Promise<void> | void,
  maxRetries = 2
): Promise<void> {
  const contextId = `${Date.now()}-${Math.random()}`;
  const context: RetryContext = {
    chatRequest,
    requestOptions,
    model,
    onText,
    onToolCall,
    onToolResult,
    retryCount: 0,
  };

  retryContexts.set(contextId, context);

  try {
    await executeStreamWithRetry(contextId, maxRetries);
  } finally {
    retryContexts.delete(contextId);
  }
}

// Execute stream processing with retry capability
async function executeStreamWithRetry(contextId: string, maxRetries: number): Promise<void> {
  const context = retryContexts.get(contextId);
  if (!context) {
    throw new Error(`Retry context not found: ${contextId}`);
  }

  try {
    const chatResponse = await context.model.sendRequest(
      context.chatRequest,
      context.requestOptions
    );

    // Create enhanced tool result handler that can trigger retries
    const retryableOnToolResult = context.onToolResult
      ? async (callId: string, toolName: string, result: vscode.LanguageModelToolResult) => {
          const resultText = result.content
            .map(part => (part instanceof vscode.LanguageModelTextPart ? part.value : ''))
            .join('');

          // Check if this is a "tool discovered" message that should trigger a retry
          if (
            resultText.includes('dynamically discovered and registered') &&
            context.retryCount < maxRetries
          ) {
            winstonLogger.info(
              `🔄 Retrying request after tool discovery (attempt ${context.retryCount + 1}/${maxRetries})`
            );
            context.retryCount++;

            // Wait a moment for registration to take effect
            await new Promise(resolve => setTimeout(resolve, 200));

            // Retry the entire request
            await executeStreamWithRetry(contextId, maxRetries);
            return;
          }

          // Normal tool result processing
          if (context.onToolResult) {
            await context.onToolResult(callId, toolName, result);
          }
        }
      : undefined;

    await processStreamChunks(
      chatResponse,
      context.onText,
      context.onToolCall,
      retryableOnToolResult
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    winstonLogger.error(`Stream execution failed for context ${contextId}: ${errorMessage}`);
    throw error;
  }
}

// Function to dynamically discover tool definition from multiple sources
async function discoverToolDefinition(toolName: string): Promise<ToolSignature | null> {
  try {
    // Strategy 1: Try common tool patterns first
    const commonTool = tryCommonToolPatterns(toolName);
    if (commonTool) {
      winstonLogger.info(`🔧 Discovered common tool pattern for ${toolName}`);
      return commonTool;
    }

    // Strategy 2: Try to get tool definition by calling Claude Code CLI
    return new Promise<ToolSignature | null>(resolve => {
      // Try multiple CLI approaches
      const commands = [
        `claude-code --help ${toolName}`,
        `claude-code tools list | grep -i ${toolName}`,
        `which ${toolName}`, // Check if it's a system command
      ];

      tryCommandSequentially(commands, 0, resolve, toolName);
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    winstonLogger.error(`Error discovering tool ${toolName}: ${errorMessage}`);
    return null;
  }
}

// Try commands sequentially until one succeeds
function tryCommandSequentially(
  commands: string[],
  index: number,
  resolve: (value: ToolSignature | null) => void,
  toolName: string
): void {
  if (index >= commands.length) {
    resolve(null);
    return;
  }

  exec(`${commands[index]} 2>/dev/null`, (error: Error | null, stdout: string) => {
    if (!error && stdout.trim()) {
      try {
        const toolDef = parseToolFromHelpOutput(toolName, stdout);
        winstonLogger.info(
          `🔧 Discovered tool definition for ${toolName} using: ${commands[index]}`
        );
        resolve(toolDef);
        return;
      } catch (parseError: unknown) {
        // Continue to next command
        winstonLogger.debug(`Failed to parse tool help for ${toolName}: ${parseError}`);
      }
    }

    // Try next command
    tryCommandSequentially(commands, index + 1, resolve, toolName);
  });
}

// Try to match common tool patterns
function tryCommonToolPatterns(toolName: string): ToolSignature | null {
  const commonPatterns: { [key: string]: ToolSignature } = {
    // File operations
    cat: {
      name: 'cat',
      description: 'Display file contents',
      parameters: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] },
    },
    ls: {
      name: 'ls',
      description: 'List directory contents',
      parameters: { type: 'object', properties: { path: { type: 'string' } } },
    },
    cp: {
      name: 'cp',
      description: 'Copy files',
      parameters: {
        type: 'object',
        properties: { source: { type: 'string' }, dest: { type: 'string' } },
        required: ['source', 'dest'],
      },
    },
    mv: {
      name: 'mv',
      description: 'Move files',
      parameters: {
        type: 'object',
        properties: { source: { type: 'string' }, dest: { type: 'string' } },
        required: ['source', 'dest'],
      },
    },
    rm: {
      name: 'rm',
      description: 'Remove files',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    },

    // Development tools
    git: {
      name: 'git',
      description: 'Git version control',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string' } },
        required: ['command'],
      },
    },
    npm: {
      name: 'npm',
      description: 'Node package manager',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string' } },
        required: ['command'],
      },
    },
    python: {
      name: 'python',
      description: 'Python interpreter',
      parameters: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] },
    },

    // Generic patterns for unknown tools
    default: {
      name: toolName,
      description: `Dynamically discovered tool: ${toolName}`,
      parameters: {
        type: 'object',
        properties: {
          args: {
            type: 'array',
            description: 'Arguments for the tool',
            items: { type: 'string' },
          },
          input: {
            type: 'string',
            description: 'Input data for the tool',
          },
        },
      },
    },
  };

  return commonPatterns[toolName] || commonPatterns.default;
}

// Simple parser for tool help output (would need more sophisticated implementation)
function parseToolFromHelpOutput(toolName: string, _helpText: string): ToolSignature {
  // For now, return a basic schema - in reality would parse the help text
  return {
    name: toolName,
    description: `Dynamically discovered tool: ${toolName}`,
    parameters: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Tool input',
        },
      },
      required: ['input'],
    },
  };
}

async function processStreamChunks(
  chatResponse: vscode.LanguageModelChatResponse,
  onText: (chunk: vscode.LanguageModelTextPart) => Promise<void> | void,
  onToolCall: (chunk: vscode.LanguageModelToolCallPart) => Promise<void> | void,
  onToolResult?: (
    callId: string,
    toolName: string,
    result: vscode.LanguageModelToolResult
  ) => Promise<void> | void
) {
  for await (const chunk of chatResponse.stream) {
    if (chunk instanceof vscode.LanguageModelTextPart) {
      console.log('📝 PART:', 'text', chunk.value.slice(0, 50));
      await onText(chunk);
    } else if (chunk instanceof vscode.LanguageModelToolCallPart) {
      console.log('🔧 PART:', 'toolCall', { name: chunk.name, callId: chunk.callId });
      winstonLogger.info(`🔧 TOOL CALL: ${chunk.name}, CallId: ${chunk.callId}`);

      // Send tool call
      await onToolCall(chunk);

      // Always execute tool and send result, regardless of chunk.name or onToolResult
      if (onToolResult) {
        try {
          const toolResult = await vscode.lm.invokeTool(
            chunk.name,
            {
              toolInvocationToken: undefined,
              input: chunk.input || {},
            },
            new vscode.CancellationTokenSource().token
          );

          await onToolResult(chunk.callId || 'unknown', chunk.name, toolResult);
        } catch (error: unknown) {
          winstonLogger.error(`Tool invocation failed for ${chunk.name}:`, error);

          // Check if this is a "tool not found" error
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (
            errorMessage.includes('tool') &&
            (errorMessage.includes('not found') || errorMessage.includes('not registered'))
          ) {
            winstonLogger.info(
              `🔍 Attempting to discover and register missing tool: ${chunk.name}`
            );

            // Try to dynamically discover and register the tool
            const discoveredTool = await discoverToolDefinition(chunk.name);
            if (discoveredTool) {
              const context = getExtensionContext();
              if (context) {
                // Add discovered tool to our tool signatures
                const added = addDiscoveredTool(discoveredTool);
                if (added) {
                  // Register the tool with VS Code LM
                  const registered = registerToolDynamically(chunk.name, context);
                  if (registered) {
                    winstonLogger.info(
                      `🔧 Successfully discovered and registered tool: ${chunk.name}`
                    );

                    // Return a message indicating the tool was discovered and registered
                    const discoveryResult = new vscode.LanguageModelToolResult([
                      new vscode.LanguageModelTextPart(
                        `Tool ${chunk.name} was dynamically discovered and registered. Please retry your request.`
                      ),
                    ]);
                    await onToolResult(chunk.callId || 'unknown', chunk.name, discoveryResult);
                    return;
                  }
                }
              }
            }

            winstonLogger.warn(`❌ Could not discover or register tool: ${chunk.name}`);
          }

          // Send original error if discovery failed
          const errorResult = new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${errorMessage}`),
          ]);
          await onToolResult(chunk.callId || 'unknown', chunk.name, errorResult);
        }
      }
    }
  }
}

function newHonoServer(getConfig: () => Config, mcpManager: MCPManager) {
  const app = new Hono();

  winstonLogger.info('Hono server started');
  app.use(logger());

  app.get('/', c => {
    return c.text('ok');
  });

  // Get available tools
  app.get('/tools', async c => {
    const mcpTools = mcpManager.getAvailableTools();

    const allTools = [
      // Claude Code official tools
      ...claudeToolSignatures.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
      // MCP tools
      ...mcpTools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema || {},
        },
      })),
    ];
    return c.json({ tools: allTools });
  });

  app.post('/chat/completions', async c => {
    try {
      const body = await c.req.json();
      const config = getConfig();

      winstonLogger.info(`=== /chat/completions REQUEST ===`);
      winstonLogger.info(`Model: ${body.model}, Stream: ${body.stream}`);
      console.log(
        '🔍 TOOLS IN BODY:',
        body.tools?.map(t =>
          'function' in t ? t.function?.name : 'name' in t ? t.name : 'unknown'
        )
      );

      // Extract and dynamically register tools
      const toolNames = extractToolNamesFromRequest(body);
      console.log('🔧 DETECTED TOOLS:', toolNames);
      winstonLogger.info(`🔧 DETECTED TOOLS: ${toolNames.join(', ')}`);
      await ensureToolsRegistered(toolNames, mcpManager);

      const model = await findModelWithFallback(body.model, config.defaultModel);
      if (!model) {
        return c.json(
          createErrorResponse(
            `model not found: ${body.model} and default model ${config.defaultModel} not available`
          ),
          400
        );
      }

      console.log('🎨 MODEL ID:', model.id);
      const convertedMsgs = processSystemPrompts(body.messages, config);
      const chatRequest = convertMessagesToVSCode(convertedMsgs);
      const requestOptions = createRequestOptions();
      console.log('🎯 REQUEST OPTIONS:', requestOptions);

      if (body.stream) {
        return stream(c, async stream => {
          await createRetryableStreamProcessor(
            model,
            chatRequest,
            requestOptions,
            async chunk => {
              const json = JSON.stringify({
                id: `chatcmpl-${Date.now()}`,
                object: 'chat.completion.chunk',
                choices: [
                  {
                    index: 0,
                    delta: { content: chunk.value },
                  },
                ],
              });
              await stream.write(`data: ${json}\n\n`);
            },
            async chunk => {
              const toolCallJson = JSON.stringify({
                id: `chatcmpl-${Date.now()}`,
                object: 'chat.completion.chunk',
                choices: [
                  {
                    index: 0,
                    delta: {
                      tool_calls: [
                        {
                          id: chunk.callId,
                          type: 'function',
                          function: {
                            name: chunk.name,
                            arguments: JSON.stringify(chunk.input || {}),
                          },
                        },
                      ],
                    },
                  },
                ],
              });
              await stream.write(`data: ${toolCallJson}\n\n`);
            },
            async (callId, toolName, result) => {
              let resultText = '';
              for (const part of result.content) {
                if (part instanceof vscode.LanguageModelTextPart) {
                  resultText += part.value;
                }
              }

              // Skip outputting "tool discovered" messages to avoid confusing the client
              if (!resultText.includes('dynamically discovered and registered')) {
                const resultJson = JSON.stringify({
                  id: `chatcmpl-${Date.now()}`,
                  object: 'chat.completion.chunk',
                  choices: [
                    {
                      index: 0,
                      delta: {
                        tool_results: [
                          {
                            id: callId,
                            type: 'function',
                            function: {
                              name: toolName,
                              result: resultText,
                            },
                          },
                        ],
                      },
                    },
                  ],
                });
                await stream.write(`data: ${resultJson}\n\n`);
              }
            }
          );
          await stream.write(`data: [DONE]\n\n`);
        });
      } else {
        // Non-streaming response
        const chatResponse = await model.sendRequest(chatRequest, requestOptions);

        const result: string[] = [];
        for await (const chunk of chatResponse.stream) {
          if (chunk instanceof vscode.LanguageModelTextPart) {
            result.push(chunk.value);
          } else if (chunk instanceof vscode.LanguageModelToolCallPart) {
            winstonLogger.info(`Tool call in non-streaming: ${chunk.name}`);
          }
        }

        const responseBody = {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: model.id,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: result.join(''),
              },
              finish_reason: 'stop',
            },
          ],
        };
        return c.json(responseBody);
      }
    } catch (error) {
      winstonLogger.error('Error in /chat/completions:', error);
      return c.json(createErrorResponse('Internal server error'), 500);
    }
  });

  app.get('/models', async c => {
    try {
      const models = await getModelsResponse();
      return c.json(models);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      winstonLogger.error('Error getting models:', errorMessage);
      return c.json(createErrorResponse('Failed to get models'), 500);
    }
  });

  app.get('/v1/models', async c => {
    try {
      const models = await getModelsResponse();
      return c.json(models);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      winstonLogger.error('Error getting models:', errorMessage);
      return c.json(createErrorResponse('Failed to get models'), 500);
    }
  });

  // Anthropic API support
  app.post('/v1/messages', async c => {
    try {
      const body = await c.req.json();
      const config = getConfig();

      winstonLogger.info(`=== /v1/messages REQUEST ===`);
      winstonLogger.info(`Model: ${body.model}, Stream: ${body.stream}`);
      console.log(
        '🔍 TOOLS IN BODY:',
        body.tools?.map(t =>
          'function' in t ? t.function?.name : 'name' in t ? t.name : 'unknown'
        )
      );

      // Extract and dynamically register tools
      const toolNames = extractToolNamesFromRequest(body);
      console.log('🔧 DETECTED TOOLS:', toolNames);
      await ensureToolsRegistered(toolNames, mcpManager);

      const model = await findModelWithFallback(body.model, config.defaultModel);
      if (!model) {
        return c.json(
          createErrorResponse(
            `model not found: ${body.model} and default model ${config.defaultModel} not available`,
            400,
            'invalid_request_error'
          ),
          400
        );
      }

      const convertedMsgs = processSystemPrompts(body.messages, config);
      const chatRequest = convertMessagesToVSCode(convertedMsgs);
      const requestOptions = createRequestOptions();

      if (body.stream) {
        const chatResponse = await model.sendRequest(chatRequest, requestOptions);

        return stream(c, async stream => {
          await stream.write(
            `event: message_start\ndata: {"type":"message_start","message":{"id":"msg_${Date.now()}","type":"message","role":"assistant","model":"${
              model.id
            }","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":0,"output_tokens":0}}}\n\n`
          );

          await processStreamChunks(
            chatResponse,
            async chunk => {
              const json = JSON.stringify({
                type: 'content_block_delta',
                index: 0,
                delta: {
                  type: 'text_delta',
                  text: chunk.value,
                },
              });
              await stream.write(`event: content_block_delta\ndata: ${json}\n\n`);
            },
            async chunk => {
              const toolUseJson = JSON.stringify({
                type: 'content_block_delta',
                index: 0,
                delta: {
                  type: 'tool_use',
                  id: chunk.callId,
                  name: chunk.name,
                  input: chunk.input || {},
                },
              });
              await stream.write(`event: content_block_delta\ndata: ${toolUseJson}\n\n`);
            },
            async (callId, toolName, result) => {
              let resultText = '';
              for (const part of result.content) {
                if (part instanceof vscode.LanguageModelTextPart) {
                  resultText += part.value;
                }
              }
              const resultJson = JSON.stringify({
                type: 'content_block_delta',
                index: 0,
                delta: {
                  type: 'tool_response',
                  id: callId,
                  name: toolName,
                  output: resultText,
                },
              });
              await stream.write(`event: content_block_delta\ndata: ${resultJson}\n\n`);
            }
          );

          await stream.write(
            `event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":1}}\n\n`
          );
          await stream.write(`event: message_stop\ndata: {"type":"message_stop"}\n\n`);
        });
      } else {
        // Non-streaming Anthropic response
        const chatResponse = await model.sendRequest(chatRequest, requestOptions);

        const result: string[] = [];
        for await (const chunk of chatResponse.stream) {
          if (chunk instanceof vscode.LanguageModelTextPart) {
            result.push(chunk.value);
          } else if (chunk instanceof vscode.LanguageModelToolCallPart) {
            winstonLogger.info(`Tool call in non-streaming: ${chunk.name}`);
          }
        }

        const responseBody = {
          id: `msg_${Date.now()}`,
          type: 'message',
          role: 'assistant',
          model: model.id,
          content: [
            {
              type: 'text',
              text: result.join(''),
            },
          ],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 0,
            output_tokens: result.join('').split(' ').length,
          },
        };
        return c.json(responseBody);
      }
    } catch (error) {
      winstonLogger.error('Error in /v1/messages:', error);
      return c.json(createErrorResponse('Internal server error', 500, 'api_error'), 500);
    }
  });

  return app;
}
