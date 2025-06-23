// @ts-nocheck
import * as vscode from 'vscode';
import { newServer } from './server';
import { getConfig, suggestAlternativePorts } from './config';
import { claudeToolSignatures } from './claudeTools';
import { ServerInstance, ToolSignature, MCPCallResult, ExtensionContext } from './types';

// Create output channel for debugging
const outputChannel = vscode.window.createOutputChannel('HTTP LM API');

let server: ServerInstance;
let extensionContext: ExtensionContext;

// Global registry for registered Claude Code tools
const dummyRegistry = new Set<string>();

// Export for testing purposes
export function clearDummyRegistry(): void {
  dummyRegistry.clear();
}

// Get extension context for dynamic registration
export function getExtensionContext(): ExtensionContext | undefined {
  return extensionContext;
}

// Add tool to runtime registry
export function addDiscoveredTool(toolSignature: ToolSignature): boolean {
  try {
    // Check if tool already exists
    const existingIndex = claudeToolSignatures.findIndex(t => t.name === toolSignature.name);
    if (existingIndex !== -1) {
      logToOutput(`🔄 Updating existing tool signature: ${toolSignature.name}`);
      // @ts-ignore - Type mismatch during dynamic tool updates
      claudeToolSignatures[existingIndex] = toolSignature;
    } else {
      logToOutput(`➕ Adding new tool signature: ${toolSignature.name}`);
      // @ts-ignore - Type mismatch during dynamic tool updates
      claudeToolSignatures.push(toolSignature);
    }
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const toolName = toolSignature?.name || 'unknown';
    logToOutput(`❌ Failed to add discovered tool ${toolName}: ${errorMessage}`);
    return false;
  }
}

// Register MCP tool dynamically
export function registerMCPTool(
  toolName: string,
  toolSchema: ToolSignature,
  mcpCallHandler: (name: string, params: Record<string, unknown>) => Promise<MCPCallResult>
): boolean {
  const context = getExtensionContext();
  if (!context) {
    logToOutput(`❌ Extension context not available for MCP tool registration: ${toolName}`);
    return false;
  }

  if (dummyRegistry.has(toolName)) {
    logToOutput(`✅ MCP tool ${toolName} already registered`);
    return true;
  }

  try {
    const disposable = vscode.lm.registerTool(toolName, {
      async invoke(request, _token) {
        logToOutput(`🔧 MCP tool ${toolName} invoked with: ${JSON.stringify(request.input)}`);
        try {
          // @ts-ignore - Input parameter type flexibility
          const result = await mcpCallHandler(toolName, request.input || {});
          // Convert MCP result to VS Code format
          let resultText = '';
          if (result.content) {
            for (const content of result.content) {
              if (content.type === 'text') {
                resultText += content.text;
              }
            }
          } else if (typeof result === 'string') {
            resultText = result;
          } else {
            resultText = JSON.stringify(result);
          }

          return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(resultText)]);
        } catch (error) {
          logToOutput(`❌ MCP tool ${toolName} execution failed: ${error}`);
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error executing MCP tool ${toolName}: ${error}`),
          ]);
        }
      },
    });

    context.subscriptions.push(disposable);
    dummyRegistry.add(toolName);
    logToOutput(`🔧 Registered MCP tool: ${toolName}`);
    return true;
  } catch (error) {
    logToOutput(`❌ Failed to register MCP tool ${toolName}: ${error}`);
    return false;
  }
}

// Enhanced logging function
function logToOutput(message: string): void {
  outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
}

// Dynamic tool registration function
export function registerToolDynamically(toolName: string, context: ExtensionContext): boolean {
  const toolSig = claudeToolSignatures.find(t => t.name === toolName);
  if (!toolSig) {
    logToOutput(`❌ Tool signature not found for: ${toolName}`);
    return false;
  }

  if (dummyRegistry.has(toolName)) {
    logToOutput(`✅ Tool ${toolName} already registered`);
    return true;
  }

  try {
    const disposable = vscode.lm.registerTool(toolName, {
      async invoke() {
        logToOutput(`🔧 Tool ${toolName} invoked - returning stub response`);
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart('(executed by Claude Code)'),
        ]);
      },
    });
    context.subscriptions.push(disposable);
    dummyRegistry.add(toolName);
    logToOutput(`🔧 Dynamically registered tool: ${toolName}`);
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logToOutput(`❌ Failed to dynamically register tool ${toolName}: ${errorMessage}`);
    return false;
  }
}

export async function activate(context: ExtensionContext): Promise<void> {
  try {
    extensionContext = context;

    // Show output channel immediately so users can see what's happening
    outputChannel.show(true);
    logToOutput('🚀 HTTP LM API Extension activation started...');
    logToOutput(`📋 VS Code version: ${vscode.version}`);
    logToOutput(`📋 Node version: ${process.version}`);

    // Test basic functionality first
    logToOutput('📋 Testing VS Code API access...');
    vscode.window.showInformationMessage('Claude Copilot extension is activating...');

    logToOutput('📋 Loading configuration...');
    let config = getConfig();
    logToOutput(
      `📋 Configuration loaded - Port: ${config.port}, Auto-start: ${config.startServerAutomatically}`
    );

    logToOutput('📋 Creating server instance...');
    server = newServer(config);
    logToOutput('✅ Server instance created successfully');

    // Register all Claude Code official tools at startup
    logToOutput('📋 Registering Claude Code tools...');
    registerClaudeCodeTools(context);

    // Listen for configuration changes
    logToOutput('📋 Setting up configuration change listener...');
    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('http-lm-api')) {
        config = getConfig();
        server.updateConfig(config);
      }
    });

    logToOutput('📋 Registering command handlers...');
    const startLmApiServerDisposable = vscode.commands.registerCommand(
      'http-lm-api.startLmApiServer',
      async () => {
        try {
          const isRunning = await server.isRunning();
          if (isRunning) {
            vscode.window.showInformationMessage('LM API server is already running');
            return;
          }

          logToOutput('🎯 Manual server start requested...');
          await server.start();

          // Verify the server started successfully
          const isNowRunning = await server.isRunning();
          if (isNowRunning) {
            logToOutput('✅ Manual server start successful');
            outputChannel.show(true);
          } else {
            throw new Error('Server start command completed but verification failed');
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logToOutput(`❌ Manual server start failed: ${errorMessage}`);
          outputChannel.show(true);
          vscode.window
            .showErrorMessage(`Failed to start LM API server: ${errorMessage}`, 'Show Output')
            .then(choice => {
              if (choice === 'Show Output') {
                outputChannel.show();
              }
            });
        }
      }
    );

    const stopLmApiServerDisposable = vscode.commands.registerCommand(
      'http-lm-api.stopLmApiServer',
      async () => {
        try {
          const isRunning = await server.isRunning();
          if (!isRunning) {
            vscode.window.showInformationMessage('LM API server is not currently running');
            return;
          }

          logToOutput('🛑 Manual server stop requested...');
          server.stop();
          logToOutput('✅ Manual server stop completed');
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logToOutput(`❌ Error during manual server stop: ${errorMessage}`);
          vscode.window.showErrorMessage(`Error stopping server: ${errorMessage}`);
        }
      }
    );

    context.subscriptions.push(configChangeDisposable);
    context.subscriptions.push(startLmApiServerDisposable);
    context.subscriptions.push(stopLmApiServerDisposable);

    if (config.startServerAutomatically) {
      try {
        logToOutput('🌐 Starting HTTP LM API server automatically...');
        logToOutput(`📍 Server will bind to http://localhost:${config.port}`);

        await server.start();

        // Verify the server is actually running
        const isRunning = await server.isRunning();
        if (isRunning) {
          logToOutput(
            `✅ Server verification successful - HTTP LM API server is running on port ${config.port}`
          );
          outputChannel.show(true); // Show the output channel with the success message
        } else {
          throw new Error('Server started but failed verification check');
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logToOutput(`❌ Failed to start server: ${errorMessage}`);

        // Show output channel for debugging
        outputChannel.show(true);

        // Provide more helpful error messages
        let userMessage = `Failed to start LM API server: ${errorMessage}`;
        let actions: string[] = [];

        if (errorMessage.includes('EADDRINUSE') || errorMessage.includes('already in use')) {
          const suggestions = suggestAlternativePorts(config.port);
          userMessage = `Port ${config.port} is already in use. Try one of these alternatives: ${suggestions.slice(0, 3).join(', ')}`;
          actions = ['Try Alternative Port', 'Change Port', 'Show Output'];
        } else if (errorMessage.includes('EACCES') || errorMessage.includes('permission denied')) {
          userMessage = `Permission denied on port ${config.port}. Try using a port above 1024.`;
          actions = ['Change Port', 'Show Output'];
        } else {
          userMessage = `Server startup failed: ${errorMessage}`;
          actions = ['Retry', 'Show Output', 'Disable Auto-start'];
        }

        const choice = await vscode.window.showErrorMessage(userMessage, ...actions);

        switch (choice) {
          case 'Try Alternative Port':
            const suggestions = suggestAlternativePorts(config.port);
            if (suggestions.length > 0) {
              const selectedPort = await vscode.window.showQuickPick(
                suggestions.map(port => ({
                  label: `Port ${port}`,
                  description: `http://localhost:${port}`,
                  port: port,
                })),
                { placeHolder: 'Select an alternative port' }
              );

              if (selectedPort) {
                await vscode.workspace
                  .getConfiguration('http-lm-api')
                  .update('port', selectedPort.port, true);
                vscode.window.showInformationMessage(
                  `Port updated to ${selectedPort.port}. Restarting server...`
                );

                // Update config and restart server
                const newConfig = getConfig();
                server.updateConfig(newConfig);
                try {
                  await server.start();
                  const isRunning = await server.isRunning();
                  if (isRunning) {
                    vscode.window.showInformationMessage(
                      `Server started successfully on port ${selectedPort.port}`
                    );
                  }
                } catch (restartError: unknown) {
                  const restartErrorMessage =
                    restartError instanceof Error ? restartError.message : String(restartError);
                  logToOutput(`❌ Failed to restart with new port: ${restartErrorMessage}`);
                }
              }
            }
            break;
          case 'Change Port':
            await vscode.commands.executeCommand(
              'workbench.action.openSettings',
              'http-lm-api.port'
            );
            break;
          case 'Show Output':
            outputChannel.show();
            break;
          case 'Retry':
            // Try starting the server again
            try {
              logToOutput('🔄 Retrying server startup...');
              await server.start();
              const isRunning = await server.isRunning();
              if (isRunning) {
                logToOutput(
                  `✅ Retry successful - HTTP LM API server is running on port ${config.port}`
                );
                vscode.window.showInformationMessage(
                  `LM API server started successfully on port ${config.port}`
                );
              }
            } catch (retryError: unknown) {
              const retryErrorMessage =
                retryError instanceof Error ? retryError.message : String(retryError);
              logToOutput(`❌ Retry failed: ${retryErrorMessage}`);
            }
            break;
          case 'Disable Auto-start':
            await vscode.workspace
              .getConfiguration('http-lm-api')
              .update('startServerAutomatically', false, true);
            vscode.window.showInformationMessage(
              'Auto-start disabled. You can start the server manually using the "Start LM API Server" command.'
            );
            break;
        }
      }
    } else {
      logToOutput('⏸️ Auto-start disabled, server not started');
      logToOutput(
        `💡 To start the server manually, use the "Start LM API Server" command or change the setting "http-lm-api.startServerAutomatically" to true`
      );
      vscode.window
        .showInformationMessage(
          'LM API server is not started automatically. Use "Start LM API Server" command to start it.',
          'Start Now',
          'Enable Auto-start'
        )
        .then(choice => {
          switch (choice) {
            case 'Start Now':
              vscode.commands.executeCommand('http-lm-api.startLmApiServer');
              break;
            case 'Enable Auto-start':
              vscode.workspace
                .getConfiguration('http-lm-api')
                .update('startServerAutomatically', true, true);
              break;
          }
        });
    }

    logToOutput('✅ Extension activation completed successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logToOutput(`❌ CRITICAL: Extension activation failed: ${errorMessage}`);
    logToOutput(`❌ Error stack: ${error instanceof Error ? error.stack : 'No stack available'}`);

    // Show output channel and error to user
    outputChannel.show(true);
    vscode.window
      .showErrorMessage(
        `Claude Copilot extension failed to activate: ${errorMessage}`,
        'Show Output',
        'Report Issue'
      )
      .then(choice => {
        switch (choice) {
          case 'Show Output':
            outputChannel.show();
            break;
          case 'Report Issue':
            vscode.env.openExternal(
              vscode.Uri.parse('https://github.com/victornanka/claude-copilot/issues')
            );
            break;
        }
      });

    // Re-throw the error to ensure VS Code knows the activation failed
    throw error;
  }
}

// This method is called when your extension is deactivated
export async function deactivate(): Promise<void> {
  logToOutput('🔄 Extension deactivation started');

  if (!server) {
    logToOutput('⚠️ Server is not initialized');
  } else {
    logToOutput('🛑 Trying to stop server');
    await server.stop();
  }

  logToOutput('✅ Extension deactivation finished');
}

// Register all 16 Claude Code official tools as empty stubs
function registerClaudeCodeTools(context: ExtensionContext): void {
  logToOutput(`🚀 Registering ${claudeToolSignatures.length} Claude Code official tools...`);

  for (const toolSig of claudeToolSignatures) {
    if (!dummyRegistry.has(toolSig.name)) {
      try {
        const disposable = vscode.lm.registerTool(toolSig.name, {
          async invoke() {
            logToOutput(`🔧 Claude Code tool ${toolSig.name} invoked - returning stub response`);
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart('(executed by Claude Code)'),
            ]);
          },
        });
        context.subscriptions.push(disposable);
        dummyRegistry.add(toolSig.name);
        logToOutput(`✅ Registered Claude Code tool: ${toolSig.name}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logToOutput(`❌ Failed to register tool ${toolSig.name}: ${errorMessage}`);
      }
    }
  }

  const expectedTools = [
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
  ];

  logToOutput(`🎯 Expected 16 tools, registered ${dummyRegistry.size} tools`);
  logToOutput(`📋 Registered tools: ${Array.from(dummyRegistry).join(', ')}`);

  // Verify all expected tools are registered
  const missingTools = expectedTools.filter(tool => !dummyRegistry.has(tool));
  if (missingTools.length > 0) {
    logToOutput(`⚠️ Missing tools: ${missingTools.join(', ')}`);
  } else {
    logToOutput(`🎉 All 16 Claude Code tools registered successfully!`);
  }

  vscode.window.showInformationMessage(`Claude Code: Registered ${dummyRegistry.size}/16 tools`);
}
