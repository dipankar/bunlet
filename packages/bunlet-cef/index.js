const { platform, arch } = process;

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
  'executeJavaScript',
  'setIpcHandler',
  'setAppEventHandler',
  'sendIpcMessage',
  'runEventLoop',
  'getAllWindowIds',
  'getPath',
]);

const cefBinding = loadCefBinding();
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

module.exports = new Proxy(cefBinding, {
  get(target, prop, receiver) {
    if (Reflect.has(target, prop)) {
      return Reflect.get(target, prop, receiver);
    }

    if (!nativeFallback || !Reflect.has(nativeFallback, prop)) {
      return undefined;
    }

    if (CEF_CORE_APIS.has(prop)) {
      throw new Error(
        `[bunlet] CEF core API "${String(
          prop
        )}" is missing from the native CEF addon. Rebuild @bunlet/cef.`
      );
    }

    const key = String(prop);
    if (!warnedFallback.has(key)) {
      warnedFallback.add(key);
      console.warn(
        `[bunlet] Using @bunlet/native fallback for non-CEF API "${key}" (BUNLET_CEF_ENABLE_NATIVE_FALLBACK=1).`
      );
    }

    return Reflect.get(nativeFallback, prop, receiver);
  },
});
