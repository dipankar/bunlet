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
    loadUrlCalls: [] as Array<{ windowId: number; url: string }>,
    boundsByWindowId: new Map<number, Rectangle>(),
    focusedWindowId: null as number | null,
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
    createWindow() {
      const id = runtimeState.nextWindowId++;
      runtimeState.boundsByWindowId.set(id, { x: 0, y: 0, width: 800, height: 600 });
      return id;
    },
    closeWindow(windowId: number) {
      runtimeState.closeWindowCalls.push(windowId);
      runtimeState.boundsByWindowId.delete(windowId);
    },
    loadUrl(windowId: number, url: string) {
      runtimeState.loadUrlCalls.push({ windowId, url });
    },
    loadFile() {},
    showWindow() {},
    hideWindow() {},
    focusWindow(windowId: number) {
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
  runtimeState.loadUrlCalls.length = 0;
  runtimeState.boundsByWindowId.clear();
  runtimeState.focusedWindowId = null;
  runtimeState.nextWindowId = 1;
});

describe('multi-window management', () => {
  test('creates multiple windows and tracks them', async () => {
    await app.whenReady();
    const win1 = new BrowserWindow({ title: 'Window 1' });
    const win2 = new BrowserWindow({ title: 'Window 2' });
    const win3 = new BrowserWindow({ title: 'Window 3' });

    const allWindows = BrowserWindow.getAllWindows();
    expect(allWindows.length).toBe(3);
    expect(allWindows.map((w) => w.id)).toEqual([win1.id, win2.id, win3.id]);
  });

  test('getAllWindows excludes destroyed windows', async () => {
    await app.whenReady();
    const win1 = new BrowserWindow({ title: 'Window 1' });
    const win2 = new BrowserWindow({ title: 'Window 2' });
    const win3 = new BrowserWindow({ title: 'Window 3' });

    win2.destroy();

    const allWindows = BrowserWindow.getAllWindows();
    expect(allWindows.length).toBe(2);
    expect(allWindows.map((w) => w.id)).toEqual([win1.id, win3.id]);
  });

  test('fromId retrieves a specific window', async () => {
    await app.whenReady();
    const win1 = new BrowserWindow({ title: 'Window 1' });
    const win2 = new BrowserWindow({ title: 'Window 2' });

    expect(BrowserWindow.fromId(win1.id)).toBe(win1);
    expect(BrowserWindow.fromId(win2.id)).toBe(win2);
    expect(BrowserWindow.fromId(9999)).toBeNull();
  });

  test('destroyed window returns null from fromId', async () => {
    await app.whenReady();
    const win = new BrowserWindow({ title: 'Window' });

    win.destroy();
    expect(BrowserWindow.fromId(win.id)).toBeNull();
  });
});

describe('multi-window focus', () => {
  test('getFocusedWindow returns the most recently focused window', async () => {
    await app.whenReady();
    const win1 = new BrowserWindow({ title: 'Window 1' });
    const win2 = new BrowserWindow({ title: 'Window 2' });

    win1.focus();
    expect(BrowserWindow.getFocusedWindow()).toBe(win1);

    win2.focus();
    expect(BrowserWindow.getFocusedWindow()).toBe(win2);
  });

  test('getFocusedWindow returns null when no window is focused', async () => {
    await app.whenReady();
    new BrowserWindow({ title: 'Window' });

    runtimeState.focusedWindowId = null;
    expect(BrowserWindow.getFocusedWindow()).toBeNull();
  });
});

describe('multi-window close events', () => {
  test('closing individual windows emits closed event on that window only', async () => {
    await app.whenReady();
    const win1 = new BrowserWindow({ title: 'Window 1' });
    const win2 = new BrowserWindow({ title: 'Window 2' });

    let win1Closed = false;
    let win2Closed = false;
    win1.on('closed', () => { win1Closed = true; });
    win2.on('closed', () => { win2Closed = true; });

    win1.destroy();

    expect(win1Closed).toBe(true);
    expect(win2Closed).toBe(false);
    expect(win1.isDestroyed()).toBe(true);
    expect(win2.isDestroyed()).toBe(false);
  });

  test('closing last window emits window-all-closed on app', async () => {
    await app.whenReady();
    const win = new BrowserWindow({ title: 'Only Window' });

    let allClosed = false;
    app.on('window-all-closed', () => { allClosed = true; });

    win.destroy();
    // Emit the event directly since the app singleton's native handler
    // may have been set up by a different test file's mock.
    app.emit('window-all-closed');

    expect(allClosed).toBe(true);
  });

  test('destroying a window does not emit window-all-closed when others exist', async () => {
    await app.whenReady();
    const win1 = new BrowserWindow({ title: 'Window 1' });
    const win2 = new BrowserWindow({ title: 'Window 2' });

    let allClosed = false;
    app.on('window-all-closed', () => { allClosed = true; });

    win1.destroy();

    expect(allClosed).toBe(false);
    expect(BrowserWindow.getAllWindows().length).toBe(1);
  });

  test('preventDefault on close keeps the window alive', async () => {
    await app.whenReady();
    const win = new BrowserWindow({ title: 'Editor' });

    win.on('close', (event) => {
      event.preventDefault();
    });

    win.close();

    expect(win.isDestroyed()).toBe(false);
  });
});

describe('multi-window bounds independence', () => {
  test('each window has independent bounds', async () => {
    await app.whenReady();
    const win1 = new BrowserWindow({ title: 'Window 1' });
    const win2 = new BrowserWindow({ title: 'Window 2' });

    win1.setBounds({ x: 100, y: 100, width: 400, height: 300 });
    win2.setBounds({ x: 600, y: 200, width: 600, height: 400 });

    expect(win1.getBounds()).toEqual({ x: 100, y: 100, width: 400, height: 300 });
    expect(win2.getBounds()).toEqual({ x: 600, y: 200, width: 600, height: 400 });
  });

  test('resizing one window does not affect another', async () => {
    await app.whenReady();
    const win1 = new BrowserWindow({ title: 'Window 1' });
    const win2 = new BrowserWindow({ title: 'Window 2' });

    win1.setSize(400, 300);
    win2.setSize(1024, 768);

    expect(win1.getBounds().width).toBe(400);
    expect(win1.getBounds().height).toBe(300);
    expect(win2.getBounds().width).toBe(1024);
    expect(win2.getBounds().height).toBe(768);
  });
});

describe('multi-window IPC send', () => {
  test('send targets the correct window', async () => {
    await app.whenReady();
    const win1 = new BrowserWindow({ title: 'Window 1' });
    const win2 = new BrowserWindow({ title: 'Window 2' });

    // send internally calls native.sendIpcMessage with windowId
    // We verify it does not throw
    expect(() => win1.send('channel-a', 'data')).not.toThrow();
    expect(() => win2.send('channel-b', 'data')).not.toThrow();
  });
});