/**
 * Tool Registration Manager
 * Handles registration and management of Claude Code tools and MCP tools
 */

import * as vscode from 'vscode';
import { claudeToolSignatures } from '../claudeTools';
import { ToolSignature, ExtensionContext } from '../types';
import { ToolRegistrationError } from '../utils/errors';
import { toolLogger, LoggingUtils } from '../utils/logging';

export interface ToolRegistryStats {
  claudeToolsRegistered: number;
  mcpToolsRegistered: number;
  totalRegistered: number;
  failedRegistrations: number;
  expectedClaudeTools: number;
}

export class ToolRegistrationManager {
  private readonly dummyRegistry = new Set<string>();
  private readonly expectedClaudeTools = [
    'Task',
    'Bash',
    'Glob',
    'Grep',
    'LS',
    'exit_plan_mode',
    'Read',
    'Edit',
    'MultiEdit',
    'Write',
    'NotebookRead',
    'NotebookEdit',
    'WebFetch',
    'TodoRead',
    'TodoWrite',
    'WebSearch',
  ] as const;

  private context: ExtensionContext | null = null;
  private registrationStats: ToolRegistryStats = {
    claudeToolsRegistered: 0,
    mcpToolsRegistered: 0,
    totalRegistered: 0,
    failedRegistrations: 0,
    expectedClaudeTools: 16,
  };

  /**
   * Initialize the tool registration manager
   */
  initialize(context: ExtensionContext): void {
    this.context = context;
    toolLogger.info('Tool registration manager initialized');
  }

  /**
   * Register all Claude Code official tools
   */
  async registerClaudeCodeTools(): Promise<ToolRegistryStats> {
    if (!this.context) {
      throw new ToolRegistrationError('Tool registration manager not initialized');
    }

    return LoggingUtils.logTiming('Claude Code tools registration', async () => {
      toolLogger.info('Starting Claude Code tools registration', {
        toolCount: claudeToolSignatures.length,
      });

      let successCount = 0;
      let failureCount = 0;

      for (const toolSig of claudeToolSignatures) {
        try {
          const success = await this.registerClaudeCodeTool(toolSig);
          if (success) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          failureCount++;
          toolLogger.error('Failed to register Claude Code tool', error, {
            toolName: toolSig.name,
          });
        }
      }

      this.registrationStats.claudeToolsRegistered = successCount;
      this.registrationStats.failedRegistrations += failureCount;
      this.registrationStats.totalRegistered = this.dummyRegistry.size;

      this.logRegistrationSummary();
      this.showRegistrationStatusToUser();

      return this.registrationStats;
    });
  }

  /**
   * Register a single Claude Code tool
   */
  private async registerClaudeCodeTool(toolSig: ToolSignature): Promise<boolean> {
    if (!this.context) {
      throw new ToolRegistrationError('Context not available', { toolName: toolSig.name });
    }

    if (this.dummyRegistry.has(toolSig.name)) {
      toolLogger.debug('Tool already registered', { toolName: toolSig.name });
      return true;
    }

    try {
      const disposable = vscode.lm.registerTool(toolSig.name, {
        async invoke() {
          toolLogger.debug('Claude Code tool invoked', { toolName: toolSig.name });
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('(executed by Claude Code)'),
          ]);
        },
      });

      this.context.subscriptions.push(disposable);
      this.dummyRegistry.add(toolSig.name);

      toolLogger.debug('Claude Code tool registered successfully', {
        toolName: toolSig.name,
      });

      return true;
    } catch (error) {
      const toolError = new ToolRegistrationError(
        `Failed to register Claude Code tool '${toolSig.name}'`,
        {
          toolName: toolSig.name,
          operation: 'register_claude_tool',
          originalError: error instanceof Error ? error : new Error(String(error)),
        }
      );

      toolLogger.error('Claude Code tool registration failed', toolError);
      return false;
    }
  }

  /**
   * Get current registration statistics
   */
  getRegistrationStats(): ToolRegistryStats {
    return { ...this.registrationStats };
  }

  /**
   * Get list of registered tool names
   */
  getRegisteredTools(): string[] {
    return Array.from(this.dummyRegistry);
  }

  /**
   * Check if a tool is registered
   */
  isToolRegistered(toolName: string): boolean {
    return this.dummyRegistry.has(toolName);
  }

  /**
   * Clear the registry (for testing)
   */
  clearRegistry(): void {
    this.dummyRegistry.clear();
    this.registrationStats = {
      claudeToolsRegistered: 0,
      mcpToolsRegistered: 0,
      totalRegistered: 0,
      failedRegistrations: 0,
      expectedClaudeTools: 16,
    };
    toolLogger.debug('Tool registry cleared');
  }

  /**
   * Log registration summary
   */
  private logRegistrationSummary(): void {
    const stats = this.registrationStats;
    const missingTools = this.expectedClaudeTools.filter(tool => !this.dummyRegistry.has(tool));

    toolLogger.info('Tool registration summary', {
      expected: stats.expectedClaudeTools,
      claudeRegistered: stats.claudeToolsRegistered,
      mcpRegistered: stats.mcpToolsRegistered,
      totalRegistered: stats.totalRegistered,
      failed: stats.failedRegistrations,
      missingTools: missingTools.length > 0 ? missingTools : undefined,
    });
  }

  /**
   * Show registration status to user
   */
  private showRegistrationStatusToUser(): void {
    const stats = this.registrationStats;
    const message = `Claude Code: Registered ${stats.totalRegistered}/${stats.expectedClaudeTools} tools`;

    if (stats.claudeToolsRegistered === stats.expectedClaudeTools) {
      vscode.window.showInformationMessage(message);
    } else {
      vscode.window.showWarningMessage(`${message} (${stats.failedRegistrations} failed)`);
    }
  }
}
