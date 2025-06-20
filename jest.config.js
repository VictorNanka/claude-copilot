module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/tests/unit/**/*.test.ts', '**/tests/integration/**/*.test.ts'],
  testPathIgnorePatterns: [
    '<rootDir>/src/test/',
    '<rootDir>/tests/e2e/',
    '<rootDir>/out/',
    '<rootDir>/node_modules/',
  ],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/test/**', '!**/node_modules/**'],
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 25,
      lines: 30,
      statements: 30,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // VSCode extension testing - mock the vscode module
    '^vscode$': '<rootDir>/__mocks__/vscode.js',
  },
  // CI-friendly configuration
  ci: process.env.CI ? true : false,
  verbose: true,
  maxWorkers: process.env.CI ? 2 : '50%',
  // Handle VSCode extension environment
  testEnvironmentOptions: {
    url: 'http://localhost',
  },
  // Clear mocks between tests for consistent results
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
