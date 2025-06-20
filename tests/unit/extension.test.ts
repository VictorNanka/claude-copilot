import { activate, deactivate } from '../../src/extension';

jest.mock('vscode');

describe('Extension Test Suite', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  test('Sample test', () => {
    expect([1, 2, 3].indexOf(5)).toBe(-1);
    expect([1, 2, 3].indexOf(0)).toBe(-1);
  });

  test('extension can be activated', async () => {
    const mockContext = {
      subscriptions: [],
    };

    // This should not throw
    await expect(activate(mockContext as any)).resolves.toBeUndefined();
  });

  test('extension can be deactivated', async () => {
    // This should not throw
    await expect(deactivate()).resolves.toBeUndefined();
  });
});
