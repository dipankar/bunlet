import native, { detectEngine } from '../native/bindings';
import type { RuntimeEngine } from '../native/bindings';
import type { RuntimeBackend, RuntimeCapabilities } from './types';

function getCapabilities(engine: RuntimeEngine): RuntimeCapabilities {
  const systemBase: RuntimeCapabilities = {
    windowManagement: true,
    multiWindow: true,
    ipcInvoke: true,
    mainToRendererPush: true,
    executeJavaScript: true,      // fire-and-forget only
    devtools: true,                // debug builds only
    navigation: true,
    preloadScripts: true,
    contextIsolation: true,
    sessionPartitions: true,
    cookies: true,                 // limited: read always returns []
    authoritativeGetters: false,   // wry can't return values from evaluate_script
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

  if (engine === 'cef') {
    return {
      ...systemBase,
      cookies: true,               // full via RequestContext/CookieManager
      authoritativeGetters: true,   // CEF has native getURL/getTitle
      executeJavaScriptReturns: true,
      sessionPartitions: true,      // full via RequestContext
    };
  }

  return systemBase;
}

const engine = detectEngine();

const runtimeBackend: RuntimeBackend = {
  engine,
  bindings: native,
  capabilities: getCapabilities(engine),
};

export function getRuntimeBackend(): RuntimeBackend {
  return runtimeBackend;
}
