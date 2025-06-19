// @ts-nocheck
import * as vscode from 'vscode';
import { newServer } from './server';
import { getConfig } from './config';
import { claudeToolSignatures } from './claudeTools';
import { ServerInstance, ToolSignature, MCPCallResult, ExtensionContext } from './types';

// Create output channel for debugging
const outputChannel = vscode.window.createOutputChannel('HTTP LM API');

let server: ServerInstance;
let extensionContext: ExtensionContext;

// Global registry for registered Claude Code tools
const dummyRegistry = new Set<string>();

// Clear registry (for testing)
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
      claudeToolSignatures[existingIndex] = toolSignature;
    } else {
      logToOutput(`➕ Adding new tool signature: ${toolSignature.name}`);
      claudeToolSignatures.push(toolSignature);
    }
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const name = (toolSignature as any)?.name ?? 'unknown';
    logToOutput(`❌ Failed to add discovered tool ${name}: ${errorMessage}`);
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
  console.log(message);
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
  extensionContext = context;
  logToOutput('🚀 HTTP LM API Extension activating...');

  let config = getConfig();
  server = newServer(config);

  // Register all Claude Code official tools at startup
  registerClaudeCodeTools(context);

  // Listen for configuration changes
  const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('http-lm-api')) {
      config = getConfig();
      server.updateConfig(config);
    }
  });

  const startLmApiServerDisposable = vscode.commands.registerCommand(
    'http-lm-api.startLmApiServer',
    async () => {
      await server.start();
    }
  );

  const stopLmApiServerDisposable = vscode.commands.registerCommand(
    'http-lm-api.stopLmApiServer',
    async () => {
      await server.stop();
    }
  );

  context.subscriptions.push(configChangeDisposable);
  context.subscriptions.push(startLmApiServerDisposable);
  context.subscriptions.push(stopLmApiServerDisposable);

  if (config.startAutomatically) {
    try {
      logToOutput('🌐 Starting HTTP LM API server automatically...');
      await server.start();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logToOutput(`❌ Failed to start server: ${errorMessage}`);
      vscode.window.showErrorMessage(`Failed to start LM API server: ${errorMessage}`);
    }
  } else {
    logToOutput('⏸️ Auto-start disabled, server not started');
    vscode.window.showInformationMessage(
      'LM API server is not started automatically. Use "Start LM API Server" command to start it.'
    );
  }
}

// This method is called when your extension is deactivated
export async function deactivate(): Promise<void> {
  console.log('deactivation started');

  if (!server) {
    console.log('Server is not initialized');
  } else {
    console.log('Trying to stop server');
    await server.stop();
  }

  console.log('deactivation finished');
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
