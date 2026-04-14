import { describe, expect, test } from 'bun:test';
import type { RuntimeCapabilities } from './types';
import { assertCapability, createCapabilityErrorMessage, hasCapability } from './capabilities';

function backendInfo(engine: 'system' | 'cef', overrides: Partial<RuntimeCapabilities> = {}) {
  const systemBase: RuntimeCapabilities = {
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
    authoritativeGetters: false,
    executeJavaScriptReturns: false,
    dialogs: true,
    tray: true,
    globalShortcuts: true,
    notifications: true,
    powerMonitor: true,
    screen: true,
    clipboard: true,
    fileDrop: true,
  };

  return {
    engine,
    capabilities: { ...systemBase, ...overrides },
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

  test('system webview defaults have authoritativeGetters = false', () => {
    const backend = backendInfo('system');
    expect(hasCapability(backend, 'authoritativeGetters')).toBe(false);
    expect(hasCapability(backend, 'executeJavaScriptReturns')).toBe(false);
  });

  test('CEF backend has authoritativeGetters and executeJavaScriptReturns', () => {
    const backend = backendInfo('cef', { authoritativeGetters: true, executeJavaScriptReturns: true });
    expect(hasCapability(backend, 'authoritativeGetters')).toBe(true);
    expect(hasCapability(backend, 'executeJavaScriptReturns')).toBe(true);
  });

  test('all platform APIs are capability-gated', () => {
    const backend = backendInfo('system');
    const requiredCaps: Array<keyof RuntimeCapabilities> = [
      'dialogs', 'tray', 'globalShortcuts', 'notifications',
      'powerMonitor', 'screen', 'clipboard', 'fileDrop',
    ];
    for (const cap of requiredCaps) {
      expect(hasCapability(backend, cap)).toBe(true);
    }
  });

  test('disabling a capability throws on access', () => {
    const backend = backendInfo('system', { dialogs: false });
    expect(() => assertCapability(backend, 'dialogs', 'dialog.showOpenDialog()')).toThrow(
      'dialog.showOpenDialog()'
    );
  });
});
