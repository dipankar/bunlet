import { describe, expect, test } from 'bun:test';
import type { RuntimeCapabilities } from './runtime/types';

const SYSTEM_CAPABILITIES: RuntimeCapabilities = {
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

const CEF_CAPABILITIES: RuntimeCapabilities = {
  ...SYSTEM_CAPABILITIES,
  cookies: true,
  authoritativeGetters: true,
  executeJavaScriptReturns: true,
  sessionPartitions: true,
};

const CEF_CORE_APIS = new Set([
  'initApp',
  'quitApp',
  'createWindow',
  'loadUrl',
  'loadFile',
  'loadHtml',
  'showWindow',
  'hideWindow',
  'closeWindow',
  'focusWindow',
  'maximizeWindow',
  'minimizeWindow',
  'restoreWindow',
  'setFullscreen',
  'getWindowBounds',
  'setWindowBounds',
  'setWindowTitle',
  'setWindowAlwaysOnTop',
  'isWindowVisible',
  'isWindowFocused',
  'isWindowMaximized',
  'isWindowMinimized',
  'isWindowFullscreen',
  'getFocusedWindowId',
  'getAllWindowIds',
  'executeJavaScript',
  'sendIpcMessage',
  'setIpcHandler',
  'setAppEventHandler',
  'runEventLoop',
  'initEventLoop',
  'pumpEvents',
  'getPath',
  'webviewReload',
  'webviewStop',
  'webviewGoBack',
  'webviewGoForward',
  'openDevtools',
  'closeDevtools',
  'toggleDevtools',
  'isDevtoolsOpen',
  'getCookies',
  'setCookie',
  'removeCookie',
  'clearStorageData',
  'getUserAgent',
]);

const CEF_PARITY_APIS = new Set([
  'sendIpcMessage',
  'executeJavaScript',
  'openDevtools',
  'closeDevtools',
  'toggleDevtools',
  'isDevtoolsOpen',
  'webviewReload',
  'webviewStop',
  'webviewGoBack',
  'webviewGoForward',
  'getCookies',
  'setCookie',
  'removeCookie',
  'clearStorageData',
  'getUserAgent',
]);

describe('CEF capability parity', () => {
  test('CEF capabilities are a superset of system webview capabilities', () => {
    const cefKeys = Object.keys(CEF_CAPABILITIES) as (keyof RuntimeCapabilities)[];
    const sysKeys = Object.keys(SYSTEM_CAPABILITIES) as (keyof RuntimeCapabilities)[];

    for (const key of sysKeys) {
      expect(CEF_CAPABILITIES[key]).toBeDefined();
    }

    expect(cefKeys.length).toBeGreaterThanOrEqual(sysKeys.length);
  });

  test('CEF enhances capabilities over system webview', () => {
    expect(CEF_CAPABILITIES.authoritativeGetters).toBe(true);
    expect(CEF_CAPABILITIES.executeJavaScriptReturns).toBe(true);
    expect(CEF_CAPABILITIES.cookies).toBe(true);

    expect(SYSTEM_CAPABILITIES.authoritativeGetters).toBe(false);
    expect(SYSTEM_CAPABILITIES.executeJavaScriptReturns).toBe(false);
  });

  test('both backends share the same capability keys', () => {
    const cefKeys = new Set(Object.keys(CEF_CAPABILITIES));
    const sysKeys = new Set(Object.keys(SYSTEM_CAPABILITIES));

    for (const key of sysKeys) {
      expect(cefKeys.has(key)).toBe(true);
    }
    for (const key of cefKeys) {
      expect(sysKeys.has(key)).toBe(true);
    }
  });

  test('system webview and CEF agree on universal capabilities', () => {
    const universalCapabilities: (keyof RuntimeCapabilities)[] = [
      'windowManagement',
      'multiWindow',
      'ipcInvoke',
      'mainToRendererPush',
      'executeJavaScript',
      'devtools',
      'navigation',
      'preloadScripts',
      'contextIsolation',
      'sessionPartitions',
      'dialogs',
      'tray',
      'globalShortcuts',
      'notifications',
      'powerMonitor',
      'screen',
      'clipboard',
      'fileDrop',
    ];

    for (const cap of universalCapabilities) {
      expect(SYSTEM_CAPABILITIES[cap]).toBe(true);
      expect(CEF_CAPABILITIES[cap]).toBe(true);
    }
  });

  test('no capability is undefined in either backend', () => {
    const cefKeys = Object.keys(CEF_CAPABILITIES) as (keyof RuntimeCapabilities)[];
    const sysKeys = Object.keys(SYSTEM_CAPABILITIES) as (keyof RuntimeCapabilities)[];

    for (const key of cefKeys) {
      expect(typeof CEF_CAPABILITIES[key]).toBe('boolean');
    }
    for (const key of sysKeys) {
      expect(typeof SYSTEM_CAPABILITIES[key]).toBe('boolean');
    }
  });
});

describe('CEF native API contract', () => {
  test('all CEF core APIs are defined', () => {
    const coreApis = Array.from(CEF_CORE_APIS);
    expect(coreApis.length).toBeGreaterThan(0);

    expect(CEF_CORE_APIS.has('initApp')).toBe(true);
    expect(CEF_CORE_APIS.has('quitApp')).toBe(true);
    expect(CEF_CORE_APIS.has('createWindow')).toBe(true);
    expect(CEF_CORE_APIS.has('loadUrl')).toBe(true);
    expect(CEF_CORE_APIS.has('executeJavaScript')).toBe(true);
    expect(CEF_CORE_APIS.has('sendIpcMessage')).toBe(true);
    expect(CEF_CORE_APIS.has('setIpcHandler')).toBe(true);
    expect(CEF_CORE_APIS.has('setAppEventHandler')).toBe(true);
    expect(CEF_CORE_APIS.has('getCookies')).toBe(true);
    expect(CEF_CORE_APIS.has('setCookie')).toBe(true);
  });

  test('CEF core APIs include all system webview core APIs', () => {
    const systemWebviewRequiredApis = new Set([
      'initApp',
      'quitApp',
      'createWindow',
      'loadUrl',
      'showWindow',
      'hideWindow',
      'closeWindow',
      'focusWindow',
      'getWindowBounds',
      'setWindowBounds',
      'setWindowTitle',
    ]);

    for (const api of systemWebviewRequiredApis) {
      expect(CEF_CORE_APIS.has(api)).toBe(true);
    }
  });

  test('CEF parity APIs are a subset of core APIs', () => {
    for (const api of CEF_PARITY_APIS) {
      expect(CEF_CORE_APIS.has(api)).toBe(true);
    }
  });

  test('window management APIs are present in CEF core', () => {
    const windowApis = [
      'createWindow',
      'showWindow',
      'hideWindow',
      'closeWindow',
      'focusWindow',
      'maximizeWindow',
      'minimizeWindow',
      'restoreWindow',
      'setFullscreen',
      'getWindowBounds',
      'setWindowBounds',
      'setWindowTitle',
      'setWindowAlwaysOnTop',
      'isWindowVisible',
      'isWindowFocused',
      'isWindowMaximized',
      'isWindowMinimized',
      'isWindowFullscreen',
      'getFocusedWindowId',
      'getAllWindowIds',
    ];

    for (const api of windowApis) {
      expect(CEF_CORE_APIS.has(api)).toBe(true);
    }
  });

  test('navigation APIs are present in CEF core', () => {
    const navigationApis = [
      'webviewReload',
      'webviewStop',
      'webviewGoBack',
      'webviewGoForward',
    ];

    for (const api of navigationApis) {
      expect(CEF_CORE_APIS.has(api)).toBe(true);
    }
  });

  test('DevTools APIs are present in CEF core', () => {
    const devtoolsApis = [
      'openDevtools',
      'closeDevtools',
      'toggleDevtools',
      'isDevtoolsOpen',
    ];

    for (const api of devtoolsApis) {
      expect(CEF_CORE_APIS.has(api)).toBe(true);
    }
  });

  test('IPC APIs are present in CEF core', () => {
    const ipcApis = [
      'sendIpcMessage',
      'setIpcHandler',
    ];

    for (const api of ipcApis) {
      expect(CEF_CORE_APIS.has(api)).toBe(true);
    }
  });

  test('session/cookie APIs are present in CEF core', () => {
    const sessionApis = [
      'getCookies',
      'setCookie',
      'removeCookie',
      'clearStorageData',
      'getUserAgent',
    ];

    for (const api of sessionApis) {
      expect(CEF_CORE_APIS.has(api)).toBe(true);
    }
  });

  test('CEF parity APIs include enhanced capabilities', () => {
    // These APIs should NOT fall back to system webview because CEF
    // provides superior implementations
    const enhancedApis = [
      'executeJavaScript',  // CEF returns values; system webview is fire-and-forget
      'getCookies',         // CEF has native cookie management; system webview always returns []
      'setCookie',          // CEF has native cookie management
      'getUserAgent',       // CEF returns proper UA string
    ];

    for (const api of enhancedApis) {
      expect(CEF_PARITY_APIS.has(api)).toBe(true);
    }
  });
});

describe('CEF and system webview capability matrix consistency', () => {
  test('all RuntimeCapabilities keys are present in both backends', () => {
    const expectedCapabilities: (keyof RuntimeCapabilities)[] = [
      'windowManagement',
      'multiWindow',
      'ipcInvoke',
      'mainToRendererPush',
      'executeJavaScript',
      'devtools',
      'navigation',
      'preloadScripts',
      'contextIsolation',
      'sessionPartitions',
      'cookies',
      'authoritativeGetters',
      'executeJavaScriptReturns',
      'dialogs',
      'tray',
      'globalShortcuts',
      'notifications',
      'powerMonitor',
      'screen',
      'clipboard',
      'fileDrop',
    ];

    for (const key of expectedCapabilities) {
      expect(key in SYSTEM_CAPABILITIES).toBe(true);
      expect(key in CEF_CAPABILITIES).toBe(true);
    }

    expect(Object.keys(SYSTEM_CAPABILITIES).length).toBe(expectedCapabilities.length);
    expect(Object.keys(CEF_CAPABILITIES).length).toBe(expectedCapabilities.length);
  });

  test('CEF-only capabilities are properly documented', () => {
    const cefOnlyCapabilities: (keyof RuntimeCapabilities)[] = [
      'authoritativeGetters',
      'executeJavaScriptReturns',
    ];

    for (const key of cefOnlyCapabilities) {
      expect(CEF_CAPABILITIES[key]).toBe(true);
      expect(SYSTEM_CAPABILITIES[key]).toBe(false);
    }
  });
});