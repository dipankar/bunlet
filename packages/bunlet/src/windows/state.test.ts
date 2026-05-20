import { describe, expect, test } from 'bun:test';
import { BrowserWindowState, WebContentsState } from './state';
import { applyNativeWindowEvent, type NativeWindowEventTarget } from './events';

describe('window state separation', () => {
  test('tracks browser window lifecycle state independently', () => {
    const state = new BrowserWindowState('Editor');

    expect(state.getTitle()).toBe('Editor');
    expect(state.isDestroyed()).toBe(false);

    state.setTitle('Notes');
    state.markDestroyed();

    expect(state.getTitle()).toBe('Notes');
    expect(state.isDestroyed()).toBe(true);
  });

  test('tracks web contents navigation history independently', () => {
    const state = new WebContentsState('Editor');

    state.recordNavigation('https://example.com');
    state.recordNavigation('https://example.com/docs');

    expect(state.getURL()).toBe('https://example.com/docs');
    expect(state.canGoBack()).toBe(true);
    expect(state.canGoForward()).toBe(false);

    state.recordGoBack();

    expect(state.getURL()).toBe('https://example.com');
    expect(state.canGoBack()).toBe(false);
    expect(state.canGoForward()).toBe(true);
  });

  test('uses empty URL for navigation targets that are not yet observable', () => {
    const state = new WebContentsState('Editor');

    state.recordNavigation('https://example.com');
    state.recordUnknownNavigation();

    expect(state.getURL()).toBe('');
    expect(state.canGoBack()).toBe(true);
  });
});

describe('BrowserWindowState — native event sync', () => {
  function stateTarget(state: BrowserWindowState): NativeWindowEventTarget {
    return {
      emit() {},
      setWindowTitle() {},
      setWebContentsTitle() {},
      recordNavigation() {},
      recordUnknownNavigation() {},
      recordHistoryBack() {},
      recordHistoryForward() {},
      getCurrentUrl: () => '',
      isDestroyed: () => state.isDestroyed(),
      requestClose() {},
      markClosed() {},
      updateBounds: (b) => state.updateBounds(b),
      setFocused: (v) => state.setFocused(v),
      setMinimized: (v) => state.setMinimized(v),
      setMaximized: (v) => state.setMaximized(v),
      setFullscreen: (v) => state.setFullscreen(v),
      setVisible: (v) => state.setVisible(v),
    };
  }

  test('window-move updates cached bounds', () => {
    const state = new BrowserWindowState('w');
    expect(state.getBounds()).toBeUndefined();

    applyNativeWindowEvent(stateTarget(state), {
      event: 'window-move',
      windowId: 1,
      bounds: { x: 100, y: 200, width: 800, height: 600 },
    });

    expect(state.getBounds()).toEqual({ x: 100, y: 200, width: 800, height: 600 });
  });

  test('focus / blur toggle focused state', () => {
    const state = new BrowserWindowState('w');
    expect(state.isFocused()).toBe(false);

    applyNativeWindowEvent(stateTarget(state), { event: 'window-focus', windowId: 1 });
    expect(state.isFocused()).toBe(true);

    applyNativeWindowEvent(stateTarget(state), { event: 'window-blur', windowId: 1 });
    expect(state.isFocused()).toBe(false);
  });

  test('minimize / restore toggle minimized state and clear maximized on restore', () => {
    const state = new BrowserWindowState('w');
    state.setMaximized(true);

    applyNativeWindowEvent(stateTarget(state), { event: 'window-minimized', windowId: 1 });
    expect(state.isMinimized()).toBe(true);

    applyNativeWindowEvent(stateTarget(state), { event: 'window-restored', windowId: 1 });
    expect(state.isMinimized()).toBe(false);
    expect(state.isMaximized()).toBe(false);
  });

  test('maximize event sets maximized and clears minimized', () => {
    const state = new BrowserWindowState('w');
    state.setMinimized(true);

    applyNativeWindowEvent(stateTarget(state), { event: 'window-maximized', windowId: 1 });
    expect(state.isMaximized()).toBe(true);
    expect(state.isMinimized()).toBe(false);

    applyNativeWindowEvent(stateTarget(state), { event: 'window-unmaximized', windowId: 1 });
    expect(state.isMaximized()).toBe(false);
  });

  test('fullscreen enter / leave toggles fullscreen state', () => {
    const state = new BrowserWindowState('w');
    applyNativeWindowEvent(stateTarget(state), { event: 'window-entered-fullscreen', windowId: 1 });
    expect(state.isFullscreen()).toBe(true);
    applyNativeWindowEvent(stateTarget(state), { event: 'window-left-fullscreen', windowId: 1 });
    expect(state.isFullscreen()).toBe(false);
  });

  test('show / hide toggle visible state', () => {
    const state = new BrowserWindowState('w');
    state.setVisible(false);
    applyNativeWindowEvent(stateTarget(state), { event: 'window-shown', windowId: 1 });
    expect(state.isVisible()).toBe(true);
    applyNativeWindowEvent(stateTarget(state), { event: 'window-hidden', windowId: 1 });
    expect(state.isVisible()).toBe(false);
  });
});
