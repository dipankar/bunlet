import type * as NativeTypes from '@bunlet/native';
import type { RuntimeEngine } from '../native/bindings';

export type NativeBindings = typeof NativeTypes;

export interface RuntimeCapabilities {
  windowManagement: boolean;
  multiWindow: boolean;
  ipcInvoke: boolean;
  mainToRendererPush: boolean;
  executeJavaScript: boolean;
  devtools: boolean;
  navigation: boolean;
  preloadScripts: boolean;
  contextIsolation: boolean;
  sessionPartitions: boolean;
  cookies: boolean;
}

export interface RuntimeBackend {
  engine: RuntimeEngine;
  bindings: NativeBindings;
  capabilities: RuntimeCapabilities;
}
