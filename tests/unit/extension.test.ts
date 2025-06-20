import * as vscode from 'vscode';

jest.mock('vscode');

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

// Use doMock to ensure proper timing
jest.doMock('../../src/config', () => ({
  getConfig: jest.fn().mockReturnValue(mockConfig),
}));

// Mock the logger module
jest.doMock('../../src/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the server module
jest.doMock('../../src/server', () => ({
  newServer: jest.fn(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    updateConfig: jest.fn(),
  })),
}));

// Import after all mocks are set up
import { activate, deactivate } from '../../src/extension';

describe('Extension Test Suite', () => {
  let mockContext: any;
  const mockVSCode = vscode as jest.Mocked<typeof vscode>;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    mockContext = {
      subscriptions: [],
    };

    // Ensure the VSCode mock returns proper values
    mockVSCode.lm.registerTool.mockReturnValue({
      dispose: jest.fn(),
    } as any);

    mockVSCode.commands.registerCommand.mockReturnValue({
      dispose: jest.fn(),
    } as any);

    mockVSCode.workspace.onDidChangeConfiguration.mockReturnValue({
      dispose: jest.fn(),
    } as any);
  });

  test('Sample test', () => {
    expect([1, 2, 3].indexOf(5)).toBe(-1);
    expect([1, 2, 3].indexOf(0)).toBe(-1);
  });

  test('extension can be activated', async () => {
    // Mock the config module directly in the test
    const configModule = require('../../src/config');
    const mockGetConfig = jest.fn().mockReturnValue(mockConfig);
    configModule.getConfig = mockGetConfig;

    // This should not throw
    await expect(activate(mockContext)).resolves.toBeUndefined();
  });

  test('extension can be deactivated', async () => {
    // This should not throw
    await expect(deactivate()).resolves.toBeUndefined();
  });
});
