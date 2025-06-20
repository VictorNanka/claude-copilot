import * as vscode from 'vscode';
import * as assert from 'assert';
import { getConfig } from '../../src/config';

// E2E tests for VS Code extension functionality
suite('Claude Copilot Extension E2E Tests', () => {
  let extension: vscode.Extension<any> | undefined;

  suiteSetup(async () => {
    // Ensure extension is activated
    extension = vscode.extensions.getExtension('victornanka.claude-copilot');
    if (extension && !extension.isActive) {
      await extension.activate();
    }
  });

  test('Extension should be present and activatable', () => {
    assert.ok(extension, 'Extension should be present');
    assert.ok(extension!.isActive, 'Extension should be activated');
  });

  test('Extension should register commands', async () => {
    const commands = await vscode.commands.getCommands(true);

    assert.ok(
      commands.includes('http-lm-api.startLmApiServer'),
      'Start server command should be registered'
    );
    assert.ok(
      commands.includes('http-lm-api.stopLmApiServer'),
      'Stop server command should be registered'
    );
  });

  test('Configuration should be accessible', () => {
    const config = getConfig();

    assert.ok(typeof config.port === 'number', 'Port should be a number');
    assert.ok(
      typeof config.startAutomatically === 'boolean',
      'Start automatically should be a boolean'
    );
    assert.ok(typeof config.defaultModel === 'string', 'Default model should be a string');
    assert.ok(typeof config.systemPrompt === 'string', 'System prompt should be a string');
    assert.ok(
      ['merge', 'assistant_acknowledgment', 'simple_prepend'].includes(config.systemPromptFormat),
      'System prompt format should be valid'
    );
  });

  test('Extension should handle configuration changes', async () => {
    const originalConfig = getConfig();
    const configSection = vscode.workspace.getConfiguration('http-lm-api');

    // Change port configuration
    await configSection.update('port', 8080, vscode.ConfigurationTarget.Workspace);

    // Wait for configuration change to propagate
    await new Promise(resolve => setTimeout(resolve, 100));

    const newConfig = getConfig();
    assert.strictEqual(newConfig.port, 8080, 'Configuration should be updated');

    // Restore original configuration
    await configSection.update('port', originalConfig.port, vscode.ConfigurationTarget.Workspace);
  });

  test('Extension should start and stop server via commands', async () => {
    // Test start server command
    await vscode.commands.executeCommand('http-lm-api.startLmApiServer');

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test that server is running by making a simple HTTP request
    try {
      const config = getConfig();
      const response = await fetch(`http://localhost:${config.port}/`);
      assert.ok(response.ok, 'Server should be running and responding');

      const text = await response.text();
      assert.strictEqual(text, 'ok', 'Server should return health check response');
    } catch (error) {
      assert.fail(`Server should be accessible: ${error}`);
    }

    // Test stop server command
    await vscode.commands.executeCommand('http-lm-api.stopLmApiServer');

    // Wait for server to stop
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify server is stopped
    try {
      const config = getConfig();
      await fetch(`http://localhost:${config.port}/`);
      assert.fail('Server should be stopped and not responding');
    } catch {
      // Expected - server should not be accessible
      assert.ok(true, 'Server should be stopped');
    }
  });

  test('Server should handle API requests correctly', async () => {
    // Start server
    await vscode.commands.executeCommand('http-lm-api.startLmApiServer');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const config = getConfig();
    const baseUrl = `http://localhost:${config.port}`;

    try {
      // Test models endpoint
      const modelsResponse = await fetch(`${baseUrl}/models`);
      assert.ok(modelsResponse.ok, 'Models endpoint should work');

      const models = await modelsResponse.json();
      assert.ok(Array.isArray(models), 'Models should be an array');

      // Test tools endpoint
      const toolsResponse = await fetch(`${baseUrl}/tools`);
      assert.ok(toolsResponse.ok, 'Tools endpoint should work');

      const toolsData = await toolsResponse.json();
      assert.ok(toolsData.tools && Array.isArray(toolsData.tools), 'Tools should be available');
      assert.ok(toolsData.tools.length >= 16, 'Should have Claude Code tools registered');

      // Test chat completions endpoint
      const chatPayload = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const chatResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatPayload),
      });

      assert.ok(chatResponse.ok, 'Chat completions endpoint should work');

      const chatData = await chatResponse.json();
      assert.ok(chatData.choices && chatData.choices.length > 0, 'Should return chat completion');
    } finally {
      // Stop server
      await vscode.commands.executeCommand('http-lm-api.stopLmApiServer');
    }
  });

  test('Extension should handle MCP client configuration', async () => {
    const configSection = vscode.workspace.getConfiguration('http-lm-api');

    // Test MCP configuration
    const testMCPConfig = {
      'test-client': {
        command: 'echo',
        args: ['test'],
        env: { TEST: 'value' },
      },
    };

    await configSection.update('mcpClients', testMCPConfig, vscode.ConfigurationTarget.Workspace);

    // Wait for configuration to propagate
    await new Promise(resolve => setTimeout(resolve, 200));

    const newConfig = getConfig();
    assert.ok(newConfig.mcpClients['test-client'], 'MCP client should be configured');
    assert.strictEqual(
      newConfig.mcpClients['test-client'].command,
      'echo',
      'MCP client command should be set'
    );

    // Restore configuration
    await configSection.update('mcpClients', {}, vscode.ConfigurationTarget.Workspace);
  });

  test('Extension should handle system prompt configuration', async () => {
    const configSection = vscode.workspace.getConfiguration('http-lm-api');

    const testSystemPrompt = 'You are a helpful coding assistant.';
    await configSection.update(
      'systemPrompt',
      testSystemPrompt,
      vscode.ConfigurationTarget.Workspace
    );

    const testFormat = 'assistant_acknowledgment';
    await configSection.update(
      'systemPromptFormat',
      testFormat,
      vscode.ConfigurationTarget.Workspace
    );

    // Wait for configuration to propagate
    await new Promise(resolve => setTimeout(resolve, 100));

    const newConfig = getConfig();
    assert.strictEqual(newConfig.systemPrompt, testSystemPrompt, 'System prompt should be updated');
    assert.strictEqual(
      newConfig.systemPromptFormat,
      testFormat,
      'System prompt format should be updated'
    );

    // Test that API uses the system prompt
    await vscode.commands.executeCommand('http-lm-api.startLmApiServer');
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      const baseUrl = `http://localhost:${newConfig.port}`;
      const chatPayload = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const chatResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatPayload),
      });

      assert.ok(chatResponse.ok, 'Chat request with system prompt should work');
    } finally {
      await vscode.commands.executeCommand('http-lm-api.stopLmApiServer');
    }

    // Restore configuration
    await configSection.update('systemPrompt', '', vscode.ConfigurationTarget.Workspace);
    await configSection.update('systemPromptFormat', 'merge', vscode.ConfigurationTarget.Workspace);
  });

  test('Extension should handle tool calling requests', async () => {
    await vscode.commands.executeCommand('http-lm-api.startLmApiServer');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const config = getConfig();
    const baseUrl = `http://localhost:${config.port}`;

    try {
      const toolPayload = {
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: 'Please use the Read tool to read a file',
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'Read',
              description: 'Reads a file from the local filesystem',
              parameters: {
                type: 'object',
                properties: {
                  file_path: { type: 'string' },
                },
                required: ['file_path'],
              },
            },
          },
        ],
      };

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolPayload),
      });

      assert.ok(response.ok, 'Tool calling request should be accepted');

      const data = await response.json();
      assert.ok(data.choices, 'Should return response with choices');
    } finally {
      await vscode.commands.executeCommand('http-lm-api.stopLmApiServer');
    }
  });

  test('Extension should handle streaming requests', async () => {
    await vscode.commands.executeCommand('http-lm-api.startLmApiServer');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const config = getConfig();
    const baseUrl = `http://localhost:${config.port}`;

    try {
      const streamPayload = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      };

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(streamPayload),
      });

      assert.ok(response.ok, 'Streaming request should be accepted');
      assert.ok(response.body, 'Response should have a body stream');

      // Read a few chunks to verify streaming works
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      let chunkCount = 0;
      let hasData = false;

      while (chunkCount < 3) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value);
        if (chunk.includes('data:')) {
          hasData = true;
        }

        chunkCount++;
      }

      reader.releaseLock();
      assert.ok(hasData, 'Should receive streaming data chunks');
    } finally {
      await vscode.commands.executeCommand('http-lm-api.stopLmApiServer');
    }
  });

  test('Extension should handle errors gracefully', async () => {
    await vscode.commands.executeCommand('http-lm-api.startLmApiServer');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const config = getConfig();
    const baseUrl = `http://localhost:${config.port}`;

    try {
      // Test invalid JSON
      const invalidResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      assert.ok(!invalidResponse.ok, 'Invalid JSON should return error');

      // Test missing required fields
      const incompletePayload = {
        model: 'gpt-4',
        // missing messages
      };

      const incompleteResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incompletePayload),
      });

      assert.ok(!incompleteResponse.ok, 'Incomplete payload should return error');
    } finally {
      await vscode.commands.executeCommand('http-lm-api.stopLmApiServer');
    }
  });
});
