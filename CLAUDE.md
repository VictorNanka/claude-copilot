# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Copilot is a VS Code extension that provides an intelligent AI assistant interface with:

- **OpenAI API compatibility** - Acts as a bridge between external AI tools and VS Code's Language Model API
- **Advanced system prompt processing** - Overcomes VS Code LM API limitations with intelligent message preprocessing
- **MCP (Model Context Protocol) integration** - Connects external MCP servers for extended tool functionality
- **Dynamic tool discovery** - Automatically discovers and registers Claude Code tools at runtime

## Architecture

### Core Components

**Extension (`src/extension.ts`)**

- Main entry point handling VS Code extension lifecycle
- Manages tool registration for both Claude Code official tools and MCP tools
- Implements dynamic tool discovery and registration system
- Stores global registry of registered tools to prevent duplicates

**HTTP Server (`src/server.ts`)**

- Hono-based HTTP server providing OpenAI-compatible API endpoints
- Handles both OpenAI (`/chat/completions`) and Anthropic (`/v1/messages`) API formats
- Implements intelligent system prompt processing with configurable strategies
- Manages streaming and non-streaming response modes

**Claude Tools (`src/claudeTools.ts`)**

- Contains precise signatures for all 16 Claude Code official tools
- Tools include: Task, Bash, Glob, Grep, LS, exit_plan_mode, Read, Edit, MultiEdit, Write, NotebookRead, NotebookEdit, WebFetch, TodoRead, TodoWrite, WebSearch

**MCP Client (`src/mcp-client.ts`)**

- Manages connections to external MCP servers
- Handles tool discovery and execution through MCP protocol
- Supports multiple concurrent MCP client connections

**Configuration (`src/config.ts`)**

- Centralizes extension settings and configuration management
- Handles system prompt processing options and MCP client configurations

### Key Features

**System Prompt Processing**

- Three strategies: `merge` (recommended), `assistant_acknowledgment`, `simple_prepend`
- Uses XML-style delimiters (`<SYSTEM_INSTRUCTIONS>`, `<USER_MESSAGE>`) for optimal instruction following
- Configurable default system prompts at extension level

**Dynamic Tool Registration**

- Registers all 16 Claude Code tools as stub implementations at startup
- Discovers and registers tools dynamically when requested in API calls
- Supports retry mechanism for failed tool discovery attempts
- Auto-registers MCP tools from connected servers

**Dual API Compatibility**

- OpenAI format: `/chat/completions` with tool calling support
- Anthropic format: `/v1/messages` with streaming support
- Model fallback system using VS Code's available language models

## Development Commands

**Build & Compilation**

```bash
yarn compile          # Compile TypeScript to JavaScript
yarn watch           # Watch mode compilation
yarn build           # Build the project (alias for compile)
yarn dev             # Development mode (alias for watch)
```

**Testing & Quality**

```bash
yarn test            # Run E2E tests via VS Code test runner
yarn test:unit       # Run unit tests with Jest
yarn test:integration # Run integration tests with Jest
yarn test:e2e        # Run E2E tests with VS Code test runner
yarn test:all        # Run all test suites
yarn test:coverage   # Run tests with coverage report
yarn pretest         # Run compile + lint before testing
yarn lint            # ESLint with TypeScript rules
yarn format          # Format code with Prettier
```

**VS Code Extension**

```bash
yarn vscode:prepublish  # Prepare for publishing (runs compile)
yarn vscode:publish     # Publish to VS Code marketplace
yarn vscode:package     # Package extension as .vsix file
```

## Extension Settings

Key configuration options available in VS Code settings:

- `http-lm-api.port` (59603) - HTTP server port
- `http-lm-api.startServerAutomatically` (true) - Auto-start server on activation
- `http-lm-api.defaultModel` (gpt-4.1) - Fallback model when requested model unavailable
- `http-lm-api.systemPrompt` - Default system prompt for all conversations
- `http-lm-api.systemPromptFormat` (merge) - System prompt processing strategy
- `http-lm-api.enableToolCalling` (true) - Enable tool calling support
- `http-lm-api.mcpClients` - MCP server configurations

## MCP Integration

Configure MCP clients in VS Code settings:

```json
{
  "http-lm-api.mcpClients": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/workspace"],
      "env": {}
    }
  }
}
```

## API Endpoints

- `GET /` - Health check
- `GET /tools` - List all available tools (Claude Code + MCP)
- `POST /chat/completions` - OpenAI-compatible chat completions
- `POST /v1/messages` - Anthropic-compatible messages API
- `GET /models` and `GET /v1/models` - List available models

## Tool Discovery Flow

1. Extension registers all 16 Claude Code tools as stubs at startup
2. API requests are analyzed for tool usage patterns
3. Missing tools are dynamically discovered using multiple strategies
4. Successfully discovered tools are registered with VS Code LM API
5. Retry mechanism handles tool discovery failures gracefully

## Testing & Quality Assurance

### Test Framework

- **Jest** - Unit and integration testing with TypeScript support
- **VS Code Test Runner** - E2E extension testing
- **Coverage Threshold** - Minimum thresholds: 20% branches, 25% functions, 30% lines/statements
- **Pre-commit Hooks** - Automatic linting, formatting, and quality checks via Husky

### Test Structure

- `tests/unit/` - Core logic testing (config, system prompts, MCP, tool registration)
- `tests/integration/` - API endpoints and tool workflow testing
- `tests/e2e/` - Complete VS Code extension functionality testing
- `tests/setup.ts` - Global test configuration and mocks

### Quality Tools

- **ESLint** - Code linting with TypeScript rules
- **Prettier** - Code formatting
- **Husky** - Git hooks for pre-commit quality checks
- **lint-staged** - Run quality checks only on changed files

### CI/CD Pipeline

- **GitHub Actions** - Automated testing, security audits, building, and publishing
- **Code Coverage** - Codecov integration for coverage tracking
- **Security Audit** - Dependency vulnerability scanning
- **Automated Publishing** - VS Code Marketplace deployment on main branch

### Test Commands

```bash
yarn test:unit            # Unit tests
yarn test:integration     # Integration tests
yarn test:e2e            # E2E tests
yarn test:all             # Run all test suites
yarn test:coverage        # Tests with coverage
yarn test:watch           # Watch mode for tests
yarn lint                 # Code linting
yarn format               # Code formatting
yarn format:check         # Check code formatting
```
