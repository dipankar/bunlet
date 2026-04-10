/**
 * BrowserWindow - Create and control browser windows
 */

import { EventEmitter } from 'events';
import type { BrowserWindowOptions, Rectangle, BunletEvent } from './types';
import type { Session } from './session';
import { screen } from './screen';
import * as path from 'path';
import * as fs from 'fs';
import { assertRuntimeCapability, native } from './runtime';
import { windowManager, windowRegistry } from './windows/manager';
import {
  applyNativeWindowEvent,
  createCloseEvent,
  type NativeWindowEvent,
} from './windows/events';
import { BrowserWindowState, WebContentsState } from './windows/state';
import {
  attachSessionToWindow,
  detachSessionFromWindow,
  resolveSessionForWebPreferences,
} from './session';

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
  private readonly windowId: number;
  private readonly state: WebContentsState;
  readonly session: Session;

  constructor(windowId: number, currentSession: Session, state: WebContentsState) {
    super();
    this.windowId = windowId;
    this.session = currentSession;
    this.state = state;
  }

  /**
   * Execute JavaScript in the WebView
   */
  async executeJavaScript(code: string): Promise<unknown> {
    assertRuntimeCapability('executeJavaScript', 'webContents.executeJavaScript()');
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
    assertRuntimeCapability('devtools', 'webContents.openDevTools()');
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
    assertRuntimeCapability('devtools', 'webContents.closeDevTools()');
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
    assertRuntimeCapability('devtools', 'webContents.toggleDevTools()');
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
    assertRuntimeCapability('devtools', 'webContents.isDevToolsOpened()');
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
    assertRuntimeCapability('navigation', 'webContents.reload()');
    native.webviewReload(this.windowId);
  }

  /**
   * Stop loading the page
   */
  stop(): void {
    assertRuntimeCapability('navigation', 'webContents.stop()');
    native.webviewStop(this.windowId);
  }

  /**
   * Navigate back in history
   */
  goBack(): void {
    assertRuntimeCapability('navigation', 'webContents.goBack()');
    native.webviewGoBack(this.windowId);
  }

  /**
   * Navigate forward in history
   */
  goForward(): void {
    assertRuntimeCapability('navigation', 'webContents.goForward()');
    native.webviewGoForward(this.windowId);
  }

  /**
   * Check if webview can navigate back
   */
  canGoBack(): boolean {
    assertRuntimeCapability('navigation', 'webContents.canGoBack()');
    return this.state.canGoBack();
  }

  /**
   * Check if webview can navigate forward
   */
  canGoForward(): boolean {
    assertRuntimeCapability('navigation', 'webContents.canGoForward()');
    return this.state.canGoForward();
  }

  /**
   * Get the current URL
   */
  getURL(): string {
    assertRuntimeCapability('navigation', 'webContents.getURL()');
    return this.state.getURL();
  }

  /**
   * Get the page title
   */
  getTitle(): string {
    return this.state.getTitle();
  }

  recordNavigation(url: string): void {
    this.state.recordNavigation(url);
  }

  recordUnknownNavigation(): void {
    this.state.recordUnknownNavigation();
  }

  recordHistoryBack(): void {
    this.state.recordGoBack();
  }

  recordHistoryForward(): void {
    this.state.recordGoForward();
  }

  setTitle(title: string): void {
    this.state.setTitle(title);
  }
}

/**
 * BrowserWindow class
 */
export class BrowserWindow extends EventEmitter {
  readonly id: number;
  readonly webContents: WebContents;
  readonly session: Session;
  private readonly state: BrowserWindowState;
  private options: BrowserWindowOptions;

  constructor(options: BrowserWindowOptions = {}) {
    super();
    this.options = options;
    this.state = new BrowserWindowState(options.title ?? 'Bunlet');
    if (options.webPreferences?.partition || options.webPreferences?.session) {
      assertRuntimeCapability('sessionPartitions', 'BrowserWindow webPreferences.session/partition');
    }
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

    this.session = resolveSessionForWebPreferences(options.webPreferences);
    attachSessionToWindow(this.id, this.session);

    // Create WebContents
    this.webContents = new WebContents(
      this.id,
      this.session,
      new WebContentsState(this.state.getTitle())
    );

    // Register in process window manager
    windowManager.register(this);

    // Note: Auto-centering is disabled because windows are created asynchronously
    // when app.run() is called. Call center() manually after 'ready-to-show' event
    // or use x/y options with screen API to center at creation time.
  }

  // Static methods

  /**
   * Get all open windows
   */
  static getAllWindows(): BrowserWindow[] {
    return windowManager.getAll();
  }

  /**
   * Get currently focused window
   */
  static getFocusedWindow(): BrowserWindow | null {
    return windowManager.getFocused();
  }

  /**
   * Get window by ID
   */
  static fromId(id: number): BrowserWindow | null {
    return windowManager.get(id);
  }

  // Content loading

  /**
   * Load a URL
   */
  async loadURL(url: string): Promise<void> {
    native.loadUrl(this.id, url);
    this.maybeAutoOpenDevTools();
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

    native.loadFile(this.id, absolutePath);
    this.maybeAutoOpenDevTools();
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
    return this.state.isDestroyed();
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
  }

  /**
   * Set window size
   */
  setSize(width: number, height: number, animate = false): void {
    native.setWindowBounds(this.id, null, null, width, height);
  }

  /**
   * Set window position
   */
  setPosition(x: number, y: number, animate = false): void {
    native.setWindowBounds(this.id, x, y, null, null);
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
    this.state.setTitle(title);
    this.webContents.setTitle(title);
  }

  /**
   * Get window title
   */
  getTitle(): string {
    return this.state.getTitle();
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
    this.requestClose();
  }

  /**
   * Force close without events
   */
  destroy(): void {
    if (this.state.isDestroyed()) return;

    native.closeWindow(this.id);
    detachSessionFromWindow(this.id);
    windowManager.unregister(this.id);
    this.state.markDestroyed();
    this.emit('closed');
  }

  // IPC

  /**
   * Send message to renderer
   */
  send(channel: string, ...args: unknown[]): void {
    assertRuntimeCapability('mainToRendererPush', 'BrowserWindow.send()');
    const message = JSON.stringify({
      channel,
      args,
    });
    native.sendIpcMessage(this.id, message);
  }

  /** @internal */
  handleNativeEvent(event: NativeWindowEvent): void {
    applyNativeWindowEvent(
      {
        emit: (eventName, ...args) => this.emit(eventName, ...args),
        setWindowTitle: (title) => this.setWindowTitle(title),
        setWebContentsTitle: (title) => this.setWebContentsTitle(title),
        recordNavigation: (url) => this.webContents.recordNavigation(url),
        recordUnknownNavigation: () => this.webContents.recordUnknownNavigation(),
        recordHistoryBack: () => this.webContents.recordHistoryBack(),
        recordHistoryForward: () => this.webContents.recordHistoryForward(),
        getCurrentUrl: () => this.getCurrentUrl(),
        isDestroyed: () => this.state.isDestroyed(),
        requestClose: () => this.requestClose(),
        markClosed: () => this.markClosed(),
      },
      event
    );
  }

  private requestClose(): void {
    const event: BunletEvent = createCloseEvent();
    this.emit('close', event);

    if (!event.defaultPrevented) {
      this.destroy();
    }
  }

  private setWindowTitle(title: string): void {
    this.state.setTitle(title);
  }

  private setWebContentsTitle(title: string): void {
    this.webContents.setTitle(title);
  }

  private getCurrentUrl(): string {
    return this.webContents.getURL();
  }

  private markClosed(): void {
    detachSessionFromWindow(this.id);
    windowManager.unregister(this.id);
    this.state.markDestroyed();
    this.emit('closed');
  }
}

export { windowManager, windowRegistry };
