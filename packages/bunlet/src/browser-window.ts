/**
 * BrowserWindow - Create and control browser windows
 */

import { EventEmitter } from 'events';
import native from './native/bindings';
import type { BrowserWindowOptions, Rectangle, BunletEvent } from './types';
import { screen } from './screen';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Global registry of windows by ID
 */
export const windowRegistry = new Map<number, BrowserWindow>();

/**
 * DevTools options
 */
export interface DevToolsOptions {
  /** Mode for DevTools panel (detached is a separate window) */
  mode?: 'right' | 'bottom' | 'detach';
}

/**
 * WebContents - Control the web page displayed in a window
 */
export class WebContents extends EventEmitter {
  private windowId: number;

  constructor(windowId: number) {
    super();
    this.windowId = windowId;
  }

  /**
   * Execute JavaScript in the WebView
   */
  async executeJavaScript(code: string): Promise<unknown> {
    const result = await native.executeJavaScript(this.windowId, code);
    try {
      return JSON.parse(result);
    } catch {
      return result;
    }
  }

  /**
   * Open DevTools
   */
  openDevTools(options?: DevToolsOptions): void {
    try {
      native.openDevtools(this.windowId);
      this.emit('devtools-opened');
    } catch (e) {
      // DevTools might not be available in release builds
      console.warn('DevTools not available:', e);
    }
  }

  /**
   * Close DevTools
   */
  closeDevTools(): void {
    try {
      native.closeDevtools(this.windowId);
      this.emit('devtools-closed');
    } catch {
      // Ignore if not available
    }
  }

  /**
   * Toggle DevTools
   */
  toggleDevTools(): void {
    try {
      native.toggleDevtools(this.windowId);
    } catch {
      // Ignore if not available
    }
  }

  /**
   * Check if DevTools is opened
   */
  isDevToolsOpened(): boolean {
    try {
      return native.isDevtoolsOpen(this.windowId);
    } catch {
      return false;
    }
  }

  /**
   * Reload the page
   */
  reload(): void {
    native.webviewReload(this.windowId);
  }

  /**
   * Stop loading the page
   */
  stop(): void {
    native.webviewStop(this.windowId);
  }

  /**
   * Navigate back in history
   */
  goBack(): void {
    native.webviewGoBack(this.windowId);
  }

  /**
   * Navigate forward in history
   */
  goForward(): void {
    native.webviewGoForward(this.windowId);
  }

  /**
   * Check if webview can navigate back
   * Note: This uses a heuristic based on history length
   */
  canGoBack(): boolean {
    // This is a best-effort implementation since wry doesn't expose canGoBack
    // The actual state tracking would need to be done via navigation events
    return true; // Assume can go back, history.back() is safe to call
  }

  /**
   * Check if webview can navigate forward
   * Note: This uses a heuristic based on history state
   */
  canGoForward(): boolean {
    // Same limitation as canGoBack
    return true;
  }

  /**
   * Get the current URL
   */
  getURL(): string {
    // Would need to track this via navigation events
    // For now, return empty string as placeholder
    return '';
  }

  /**
   * Get the page title
   */
  getTitle(): string {
    // Would need to track this via page title change events
    return '';
  }
}

/**
 * BrowserWindow class
 */
export class BrowserWindow extends EventEmitter {
  readonly id: number;
  readonly webContents: WebContents;
  private options: BrowserWindowOptions;
  private destroyed = false;

  constructor(options: BrowserWindowOptions = {}) {
    super();
    this.options = options;
    const preloadScript = this.resolvePreloadScript(options.webPreferences?.preload);
    const openDevtools =
      options.webPreferences?.devTools ?? process.env.BUNLET_OPEN_DEVTOOLS === '1';

    // Create native window
    this.id = native.createWindow({
      width: options.width ?? 800,
      height: options.height ?? 600,
      title: options.title ?? 'Bunlet',
      resizable: options.resizable ?? true,
      decorations: options.frame ?? true,
      transparent: options.transparent ?? false,
      visible: options.show ?? true,
      alwaysOnTop: options.alwaysOnTop ?? false,
      x: options.x,
      y: options.y,
      minWidth: options.minWidth,
      minHeight: options.minHeight,
      maxWidth: options.maxWidth,
      maxHeight: options.maxHeight,
      preloadScript,
      openDevtools,
      parentId: options.parent?.id,
      modal: options.modal,
    });

    // Create WebContents
    this.webContents = new WebContents(this.id);

    // Register in global registry
    windowRegistry.set(this.id, this);

    // Note: Auto-centering is disabled because windows are created asynchronously
    // when app.run() is called. Call center() manually after 'ready-to-show' event
    // or use x/y options with screen API to center at creation time.
  }

  // Static methods

  /**
   * Get all open windows
   */
  static getAllWindows(): BrowserWindow[] {
    return Array.from(windowRegistry.values());
  }

  /**
   * Get currently focused window
   */
  static getFocusedWindow(): BrowserWindow | null {
    if (typeof native.getFocusedWindowId === 'function') {
      const focusedWindowId = native.getFocusedWindowId();
      if (typeof focusedWindowId === 'number') {
        return windowRegistry.get(focusedWindowId) ?? null;
      }
    }
    return null;
  }

  /**
   * Get window by ID
   */
  static fromId(id: number): BrowserWindow | null {
    return windowRegistry.get(id) ?? null;
  }

  // Content loading

  /**
   * Load a URL
   */
  async loadURL(url: string): Promise<void> {
    this.emit('did-start-loading');
    native.loadUrl(this.id, url);
    this.maybeAutoOpenDevTools();
    this.emit('did-finish-load');
  }

  /**
   * Load a local file
   */
  async loadFile(filePath: string): Promise<void> {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    this.emit('did-start-loading');
    native.loadFile(this.id, absolutePath);
    this.maybeAutoOpenDevTools();
    this.emit('did-finish-load');
  }

  private maybeAutoOpenDevTools(): void {
    if (process.env.BUNLET_OPEN_DEVTOOLS === '1') {
      this.webContents.openDevTools();
    }
  }

  private resolvePreloadScript(preloadPath?: string): string | undefined {
    if (!preloadPath) {
      return undefined;
    }

    const absolutePath = path.isAbsolute(preloadPath)
      ? preloadPath
      : path.resolve(process.cwd(), preloadPath);

    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }

    // Build output fallback (preload.ts -> preload.js in current working directory)
    const fallbackPath = path.resolve(
      process.cwd(),
      path.basename(preloadPath).replace(/\.(ts|tsx|mts|cts)$/i, '.js')
    );
    if (fs.existsSync(fallbackPath)) {
      return fallbackPath;
    }

    console.warn(`Preload script not found: ${absolutePath}`);
    return undefined;
  }

  /**
   * Reload the page
   */
  reload(): void {
    this.webContents.reload();
  }

  // Visibility

  /**
   * Show the window
   */
  show(): void {
    native.showWindow(this.id);
    this.emit('show');
  }

  /**
   * Hide the window
   */
  hide(): void {
    native.hideWindow(this.id);
    this.emit('hide');
  }

  /**
   * Focus the window
   */
  focus(): void {
    native.focusWindow(this.id);
    this.emit('focus');
  }

  /**
   * Remove focus from the window
   */
  blur(): void {
    // Would need native support
    this.emit('blur');
  }

  // State checks

  /**
   * Check if window is visible
   */
  isVisible(): boolean {
    return native.isWindowVisible(this.id);
  }

  /**
   * Check if window is focused
   */
  isFocused(): boolean {
    if (typeof native.isWindowFocused === 'function') {
      return native.isWindowFocused(this.id);
    }
    return false;
  }

  /**
   * Check if window is maximized
   */
  isMaximized(): boolean {
    return native.isWindowMaximized(this.id);
  }

  /**
   * Check if window is minimized
   */
  isMinimized(): boolean {
    return native.isWindowMinimized(this.id);
  }

  /**
   * Check if window is fullscreen
   */
  isFullScreen(): boolean {
    return native.isWindowFullscreen(this.id);
  }

  /**
   * Check if window is destroyed
   */
  isDestroyed(): boolean {
    return this.destroyed;
  }

  // Window controls

  /**
   * Maximize the window
   */
  maximize(): void {
    native.maximizeWindow(this.id);
    this.emit('maximize');
  }

  /**
   * Exit maximized state
   */
  unmaximize(): void {
    native.restoreWindow(this.id);
    this.emit('unmaximize');
  }

  /**
   * Minimize the window
   */
  minimize(): void {
    native.minimizeWindow(this.id);
    this.emit('minimize');
  }

  /**
   * Restore from minimized/maximized
   */
  restore(): void {
    native.restoreWindow(this.id);
    this.emit('restore');
  }

  /**
   * Set fullscreen state
   */
  setFullScreen(flag: boolean): void {
    native.setFullscreen(this.id, flag);
    if (flag) {
      this.emit('enter-full-screen');
    } else {
      this.emit('leave-full-screen');
    }
  }

  // Geometry

  /**
   * Get window bounds
   */
  getBounds(): Rectangle {
    return native.getWindowBounds(this.id);
  }

  /**
   * Set window bounds
   */
  setBounds(bounds: Partial<Rectangle>, animate = false): void {
    native.setWindowBounds(
      this.id,
      bounds.x ?? null,
      bounds.y ?? null,
      bounds.width ?? null,
      bounds.height ?? null
    );
    this.emit('resize');
    this.emit('move');
  }

  /**
   * Set window size
   */
  setSize(width: number, height: number, animate = false): void {
    native.setWindowBounds(this.id, null, null, width, height);
    this.emit('resize');
  }

  /**
   * Set window position
   */
  setPosition(x: number, y: number, animate = false): void {
    native.setWindowBounds(this.id, x, y, null, null);
    this.emit('move');
  }

  /**
   * Center window on screen
   */
  center(): void {
    const display = screen.getPrimaryDisplay();
    const bounds = this.getBounds();
    const x = Math.round(display.bounds.x + (display.bounds.width - bounds.width) / 2);
    const y = Math.round(display.bounds.y + (display.bounds.height - bounds.height) / 2);
    this.setPosition(x, y);
  }

  // Properties

  /**
   * Set window title
   */
  setTitle(title: string): void {
    native.setWindowTitle(this.id, title);
  }

  /**
   * Get window title
   */
  getTitle(): string {
    // Would need native support
    return this.options.title ?? 'Bunlet';
  }

  /**
   * Set always on top
   */
  setAlwaysOnTop(flag: boolean): void {
    if (typeof native.setWindowAlwaysOnTop === 'function') {
      native.setWindowAlwaysOnTop(this.id, flag);
    }
    this.options.alwaysOnTop = flag;
  }

  /**
   * Set background color
   */
  setBackgroundColor(color: string): void {
    // Would need native support
  }

  // Lifecycle

  /**
   * Close the window
   */
  close(): void {
    const event: BunletEvent = {
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };

    this.emit('close', event);

    if (!event.defaultPrevented) {
      this.destroy();
    }
  }

  /**
   * Force close without events
   */
  destroy(): void {
    if (this.destroyed) return;

    native.closeWindow(this.id);
    windowRegistry.delete(this.id);
    this.destroyed = true;
    this.emit('closed');
  }

  // IPC

  /**
   * Send message to renderer
   */
  send(channel: string, ...args: unknown[]): void {
    const message = JSON.stringify({
      channel,
      args,
    });
    native.sendIpcMessage(this.id, message);
  }
}
