/**
 * Centralized error handling utilities for Claude Copilot extension
 */

// Base error types for better error handling
export class BaseError extends Error {
  readonly code: string = 'BASE_ERROR';

  constructor(
    message: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConfigurationError extends BaseError {
  readonly code = 'CONFIGURATION_ERROR';

  constructor(
    message: string,
    public readonly context: {
      setting?: string;
      value?: unknown;
      validValues?: unknown[];
      operation?: string;
      originalError?: Error;
      [key: string]: unknown;
    } = {}
  ) {
    super(message);
  }
}

export class ServerError extends BaseError {
  readonly code = 'SERVER_ERROR';

  constructor(
    message: string,
    public readonly context: {
      port?: number;
      operation?: string;
      originalError?: Error;
    } = {}
  ) {
    super(message);
  }
}

export class MCPError extends BaseError {
  readonly code = 'MCP_ERROR';

  constructor(
    message: string,
    public readonly context: {
      clientName?: string;
      toolName?: string;
      operation?: string;
      originalError?: Error;
      status?: string;
      availableTools?: string[];
      [key: string]: unknown;
    } = {}
  ) {
    super(message);
  }
}

export class ToolRegistrationError extends BaseError {
  readonly code = 'TOOL_REGISTRATION_ERROR';

  constructor(
    message: string,
    public readonly context: {
      toolName?: string;
      operation?: string;
      originalError?: Error;
    } = {}
  ) {
    super(message);
  }
}

// Error handling utilities
export class ErrorHandler {
  /**
   * Safely converts unknown errors to structured error information
   */
  static toErrorInfo(error: unknown): {
    message: string;
    code?: string;
    context?: Record<string, unknown>;
    stack?: string;
  } {
    if (error instanceof BaseError) {
      return {
        message: error.message,
        code: error.code,
        context: error.context,
        stack: error.stack,
      };
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
      };
    }

    return {
      message: String(error),
    };
  }

  /**
   * Formats error for user display
   */
  static formatForUser(error: unknown): string {
    const errorInfo = this.toErrorInfo(error);

    if (errorInfo.code) {
      return `${errorInfo.message} (${errorInfo.code})`;
    }

    return errorInfo.message;
  }

  /**
   * Formats error for logging with full context
   */
  static formatForLogging(error: unknown): {
    message: string;
    code?: string;
    context?: Record<string, unknown>;
    stack?: string;
  } {
    return this.toErrorInfo(error);
  }

  /**
   * Wraps async operations with consistent error handling
   */
  static async wrapAsync<T>(
    operation: () => Promise<T>,
    context: {
      operationName: string;
      errorMessage?: string;
      errorType?: typeof BaseError;
    }
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const errorType = context.errorType || BaseError;
      const message = context.errorMessage || `Failed to ${context.operationName}`;

      if (errorType === BaseError) {
        throw error; // Re-throw original error if no specific type provided
      }

      throw new errorType(message, {
        operation: context.operationName,
        originalError: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}

// Type guards for error checking
export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError;
}

export function isServerError(error: unknown): error is ServerError {
  return error instanceof ServerError;
}

export function isMCPError(error: unknown): error is MCPError {
  return error instanceof MCPError;
}

export function isToolRegistrationError(error: unknown): error is ToolRegistrationError {
  return error instanceof ToolRegistrationError;
}

// Validation utilities
export class Validator {
  /**
   * Validates required string parameter
   */
  static requireString(value: unknown, name: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new ConfigurationError(`${name} must be a non-empty string`, {
        setting: name,
        value,
      });
    }
    return value;
  }

  /**
   * Validates required number parameter
   */
  static requireNumber(value: unknown, name: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ConfigurationError(`${name} must be a valid number`, {
        setting: name,
        value,
      });
    }
    return value;
  }

  /**
   * Validates enum value
   */
  static requireEnum<T extends string>(value: unknown, validValues: readonly T[], name: string): T {
    if (!validValues.includes(value as T)) {
      throw new ConfigurationError(`${name} must be one of: ${validValues.join(', ')}`, {
        setting: name,
        value,
        validValues: [...validValues],
      });
    }
    return value as T;
  }
}
