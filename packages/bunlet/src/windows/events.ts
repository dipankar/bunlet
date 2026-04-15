import type { Rectangle, BunletEvent } from '../types';

export interface NativeWindowEvent {
  event: string;
  windowId: number;
  title?: string;
  url?: string;
  bounds?: Rectangle;
  scaleFactor?: number;
  theme?: string;
  files?: string[];
  preloadPath?: string;
  errorMessage?: string;
  errorStack?: string;
}

export interface NativeWindowEventTarget {
  emit(event: string, ...args: unknown[]): void;
  setWindowTitle(title: string): void;
  setWebContentsTitle(title: string): void;
  recordNavigation(url: string): void;
  recordUnknownNavigation(): void;
  recordHistoryBack(): void;
  recordHistoryForward(): void;
  getCurrentUrl(): string;
  isDestroyed(): boolean;
  requestClose(): void;
  markClosed(): void;
  updateBounds(bounds: Rectangle): void;
}

export function applyNativeWindowEvent(
  target: NativeWindowEventTarget,
  event: NativeWindowEvent
): void {
  switch (event.event) {
    case 'window-focus':
      target.emit('focus');
      break;
    case 'window-blur':
      target.emit('blur');
      break;
    case 'window-resize':
      if (event.bounds) {
        target.updateBounds(event.bounds);
        target.emit('resize', event.bounds);
      } else {
        target.emit('resize');
      }
      break;
    case 'window-move':
      if (event.bounds) {
        target.updateBounds(event.bounds);
        target.emit('move', event.bounds);
      } else {
        target.emit('move');
      }
      break;
    case 'window-title-updated':
      if (typeof event.title === 'string') {
        target.setWindowTitle(event.title);
      }
      break;
    case 'web-contents-title-updated':
      if (typeof event.title === 'string') {
        target.setWebContentsTitle(event.title);
        target.emit('page-title-updated', event.title);
      }
      break;
    case 'web-contents-navigation':
      target.emit('did-start-loading');
      if (typeof event.title === 'string') {
        target.setWebContentsTitle(event.title);
      }
      if (typeof event.url === 'string') {
        target.recordNavigation(event.url);
      } else {
        target.recordUnknownNavigation();
      }
      target.emit('did-finish-load');
      target.emit('did-navigate', event.url ?? target.getCurrentUrl());
      break;
    case 'web-contents-history-back':
      target.recordHistoryBack();
      target.emit('did-navigate', target.getCurrentUrl());
      break;
    case 'web-contents-history-forward':
      target.recordHistoryForward();
      target.emit('did-navigate', target.getCurrentUrl());
      break;
    case 'window-close-requested':
      target.requestClose();
      break;
    case 'window-closed':
    case 'window-destroyed':
      if (!target.isDestroyed()) {
        target.markClosed();
      }
      break;
    case 'window-maximized':
      target.emit('maximize');
      break;
    case 'window-unmaximized':
      target.emit('unmaximize');
      break;
    case 'window-minimized':
      target.emit('minimize');
      break;
    case 'window-restored':
      target.emit('restore');
      break;
    case 'window-entered-fullscreen':
      target.emit('enter-full-screen');
      break;
    case 'window-left-fullscreen':
      target.emit('leave-full-screen');
      break;
    case 'window-scale-factor-changed':
      if (typeof event.scaleFactor === 'number') {
        target.emit('scale-factor-changed', event.scaleFactor);
      }
      break;
    case 'window-theme-changed':
      if (typeof event.theme === 'string') {
        target.emit('theme-changed', event.theme);
      }
      break;
    case 'window-file-drop':
      if (Array.isArray(event.files)) {
        target.emit('file-drop', event.files);
      }
      break;
    case 'window-file-hover':
      if (Array.isArray(event.files)) {
        target.emit('file-drag-enter', event.files);
      }
      break;
    case 'window-file-hover-cancelled':
      target.emit('file-drag-leave');
      break;
    case 'preload-success':
      target.emit('preload-success', event.preloadPath);
      break;
    case 'preload-error':
      target.emit('preload-error', {
        path: event.preloadPath,
        message: event.errorMessage ?? 'Unknown preload error',
        stack: event.errorStack,
      });
      break;
    default:
      break;
  }
}

export function createCloseEvent(): BunletEvent {
  return {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}
