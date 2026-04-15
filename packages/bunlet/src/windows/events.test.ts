import { describe, expect, test } from 'bun:test';
import {
  applyNativeWindowEvent,
  createCloseEvent,
  type NativeWindowEvent,
  type NativeWindowEventTarget,
} from './events';

function createTarget() {
  const emitted: Array<{ event: string; args: unknown[] }> = [];
  let bounds: import('../types').Rectangle | undefined;
  const target: NativeWindowEventTarget & {
    windowTitle: string;
    pageTitle: string;
    currentUrl: string;
    destroyed: boolean;
    closeRequests: number;
    markClosedCalls: number;
    getBounds(): import('../types').Rectangle | undefined;
  } = {
    windowTitle: 'Window',
    pageTitle: 'Window',
    currentUrl: '',
    destroyed: false,
    closeRequests: 0,
    markClosedCalls: 0,
    getBounds(): import('../types').Rectangle | undefined {
      return bounds;
    },
    emit(event: string, ...args: unknown[]) {
      emitted.push({ event, args });
    },
    setWindowTitle(title: string) {
      target.windowTitle = title;
    },
    setWebContentsTitle(title: string) {
      target.pageTitle = title;
    },
    recordNavigation(url: string) {
      target.currentUrl = url;
    },
    recordUnknownNavigation() {
      target.currentUrl = '';
    },
    recordHistoryBack() {
      target.currentUrl = 'https://example.com';
    },
    recordHistoryForward() {
      target.currentUrl = 'https://example.com/docs';
    },
    getCurrentUrl() {
      return target.currentUrl;
    },
    isDestroyed() {
      return target.destroyed;
    },
    requestClose() {
      target.closeRequests += 1;
    },
    markClosed() {
      target.destroyed = true;
      target.markClosedCalls += 1;
      target.emit('closed');
    },
    updateBounds(b: import('../types').Rectangle) {
      bounds = b;
    },
  } satisfies NativeWindowEventTarget & {
    windowTitle: string;
    pageTitle: string;
    currentUrl: string;
    destroyed: boolean;
    closeRequests: number;
    markClosedCalls: number;
    getBounds(): import('../types').Rectangle | undefined;
  };

  return { emitted, target };
}

describe('native window event handling', () => {
  test('keeps window title and page title separate', () => {
    const { target, emitted } = createTarget();

    applyNativeWindowEvent(target, {
      event: 'window-title-updated',
      windowId: 1,
      title: 'Shell Title',
    });
    applyNativeWindowEvent(target, {
      event: 'web-contents-title-updated',
      windowId: 1,
      title: 'Document Title',
    });

    expect(target.windowTitle).toBe('Shell Title');
    expect(target.pageTitle).toBe('Document Title');
    expect(emitted.at(-1)).toEqual({
      event: 'page-title-updated',
      args: ['Document Title'],
    });
  });

  test('emits navigation lifecycle from native web contents events', () => {
    const { target, emitted } = createTarget();
    const event: NativeWindowEvent = {
      event: 'web-contents-navigation',
      windowId: 1,
      title: 'Docs',
      url: 'https://example.com/docs',
    };

    applyNativeWindowEvent(target, event);

    expect(target.pageTitle).toBe('Docs');
    expect(target.currentUrl).toBe('https://example.com/docs');
    expect(emitted).toEqual([
      { event: 'did-start-loading', args: [] },
      { event: 'did-finish-load', args: [] },
      { event: 'did-navigate', args: ['https://example.com/docs'] },
    ]);
  });

  test('routes close requests through the shared close path', () => {
    const { target } = createTarget();

    applyNativeWindowEvent(target, {
      event: 'window-close-requested',
      windowId: 1,
    });

    expect(target.closeRequests).toBe(1);
    expect(target.destroyed).toBe(false);
  });

  test('marks windows closed only once after destruction', () => {
    const { target, emitted } = createTarget();

    applyNativeWindowEvent(target, {
      event: 'window-destroyed',
      windowId: 1,
    });
    applyNativeWindowEvent(target, {
      event: 'window-closed',
      windowId: 1,
    });

    expect(target.destroyed).toBe(true);
    expect(target.markClosedCalls).toBe(1);
    expect(emitted).toEqual([{ event: 'closed', args: [] }]);
  });

  test('emits scale-factor-changed event with factor', () => {
    const { target, emitted } = createTarget();

    applyNativeWindowEvent(target, {
      event: 'window-scale-factor-changed',
      windowId: 1,
      scaleFactor: 2.0,
    });

    expect(emitted).toEqual([
      { event: 'scale-factor-changed', args: [2.0] },
    ]);
  });

  test('emits theme-changed event with theme name', () => {
    const { target, emitted } = createTarget();

    applyNativeWindowEvent(target, {
      event: 'window-theme-changed',
      windowId: 1,
      theme: 'dark',
    });

    expect(emitted).toEqual([
      { event: 'theme-changed', args: ['dark'] },
    ]);
  });

  test('emits file-drop event with file paths', () => {
    const { target, emitted } = createTarget();

    applyNativeWindowEvent(target, {
      event: 'window-file-drop',
      windowId: 1,
      files: ['/path/to/file.txt', '/path/to/other.pdf'],
    });

    expect(emitted).toEqual([
      { event: 'file-drop', args: [['/path/to/file.txt', '/path/to/other.pdf']] },
    ]);
  });

  test('emits file-drag-enter event', () => {
    const { target, emitted } = createTarget();

    applyNativeWindowEvent(target, {
      event: 'window-file-hover',
      windowId: 1,
      files: ['/hover/file.txt'],
    });

    expect(emitted).toEqual([
      { event: 'file-drag-enter', args: [['/hover/file.txt']] },
    ]);
  });

  test('emits file-drag-leave event without file paths', () => {
    const { target, emitted } = createTarget();

    applyNativeWindowEvent(target, {
      event: 'window-file-hover-cancelled',
      windowId: 1,
    });

    expect(emitted).toEqual([
      { event: 'file-drag-leave', args: [] },
    ]);
  });

  test('emits preload-success event', () => {
    const { target, emitted } = createTarget();

    applyNativeWindowEvent(target, {
      event: 'preload-success',
      windowId: 1,
      preloadPath: '/app/preload.js',
    });

    expect(emitted).toEqual([
      { event: 'preload-success', args: ['/app/preload.js'] },
    ]);
  });

  test('emits preload-error event with message', () => {
    const { target, emitted } = createTarget();

    applyNativeWindowEvent(target, {
      event: 'preload-error',
      windowId: 1,
      preloadPath: '/app/preload.js',
      errorMessage: 'SyntaxError: Unexpected token',
    });

    expect(emitted).toEqual([
      {
        event: 'preload-error',
        args: [{ path: '/app/preload.js', message: 'SyntaxError: Unexpected token' }],
      },
    ]);
  });
});

describe('bounds propagation for resize/move events', () => {
  test('emits resize with bounds data', () => {
    const { target, emitted } = createTarget();
    const bounds = { x: 10, y: 20, width: 800, height: 600 };

    applyNativeWindowEvent(target, {
      event: 'window-resize',
      windowId: 1,
      bounds,
    });

    expect(target.getBounds()).toEqual(bounds);
    expect(emitted).toEqual([{ event: 'resize', args: [bounds] }]);
  });

  test('emits resize without bounds when native omits them', () => {
    const { target, emitted } = createTarget();

    applyNativeWindowEvent(target, {
      event: 'window-resize',
      windowId: 1,
    });

    expect(emitted).toEqual([{ event: 'resize', args: [] }]);
  });

  test('emits move with bounds data', () => {
    const { target, emitted } = createTarget();
    const bounds = { x: 50, y: 75, width: 1024, height: 768 };

    applyNativeWindowEvent(target, {
      event: 'window-move',
      windowId: 1,
      bounds,
    });

    expect(target.getBounds()).toEqual(bounds);
    expect(emitted).toEqual([{ event: 'move', args: [bounds] }]);
  });
});

describe('window state change events', () => {
  test('emits maximize event', () => {
    const { target, emitted } = createTarget();

    applyNativeWindowEvent(target, {
      event: 'window-maximized',
      windowId: 1,
    });

    expect(emitted).toEqual([{ event: 'maximize', args: [] }]);
  });

  test('emits unmaximize event', () => {
    const { target, emitted } = createTarget();

    applyNativeWindowEvent(target, {
      event: 'window-unmaximized',
      windowId: 1,
    });

    expect(emitted).toEqual([{ event: 'unmaximize', args: [] }]);
  });

  test('emits minimize event', () => {
    const { target, emitted } = createTarget();

    applyNativeWindowEvent(target, {
      event: 'window-minimized',
      windowId: 1,
    });

    expect(emitted).toEqual([{ event: 'minimize', args: [] }]);
  });

  test('emits restore event', () => {
    const { target, emitted } = createTarget();

    applyNativeWindowEvent(target, {
      event: 'window-restored',
      windowId: 1,
    });

    expect(emitted).toEqual([{ event: 'restore', args: [] }]);
  });

  test('emits enter-full-screen event', () => {
    const { target, emitted } = createTarget();

    applyNativeWindowEvent(target, {
      event: 'window-entered-fullscreen',
      windowId: 1,
    });

    expect(emitted).toEqual([{ event: 'enter-full-screen', args: [] }]);
  });

  test('emits leave-full-screen event', () => {
    const { target, emitted } = createTarget();

    applyNativeWindowEvent(target, {
      event: 'window-left-fullscreen',
      windowId: 1,
    });

    expect(emitted).toEqual([{ event: 'leave-full-screen', args: [] }]);
  });
});

describe('close event helper', () => {
  test('supports preventDefault semantics', () => {
    const event = createCloseEvent();

    expect(event.defaultPrevented).toBe(false);
    event.preventDefault();
    expect(event.defaultPrevented).toBe(true);
  });
});
