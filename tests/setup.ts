// Global test setup file
import 'jest';

// Mock VS Code API for unit tests
const mockVSCode = {
  window: {
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
    })),
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
  },
  workspace: {
    onDidChangeConfiguration: jest.fn(),
    getConfiguration: jest.fn(() => ({
      get: jest.fn(),
      update: jest.fn(),
    })),
  },
  commands: {
    registerCommand: jest.fn(),
  },
  lm: {
    registerTool: jest.fn(() => ({
      dispose: jest.fn(),
    })),
    selectChatModels: jest.fn(() => []),
    invokeTool: jest.fn(),
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
  CancellationTokenSource: jest.fn(() => ({
    token: {},
  })),
  ExtensionContext: jest.fn(),
};

// Set up global mocks
(global as any).vscode = mockVSCode;

// Mock node-fetch for HTTP testing
global.fetch = jest.fn();

// Set up test environment variables
process.env.NODE_ENV = 'test';
