/**
 * Preload context detection and lifecycle utilities.
 *
 * These helpers allow preload scripts to detect their execution context
 * and register lifecycle handlers.
 *
 * @example
 * ```typescript
 * import { preload, contextBridge, ipcRenderer } from '@bunlet/core';
 *
 * if (preload.isPreloadContext()) {
 *   contextBridge.exposeInMainWorld('api', {
 *     ping: () => ipcRenderer.invoke('ping'),
 *   });
 * }
 *
 * preload.onSuccess((path) => {
 *   console.log('Preload loaded:', path);
 * });
 *
 * preload.onError((err) => {
 *   console.error('Preload failed:', err.message);
 * });
 * ```
 */

const PRELOAD_CONTEXT_SYMBOL = Symbol.for('__bunlet_preload_context');
const BUNLET_GLOBAL = '__bunlet' as const;

/**
 * Check whether code is running inside a preload script context.
 *
 * In a preload context, the `window.__bunlet` IPC bridge is available
 * and the page has not yet loaded. This returns `true` when the Bunlet
 * initialization script has been evaluated, which happens before any
 * preload script runs.
 */
export function isPreloadContext(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return !!(window as unknown as Record<symbol, unknown>)[PRELOAD_CONTEXT_SYMBOL]
    || !!(window as unknown as Record<string, unknown>)[BUNLET_GLOBAL];
}

/**
 * Register a callback that runs when the preload script executes successfully.
 *
 * The native runtime emits a `preload-success` event to the BrowserWindow
 * after the preload script finishes executing. This convenience method
 * listens for that event on the BrowserWindow side.
 *
 * Note: This hook fires on the **main process** side (in the window's
 * event handlers), not in the renderer process.
 */
export function onPreloadSuccess(
  window: import('./browser-window').BrowserWindow,
  callback: (preloadPath: string) => void,
): () => void {
  const handler = (path: string) => callback(path);
  window.on('preload-success', handler);
  return () => window.off('preload-success', handler);
}

/**
 * Register a callback that runs when the preload script fails.
 *
 * The native runtime emits a `preload-error` event with details about
 * the failure. This convenience method listens for that event on the
 * BrowserWindow side.
 *
 * Note: This hook fires on the **main process** side.
 */
export function onPreloadError(
  window: import('./browser-window').BrowserWindow,
  callback: (err: { path: string; message: string; stack?: string }) => void,
): () => void {
  const handler = (err: { path: string; message: string; stack?: string }) => callback(err);
  window.on('preload-error', handler);
  return () => window.off('preload-error', handler);
}

/**
 * Preload API namespace
 */
export const preload = {
  isPreloadContext,
  onPreloadSuccess,
  onPreloadError,
} as const;