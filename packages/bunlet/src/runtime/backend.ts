import native, { detectEngine } from '../native/bindings';
import type { RuntimeEngine } from '../native/bindings';
import type { RuntimeBackend, RuntimeCapabilities } from './types';

function getCapabilities(engine: RuntimeEngine): RuntimeCapabilities {
  if (engine === 'cef') {
    return {
      windowManagement: true,
      multiWindow: true,
      ipcInvoke: true,
      mainToRendererPush: true,
      executeJavaScript: false,
      devtools: false,
      navigation: false,
      preloadScripts: false,
      contextIsolation: false,
      sessionPartitions: false,
      cookies: false,
    };
  }

  return {
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
  };
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
