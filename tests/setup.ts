// Global test setup file for Vitest
import { vi, beforeEach } from 'vitest';

// Mock VS Code API for unit tests
const mockVSCode = {
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      append: vi.fn(),
      clear: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
      name: 'mock-output-channel',
    })),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showQuickPick: vi.fn(),
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
    executeCommand: vi.fn(),
  },
  lm: {
    registerTool: vi.fn(() => ({
      dispose: vi.fn(),
    })),
    selectChatModels: vi.fn(() => []),
    invokeTool: vi.fn(),
    sendRequest: vi.fn(),
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
  LanguageModelChatRequestOptions: vi.fn(),
  CancellationTokenSource: vi.fn(() => ({
    token: {},
  })),
  ExtensionContext: vi.fn(),
  Uri: {
    parse: vi.fn(),
  },
  env: {
    openExternal: vi.fn(),
  },
  version: '1.99.0',
};

// Mock the vscode module before any imports
vi.doMock('vscode', () => mockVSCode, { virtual: true });

// Mock node-fetch for HTTP testing
vi.stubGlobal('fetch', vi.fn());

// Mock console methods to reduce noise in tests
vi.stubGlobal('console', {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
});

// Set up test environment variables
process.env.NODE_ENV = 'test';

// Global test hooks
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
});
