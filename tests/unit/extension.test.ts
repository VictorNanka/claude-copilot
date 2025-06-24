import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';

vi.mock('vscode');

// Mock the config module with a more explicit mock
const mockConfig = {
  port: 59603,
  startAutomatically: true,
  defaultModel: 'gpt-4.1',
  systemPrompt: '',
  systemPromptFormat: 'merge' as const,
  enableSystemPromptProcessing: true,
  mcpClients: {},
  enableToolCalling: true,
  startServerAutomatically: true,
};

// Mock vscode first
vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      show: vi.fn(),
      dispose: vi.fn(),
    })),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(),
    })),
    onDidChangeConfiguration: vi.fn(() => ({
      dispose: vi.fn(),
    })),
  },
  commands: {
    registerCommand: vi.fn(() => ({
      dispose: vi.fn(),
    })),
  },
  lm: {
    registerTool: vi.fn(() => ({
      dispose: vi.fn(),
    })),
  },
}));

// Use vi.doMock to ensure proper timing
vi.doMock('../../src/config', () => ({
  getConfig: vi.fn().mockReturnValue(mockConfig),
}));

// Mock the logger module
vi.doMock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the server module
vi.doMock('../../src/server', () => ({
  newServer: vi.fn(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    updateConfig: vi.fn(),
    isRunning: vi.fn().mockResolvedValue(true),
  })),
}));

// Import after all mocks are set up
import { activate, deactivate } from '../../src/extension';

describe('Extension Test Suite', () => {
  let mockContext: any;
  const mockVSCode = vscode as any;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    mockContext = {
      subscriptions: [],
    };

    // Ensure the VSCode mock returns proper values
    mockVSCode.lm.registerTool.mockReturnValue({
      dispose: vi.fn(),
    } as any);

    mockVSCode.commands.registerCommand.mockReturnValue({
      dispose: vi.fn(),
    } as any);

    mockVSCode.workspace.onDidChangeConfiguration.mockReturnValue({
      dispose: vi.fn(),
    } as any);
  });

  test('Sample test', () => {
    expect([1, 2, 3].indexOf(5)).toBe(-1);
    expect([1, 2, 3].indexOf(0)).toBe(-1);
  });

  test.skip('extension can be activated', async () => {
    // This should not throw
    await expect(activate(mockContext)).resolves.toBeUndefined();
  });

  test('extension can be deactivated', async () => {
    // This should not throw
    await expect(deactivate()).resolves.toBeUndefined();
  });
});
