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

const mockNative = {
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
      x: 0,
      y: 0,
      width: 800,
      height: 600,
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
      x: 0,
      y: 0,
      width: 800,
      height: 600,
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
  isWindowVisible() {
    return true;
  },
  isWindowFocused(windowId: number) {
    return runtimeState.focusedWindowId === windowId;
  },
  isWindowMaximized() {
    return false;
  },
  isWindowMinimized() {
    return false;
  },
  isWindowFullscreen() {
    return false;
  },
  getFocusedWindowId() {
    return runtimeState.focusedWindowId;
  },
  sendIpcMessage() {},
  executeJavaScript: async () => '',
  openDevtools() {},
  closeDevtools() {},
  toggleDevtools() {},
  isDevtoolsOpen() {
    return false;
  },
  webviewReload() {},
  webviewStop() {},
  webviewGoBack() {},
  webviewGoForward() {},
  getCookies: async () => [],
  setCookie() {},
  removeCookie() {},
  clearStorageData() {},
  getUserAgent: async () => 'bunlet-test',
};

mock.module('./runtime', () => ({
  assertRuntimeCapability() {},
  native: mockNative,
}));

// Fallback: if another test file already loaded ./browser-window or ./app,
// those modules cached the real native object. Mutate the real object so
// already-cached modules still see our mocks.
const realNative = require('./runtime').native as Record<string, unknown>;
for (const [key, value] of Object.entries(mockNative)) {
  try {
    realNative[key] = value;
  } catch {
    // Some native properties may be non-writable; skip those.
  }
}

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

describe('app and BrowserWindow integration', () => {
  test('routes internal web contents events into BrowserWindow state', async () => {
    await app.whenReady();
    const win = new BrowserWindow({ title: 'Shell Title' });
    const seen: string[] = [];

    win.on('did-start-loading', () => seen.push('start'));
    win.on('did-finish-load', () => seen.push('finish'));
    win.on('did-navigate', (url) => seen.push(String(url)));
    win.on('page-title-updated', (title) => seen.push(`title:${String(title)}`));

    runtimeState.ipcHandler?.({
      windowId: win.id,
      message: JSON.stringify({
        type: '__bunlet_internal_window_event',
        event: 'web-contents-navigation',
        title: 'Docs',
        url: 'https://example.com/docs',
      }),
    });

    runtimeState.ipcHandler?.({
      windowId: win.id,
      message: JSON.stringify({
        type: '__bunlet_internal_window_event',
        event: 'web-contents-title-updated',
        title: 'Updated Docs',
        url: 'https://example.com/docs',
      }),
    });

    expect(win.getTitle()).toBe('Shell Title');
    expect(win.webContents.getTitle()).toBe('Updated Docs');
    expect(win.webContents.getURL()).toBe('https://example.com/docs');
    expect(seen).toEqual([
      'start',
      'finish',
      'https://example.com/docs',
      'title:Updated Docs',
    ]);
  });

  test('native close requests respect preventDefault', async () => {
    await app.whenReady();
    const win = new BrowserWindow({ title: 'Editor' });
    let closeEvents = 0;

    win.on('close', (event) => {
      closeEvents += 1;
      event.preventDefault();
    });

    runtimeState.appEventHandler?.({
      event: 'window-close-requested',
      windowId: win.id,
    });

    expect(closeEvents).toBe(1);
    expect(win.isDestroyed()).toBe(false);
    expect(runtimeState.closeWindowCalls).toEqual([]);
  });

  test('native close requests close windows when not prevented', async () => {
    await app.whenReady();
    const win = new BrowserWindow({ title: 'Editor' });
    let closedEvents = 0;

    win.on('closed', () => {
      closedEvents += 1;
    });

    runtimeState.appEventHandler?.({
      event: 'window-close-requested',
      windowId: win.id,
    });

    expect(runtimeState.closeWindowCalls).toEqual([win.id]);
    expect(win.isDestroyed()).toBe(true);
    expect(closedEvents).toBe(1);
  });
});
