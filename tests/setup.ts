// Global test setup file
import { vi } from 'vitest';

declare global {
  // Provide jest compatibility using vitest's vi object
  var jest: typeof vi;
}

// Mock VS Code API for unit tests
const mockVSCode = {
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      show: vi.fn(),
    })),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
  workspace: {
    onDidChangeConfiguration: vi.fn(),
    getConfiguration: vi.fn(() => ({
      get: vi.fn(),
      update: vi.fn(),
    })),
  },
  commands: {
    registerCommand: vi.fn(),
  },
  lm: {
    registerTool: vi.fn(() => ({
      dispose: vi.fn(),
    })),
    selectChatModels: vi.fn(() => []),
    invokeTool: vi.fn(),
  },
  LanguageModelChatMessage: vi.fn(),
  LanguageModelChatMessageRole: {
    User: 1,
    Assistant: 2,
  },
  LanguageModelTextPart: vi.fn(),
  LanguageModelToolResult: vi.fn(),
  LanguageModelChatToolMode: {
    Auto: 'auto',
  },
  CancellationTokenSource: vi.fn(() => ({
    token: {},
  })),
  ExtensionContext: vi.fn(),
};

// Set up global mocks and Jest compatibility
Object.assign(globalThis, { vscode: mockVSCode, jest: vi });

// Mock node-fetch for HTTP testing
global.fetch = vi.fn();

// Set up test environment variables
process.env.NODE_ENV = 'test';
