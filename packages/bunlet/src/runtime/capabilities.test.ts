import { describe, expect, test } from 'bun:test';
import type { RuntimeCapabilities } from './types';
import { assertCapability, createCapabilityErrorMessage, hasCapability } from './capabilities';

function backendInfo(engine: 'system' | 'cef', overrides: Partial<RuntimeCapabilities> = {}) {
  return {
    engine,
    capabilities: {
      windowManagement: true,
      multiWindow: true,
      ipcInvoke: true,
      mainToRendererPush: true,
      executeJavaScript: true,
      devtools: true,
      navigation: true,
      preloadScripts: true,
      contextIsolation: true,
      sessionPartitions: true,
      cookies: true,
      ...overrides,
    },
  };
}

describe('runtime capability helpers', () => {
  test('detects supported capabilities', () => {
    const backend = backendInfo('system', { cookies: false });

    expect(hasCapability(backend, 'navigation')).toBe(true);
    expect(hasCapability(backend, 'cookies')).toBe(false);
  });

  test('formats capability errors with backend context', () => {
    const message = createCapabilityErrorMessage('cef', 'devtools', 'webContents.openDevTools()');

    expect(message).toContain('webContents.openDevTools()');
    expect(message).toContain('"cef"');
    expect(message).toContain('devtools');
  });

  test('throws when backend does not support a capability', () => {
    const backend = backendInfo('cef', { devtools: false });

    expect(() => assertCapability(backend, 'devtools', 'webContents.openDevTools()')).toThrow(
      'webContents.openDevTools()'
    );
  });
});
