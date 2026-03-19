/**
 * Bunlet CLI
 *
 * Command-line interface for the Bunlet desktop framework.
 */

// Dev Server
export { DevServer } from './dev/server';
export type { DevServerOptions } from './dev/server';

// HMR
export type { HMRUpdate, HMRUpdateType, ModuleUpdate, HMRError, HMRClientMessage } from './dev/hmr';
export { createUpdate, createModuleUpdate, createErrorUpdate } from './dev/hmr';

// File Watcher
export { FileWatcher } from './dev/watcher';
export type { FileChange, FileChangeType, WatcherOptions, ChangeHandler } from './dev/watcher';

// Main Process Watcher
export { MainWatcher } from './dev/main-watcher';
export type { MainWatcherOptions } from './dev/main-watcher';

// Error Overlay
export { generateErrorOverlayHTML, generateErrorOverlayScript } from './dev/error-overlay';
