/**
 * Bunlet type definitions
 */

/**
 * Rectangle representing bounds
 */
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Web preferences for BrowserWindow
 */
export interface WebPreferences {
  /** Path to preload script */
  preload?: string;
  /** Session partition for this window's web contents */
  partition?: string;
  /** Explicit session object to associate with this window */
  session?: import('./session').Session;
  /** Enable DevTools (default: true) */
  devTools?: boolean;
  /** Enable context isolation (default: true) */
  contextIsolation?: boolean;
  /** Enable sandbox (default: true) */
  sandbox?: boolean;
  /** Enable web security (default: true) */
  webSecurity?: boolean;
}

/**
 * BrowserWindow constructor options
 */
export interface BrowserWindowOptions {
  /** Window width in pixels (default: 800) */
  width?: number;
  /** Window height in pixels (default: 600) */
  height?: number;
  /** Initial X position */
  x?: number;
  /** Initial Y position */
  y?: number;
  /** Center window on screen (default: true) */
  center?: boolean;
  /** Minimum width */
  minWidth?: number;
  /** Minimum height */
  minHeight?: number;
  /** Maximum width */
  maxWidth?: number;
  /** Maximum height */
  maxHeight?: number;
  /** Whether window is resizable (default: true) */
  resizable?: boolean;
  /** Whether window is movable (default: true) */
  movable?: boolean;
  /** Whether window can be minimized (default: true) */
  minimizable?: boolean;
  /** Whether window can be maximized (default: true) */
  maximizable?: boolean;
  /** Whether window can be closed (default: true) */
  closable?: boolean;
  /** Window title */
  title?: string;
  /** Show window immediately (default: true) */
  show?: boolean;
  /** Show window frame (default: true) */
  frame?: boolean;
  /** Enable transparency (default: false) */
  transparent?: boolean;
  /** Background color */
  backgroundColor?: string;
  /** Parent window for modal dialogs */
  parent?: import('./browser-window').BrowserWindow;
  /** Whether this is a modal window (default: false) */
  modal?: boolean;
  /** Keep window always on top (default: false) */
  alwaysOnTop?: boolean;
  /** Start in fullscreen (default: false) */
  fullscreen?: boolean;
  /** Allow fullscreen (default: true) */
  fullscreenable?: boolean;
  /** Skip showing in taskbar (default: false) */
  skipTaskbar?: boolean;
  /** Web preferences */
  webPreferences?: WebPreferences;
}

/**
 * App path names
 */
export type PathName =
  | 'home'
  | 'appData'
  | 'userData'
  | 'temp'
  | 'exe'
  | 'desktop'
  | 'documents'
  | 'downloads'
  | 'music'
  | 'pictures'
  | 'videos';

/**
 * IPC context passed to handlers
 */
export interface IPCContext {
  /** The window that sent the IPC message */
  window: import('./browser-window').BrowserWindow;
  /** Window ID */
  windowId: number;
}

/**
 * Event object
 */
export interface BunletEvent {
  /** Prevent default behavior */
  preventDefault(): void;
  /** Whether default was prevented */
  defaultPrevented: boolean;
}
