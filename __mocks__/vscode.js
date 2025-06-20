// VSCode API mock for Jest testing
// Based on industry best practices for VSCode extension testing

const languages = {
  createDiagnosticCollection: jest.fn(() => ({
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    dispose: jest.fn(),
  })),
};

const StatusBarAlignment = {
  Left: 1,
  Right: 2,
};

const window = {
  createStatusBarItem: jest.fn(() => ({
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
    text: '',
    tooltip: '',
    color: undefined,
    priority: undefined,
  })),
  showErrorMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showInformationMessage: jest.fn(),
  createTextEditorDecorationType: jest.fn(() => ({
    dispose: jest.fn(),
  })),
  activeTextEditor: undefined,
  visibleTextEditors: [],
};

const workspace = {
  getConfiguration: jest.fn(() => ({
    get: jest.fn(),
    update: jest.fn(),
    has: jest.fn(),
  })),
  workspaceFolders: [],
  onDidSaveTextDocument: jest.fn(),
  onDidChangeConfiguration: jest.fn(),
  rootPath: undefined,
};

const OverviewRulerLane = {
  Left: null,
  Center: null,
  Right: null,
  Full: null,
};

const Uri = {
  file: jest.fn(f => ({ fsPath: f, scheme: 'file', path: f })),
  parse: jest.fn(uri => ({ fsPath: uri, scheme: 'https', path: uri })),
  joinPath: jest.fn(),
  from: jest.fn(),
};

const Range = jest.fn();
const Position = jest.fn();
const Selection = jest.fn();
const Diagnostic = jest.fn();
const DiagnosticSeverity = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3,
};

const debug = {
  onDidTerminateDebugSession: jest.fn(),
  startDebugging: jest.fn(),
  activeDebugSession: undefined,
};

const commands = {
  executeCommand: jest.fn(),
  registerCommand: jest.fn(() => ({
    dispose: jest.fn(),
  })),
  getCommands: jest.fn(),
};

const env = {
  clipboard: {
    readText: jest.fn(),
    writeText: jest.fn(),
  },
  openExternal: jest.fn(),
};

// Language Model API mock for VSCode extension testing
const lm = {
  registerTool: jest.fn().mockReturnValue({
    dispose: jest.fn(),
  }),
  invokeTool: jest.fn(),
  selectChatModels: jest.fn(() => []),
  sendChatRequest: jest.fn(),
};

// Language Model Tool Result mock
const LanguageModelToolResult = jest.fn().mockImplementation(content => ({
  content: Array.isArray(content) ? content : [content],
}));

// Language Model Text Part mock
const LanguageModelTextPart = jest.fn().mockImplementation(text => ({
  type: 'text',
  text: text || '',
}));

// Extension Context mock
const ExtensionContext = {
  subscriptions: [],
  workspaceState: {
    get: jest.fn(),
    update: jest.fn(),
  },
  globalState: {
    get: jest.fn(),
    update: jest.fn(),
  },
  extensionPath: '/mock/extension/path',
  asAbsolutePath: jest.fn(path => `/mock/extension/path/${path}`),
};

// File system API mock
const FileType = {
  Unknown: 0,
  File: 1,
  Directory: 2,
  SymbolicLink: 64,
};

const FileSystemError = {
  FileNotFound: jest.fn(),
  FileExists: jest.fn(),
  FileNotADirectory: jest.fn(),
  FileIsADirectory: jest.fn(),
  NoPermissions: jest.fn(),
  Unavailable: jest.fn(),
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

module.exports = vscode;
