import type * as NativeTypes from '@bunlet/native';
import type { RuntimeEngine } from '../native/bindings';

export type NativeBindings = typeof NativeTypes;

export interface RuntimeCapabilities {
  /** Window creation and management */
  windowManagement: boolean;
  /** Multiple windows simultaneously */
  multiWindow: boolean;
  /** ipcRenderer.invoke() round-trip IPC */
  ipcInvoke: boolean;
  /** Main → renderer push messaging */
  mainToRendererPush: boolean;
  /** Execute JavaScript in renderer (fire-and-forget on system webview; returns value on CEF) */
  executeJavaScript: boolean;
  /** DevTools open/close/toggle */
  devtools: boolean;
  /** Navigation: goBack, goForward, reload, stop */
  navigation: boolean;
  /** Preload script injection */
  preloadScripts: boolean;
  /** Context isolation between preload and renderer */
  contextIsolation: boolean;
  /** Session partitions (persist and ephemeral) */
  sessionPartitions: boolean;
  /** Cookie read/write (limited on system webview; full on CEF) */
  cookies: boolean;
  /** Authoritative URL/title/history queries (via native API, not tracking) */
  authoritativeGetters: boolean;
  /** Can return values from executeJavaScript (CEF only) */
  executeJavaScriptReturns: boolean;
  /** Dialog system (open/save/message box) */
  dialogs: boolean;
  /** System tray icons */
  tray: boolean;
  /** Global keyboard shortcuts */
  globalShortcuts: boolean;
  /** System notifications */
  notifications: boolean;
  /** Power monitoring (battery, idle, AC state) */
  powerMonitor: boolean;
  /** Screen/display enumeration */
  screen: boolean;
  /** Clipboard read/write */
  clipboard: boolean;
  /** File drag-and-drop */
  fileDrop: boolean;
}

export interface RuntimeBackend {
  engine: RuntimeEngine;
  bindings: NativeBindings;
  capabilities: RuntimeCapabilities;
}
