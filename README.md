# Claude Copilot - VS Code AI Assistant

Claude Copilot is an intelligent VS Code extension that provides advanced AI assistance with enhanced system prompt processing, OpenAI API compatibility, and MCP (Model Context Protocol) tool integration for superior coding workflows.

## 🚀 Features

### **Intelligent System Prompt Processing**
- **Advanced Instruction Following**: Overcomes VS Code LM API limitations with intelligent message preprocessing
- **Multiple Format Strategies**: Choose from merge, assistant acknowledgment, or simple prepend formats
- **Clear Delimiters**: Uses structured formatting (`<SYSTEM_INSTRUCTIONS>`, `<USER_MESSAGE>`) for better AI comprehension
- **Configurable Default Prompts**: Set project-wide system prompts via VS Code settings

### **OpenAI API Compatibility**
- **Drop-in Replacement**: Compatible with OpenAI API endpoints (`/chat/completions`, `/v1/messages`)
- **Streaming Support**: Real-time response streaming for interactive experiences
- **Tool Calling**: Advanced function calling capabilities with dynamic tool discovery
- **Model Flexibility**: Access to all [GitHub Copilot models](https://docs.github.com/en/copilot/using-github-copilot/ai-models/changing-the-ai-model-for-copilot-chat)

### **MCP Tool Integration**
- **Dynamic Tool Discovery**: Automatically discover and register Claude Code tools
- **MCP Client Support**: Connect to external MCP servers for extended functionality
- **Tool Auto-Registration**: Seamless integration with VS Code Language Model tooling

## 🎯 Motivation

VS Code's Language Model API provides powerful LLM access through GitHub Copilot, but lacks native system prompt support, leading to poor instruction following. Claude Copilot solves this by implementing intelligent preprocessing strategies similar to how Cline (formerly Claude Dev) handles these limitations.

This extension transforms VS Code into a powerful AI coding assistant without requiring additional installations or subscriptions beyond your existing GitHub Copilot access.

## 📋 Requirements

- **VS Code 1.99.0+**
- **GitHub Copilot subscription** (or compatible Language Model API access)
- **Node.js** (for MCP client features)

## ⚙️ Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `claude-copilot.port` | `59603` | HTTP server port |
| `claude-copilot.startServerAutomatically` | `true` | Auto-start server on VS Code launch |
| `claude-copilot.defaultModel` | `gpt-4.1` | Default model when requested model unavailable |
| `claude-copilot.systemPrompt` | `""` | Default system prompt for all conversations |
| `claude-copilot.systemPromptFormat` | `merge` | System prompt formatting strategy |
| `claude-copilot.enableSystemPromptProcessing` | `true` | Enable intelligent system prompt processing |
| `claude-copilot.enableToolCalling` | `true` | Enable tool calling support |
| `claude-copilot.mcpClients` | `{}` | MCP client configurations |

### System Prompt Formats

1. **Merge** (Recommended): Uses clear XML-style delimiters for optimal instruction following
2. **Assistant Acknowledgment**: Creates assistant acknowledgment + user instruction pattern  
3. **Simple Prepend**: Basic prepending to first user message

## 🔌 API Endpoints

### OpenAI Compatible
- `POST /chat/completions` - Chat completions with streaming support
- `GET /models` - List available models
- `GET /v1/models` - Alternative models endpoint

### Anthropic Compatible  
- `POST /v1/messages` - Anthropic-style message API

### Tool Discovery
- `GET /tools` - List all available tools (Claude Code + MCP)

## 🛠️ MCP Integration

Configure MCP clients in your VS Code settings:

```json
{
  "claude-copilot.mcpClients": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/workspace"],
      "env": {}
    }
  }
}
```

## 🚀 Quick Start

1. **Install** the extension from VS Code marketplace
2. **Configure** your system prompt in settings
3. **Start coding** with enhanced AI assistance!

The server starts automatically and provides OpenAI-compatible API access at `http://localhost:59603`.

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines and submit pull requests to help improve Claude Copilot.

## 📄 License

MIT License - see LICENSE file for details.

---

**Enhance your coding workflow with Claude Copilot's intelligent AI assistance! 🚀**