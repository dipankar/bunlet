/**
 * Bunlet - Build cross-platform desktop apps with Bun and WebView
 *
 * @packageDocumentation
 */

// Core exports
export { app } from './app';
export { BrowserWindow, WebContents, windowManager, windowRegistry } from './browser-window';

// Phase 2: Native APIs
export { clipboard } from './clipboard';
export { shell } from './shell';
export { dialog } from './dialog';
export { globalShortcut } from './global-shortcut';
export { Notification } from './notification';
export { Menu, MenuItem } from './menu';
export { Tray } from './tray';
export { screen } from './screen';
export { fileWatcher, FileWatcher } from './file-watcher';

// Phase 5: Auto-Updater
export { autoUpdater, AutoUpdater, DarwinInstallStrategy, WindowsInstallStrategy, LinuxInstallStrategy } from './auto-updater';

// Type exports
export type {
  Rectangle,
  WebPreferences,
  BrowserWindowOptions,
  PathName,
  IPCContext,
  BunletEvent,
} from './types';

// Dialog types
export type {
  FileFilter,
  OpenDialogOptions,
  OpenDialogReturnValue,
  SaveDialogOptions,
  SaveDialogReturnValue,
  MessageBoxOptions,
  MessageBoxReturnValue,
} from './dialog';

// Shell types
export type { OpenExternalOptions } from './shell';

// Screen types
export type { Display, Point } from './screen';

// File watcher types
export type { FileWatchEvent, FileWatcherOptions, FileWatchEventType } from './file-watcher';

// Notification types
export type { NotificationOptions, NotificationAction } from './notification';

// Menu types
export type { MenuItemOptions, MenuItemRole, PopupOptions } from './menu';

// Auto-Updater types
export type {
  UpdateInfo,
  UpdateFile,
  ProgressInfo,
  UpdateCheckResult,
  UpdateConfig,
  ArtifactMetadata,
  InstallStrategy,
  InstallOptions,
  InstallResult,
  StagedRolloutPolicy,
  RolloutCheckResult,
  ProviderFactory,
  UpdateProvider,
  BlockMap,
  BlockInfo,
  UpdateManifest,
} from './updater/types';

// Context Bridge (for preload scripts)
export { contextBridge, ipcRenderer } from './context-bridge';

// Preload lifecycle utilities
export { preload, isPreloadContext, onPreloadSuccess, onPreloadError } from './preload';

// Restart state persistence
export {
  saveRestartState,
  loadRestartState,
  collectWindowState,
} from './restart';
export type { WindowRestoreState, RestartState } from './restart';

// Session/Cookies
export { Session, Cookies, session } from './session';

// Power Monitor
export { powerMonitor } from './power-monitor';
export type { BatteryInfo, IdleState, PowerEventType } from './power-monitor';
export type {
  Cookie as SessionCookie,
  CookieFilter,
  CookieDetails,
  ClearStorageDataOptions,
} from './session';

// Re-export zod for handler schemas
export { z } from 'zod';

// Config helper
export { defineConfig } from './config';
export type { BunletConfig } from './config';

// Runtime backend
export { runtime } from './runtime';
export type { RuntimeBackend, RuntimeCapabilities } from './runtime';

// Debug logging and diagnostics
export { createLogger, collectDiagnostics, printDiagnostics } from './debug';
export type { Logger, LogLevel } from './debug';

// Performance budgets (for CI and release gating)
export { performanceBudgets, binarySizeBudgets, coverageTargets } from './performance-budgets';
export type { PerformanceBudget, BinarySizeBudget, CoverageTarget } from './performance-budgets';
