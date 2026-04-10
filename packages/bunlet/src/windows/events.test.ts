import { describe, expect, test } from 'bun:test';
import {
  applyNativeWindowEvent,
  createCloseEvent,
  type NativeWindowEvent,
  type NativeWindowEventTarget,
} from './events';

function createTarget() {
  const emitted: Array<{ event: string; args: unknown[] }> = [];
  const target = {
    windowTitle: 'Window',
    pageTitle: 'Window',
    currentUrl: '',
    destroyed: false,
    closeRequests: 0,
    markClosedCalls: 0,
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
  } satisfies NativeWindowEventTarget & {
    windowTitle: string;
    pageTitle: string;
    currentUrl: string;
    destroyed: boolean;
    closeRequests: number;
    markClosedCalls: number;
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
});

describe('close event helper', () => {
  test('supports preventDefault semantics', () => {
    const event = createCloseEvent();

    expect(event.defaultPrevented).toBe(false);
    event.preventDefault();
    expect(event.defaultPrevented).toBe(true);
  });
});
