/**
 * @bunlet/cef - CEF backend for Bunlet
 *
 * This module loads the CEF native addon and provides a proxy that:
 * 1. Routes core APIs through the CEF native addon (full Chromium webview)
 * 2. Falls back to @bunlet/native for APIs where CEF already has parity
 * 3. Throws explicit errors for APIs that are not yet implemented in CEF
 *
 * The CEF backend provides a full Chromium engine, giving Bunlet apps
 * web compatibility equivalent to Electron (DevTools, executeJavaScript,
 * CSS features, navigation, etc.).
 */

const { platform, arch } = process;

// ─── Core API contract ───────────────────────────────────────────────
// These APIs MUST exist in the CEF native addon. If any are missing,
// we fail immediately rather than silently degrading.
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
  // Navigation
  'webviewReload',
  'webviewStop',
  'webviewGoBack',
  'webviewGoForward',
  // DevTools
  'openDevtools',
  'closeDevtools',
  'toggleDevtools',
  'isDevtoolsOpen',
  // Session / Cookies
  'getCookies',
  'setCookie',
  'removeCookie',
  'clearStorageData',
  'getUserAgent',
]);

// ─── CEF-parity APIs ─────────────────────────────────────────────────
// These APIs now have full CEF implementations and should NOT fall back
// to the system-webview backend.
const CEF_PARITY_APIS = new Set([
  // IPC and event loop are handled by CEF directly now
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
  // Session / Cookies — full CEF implementation via RequestContext
  'getCookies',
  'setCookie',
  'removeCookie',
  'clearStorageData',
  'getUserAgent',
]);

// ─── Load CEF native addon ───────────────────────────────────────────

function getBindingName() {
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
}

function loadCefBinding() {
  const bindingName = getBindingName();
  try {
    return require(`./${bindingName}`);
  } catch (error) {
    throw new Error(
      `[bunlet] Failed to load CEF native addon "${bindingName}". ` +
        `Run "bun --filter @bunlet/cef run build" to build it.\n` +
        `Underlying error: ${String(error)}`
    );
  }
}

const cefBinding = loadCefBinding();

// ─── Optional native fallback ────────────────────────────────────────
// When BUNLET_CEF_ENABLE_NATIVE_FALLBACK=1, APIs not yet implemented
// in CEF can fall back to the system-webview (@bunlet/native) backend.
// This is intended for transitional use and should not be relied upon
// long-term, as mixing two webview runtimes has subtle inconsistencies.

const enableNativeFallback = process.env.BUNLET_CEF_ENABLE_NATIVE_FALLBACK === '1';
let nativeFallback = null;
const warnedFallback = new Set();

if (enableNativeFallback) {
  try {
    nativeFallback = require('@bunlet/native');
  } catch {
    nativeFallback = null;
  }
}

// ─── Create proxy ────────────────────────────────────────────────────

module.exports = new Proxy(cefBinding, {
  get(target, prop, receiver) {
    // If CEF binding has the property, use it directly
    if (Reflect.has(target, prop)) {
      return Reflect.get(target, prop, receiver);
    }

    // Check if this is a core API that must be present
    if (CEF_CORE_APIS.has(prop)) {
      throw new Error(
        `[bunlet] CEF core API "${String(prop)}" is missing from the native addon. ` +
        `Rebuild @bunlet/cef-native with CEF support enabled.`
      );
    }

    // Check if this is a CEF-parity API that should NOT fall back
    if (CEF_PARITY_APIS.has(prop)) {
      // Don't fall back for APIs that CEF should handle
      return undefined;
    }

    // For non-core, non-parity APIs (dialog, menu, tray, etc.),
    // optionally fall back to the system-webview backend
    if (enableNativeFallback && nativeFallback && Reflect.has(nativeFallback, prop)) {
      const key = String(prop);
      if (!warnedFallback.has(key)) {
        warnedFallback.add(key);
        console.warn(
          `[bunlet] Using @bunlet/native fallback for non-CEF API "${key}" (BUNLET_CEF_ENABLE_NATIVE_FALLBACK=1).`
        );
      }
      return Reflect.get(nativeFallback, prop, receiver);
    }

    return undefined;
  },
});