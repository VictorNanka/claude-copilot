// Mock for src/utils/logging.ts
import { vi } from 'vitest';

export const Logger = {
  getInstance: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    show: vi.fn(),
    clear: vi.fn(),
    getOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      show: vi.fn(),
    })),
  })),
};

export const LoggingUtils = {
  logExtensionEvent: vi.fn(),
  logServerEvent: vi.fn(),
  logMCPEvent: vi.fn(),
  logToolEvent: vi.fn(),
  logConfigEvent: vi.fn(),
  logTiming: vi.fn((operation, task) => task()),
  createComponentLogger: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  })),
};

export const logger = Logger.getInstance();
export const extensionLogger = LoggingUtils.createComponentLogger('extension');
export const serverLogger = LoggingUtils.createComponentLogger('server');
export const mcpLogger = LoggingUtils.createComponentLogger('mcp');
export const toolLogger = LoggingUtils.createComponentLogger('tools');
export const configLogger = LoggingUtils.createComponentLogger('config');

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export interface LogContext {
  component?: string;
  operation?: string;
  [key: string]: unknown;
}
