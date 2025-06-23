/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['tests/e2e/**/*', 'out/**/*', 'node_modules/**/*'],
    testTimeout: 10000,
    alias: {
      vscode: path.resolve(__dirname, '__mocks__/vscode.ts'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/test/**/*'],
      thresholds: {
        branches: 20,
        functions: 25,
        lines: 30,
        statements: 30
      }
    }
  }
})