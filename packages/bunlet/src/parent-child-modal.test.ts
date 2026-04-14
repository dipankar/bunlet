import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { Rectangle } from './types';

type IpcCallback = (message: { windowId: number; message: string }) => void;
type AppEventCallback = (event: {
  event: string;
  windowId?: number;
  title?: string;
  url?: string;
  bounds?: Rectangle;
}) => void;

function createRuntimeState() {
  return {
    nextWindowId: 1,
    ipcHandler: null as IpcCallback | null,
    appEventHandler: null as AppEventCallback | null,
    closeWindowCalls: [] as number[],
    focusWindowCalls: [] as number[],
    loadUrlCalls: [] as Array<{ windowId: number; url: string }>,
    boundsByWindowId: new Map<number, Rectangle>(),
    focusedWindowId: null as number | null,
    parentIdByWindowId: new Map<number, number | null>(),
    modalByWindowId: new Map<number, boolean>(),
  };
}

const runtimeState = createRuntimeState();

mock.module('./runtime', () => ({
  assertRuntimeCapability() {},
  native: {
    initApp() {},
    quitApp() {},
    setIpcHandler(callback: IpcCallback) {
      runtimeState.ipcHandler = callback;
    },
    setAppEventHandler(callback: AppEventCallback) {
      runtimeState.appEventHandler = callback;
    },
    createWindow(opts: {
      parentId?: number;
      modal?: boolean;
      [key: string]: unknown;
    }) {
      const id = runtimeState.nextWindowId++;
      runtimeState.boundsByWindowId.set(id, { x: 0, y: 0, width: 800, height: 600 });
      runtimeState.parentIdByWindowId.set(id, opts?.parentId ?? null);
      runtimeState.modalByWindowId.set(id, opts?.modal ?? false);
      return id;
    },
    closeWindow(windowId: number) {
      runtimeState.closeWindowCalls.push(windowId);
      runtimeState.boundsByWindowId.delete(windowId);
      runtimeState.parentIdByWindowId.delete(windowId);
      runtimeState.modalByWindowId.delete(windowId);
    },
    loadUrl(windowId: number, url: string) {
      runtimeState.loadUrlCalls.push({ windowId, url });
    },
    loadFile() {},
    showWindow() {},
    hideWindow() {},
    focusWindow(windowId: number) {
      runtimeState.focusWindowCalls.push(windowId);
      runtimeState.focusedWindowId = windowId;
    },
    maximizeWindow() {},
    minimizeWindow() {},
    restoreWindow() {},
    setFullscreen() {},
    getWindowBounds(windowId: number) {
      return runtimeState.boundsByWindowId.get(windowId) ?? {
        x: 0, y: 0, width: 800, height: 600,
      };
    },
    setWindowBounds(
      windowId: number,
      x: number | null,
      y: number | null,
      width: number | null,
      height: number | null
    ) {
      const current = runtimeState.boundsByWindowId.get(windowId) ?? {
        x: 0, y: 0, width: 800, height: 600,
      };
      runtimeState.boundsByWindowId.set(windowId, {
        x: x ?? current.x,
        y: y ?? current.y,
        width: width ?? current.width,
        height: height ?? current.height,
      });
    },
    setWindowTitle() {},
    setWindowAlwaysOnTop() {},
    isWindowVisible() { return true; },
    isWindowFocused(windowId: number) {
      return runtimeState.focusedWindowId === windowId;
    },
    isWindowMaximized() { return false; },
    isWindowMinimized() { return false; },
    isWindowFullscreen() { return false; },
    getFocusedWindowId() { return runtimeState.focusedWindowId; },
    sendIpcMessage() {},
    executeJavaScript: async () => '',
    openDevtools() {},
    closeDevtools() {},
    toggleDevtools() {},
    isDevtoolsOpen() { return false; },
    webviewReload() {},
    webviewStop() {},
    webviewGoBack() {},
    webviewGoForward() {},
    getCookies: async () => [],
    setCookie() {},
    removeCookie() {},
    clearStorageData() {},
    getUserAgent: async () => 'bunlet-test',
  },
}));

const { app } = await import('./app');
const { BrowserWindow } = await import('./browser-window');

afterEach(() => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.destroy();
    }
  }
  app.removeAllListeners();
  runtimeState.closeWindowCalls.length = 0;
  runtimeState.focusWindowCalls.length = 0;
  runtimeState.loadUrlCalls.length = 0;
  runtimeState.boundsByWindowId.clear();
  runtimeState.focusedWindowId = null;
  runtimeState.nextWindowId = 1;
  runtimeState.parentIdByWindowId.clear();
  runtimeState.modalByWindowId.clear();
});

describe('parent/child window behavior', () => {
  test('creates a child window with a parent reference', async () => {
    await app.whenReady();
    const parent = new BrowserWindow({ title: 'Parent' });
    const child = new BrowserWindow({ title: 'Child', parent });

    expect(runtimeState.parentIdByWindowId.get(child.id)).toBe(parent.id);
    expect(child.isDestroyed()).toBe(false);
  });

  test('closing parent does not automatically destroy child in JS layer', async () => {
    await app.whenReady();
    const parent = new BrowserWindow({ title: 'Parent' });
    const child = new BrowserWindow({ title: 'Child', parent });

    parent.destroy();

    expect(parent.isDestroyed()).toBe(true);
    // Child window is still registered — the native layer handles
    // parent-child closing independently. The JS registry keeps it alive
    // until it receives its own close event or is explicitly destroyed.
    expect(child.isDestroyed()).toBe(false);
  });

  test('child can be destroyed independently of parent', async () => {
    await app.whenReady();
    const parent = new BrowserWindow({ title: 'Parent' });
    const child = new BrowserWindow({ title: 'Child', parent });

    child.destroy();

    expect(child.isDestroyed()).toBe(true);
    expect(parent.isDestroyed()).toBe(false);
  });

  test('child window gets a unique id distinct from parent', async () => {
    await app.whenReady();
    const parent = new BrowserWindow({ title: 'Parent' });
    const child = new BrowserWindow({ title: 'Child', parent });

    expect(parent.id).not.toBe(child.id);
    expect(typeof parent.id).toBe('number');
    expect(typeof child.id).toBe('number');
  });
});

describe('modal window behavior', () => {
  test('creates a modal window with a parent reference', async () => {
    await app.whenReady();
    const parent = new BrowserWindow({ title: 'Parent' });
    const modal = new BrowserWindow({ title: 'Modal', parent, modal: true });

    expect(runtimeState.modalByWindowId.get(modal.id)).toBe(true);
    expect(runtimeState.parentIdByWindowId.get(modal.id)).toBe(parent.id);
  });

  test('modal without parent still creates a window', async () => {
    await app.whenReady();
    // A modal without a parent is technically a free-floating window;
    // the framework should not crash.
    const modal = new BrowserWindow({ title: 'Modal', modal: true });

    expect(modal.isDestroyed()).toBe(false);
    expect(runtimeState.modalByWindowId.get(modal.id)).toBe(true);
  });

  test('modal window focus stays on modal while open', async () => {
    await app.whenReady();
    const parent = new BrowserWindow({ title: 'Parent' });
    const modal = new BrowserWindow({ title: 'Modal', parent, modal: true });

    // Focus the parent
    parent.focus();
    expect(runtimeState.focusedWindowId).toBe(parent.id);

    // Focus the modal — in a real native environment, the modal would
    // capture focus. Here we verify it can receive focus.
    modal.focus();
    expect(runtimeState.focusedWindowId).toBe(modal.id);
  });

  test('closing a modal window does not close the parent', async () => {
    await app.whenReady();
    const parent = new BrowserWindow({ title: 'Parent' });
    const modal = new BrowserWindow({ title: 'Modal', parent, modal: true });

    modal.destroy();

    expect(modal.isDestroyed()).toBe(true);
    expect(parent.isDestroyed()).toBe(false);
  });
});

describe('window hierarchy with multiple children', () => {
  test('a parent can have multiple child windows', async () => {
    await app.whenReady();
    const parent = new BrowserWindow({ title: 'Parent' });
    const child1 = new BrowserWindow({ title: 'Child 1', parent });
    const child2 = new BrowserWindow({ title: 'Child 2', parent });

    expect(runtimeState.parentIdByWindowId.get(child1.id)).toBe(parent.id);
    expect(runtimeState.parentIdByWindowId.get(child2.id)).toBe(parent.id);
    expect(child1.id).not.toBe(child2.id);
  });

  test('closing one child does not affect siblings', async () => {
    await app.whenReady();
    const parent = new BrowserWindow({ title: 'Parent' });
    const child1 = new BrowserWindow({ title: 'Child 1', parent });
    const child2 = new BrowserWindow({ title: 'Child 2', parent });

    child1.destroy();

    expect(child1.isDestroyed()).toBe(true);
    expect(child2.isDestroyed()).toBe(false);
    expect(parent.isDestroyed()).toBe(false);
  });
});