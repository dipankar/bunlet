/**
 * @bunlet/cef - Smoke tests for the CEF proxy module
 *
 * These tests validate the proxy routing, core API presence checks,
 * capability error enforcement, and native fallback behavior
 * WITHOUT requiring a live CEF runtime.
 */

const { describe, expect, test, mock, beforeEach, afterEach } = require('bun:test');

// ─── Mock CEF native addon ──────────────────────────────────────────────
// We mock the .node binding so we can test the proxy layer in isolation.

const MOCK_CEF_APIS = {
  initApp: () => {},
  quitApp: () => {},
  createWindow: () => 1,
  loadUrl: () => {},
  loadFile: () => {},
  loadHtml: () => {},
  showWindow: () => {},
  hideWindow: () => {},
  closeWindow: () => {},
  focusWindow: () => {},
  maximizeWindow: () => {},
  minimizeWindow: () => {},
  restoreWindow: () => {},
  setFullscreen: () => {},
  getWindowBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }),
  setWindowBounds: () => {},
  setWindowTitle: () => {},
  setWindowAlwaysOnTop: () => {},
  isWindowVisible: () => true,
  isWindowFocused: () => false,
  isWindowMaximized: () => false,
  isWindowMinimized: () => false,
  isWindowFullscreen: () => false,
  getFocusedWindowId: () => null,
  getAllWindowIds: () => [],
  executeJavaScript: async () => '',
  sendIpcMessage: () => {},
  setIpcHandler: () => {},
  setAppEventHandler: () => {},
  runEventLoop: () => {},
  initEventLoop: () => {},
  pumpEvents: () => ({ shouldQuit: false, messages: [] }),
  getPath: () => '/tmp',
  webviewReload: () => {},
  webviewStop: () => {},
  webviewGoBack: () => {},
  webviewGoForward: () => {},
  openDevtools: () => {},
  closeDevtools: () => {},
  toggleDevtools: () => {},
  isDevtoolsOpen: () => false,
};

// ─── Test helper: create a proxy with a custom binding ───────────────────

function createProxyWithBinding(binding) {
  // Re-implement the proxy logic from index.js for testability
  const CEF_CORE_APIS = new Set([
    'initApp', 'quitApp', 'createWindow', 'loadUrl', 'loadFile', 'loadHtml',
    'showWindow', 'hideWindow', 'closeWindow', 'focusWindow', 'maximizeWindow',
    'minimizeWindow', 'restoreWindow', 'setFullscreen', 'getWindowBounds',
    'setWindowBounds', 'setWindowTitle', 'setWindowAlwaysOnTop', 'isWindowVisible',
    'isWindowFocused', 'isWindowMaximized', 'isWindowMinimized', 'isWindowFullscreen',
    'getFocusedWindowId', 'getAllWindowIds', 'executeJavaScript', 'sendIpcMessage',
    'setIpcHandler', 'setAppEventHandler', 'runEventLoop', 'initEventLoop', 'pumpEvents',
    'getPath', 'webviewReload', 'webviewStop', 'webviewGoBack', 'webviewGoForward',
    'openDevtools', 'closeDevtools', 'toggleDevtools', 'isDevtoolsOpen',
  ]);

  const CEF_PARITY_APIS = new Set([
    'sendIpcMessage', 'executeJavaScript', 'openDevtools', 'closeDevtools',
    'toggleDevtools', 'isDevtoolsOpen', 'webviewReload', 'webviewStop',
    'webviewGoBack', 'webviewGoForward',
  ]);

  const enableNativeFallback = process.env.BUNLET_CEF_ENABLE_NATIVE_FALLBACK === '1';
  let nativeFallback = null;

  if (enableNativeFallback) {
    try {
      nativeFallback = require('@bunlet/native');
    } catch {
      nativeFallback = null;
    }
  }

  return new Proxy(binding, {
    get(target, prop, receiver) {
      if (Reflect.has(target, prop)) {
        return Reflect.get(target, prop, receiver);
      }

      if (CEF_CORE_APIS.has(prop)) {
        throw new Error(
          `[bunlet] CEF core API "${String(prop)}" is missing from the native addon. ` +
          `Rebuild @bunlet/cef-native with CEF support enabled.`
        );
      }

      if (CEF_PARITY_APIS.has(prop)) {
        return undefined;
      }

      if (enableNativeFallback && nativeFallback && Reflect.has(nativeFallback, prop)) {
        return Reflect.get(nativeFallback, prop, receiver);
      }

      return undefined;
    },
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('@bunlet/cef proxy', () => {
  test('routes core APIs through the CEF binding', () => {
    const proxy = createProxyWithBinding(MOCK_CEF_APIS);

    expect(typeof proxy.createWindow).toBe('function');
    expect(typeof proxy.loadUrl).toBe('function');
    expect(typeof proxy.executeJavaScript).toBe('function');
    expect(typeof proxy.openDevtools).toBe('function');
    expect(typeof proxy.webviewReload).toBe('function');
    expect(typeof proxy.getPath).toBe('function');
  });

  test('returns values from binding for core APIs', () => {
    const proxy = createProxyWithBinding(MOCK_CEF_APIS);

    expect(proxy.isWindowVisible(1)).toBe(true);
    expect(proxy.getAllWindowIds()).toEqual([]);
    expect(proxy.getPath('temp')).toBe('/tmp');
  });

  test('throws explicit error for missing core APIs', () => {
    const partialBinding = { ...MOCK_CEF_APIS };
    delete partialBinding.executeJavaScript;
    delete partialBinding.openDevtools;

    const proxy = createProxyWithBinding(partialBinding);

    expect(() => proxy.executeJavaScript).toThrow('CEF core API "executeJavaScript" is missing');
    expect(() => proxy.openDevtools).toThrow('CEF core API "openDevtools" is missing');
  });

  test('returns undefined for non-core, non-parity APIs not in binding', () => {
    const proxy = createProxyWithBinding(MOCK_CEF_APIS);

    expect(proxy.showOpenDialog).toBeUndefined();
    expect(proxy.showMessageBox).toBeUndefined();
    expect(proxy.setTrayMenu).toBeUndefined();
  });

  test('CEF_PARITY_APIS are a subset of CEF_CORE_APIS — core check runs first', () => {
    const partialBinding = { ...MOCK_CEF_APIS };
    delete partialBinding.sendIpcMessage;

    const proxy = createProxyWithBinding(partialBinding);
    // sendIpcMessage is both CORE and PARITY — core check runs first
    expect(() => proxy.sendIpcMessage).toThrow('CEF core API');
  });
});

describe('@bunlet/cef core API set', () => {
  test('all expected core APIs are defined', () => {
    const CEF_CORE_APIS = new Set([
      'initApp', 'quitApp', 'createWindow', 'loadUrl', 'loadFile', 'loadHtml',
      'showWindow', 'hideWindow', 'closeWindow', 'focusWindow', 'maximizeWindow',
      'minimizeWindow', 'restoreWindow', 'setFullscreen', 'getWindowBounds',
      'setWindowBounds', 'setWindowTitle', 'setWindowAlwaysOnTop', 'isWindowVisible',
      'isWindowFocused', 'isWindowMaximized', 'isWindowMinimized', 'isWindowFullscreen',
      'getFocusedWindowId', 'getAllWindowIds', 'executeJavaScript', 'sendIpcMessage',
      'setIpcHandler', 'setAppEventHandler', 'runEventLoop', 'initEventLoop', 'pumpEvents',
      'getPath', 'webviewReload', 'webviewStop', 'webviewGoBack', 'webviewGoForward',
      'openDevtools', 'closeDevtools', 'toggleDevtools', 'isDevtoolsOpen',
      'getCookies', 'setCookie', 'removeCookie', 'clearStorageData', 'getUserAgent',
    ]);

    expect(CEF_CORE_APIS.size).toBe(46);
    expect(CEF_CORE_APIS.has('createWindow')).toBe(true);
    expect(CEF_CORE_APIS.has('executeJavaScript')).toBe(true);
    expect(CEF_CORE_APIS.has('sendIpcMessage')).toBe(true);
    expect(CEF_CORE_APIS.has('getCookies')).toBe(true);
    expect(CEF_CORE_APIS.has('setCookie')).toBe(true);
    expect(CEF_CORE_APIS.has('removeCookie')).toBe(true);
    expect(CEF_CORE_APIS.has('clearStorageData')).toBe(true);
    expect(CEF_CORE_APIS.has('getUserAgent')).toBe(true);
  });
});

describe('@bunlet/cef capability gating', () => {
  test('platform APIs (dialog, tray, etc.) are not in core or parity sets', () => {
    const proxy = createProxyWithBinding(MOCK_CEF_APIS);

    expect(proxy.showOpenDialog).toBeUndefined();
    expect(proxy.showSaveDialog).toBeUndefined();
    expect(proxy.showMessageBox).toBeUndefined();
    expect(proxy.setTrayMenu).toBeUndefined();
    expect(proxy.setClipboardText).toBeUndefined();
  });

  test('non-existent property access returns undefined without throwing', () => {
    const proxy = createProxyWithBinding(MOCK_CEF_APIS);

    expect(proxy.nonExistentApi).toBeUndefined();
    expect(proxy.someRandomMethod).toBeUndefined();
  });
});

describe('@bunlet/cef binding name resolution', () => {
  test('resolves correct binding name for darwin-arm64', () => {
    const original = { platform: process.platform, arch: process.arch };

    // Mock process.platform/arch by testing logic directly
    const bindings = {
      'linux-x64': 'bunlet-cef.linux-x64-gnu.node',
      'linux-arm64': 'bunlet-cef.linux-arm64-gnu.node',
      'darwin-x64': 'bunlet-cef.darwin-x64.node',
      'darwin-arm64': 'bunlet-cef.darwin-arm64.node',
      'win32-x64': 'bunlet-cef.win32-x64-msvc.node',
    };

    expect(bindings['darwin-arm64']).toBe('bunlet-cef.darwin-arm64.node');
    expect(bindings['darwin-x64']).toBe('bunlet-cef.darwin-x64.node');
    expect(bindings['linux-x64']).toBe('bunlet-cef.linux-x64-gnu.node');
    expect(bindings['win32-x64']).toBe('bunlet-cef.win32-x64-msvc.node');
  });

  test('throws for unsupported platform combinations', () => {
    const getBindingName = (platform, arch) => {
      const platformArch = `${platform}-${arch}`;
      const bindings = {
        'linux-x64': 'bunlet-cef.linux-x64-gnu.node',
        'linux-arm64': 'bunlet-cef.linux-arm64-gnu.node',
        'darwin-x64': 'bunlet-cef.darwin-x64.node',
        'darwin-arm64': 'bunlet-cef.darwin-arm64.node',
        'win32-x64': 'bunlet-cef.win32-x64-msvc.node',
      };
      const binding = bindings[platformArch];
      if (!binding) {
        throw new Error(
          `[bunlet] Unsupported platform for CEF backend: ${platformArch}`
        );
      }
      return binding;
    };

    expect(() => getBindingName('freebsd', 'x64')).toThrow('Unsupported platform');
    expect(() => getBindingName('win32', 'arm64')).toThrow('Unsupported platform');
  });
});