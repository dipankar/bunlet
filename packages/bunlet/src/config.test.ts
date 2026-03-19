import { describe, expect, test } from 'bun:test';
import { defineConfig } from './config';

describe('defineConfig', () => {
  test('returns the original config object', () => {
    const config = defineConfig({
      main: './main.ts',
      webview: { engine: 'system' as const },
    });

    expect(config.main).toBe('./main.ts');
    expect(config.webview?.engine).toBe('system');
  });
});
