/**
 * Extension Lifecycle Manager
 * Handles the complex lifecycle operations of the VS Code extension
 */

import * as vscode from 'vscode';
import { Config } from '../config';
import { ServerInstance, ExtensionContext } from '../types';
import { ServerError, ConfigurationError, ErrorHandler } from '../utils/errors';
import { extensionLogger, LoggingUtils } from '../utils/logging';

export interface ExtensionState {
  context: ExtensionContext;
  server: ServerInstance;
  config: Config;
  outputChannel: vscode.OutputChannel;
  isActivated: boolean;
}

export class ExtensionLifecycleManager {
  private state: ExtensionState | null = null;
  private disposables: vscode.Disposable[] = [];

  /**
   * Initialize the extension with all necessary components
   */
  async initialize(
    context: ExtensionContext,
    server: ServerInstance,
    config: Config
  ): Promise<void> {
    return LoggingUtils.logTiming('extension initialization', async () => {
      try {
        extensionLogger.info('Starting extension initialization', {
          extensionId: context.extension.id,
          version: context.extension.packageJSON.version,
        });

        const outputChannel = vscode.window.createOutputChannel('Claude Copilot');

        this.state = {
          context,
          server,
          config,
          outputChannel,
          isActivated: false,
        };

        // Show output channel for user visibility
        outputChannel.show(true);

        // Initialize components in order
        await this.registerCommands();
        await this.setupConfigurationWatcher();
        await this.startServerIfConfigured();

        this.state.isActivated = true;

        extensionLogger.info('Extension initialization completed successfully', {
          serverAutoStart: config.startServerAutomatically,
          port: config.port,
        });
      } catch (error) {
        extensionLogger.error('Extension initialization failed', error);
        throw new ConfigurationError('Failed to initialize extension', {
          operation: 'initialize',
          originalError: error instanceof Error ? error : new Error(String(error)),
        });
      }
    });
  }

  /**
   * Register all VS Code commands
   */
  private async registerCommands(): Promise<void> {
    if (!this.state) {
      throw new Error('Extension not initialized');
    }

    extensionLogger.debug('Registering VS Code commands');

    // Start server command
    const startCommand = vscode.commands.registerCommand('http-lm-api.startLmApiServer', async () =>
      this.handleStartServerCommand()
    );

    // Stop server command
    const stopCommand = vscode.commands.registerCommand('http-lm-api.stopLmApiServer', async () =>
      this.handleStopServerCommand()
    );

    this.disposables.push(startCommand, stopCommand);
    this.state.context.subscriptions.push(...this.disposables);

    extensionLogger.debug('Commands registered successfully', {
      commandCount: this.disposables.length,
    });
  }

  /**
   * Setup configuration change monitoring
   */
  private async setupConfigurationWatcher(): Promise<void> {
    if (!this.state) {
      throw new Error('Extension not initialized');
    }

    extensionLogger.debug('Setting up configuration watcher');

    const configWatcher = vscode.workspace.onDidChangeConfiguration(async event => {
      if (event.affectsConfiguration('http-lm-api')) {
        await this.handleConfigurationChange();
      }
    });

    this.disposables.push(configWatcher);
    this.state.context.subscriptions.push(configWatcher);

    extensionLogger.debug('Configuration watcher setup complete');
  }

  /**
   * Handle configuration changes
   */
  private async handleConfigurationChange(): Promise<void> {
    if (!this.state) {
      return;
    }

    try {
      extensionLogger.info('Configuration change detected, updating server');

      // Import config dynamically to get fresh configuration
      const { getConfig } = await import('../config.js');
      const newConfig = getConfig();

      this.state.config = newConfig;
      this.state.server.updateConfig(newConfig);

      extensionLogger.info('Configuration updated successfully', {
        port: newConfig.port,
        autoStart: newConfig.startServerAutomatically,
      });
    } catch (error) {
      extensionLogger.error('Failed to handle configuration change', error);

      vscode.window.showErrorMessage(
        `Failed to update configuration: ${ErrorHandler.formatForUser(error)}`
      );
    }
  }

  /**
   * Start server if configured to do so
   */
  private async startServerIfConfigured(): Promise<void> {
    if (!this.state) {
      throw new Error('Extension not initialized');
    }

    if (!this.state.config.startServerAutomatically) {
      extensionLogger.info('Auto-start disabled, server not started');
      await this.showManualStartPrompt();
      return;
    }

    try {
      extensionLogger.info('Starting server automatically', {
        port: this.state.config.port,
      });

      await this.state.server.start();

      // Verify server is running
      const isRunning = await this.state.server.isRunning();
      if (isRunning) {
        extensionLogger.info('Server started and verified successfully', {
          port: this.state.config.port,
        });
        this.state.outputChannel.show(true);
      } else {
        throw new ServerError('Server started but verification failed', {
          port: this.state.config.port,
          operation: 'start_verify',
        });
      }
    } catch (error) {
      extensionLogger.error('Failed to start server automatically', error);
      await this.handleServerStartFailure(error);
    }
  }

  /**
   * Handle server start command
   */
  private async handleStartServerCommand(): Promise<void> {
    if (!this.state) {
      return;
    }

    try {
      const isRunning = await this.state.server.isRunning();
      if (isRunning) {
        vscode.window.showInformationMessage('LM API server is already running');
        return;
      }

      extensionLogger.info('Manual server start requested');
      await this.state.server.start();

      const isNowRunning = await this.state.server.isRunning();
      if (isNowRunning) {
        extensionLogger.info('Manual server start successful');
        this.state.outputChannel.show(true);
        vscode.window.showInformationMessage(
          `LM API server started on port ${this.state.config.port}`
        );
      } else {
        throw new ServerError('Server start verification failed');
      }
    } catch (error) {
      extensionLogger.error('Manual server start failed', error);
      this.state.outputChannel.show(true);

      const choice = await vscode.window.showErrorMessage(
        `Failed to start LM API server: ${ErrorHandler.formatForUser(error)}`,
        'Show Output',
        'Open Settings'
      );

      this.handleErrorAction(choice);
    }
  }

  /**
   * Handle server stop command
   */
  private async handleStopServerCommand(): Promise<void> {
    if (!this.state) {
      return;
    }

    try {
      const isRunning = await this.state.server.isRunning();
      if (!isRunning) {
        vscode.window.showInformationMessage('LM API server is not currently running');
        return;
      }

      extensionLogger.info('Manual server stop requested');
      this.state.server.stop();
      extensionLogger.info('Manual server stop completed');

      vscode.window.showInformationMessage('LM API server stopped');
    } catch (error) {
      extensionLogger.error('Manual server stop failed', error);
      vscode.window.showErrorMessage(`Error stopping server: ${ErrorHandler.formatForUser(error)}`);
    }
  }

  /**
   * Handle server start failures with user-friendly options
   */
  private async handleServerStartFailure(error: unknown): Promise<void> {
    if (!this.state) {
      return;
    }

    this.state.outputChannel.show(true);

    const errorInfo = ErrorHandler.toErrorInfo(error);
    let message = `Failed to start LM API server: ${errorInfo.message}`;
    let actions: string[] = ['Show Output', 'Retry'];

    // Provide specific help based on error type
    if (errorInfo.message.includes('EADDRINUSE') || errorInfo.message.includes('already in use')) {
      message = `Port ${this.state.config.port} is already in use. Please choose a different port.`;
      actions = ['Change Port', 'Show Output', 'Disable Auto-start'];
    } else if (
      errorInfo.message.includes('EACCES') ||
      errorInfo.message.includes('permission denied')
    ) {
      message = `Permission denied on port ${this.state.config.port}. Try using a port above 1024.`;
      actions = ['Change Port', 'Show Output'];
    }

    const choice = await vscode.window.showErrorMessage(message, ...actions);
    await this.handleErrorAction(choice);
  }

  /**
   * Handle error action choices
   */
  private async handleErrorAction(choice: string | undefined): Promise<void> {
    if (!choice) {
      return;
    }

    switch (choice) {
      case 'Show Output':
        this.state?.outputChannel.show();
        break;

      case 'Change Port':
      case 'Open Settings':
        await vscode.commands.executeCommand('workbench.action.openSettings', 'http-lm-api.port');
        break;

      case 'Retry':
        if (this.state) {
          try {
            await this.state.server.start();
            const isRunning = await this.state.server.isRunning();
            if (isRunning) {
              extensionLogger.info('Retry successful');
              vscode.window.showInformationMessage(
                `LM API server started successfully on port ${this.state.config.port}`
              );
            }
          } catch (retryError) {
            extensionLogger.error('Retry failed', retryError);
          }
        }
        break;

      case 'Disable Auto-start':
        await vscode.workspace
          .getConfiguration('http-lm-api')
          .update('startServerAutomatically', false, true);
        vscode.window.showInformationMessage(
          'Auto-start disabled. Use "Start LM API Server" command to start manually.'
        );
        break;
    }
  }

  /**
   * Show manual start prompt when auto-start is disabled
   */
  private async showManualStartPrompt(): Promise<void> {
    const choice = await vscode.window.showInformationMessage(
      'LM API server is not started automatically. Would you like to start it now?',
      'Start Now',
      'Enable Auto-start'
    );

    switch (choice) {
      case 'Start Now':
        await vscode.commands.executeCommand('http-lm-api.startLmApiServer');
        break;

      case 'Enable Auto-start':
        await vscode.workspace
          .getConfiguration('http-lm-api')
          .update('startServerAutomatically', true, true);
        break;
    }
  }

  /**
   * Cleanup on extension deactivation
   */
  async cleanup(): Promise<void> {
    if (!this.state) {
      return;
    }

    extensionLogger.info('Starting extension cleanup');

    try {
      // Dispose all registered disposables
      for (const disposable of this.disposables) {
        try {
          disposable.dispose();
        } catch (error) {
          extensionLogger.warn('Error disposing resource', { error });
        }
      }
      this.disposables = [];

      // Stop server if running
      if (this.state.server) {
        try {
          await this.state.server.stop();
        } catch (error) {
          extensionLogger.warn('Error stopping server during cleanup', { error });
        }
      }

      this.state.isActivated = false;
      extensionLogger.info('Extension cleanup completed');
    } catch (error) {
      extensionLogger.error('Error during extension cleanup', error);
    } finally {
      this.state = null;
    }
  }

  /**
   * Get current extension state
   */
  getState(): ExtensionState | null {
    return this.state;
  }

  /**
   * Check if extension is properly activated
   */
  isActivated(): boolean {
    return this.state?.isActivated ?? false;
  }
}
