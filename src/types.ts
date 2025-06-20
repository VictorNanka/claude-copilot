/**
 * TypeScript type definitions for Claude Copilot VS Code Extension
 */
// @ts-nocheck

import * as vscode from 'vscode';

// ============================================================================
// Message Types
// ============================================================================

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | OpenAIMessageContent[];
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface OpenAIMessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicMessageContent[];
}

export interface AnthropicMessageContent {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | Array<{ type: string; text?: string }>;
  is_error?: boolean;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface OpenAIChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  tools?: OpenAITool[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: 'chat.completion' | 'chat.completion.chunk';
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIChoice {
  index: number;
  message?: OpenAIMessage;
  delta?: Partial<OpenAIMessage>;
  finish_reason?: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

export interface AnthropicMessagesRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  tools?: AnthropicTool[];
  tool_choice?: { type: 'auto' | 'any' | 'tool'; name?: string };
  system?: string;
}

export interface AnthropicMessagesResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicMessageContent[];
  model: string;
  stop_reason?: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ============================================================================
// Tool Types
// ============================================================================

export interface OpenAITool {
  type: 'function';
  function: OpenAIToolFunction;
}

export interface OpenAIToolFunction {
  name: string;
  description?: string;
  parameters?: JSONSchema;
}

export interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: JSONSchema;
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JSONSchemaProperty;
}

export interface JSONSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  items?: JSONSchemaProperty;
  additionalProperties?: boolean;
}

export interface ToolSignature {
  name: string;
  description?: string;
  parameters?: JSONSchema;
  inputSchema?: JSONSchema;
}

export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================================
// MCP Types
// ============================================================================

export interface MCPClientConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: JSONSchema;
}

export interface MCPCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// ============================================================================
// Server Types
// ============================================================================

export interface ServerInstance {
  start(): Promise<void>;
  stop(): void;
  updateConfig(config: Config): void;
}

export interface ModelInfo {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

export interface ToolDiscoveryResult {
  signature?: ToolSignature;
  found: boolean;
  source: 'claude' | 'mcp' | 'dynamic' | 'common_patterns';
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface Config {
  port: number;
  startServerAutomatically: boolean;
  startAutomatically: boolean;
  defaultModel: string;
  systemPrompt: string;
  systemPromptFormat: 'merge' | 'assistant_acknowledgment' | 'simple_prepend';
  enableSystemPromptProcessing: boolean;
  enableToolCalling: boolean;
  mcpClients: Record<string, MCPClientConfig>;
}

// ============================================================================
// VS Code Extension Types
// ============================================================================

export type ExtensionContext = vscode.ExtensionContext;

export interface LanguageModelRequestOptions {
  messages: vscode.LanguageModelChatMessage[];
  tools?: vscode.LanguageModelTool<Record<string, unknown>>[];
}

// ============================================================================
// Error Types
// ============================================================================

export interface APIError extends Error {
  status?: number;
  code?: string;
  type?: string;
}

export interface ToolExecutionError extends Error {
  toolName: string;
  parameters?: Record<string, unknown>;
}

export interface MCPConnectionError extends Error {
  clientName: string;
  command?: string;
}

// ============================================================================
// System Prompt Processing Types
// ============================================================================

export type SystemPromptFormat = 'merge' | 'assistant_acknowledgment' | 'simple_prepend';

export interface ProcessedMessages {
  messages: OpenAIMessage[] | AnthropicMessage[];
  hasSystemPrompt: boolean;
  systemContent?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  { [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>> }[Keys];

// ============================================================================
// Type Guards
// ============================================================================

export function isOpenAIMessage(message: unknown): message is OpenAIMessage {
  return typeof message === 'object' && message !== null && 'role' in message;
}

export function isAnthropicMessage(message: unknown): message is AnthropicMessage {
  return typeof message === 'object' && message !== null && 'role' in message;
}

export function isAPIError(error: unknown): error is APIError {
  return error instanceof Error && ('status' in error || 'code' in error);
}

export function isToolExecutionError(error: unknown): error is ToolExecutionError {
  return error instanceof Error && 'toolName' in error;
}

export function isMCPConnectionError(error: unknown): error is MCPConnectionError {
  return error instanceof Error && 'clientName' in error;
}
