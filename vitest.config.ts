import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'src/test/**', 'node_modules/**', 'out/**'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    environmentOptions: {
      url: 'http://localhost',
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov', 'html'],
      lines: 30,
      functions: 25,
      branches: 20,
      statements: 30,
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      vscode: fileURLToPath(new URL('./__mocks__/vscode.js', import.meta.url)),
    },
  },
});
