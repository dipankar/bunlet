import { describe, expect, test } from 'bun:test';
import {
  defineConfig,
  parseConfig,
  bunletConfigSchema,
  type BunletConfig,
} from './config';

describe('defineConfig', () => {
  test('returns the original config object for valid config', () => {
    const config = defineConfig({
      main: './main.ts',
      webview: { engine: 'system' },
    });

    expect(config.main).toBe('./main.ts');
    expect(config.webview?.engine).toBe('system');
  });

  test('throws on invalid config values', () => {
    expect(() =>
      defineConfig({ webview: { engine: 'invalid' } } as unknown as BunletConfig)
    ).toThrow();
  });
});

describe('bunletConfigSchema', () => {
  test('accepts an empty object', () => {
    const result = bunletConfigSchema.parse({});
    expect(result).toEqual({});
  });

  test('parses a complete config', () => {
    const result = bunletConfigSchema.parse({
      main: './src/main.ts',
      preload: './preload.ts',
      renderer: { root: 'renderer', index: 'index.html', entry: 'main.tsx' },
      webview: { engine: 'cef', cef: { cachePath: '/tmp/cef-cache', remoteDebuggingPort: 9222, disableGpu: true } },
      build: { outDir: 'dist', minify: true, sourcemap: 'inline', bytecode: false, external: ['electron'], define: { 'process.env.NODE_ENV': '"production"' } },
      package: { name: 'my-app', version: '1.0.0', category: 'utilities', mac: { category: 'public.app-category.utilities', target: ['dmg'] } },
      publish: { provider: 'github', owner: 'myorg', repo: 'my-app' },
    });

    expect(result.main).toBe('./src/main.ts');
    expect(result.webview?.engine).toBe('cef');
    expect(result.build?.sourcemap).toBe('inline');
    expect(result.package?.mac?.category).toBe('public.app-category.utilities');
  });

  test('rejects invalid engine values', () => {
    expect(() => bunletConfigSchema.parse({ webview: { engine: 'webkit2gtk' } })).toThrow();
  });

  test('rejects invalid provider values', () => {
    expect(() => bunletConfigSchema.parse({ publish: { provider: 'npm' } })).toThrow();
  });
});

describe('parseConfig', () => {
  test('returns parsed config and empty warnings for valid input', () => {
    const { config, warnings } = parseConfig({ main: 'main.ts' });
    expect(config.main).toBe('main.ts');
    expect(warnings).toEqual([]);
  });

  test('throws on invalid input', () => {
    expect(() => parseConfig({ webview: { engine: 123 } })).toThrow();
  });

  test('warns on non-semver package version', () => {
    const { warnings } = parseConfig({ package: { version: 'not-a-version' } });
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('semver');
  });

  test('warns on cef engine without cef options', () => {
    const { warnings } = parseConfig({ webview: { engine: 'cef' } });
    expect(warnings.some((w) => w.includes('cef'))).toBe(true);
  });
});