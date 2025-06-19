# Testing Guide for Claude Copilot

This document provides comprehensive guidance for testing the Claude Copilot VS Code extension.

## Test Structure

### Unit Tests (`tests/unit/`)

- **config.test.ts** - Configuration loading and validation
- **systemPromptProcessing.test.ts** - System prompt processing logic
- **mcpClient.test.ts** - MCP client functionality
- **toolRegistration.test.ts** - Tool registration mechanisms

### Integration Tests (`tests/integration/`)

- **apiEndpoints.test.ts** - HTTP API endpoint testing
- **toolWorkflows.test.ts** - Tool discovery and execution workflows

### E2E Tests (`tests/e2e/`)

- **extension.e2e.test.ts** - Complete VS Code extension functionality

## Test Commands

### Running Tests

```bash
# Run all tests
npm run test:all

# Run specific test suites
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e           # E2E tests only

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Code Quality

```bash
# Check code formatting
npm run format:check

# Format code
npm run format

# Check linting
npm run lint:check

# Fix linting issues
npm run lint
```

## Test Coverage

The project maintains a minimum **80% code coverage** threshold across:

- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

Coverage reports are generated in the `coverage/` directory.

## Test Configuration

### Jest Configuration (`jest.config.js`)

- TypeScript support via `ts-jest`
- 80% coverage threshold enforcement
- Setup file for global mocks
- Custom test environments for different test types

### VS Code Test Configuration

- E2E tests use `@vscode/test-cli`
- Tests run in isolated VS Code instance
- Extension activation testing

## Writing Tests

### Unit Test Example

```typescript
import { getConfig } from '../../src/config';

describe('Config', () => {
  it('should return default configuration', () => {
    const config = getConfig();
    expect(config.port).toBe(68686);
    expect(config.startAutomatically).toBe(true);
  });
});
```

### Integration Test Example

```typescript
describe('API Endpoints', () => {
  it('should handle chat completions', async () => {
    const response = await fetch('/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.choices).toBeDefined();
  });
});
```

### E2E Test Example

```typescript
suite('Extension E2E', () => {
  test('should activate extension', async () => {
    const extension = vscode.extensions.getExtension('victornanka.claude-copilot');
    await extension?.activate();
    expect(extension?.isActive).toBe(true);
  });
});
```

## Mock Strategy

### VS Code API Mocking

- Global VS Code API mock in `tests/setup.ts`
- Extension context simulation
- Language Model API mocking

### HTTP Request Mocking

- `fetch` API mocking for integration tests
- Request/response simulation
- Error scenario testing

### MCP Client Mocking

- SDK client mocking
- Transport layer simulation
- Tool discovery and execution mocking

## Continuous Integration

### GitHub Actions Workflow

1. **Code Quality Checks** - ESLint, Prettier, TypeScript compilation
2. **Unit Tests** - Fast feedback on core logic
3. **Integration Tests** - API endpoint validation
4. **E2E Tests** - Full extension testing
5. **Security Audit** - Dependency vulnerability scanning
6. **Build & Package** - Extension packaging
7. **Publish** - Marketplace deployment (main branch only)

### Quality Gates

- All tests must pass
- Code coverage must meet 80% threshold
- No high/critical security vulnerabilities
- Code must pass linting and formatting checks

## Test Data and Fixtures

### Test Fixtures (`tests/fixtures/`)

- Sample MCP client configurations
- Mock API responses
- Test tool signatures

### Test Utilities

- Common test helpers
- Mock factories
- Assertion utilities

## Performance Testing

### Load Testing

- API endpoint performance
- Tool registration overhead
- Memory usage monitoring

### Benchmark Tests

- System prompt processing performance
- Tool discovery speed
- Streaming response throughput

## Debugging Tests

### VS Code Test Debugging

1. Set breakpoints in test files
2. Use "Debug: Start Debugging" with test configuration
3. Step through extension and test code

### Jest Debugging

```bash
# Debug specific test
npm run test:watch -- --testNamePattern="specific test"

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Log Analysis

- Test output logging
- Extension output channel monitoring
- HTTP request/response logging

## Best Practices

### Test Organization

- Group related tests in describe blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### Mock Management

- Keep mocks minimal and focused
- Reset mocks between tests
- Use factory functions for complex mocks

### Error Testing

- Test error scenarios explicitly
- Verify error messages and types
- Test error recovery mechanisms

### Async Testing

- Use async/await consistently
- Handle timeouts appropriately
- Test promise rejections

## Troubleshooting

### Common Issues

**Tests timing out**

- Increase Jest timeout in configuration
- Check for unresolved promises
- Verify mock implementations

**VS Code extension tests failing**

- Ensure extension is properly activated
- Check VS Code version compatibility
- Verify test workspace setup

**Coverage gaps**

- Identify uncovered code paths
- Add tests for error scenarios
- Test edge cases and boundary conditions

**CI/CD failures**

- Check environment differences
- Verify dependency installations
- Review security audit results

### Debug Commands

```bash
# Verbose test output
npm run test:unit -- --verbose

# Run specific test file
npm run test:unit -- config.test.ts

# Update test snapshots
npm run test:unit -- --updateSnapshot
```

## Maintenance

### Regular Tasks

- Update test dependencies
- Review and update test coverage requirements
- Refactor tests as codebase evolves
- Update CI/CD pipeline configurations

### Test Health Monitoring

- Monitor test execution times
- Track flaky test patterns
- Review coverage trends
- Update test documentation

This comprehensive testing framework ensures high code quality, reliability, and maintainability for the Claude Copilot extension.
