// VSCode API mock for Vitest testing
// Based on industry best practices for VSCode extension testing
import { vi } from 'vitest';

const languages = {
  createDiagnosticCollection: vi.fn(() => ({
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
  })),
};

const StatusBarAlignment = {
  Left: 1,
  Right: 2,
};

const window = {
  createStatusBarItem: vi.fn(() => ({
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
    text: '',
    tooltip: '',
    color: undefined,
    priority: undefined,
  })),
  createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
    name: 'mock-output-channel',
  })),
  showErrorMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showInformationMessage: vi.fn(),
  createTextEditorDecorationType: vi.fn(() => ({
    dispose: vi.fn(),
  })),
  activeTextEditor: undefined,
  visibleTextEditors: [],
};

const workspace = {
  getConfiguration: vi.fn(() => ({
    get: vi.fn((key, defaultValue) => defaultValue), // Return the default value when called
    update: vi.fn(),
    has: vi.fn(() => false),
  })),
  workspaceFolders: [],
  onDidSaveTextDocument: vi.fn(),
  onDidChangeConfiguration: vi.fn(),
  rootPath: undefined,
};

const OverviewRulerLane = {
  Left: null,
  Center: null,
  Right: null,
  Full: null,
};

const Uri = {
  file: vi.fn(f => ({ fsPath: f, scheme: 'file', path: f })),
  parse: vi.fn(uri => ({ fsPath: uri, scheme: 'https', path: uri })),
  joinPath: vi.fn(),
  from: vi.fn(),
};

const Range = vi.fn();
const Position = vi.fn();
const Selection = vi.fn();
const Diagnostic = vi.fn();
const DiagnosticSeverity = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3,
};

const debug = {
  onDidTerminateDebugSession: vi.fn(),
  startDebugging: vi.fn(),
  activeDebugSession: undefined,
};

const commands = {
  executeCommand: vi.fn(),
  registerCommand: vi.fn(() => ({
    dispose: vi.fn(),
  })),
  getCommands: vi.fn(),
};

const env = {
  clipboard: {
    readText: vi.fn(),
    writeText: vi.fn(),
  },
  openExternal: vi.fn(),
};

// Language Model API mock for VSCode extension testing
const lm = {
  registerTool: vi.fn().mockReturnValue({
    dispose: vi.fn(),
  }),
  invokeTool: vi.fn(),
  selectChatModels: vi.fn(() => []),
  sendChatRequest: vi.fn(),
};

// Language Model Tool Result mock
const LanguageModelToolResult = vi.fn().mockImplementation(content => ({
  content: Array.isArray(content) ? content : [content],
}));

// Language Model Text Part mock
const LanguageModelTextPart = vi.fn().mockImplementation(text => ({
  type: 'text',
  text: text || '',
}));

// Extension Context mock
const ExtensionContext = {
  subscriptions: [],
  workspaceState: {
    get: vi.fn(),
    update: vi.fn(),
  },
  globalState: {
    get: vi.fn(),
    update: vi.fn(),
  },
  extensionPath: '/mock/extension/path',
  asAbsolutePath: vi.fn(path => `/mock/extension/path/${path}`),
};

// File system API mock
const FileType = {
  Unknown: 0,
  File: 1,
  Directory: 2,
  SymbolicLink: 64,
};

const FileSystemError = {
  FileNotFound: vi.fn(),
  FileExists: vi.fn(),
  FileNotADirectory: vi.fn(),
  FileIsADirectory: vi.fn(),
  NoPermissions: vi.fn(),
  Unavailable: vi.fn(),
};

// Extension exports
const vscode = {
  languages,
  StatusBarAlignment,
  window,
  workspace,
  OverviewRulerLane,
  Uri,
  Range,
  Position,
  Selection,
  Diagnostic,
  DiagnosticSeverity,
  debug,
  commands,
  env,
  lm,
  LanguageModelToolResult,
  LanguageModelTextPart,
  ExtensionContext,
  FileType,
  FileSystemError,
};

export default vscode;
export { vscode };
