import type { Rectangle, BunletEvent } from '../types';

export interface NativeWindowEvent {
  event: string;
  windowId: number;
  title?: string;
  url?: string;
  bounds?: Rectangle;
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
      target.emit('resize');
      break;
    case 'window-move':
      target.emit('move');
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
