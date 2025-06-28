/**
 * Centralized logging utilities for Claude Copilot extension
 */

import * as vscode from 'vscode';
import * as winston from 'winston';
import { OutputChannelTransport } from 'winston-transport-vscode';
import { ErrorHandler } from './errors';

// Log levels
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

// Log context interface
export interface LogContext {
  component?: string;
  operation?: string;
  toolName?: string;
  clientName?: string;
  port?: number;
  [key: string]: unknown;
}

// Centralized logger class
export class Logger {
  private static instance: Logger;
  private winston: winston.Logger;
  private outputChannel: vscode.OutputChannel;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Claude Copilot');
    this.winston = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      transports: [
        new OutputChannelTransport({
          outputChannel: this.outputChannel,
        }),
      ],
    });
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Log error with full context
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    const errorInfo = error ? ErrorHandler.formatForLogging(error) : undefined;

    this.winston.error(message, {
      ...context,
      error: errorInfo,
      timestamp: new Date().toISOString(),
    });

    // Also show critical errors to user
    if (context?.component === 'extension' || context?.component === 'server') {
      this.outputChannel.show(true);
    }
  }

  /**
   * Log warning
   */
  warn(message: string, context?: LogContext): void {
    this.winston.warn(message, {
      ...context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log info
   */
  info(message: string, context?: LogContext): void {
    this.winston.info(message, {
      ...context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log debug info
   */
  debug(message: string, context?: LogContext): void {
    this.winston.debug(message, {
      ...context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Show output channel to user
   */
  show(): void {
    this.outputChannel.show();
  }

  /**
   * Clear output channel
   */
  clear(): void {
    this.outputChannel.clear();
  }

  /**
   * Get raw output channel for VS Code integrations
   */
  getOutputChannel(): vscode.OutputChannel {
    return this.outputChannel;
  }
}

// Convenience functions for common logging patterns
export class LoggingUtils {
  private static logger = Logger.getInstance();

  /**
   * Log extension lifecycle events
   */
  static logExtensionEvent(event: string, context?: Omit<LogContext, 'component'>): void {
    this.logger.info(`Extension ${event}`, {
      component: 'extension',
      ...context,
    });
  }

  /**
   * Log server events
   */
  static logServerEvent(event: string, context?: Omit<LogContext, 'component'>): void {
    this.logger.info(`Server ${event}`, {
      component: 'server',
      ...context,
    });
  }

  /**
   * Log MCP client events
   */
  static logMCPEvent(event: string, context?: Omit<LogContext, 'component'>): void {
    this.logger.info(`MCP ${event}`, {
      component: 'mcp',
      ...context,
    });
  }

  /**
   * Log tool registration events
   */
  static logToolEvent(event: string, context?: Omit<LogContext, 'component'>): void {
    this.logger.info(`Tool ${event}`, {
      component: 'tools',
      ...context,
    });
  }

  /**
   * Log configuration events
   */
  static logConfigEvent(event: string, context?: Omit<LogContext, 'component'>): void {
    this.logger.info(`Config ${event}`, {
      component: 'config',
      ...context,
    });
  }

  /**
   * Log operation timing
   */
  static logTiming<T>(
    operation: string,
    task: () => T | Promise<T>,
    context?: LogContext
  ): T | Promise<T> {
    const startTime = Date.now();

    this.logger.debug(`Starting ${operation}`, context);

    const result = task();

    if (result instanceof Promise) {
      return result
        .then(value => {
          const duration = Date.now() - startTime;
          this.logger.debug(`Completed ${operation}`, {
            ...context,
            duration,
          });
          return value;
        })
        .catch(error => {
          const duration = Date.now() - startTime;
          this.logger.error(`Failed ${operation}`, error, {
            ...context,
            duration,
          });
          throw error;
        });
    } else {
      const duration = Date.now() - startTime;
      this.logger.debug(`Completed ${operation}`, {
        ...context,
        duration,
      });
      return result;
    }
  }

  /**
   * Create scoped logger for specific component
   */
  static createComponentLogger(component: string) {
    return {
      error: (message: string, error?: unknown, context?: Omit<LogContext, 'component'>) =>
        this.logger.error(message, error, { component, ...context }),
      warn: (message: string, context?: Omit<LogContext, 'component'>) =>
        this.logger.warn(message, { component, ...context }),
      info: (message: string, context?: Omit<LogContext, 'component'>) =>
        this.logger.info(message, { component, ...context }),
      debug: (message: string, context?: Omit<LogContext, 'component'>) =>
        this.logger.debug(message, { component, ...context }),
    };
  }
}

// Export singleton logger instance
export const logger = Logger.getInstance();

// Export component-specific loggers
export const extensionLogger = LoggingUtils.createComponentLogger('extension');
export const serverLogger = LoggingUtils.createComponentLogger('server');
export const mcpLogger = LoggingUtils.createComponentLogger('mcp');
export const toolLogger = LoggingUtils.createComponentLogger('tools');
export const configLogger = LoggingUtils.createComponentLogger('config');
