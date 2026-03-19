/**
 * Window creation options
 */
export interface WindowOptions {
  /** Window width in pixels */
  width?: number;
  /** Window height in pixels */
  height?: number;
  /** Window title */
  title?: string;
  /** Whether window is resizable */
  resizable?: boolean;
  /** Whether to show window decorations (title bar, borders) */
  decorations?: boolean;
  /** Whether window is transparent */
  transparent?: boolean;
  /** Whether to show window immediately */
  visible?: boolean;
  /** Whether window should always be on top */
  alwaysOnTop?: boolean;
  /** Initial X position */
  x?: number;
  /** Initial Y position */
  y?: number;
  /** Minimum width */
  minWidth?: number;
  /** Minimum height */
  minHeight?: number;
  /** Maximum width */
  maxWidth?: number;
  /** Maximum height */
  maxHeight?: number;
  /** Absolute path to preload script injected at startup */
  preloadScript?: string;
  /** Open DevTools for this window */
  openDevtools?: boolean;
  /** Parent window ID for child windows */
  parentId?: number;
  /** Whether this is a modal window (blocks parent) */
  modal?: boolean;
}

/**
 * Window bounds (position and size)
 */
export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Create a new window with the given options
 * @returns Window ID
 */
export function createWindow(options?: WindowOptions): number;

/**
 * Load a URL in the window's WebView
 */
export function loadUrl(windowId: number, url: string): void;

/**
 * Load an HTML file in the window's WebView
 */
export function loadFile(windowId: number, filePath: string): void;

/**
 * Load HTML content directly in the window's WebView
 */
export function loadHtml(windowId: number, html: string): void;

/**
 * Show the window
 */
export function showWindow(windowId: number): void;

/**
 * Hide the window
 */
export function hideWindow(windowId: number): void;

/**
 * Close and destroy the window
 */
export function closeWindow(windowId: number): void;

/**
 * Focus the window
 */
export function focusWindow(windowId: number): void;

/**
 * Maximize the window
 */
export function maximizeWindow(windowId: number): void;

/**
 * Minimize the window
 */
export function minimizeWindow(windowId: number): void;

/**
 * Restore the window from maximized/minimized state
 */
export function restoreWindow(windowId: number): void;

/**
 * Set window fullscreen state
 */
export function setFullscreen(windowId: number, fullscreen: boolean): void;

/**
 * Get window bounds
 */
export function getWindowBounds(windowId: number): WindowBounds;

/**
 * Set window bounds
 */
export function setWindowBounds(
  windowId: number,
  x: number | null,
  y: number | null,
  width: number | null,
  height: number | null
): void;

/**
 * Set window title
 */
export function setWindowTitle(windowId: number, title: string): void;

/**
 * Set always-on-top flag
 */
export function setWindowAlwaysOnTop(windowId: number, alwaysOnTop: boolean): void;

/**
 * Check if window is visible
 */
export function isWindowVisible(windowId: number): boolean;

/**
 * Check if window is focused
 */
export function isWindowFocused(windowId: number): boolean;

/**
 * Check if window is maximized
 */
export function isWindowMaximized(windowId: number): boolean;

/**
 * Check if window is minimized
 */
export function isWindowMinimized(windowId: number): boolean;

/**
 * Check if window is fullscreen
 */
export function isWindowFullscreen(windowId: number): boolean;

/**
 * Get the currently focused window ID
 */
export function getFocusedWindowId(): number | null;

/**
 * Run the event loop (blocking)
 * This should be called after creating windows
 */
export function runEventLoop(): void;

/**
 * Initialize the event loop and create windows (non-blocking)
 * Used for the pumping event model on Linux
 */
export function initEventLoop(): void;

/**
 * Result of pumping events
 */
export interface PumpResult {
  shouldQuit: boolean;
  messages: IpcMessage[];
}

/**
 * Pump events (non-blocking) - returns pending IPC messages
 * Call repeatedly in a loop to process events
 */
export function pumpEvents(): PumpResult;

/**
 * Poll and retrieve pending IPC messages
 */
export function pollIpcMessages(): IpcMessage[];

/**
 * Execute JavaScript in the window's WebView
 */
export function executeJavaScript(windowId: number, script: string): Promise<string>;

/**
 * IPC message from WebView
 */
export interface IpcMessage {
  windowId: number;
  message: string;
}

/**
 * App-level event from native runtime
 */
export interface AppEvent {
  event: string;
}

/**
 * Set up IPC handler for messages from WebView
 */
export function setIpcHandler(callback: (message: IpcMessage) => void): void;

/**
 * Set app event handler (window lifecycle events)
 */
export function setAppEventHandler(callback: (event: AppEvent) => void): void;

/**
 * Send IPC message to a window's WebView
 */
export function sendIpcMessage(windowId: number, message: string): void;

/**
 * Initialize the application
 */
export function initApp(): void;

/**
 * Quit the application
 */
export function quitApp(): void;

/**
 * Get all window IDs
 */
export function getAllWindowIds(): number[];

/**
 * Get a standard system path
 */
export function getPath(name: string): string | null;

// ============================================================================
// Phase 2: Clipboard API
// ============================================================================

/**
 * Read text from the clipboard
 */
export function clipboardReadText(): string;

/**
 * Write text to the clipboard
 */
export function clipboardWriteText(text: string): void;

/**
 * Clear the clipboard
 */
export function clipboardClear(): void;

/**
 * Check if clipboard has text content
 */
export function clipboardHasText(): boolean;

// ============================================================================
// Phase 2: Shell API
// ============================================================================

/**
 * Open a URL in the default browser
 */
export function shellOpenExternal(url: string): Promise<void>;

/**
 * Open a file or directory with the default application
 */
export function shellOpenPath(path: string): Promise<string>;

/**
 * Show an item in the file manager
 */
export function shellShowItemInFolder(fullPath: string): void;

/**
 * Move an item to the trash
 */
export function shellTrashItem(path: string): Promise<void>;

/**
 * Play the system beep sound
 */
export function shellBeep(): void;

// ============================================================================
// Phase 2: Dialog API
// ============================================================================

export interface DialogFileFilter {
  name: string;
  extensions: string[];
}

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: DialogFileFilter[];
  openFile?: boolean;
  openDirectory?: boolean;
  multiSelections?: boolean;
}

export interface OpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: DialogFileFilter[];
}

export interface SaveDialogResult {
  canceled: boolean;
  filePath: string | null;
}

export interface MessageBoxOptions {
  messageType?: string;
  title?: string;
  message: string;
  detail?: string;
  buttons?: string[];
  defaultId?: number;
  cancelId?: number;
}

export interface MessageBoxResult {
  response: number;
}

/**
 * Show an open file dialog
 */
export function showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogResult>;

/**
 * Show a save file dialog
 */
export function showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogResult>;

/**
 * Show a message box
 */
export function showMessageBox(options: MessageBoxOptions): Promise<MessageBoxResult>;

/**
 * Show an error box (synchronous)
 */
export function showErrorBox(title: string, content: string): void;

// ============================================================================
// Phase 2: Global Shortcuts API
// ============================================================================

/**
 * Initialize the global shortcuts system
 */
export function initGlobalShortcuts(): void;

/**
 * Set the callback for shortcut events
 */
export function setShortcutCallback(callback: (id: number) => void): void;

/**
 * Register a global shortcut
 */
export function registerShortcut(accelerator: string): number;

/**
 * Unregister a global shortcut
 */
export function unregisterShortcut(accelerator: string): boolean;

/**
 * Unregister all global shortcuts
 */
export function unregisterAllShortcuts(): void;

/**
 * Check if a shortcut is registered
 */
export function isShortcutRegistered(accelerator: string): boolean;

// ============================================================================
// Phase 2: Notification API
// ============================================================================

export interface NotificationAction {
  actionType: string;
  text: string;
}

export interface NotificationOptions {
  title: string;
  body?: string;
  subtitle?: string;
  icon?: string;
  silent?: boolean;
  urgency?: string;
  timeoutType?: string;
  actions?: NotificationAction[];
}

export interface NotificationEvent {
  notificationId: number;
  eventType: string;
  actionIndex?: number;
}

/**
 * Check if notifications are supported
 */
export function notificationIsSupported(): boolean;

/**
 * Set the notification event callback
 */
export function setNotificationCallback(callback: (event: NotificationEvent) => void): void;

/**
 * Show a notification
 */
export function showNotification(options: NotificationOptions): number;

/**
 * Close a notification
 */
export function closeNotification(notificationId: number): boolean;

// ============================================================================
// Phase 2: Menu API
// ============================================================================

export interface MenuItemOptions {
  id?: string;
  label?: string;
  enabled?: boolean;
  itemType?: string;
  accelerator?: string;
  checked?: boolean;
  role?: string;
  submenu?: MenuItemOptions[];
  callbackId?: number;
}

export interface MenuEventData {
  menuId: number;
  itemId: string;
  callbackId: number;
}

/**
 * Initialize menu events
 */
export function initMenuEvents(): void;

/**
 * Set the menu event callback
 */
export function setMenuCallback(callback: (event: MenuEventData) => void): void;

/**
 * Create a new menu
 */
export function createMenu(): number;

/**
 * Append a menu item
 */
export function appendMenuItem(menuId: number, options: MenuItemOptions): boolean;

/**
 * Build menu from template
 */
export function buildMenuFromTemplate(menuId: number, template: MenuItemOptions[]): boolean;

/**
 * Set the application menu
 */
export function setApplicationMenu(menuId?: number): boolean;

/**
 * Get the application menu ID
 */
export function getApplicationMenu(): number | null;

/**
 * Destroy a menu
 */
export function destroyMenu(menuId: number): boolean;

/**
 * Show a popup menu
 */
export function popupMenu(menuId: number, windowId: number, x: number, y: number): boolean;

// ============================================================================
// Phase 2: Tray API
// ============================================================================

export interface TrayEventData {
  trayId: number;
  eventType: string;
  x: number;
  y: number;
}

export interface TrayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Initialize tray events
 */
export function initTrayEvents(): void;

/**
 * Set the tray event callback
 */
export function setTrayCallback(callback: (event: TrayEventData) => void): void;

/**
 * Create a tray icon
 */
export function createTray(iconPath: string): number;

/**
 * Create a tray icon with tooltip
 */
export function createTrayWithTooltip(iconPath: string, tooltip: string): number;

/**
 * Set the tray icon
 */
export function setTrayIcon(trayId: number, iconPath: string): void;

/**
 * Set the tray tooltip
 */
export function setTrayTooltip(trayId: number, tooltip: string): void;

/**
 * Set the tray title (macOS only)
 */
export function setTrayTitle(trayId: number, title: string): void;

/**
 * Set the tray menu
 */
export function setTrayMenu(trayId: number, menuId: number): void;

/**
 * Get tray bounds
 */
export function getTrayBounds(trayId: number): TrayBounds;

/**
 * Destroy a tray icon
 */
export function destroyTray(trayId: number): boolean;

/**
 * Check if a tray is destroyed
 */
export function isTrayDestroyed(trayId: number): boolean;

// ============================================================================
// File Watcher API
// ============================================================================

export interface FileWatchEvent {
  watcherId: number;
  eventType: string;
  paths: string[];
}

/**
 * Set the file watcher callback
 */
export function setFileWatcherCallback(callback: (event: FileWatchEvent) => void): void;

/**
 * Watch a path for changes
 */
export function watchPath(path: string, recursive?: boolean): number;

/**
 * Stop watching a path
 */
export function unwatch(watcherId: number): boolean;

/**
 * Stop all watchers
 */
export function unwatchAll(): void;

/**
 * Get the number of active watchers
 */
export function getWatcherCount(): number;

// ============================================================================
// Navigation API
// ============================================================================

/**
 * Navigate back in webview history
 */
export function webviewGoBack(windowId: number): void;

/**
 * Navigate forward in webview history
 */
export function webviewGoForward(windowId: number): void;

/**
 * Reload the webview
 */
export function webviewReload(windowId: number): void;

/**
 * Stop loading the webview
 */
export function webviewStop(windowId: number): void;

// ============================================================================
// Screen/Display API
// ============================================================================

/**
 * Display/monitor information
 */
export interface DisplayInfo {
  /** Unique display identifier */
  id: number;
  /** Display name (may be empty on some platforms) */
  name: string;
  /** X position of the display in virtual screen coordinates */
  x: number;
  /** Y position of the display in virtual screen coordinates */
  y: number;
  /** Display width in pixels */
  width: number;
  /** Display height in pixels */
  height: number;
  /** Work area X (excludes taskbar/dock) */
  work_area_x: number;
  /** Work area Y (excludes taskbar/dock) */
  work_area_y: number;
  /** Work area width (excludes taskbar/dock) */
  work_area_width: number;
  /** Work area height (excludes taskbar/dock) */
  work_area_height: number;
  /** Display scale factor (DPI scaling) */
  scale_factor: number;
  /** Whether this is the primary display */
  is_primary: boolean;
}

/**
 * Cursor position on screen
 */
export interface CursorPoint {
  x: number;
  y: number;
}

/**
 * Get the primary display
 */
export function getPrimaryDisplay(): DisplayInfo;

/**
 * Get all available displays
 */
export function getAllDisplays(): DisplayInfo[];

/**
 * Get display nearest to a point
 */
export function getDisplayNearestPoint(x: number, y: number): DisplayInfo;

/**
 * Get cursor screen point
 */
export function getCursorScreenPoint(): CursorPoint;

// ============================================================================
// DevTools API
// ============================================================================

/**
 * Open DevTools for the window
 */
export function openDevtools(windowId: number): void;

/**
 * Close DevTools for the window
 */
export function closeDevtools(windowId: number): void;

/**
 * Toggle DevTools for the window
 */
export function toggleDevtools(windowId: number): void;

/**
 * Check if DevTools is open
 */
export function isDevtoolsOpen(windowId: number): boolean;

// ============================================================================
// Session/Cookie API
// ============================================================================

/**
 * Cookie information
 */
export interface Cookie {
  /** Cookie name */
  name: string;
  /** Cookie value */
  value: string;
  /** Cookie domain */
  domain?: string;
  /** Cookie path */
  path?: string;
  /** Whether cookie is secure */
  secure?: boolean;
  /** Whether cookie is HTTP-only */
  httpOnly?: boolean;
  /** Same-site policy */
  sameSite?: string;
  /** Expiration date in Unix timestamp (seconds) */
  expirationDate?: number;
}

/**
 * Options for clearing storage data
 */
export interface ClearStorageOptions {
  /** Clear cookies (default: true) */
  cookies?: boolean;
  /** Clear localStorage (default: true) */
  localStorage?: boolean;
  /** Clear sessionStorage (default: true) */
  sessionStorage?: boolean;
  /** Clear indexedDB (default: true) */
  indexedDb?: boolean;
  /** Clear cache storage (default: true) */
  cacheStorage?: boolean;
}

/**
 * Get cookies for a window
 * Note: This only retrieves non-HttpOnly cookies due to browser security
 */
export function getCookies(windowId: number): Promise<Cookie[]>;

/**
 * Set a cookie for a window
 */
export function setCookie(windowId: number, cookie: Cookie): void;

/**
 * Remove a cookie by name
 */
export function removeCookie(windowId: number, name: string, url?: string): void;

/**
 * Clear all storage data for a window
 */
export function clearStorageData(windowId: number, options?: ClearStorageOptions): void;

/**
 * Get the user agent string
 */
export function getUserAgent(windowId: number): Promise<string>;

/**
 * Set a custom user agent (must be called before loading content)
 */
export function setUserAgent(windowId: number, userAgent: string): void;

// ============================================================================
// Power Monitor API
// ============================================================================

/**
 * Power event data
 */
export interface PowerEvent {
  /** Event type: "suspend", "resume", "on-ac", "on-battery", "shutdown", "lock-screen" */
  eventType: string;
}

/**
 * Battery information
 */
export interface BatteryInfo {
  /** Battery level percentage (0-100) */
  level: number;
  /** Whether the device is charging */
  charging: boolean;
  /** Whether the device is on AC power */
  onAc: boolean;
  /** Estimated time remaining in seconds (-1 if unknown) */
  timeRemaining: number;
}

/**
 * System idle state
 */
export interface IdleState {
  /** Idle state: "active", "idle", "locked", "unknown" */
  state: string;
  /** Idle time in seconds */
  idleTime: number;
}

/**
 * Initialize power monitoring
 */
export function initPowerMonitor(): void;

/**
 * Stop power monitoring
 */
export function stopPowerMonitor(): void;

/**
 * Set the power event callback
 */
export function setPowerCallback(callback: (event: PowerEvent) => void): void;

/**
 * Get battery information
 */
export function getBatteryInfo(): BatteryInfo;

/**
 * Check if on battery power
 */
export function isOnBatteryPower(): boolean;

/**
 * Get system idle state
 */
export function getSystemIdleState(idleThreshold: number): IdleState;

/**
 * Get system idle time in seconds
 */
export function getSystemIdleTime(): number;
