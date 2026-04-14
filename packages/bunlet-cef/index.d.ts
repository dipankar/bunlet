/**
 * @bunlet/cef - CEF backend types for Bunlet
 *
 * This module re-exports all types from @bunlet/native and provides
 * CEF-specific type overrides where capabilities differ.
 */

// Re-export all native types as the base interface
export type * from '@bunlet/native';

// CEF-specific capability overrides
// These types indicate which APIs are actually functional in the CEF backend.
// The proxy in index.js will throw explicit errors for unsupported APIs.

/**
 * APIs that are fully supported by the CEF backend.
 */
export type CefSupportedApi =
  | 'windowManagement'
  | 'multiWindow'
  | 'ipcInvoke'
  | 'mainToRendererPush'
  | 'executeJavaScript'
  | 'devtools'
  | 'navigation'
  | 'preloadScripts'
  | 'contextIsolation'
  | 'sessionPartitions'
  | 'cookies';

/**
 * Runtime engine identifier.
 */
export type RuntimeEngine = 'cef';

/**
 * CEF-specific configuration options.
 */
export interface CefConfig {
  /** Path to the CEF runtime cache directory */
  cachePath?: string;
  /** Remote debugging port for DevTools (0 = disabled) */
  remoteDebuggingPort?: number;
  /** Disable GPU acceleration */
  disableGpu?: boolean;
  /** Enable offscreen rendering */
  offscreenRendering?: boolean;
}