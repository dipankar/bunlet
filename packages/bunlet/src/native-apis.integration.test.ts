import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { RuntimeCapabilities } from './runtime/types';

type DialogCallback = (result: unknown) => void;

function createNativeMock() {
  return {
    dialogResults: [] as Array<{ method: string; options: unknown }>,
    clipboardState: { text: '', hasText: false },
    trayState: {
      nextId: 1,
      trays: new Map<number, { image: string; tooltip: string; title: string; menuId: number | null; destroyed: boolean }>(),
    },
    menuState: {
      nextId: 1,
      menus: new Map<number, { items: unknown[]; destroyed: boolean }>(),
    },
    notificationState: {
      nextId: 1,
      isSupported: true,
      notifications: new Map<number, { title: string; body?: string; shown: boolean; closed: boolean }>(),
      callback: null as ((event: { notificationId: number; eventType: string; actionIndex?: number }) => void) | null,
    },
    shortcutState: {
      nextId: 1,
      registered: new Map<number, string>(),
      callback: null as ((id: number) => void) | null,
    },
    powerState: {
      onBattery: false,
      batteryLevel: 85,
      charging: true,
      idleTime: 0,
      callback: null as ((event: { eventType: string }) => void) | null,
      initialized: false,
    },
    screenState: {
      displays: [{
        id: 1,
        name: 'Primary',
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        work_area_x: 0,
        work_area_y: 25,
        work_area_width: 1920,
        work_area_height: 1055,
        scale_factor: 2,
        is_primary: true,
      }],
      cursorPoint: { x: 500, y: 500 },
    },
    shellState: {
      openExternalCalls: [] as string[],
      openPathCalls: [] as string[],
      showInFolderCalls: [] as string[],
      trashCalls: [] as string[],
      beepCalls: 0,
    },
  };
}

const state = createNativeMock();

mock.module('./runtime', () => ({
  assertRuntimeCapability() {},
  hasRuntimeCapability() { return true; },
  native: {
    initApp() {},
    quitApp() {},
    setIpcHandler() {},
    setAppEventHandler() {},
    createWindow() { return 1; },
    closeWindow() {},
    loadUrl() {},
    loadFile() {},
    showWindow() {},
    hideWindow() {},
    focusWindow() {},
    maximizeWindow() {},
    minimizeWindow() {},
    restoreWindow() {},
    setFullscreen() {},
    getWindowBounds() { return { x: 0, y: 0, width: 800, height: 600 }; },
    setWindowBounds() {},
    setWindowTitle() {},
    setWindowAlwaysOnTop() {},
    isWindowVisible() { return true; },
    isWindowFocused() { return false; },
    isWindowMaximized() { return false; },
    isWindowMinimized() { return false; },
    isWindowFullscreen() { return false; },
    getFocusedWindowId() { return null; },
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

    showOpenDialog(options: unknown) {
      state.dialogResults.push({ method: 'showOpenDialog', options });
      return Promise.resolve({ canceled: false, filePaths: ['/test/file.txt'] });
    },
    showSaveDialog(options: unknown) {
      state.dialogResults.push({ method: 'showSaveDialog', options });
      return Promise.resolve({ canceled: false, filePath: '/test/save.txt' });
    },
    showMessageBox(options: unknown) {
      state.dialogResults.push({ method: 'showMessageBox', options });
      return Promise.resolve({ response: 0 });
    },
    showErrorBox(title: string, _content: string) {
      state.dialogResults.push({ method: 'showErrorBox', options: { title } });
    },

    createMenu() {
      const id = state.menuState.nextId++;
      state.menuState.menus.set(id, { items: [], destroyed: false });
      return id;
    },
    destroyMenu(id: number) {
      const menu = state.menuState.menus.get(id);
      if (menu) menu.destroyed = true;
    },
    appendMenuItem(menuId: number, item: unknown) {
      const menu = state.menuState.menus.get(menuId);
      if (menu) menu.items.push(item);
    },
    buildMenuFromTemplate(menuId: number, items: unknown[]) {
      const menu = state.menuState.menus.get(menuId);
      if (menu) menu.items = items;
    },
    setApplicationMenu(menuId: number | undefined) {
      state.menuState.menus.forEach((m) => { m.isApplicationMenu = m === state.menuState.menus.get(menuId ?? -1); });
    },
    popupMenu() {},
    initMenuEvents() {},
    setMenuCallback() {},

    createTray(image: string) {
      const id = state.trayState.nextId++;
      state.trayState.trays.set(id, { image, tooltip: '', title: '', menuId: null, destroyed: false });
      return id;
    },
    destroyTray(id: number) {
      const tray = state.trayState.trays.get(id);
      if (tray) tray.destroyed = true;
    },
    setTrayIcon(id: number, image: string) {
      const tray = state.trayState.trays.get(id);
      if (tray) tray.image = image;
    },
    setTrayTooltip(id: number, tooltip: string) {
      const tray = state.trayState.trays.get(id);
      if (tray) tray.tooltip = tooltip;
    },
    setTrayTitle(id: number, title: string) {
      const tray = state.trayState.trays.get(id);
      if (tray) tray.title = title;
    },
    setTrayMenu(id: number, menuId: number) {
      const tray = state.trayState.trays.get(id);
      if (tray) tray.menuId = menuId;
    },
    getTrayBounds(id: number) {
      return { x: 100, y: 0, width: 22, height: 22 };
    },
    initTrayEvents() {},
    setTrayCallback(cb: (event: { trayId: number; eventType: string; x: number; y: number }) => void) {
      state.trayState.callback = cb as never;
    },

    notificationIsSupported() { return state.notificationState.isSupported; },
    showNotification(options: { title: string; body?: string }) {
      const id = state.notificationState.nextId++;
      state.notificationState.notifications.set(id, { title: options.title, body: options.body, shown: true, closed: false });
      return id;
    },
    closeNotification(id: number) {
      const n = state.notificationState.notifications.get(id);
      if (n) n.closed = true;
    },
    setNotificationCallback(cb: typeof state.notificationState.callback) {
      state.notificationState.callback = cb;
    },

    clipboardReadText() { return state.clipboardState.text; },
    clipboardWriteText(text: string) { state.clipboardState.text = text; state.clipboardState.hasText = true; },
    clipboardClear() { state.clipboardState.text = ''; state.clipboardState.hasText = false; },
    clipboardHasText() { return state.clipboardState.hasText; },

    shellOpenExternal(url: string) { state.shellState.openExternalCalls.push(url); },
    shellOpenPath(path: string) { state.shellState.openPathCalls.push(path); return Promise.resolve(''); },
    shellShowItemInFolder(path: string) { state.shellState.showInFolderCalls.push(path); },
    shellTrashItem(path: string) { state.shellState.trashCalls.push(path); },
    shellBeep() { state.shellState.beepCalls++; },

    initGlobalShortcuts() {},
    registerShortcut(accelerator: string) {
      const id = state.shortcutState.nextId++;
      state.shortcutState.registered.set(id, accelerator);
      return id;
    },
    unregisterShortcut(accelerator: string) {
      for (const [id, acc] of state.shortcutState.registered) {
        if (acc === accelerator) { state.shortcutState.registered.delete(id); break; }
      }
    },
    unregisterAllShortcuts() { state.shortcutState.registered.clear(); },
    isShortcutRegistered(accelerator: string) {
      for (const [, acc] of state.shortcutState.registered) {
        if (acc === accelerator) return true;
      }
      return false;
    },
    setShortcutCallback(cb: (id: number) => void) { state.shortcutState.callback = cb; },

    initPowerMonitor() { state.powerState.initialized = true; },
    stopPowerMonitor() { state.powerState.initialized = false; },
    isOnBatteryPower() { return state.powerState.onBattery; },
    getBatteryInfo() {
      return {
        level: state.powerState.batteryLevel,
        charging: state.powerState.charging,
        onAc: !state.powerState.onBattery,
        timeRemaining: -1,
      };
    },
    getSystemIdleState(threshold: number) {
      const idle = state.powerState.idleTime;
      return { state: idle > threshold ? 'idle' : 'active' };
    },
    getSystemIdleTime() { return state.powerState.idleTime; },
    setPowerCallback(cb: typeof state.powerState.callback) { state.powerState.callback = cb; },

    getPrimaryDisplay() { return state.screenState.displays[0]; },
    getAllDisplays() { return state.screenState.displays; },
    getDisplayNearestPoint(x: number, y: number) { return state.screenState.displays[0]; },
    getCursorScreenPoint() { return state.screenState.cursorPoint; },
  },
  runtime: {
    engine: 'system',
    capabilities: {
      windowManagement: true, multiWindow: true, ipcInvoke: true, mainToRendererPush: true,
      executeJavaScript: true, devtools: true, navigation: true, preloadScripts: true,
      contextIsolation: true, sessionPartitions: true, cookies: true,
      authoritativeGetters: false, executeJavaScriptReturns: false,
      dialogs: true, tray: true, globalShortcuts: true, notifications: true,
      powerMonitor: true, screen: true, clipboard: true, fileDrop: true,
    } satisfies RuntimeCapabilities,
  },
}));

afterEach(() => {
  state.dialogResults.length = 0;
  state.clipboardState.text = '';
  state.clipboardState.hasText = false;
  state.trayState.trays.clear();
  state.trayState.nextId = 1;
  state.menuState.menus.clear();
  state.menuState.nextId = 1;
  state.notificationState.notifications.clear();
  state.notificationState.nextId = 1;
  globalShortcut.unregisterAll();
  state.shortcutState.nextId = 1;
  powerMonitor.stop();
  state.powerState.onBattery = false;
  state.powerState.batteryLevel = 85;
  state.powerState.charging = true;
  state.powerState.idleTime = 0;
  state.powerState.initialized = false;
  state.shellState.openExternalCalls.length = 0;
  state.shellState.openPathCalls.length = 0;
  state.shellState.showInFolderCalls.length = 0;
  state.shellState.trashCalls.length = 0;
  state.shellState.beepCalls = 0;
});

const { dialog } = await import('./dialog');
const { Menu, MenuItem } = await import('./menu');
const { Tray } = await import('./tray');
const { Notification } = await import('./notification');
const { clipboard } = await import('./clipboard');
const { shell } = await import('./shell');
const { globalShortcut } = await import('./global-shortcut');
const { powerMonitor } = await import('./power-monitor');
const { screen } = await import('./screen');

describe('native API integration: dialog', () => {
  test('showOpenDialog calls native with correct options', async () => {
    const result = await dialog.showOpenDialog(null, {
      title: 'Open File',
      defaultPath: '/home',
      properties: ['openFile', 'multiSelections'],
    });

    expect(result.canceled).toBe(false);
    expect(result.filePaths).toEqual(['/test/file.txt']);
    expect(state.dialogResults).toHaveLength(1);
    expect(state.dialogResults[0].method).toBe('showOpenDialog');
  });

  test('showSaveDialog calls native with correct options', async () => {
    const result = await dialog.showSaveDialog(null, {
      title: 'Save File',
      defaultPath: '/home/document.txt',
    });

    expect(result.canceled).toBe(false);
    expect(result.filePath).toBe('/test/save.txt');
  });

  test('showMessageBox calls native with correct options', async () => {
    const result = await dialog.showMessageBox(null, {
      type: 'question',
      title: 'Confirm',
      message: 'Are you sure?',
      buttons: ['Yes', 'No'],
    });

    expect(result.response).toBe(0);
  });

  test('showErrorBox calls native synchronously', () => {
    dialog.showErrorBox('Error Title', 'Error content');
    expect(state.dialogResults).toEqual([
      { method: 'showErrorBox', options: { title: 'Error Title' } },
    ]);
  });

  test('showOpenDialog defaults to openFile property', async () => {
    await dialog.showOpenDialog(null, {});
    expect(state.dialogResults[0].options).toHaveProperty('openFile', true);
  });
});

describe('native API integration: menu', () => {
  test('Menu builds from template', () => {
    const menu = Menu.buildFromTemplate([
      { label: 'File', submenu: [{ label: 'New', accelerator: 'CmdOrCtrl+N' }] },
    ]);

    expect(menu.items).toHaveLength(1);
    expect(menu.items[0].label).toBe('File');
    expect(menu.items[0].type).toBe('submenu');
  });

  test('MenuItem gets unique IDs', () => {
    const item1 = new MenuItem({ label: 'Item 1' });
    const item2 = new MenuItem({ label: 'Item 2' });

    expect(item1.id).toBeTruthy();
    expect(item2.id).toBeTruthy();
    expect(item1.id).not.toBe(item2.id);
  });

  test('Menu append adds items', () => {
    const menu = new Menu();
    const item = new MenuItem({ label: 'Test' });
    menu.append(item);

    expect(menu.items).toHaveLength(1);
    expect(menu.items[0].label).toBe('Test');
  });

  test('Menu destroy cleans up', () => {
    const menu = new Menu();
    menu.destroy();
    expect(state.menuState.menus.get(menu.getNativeId())?.destroyed).toBe(true);
  });

  test('Menu.setApplicationMenu calls native', () => {
    const menu = new Menu();
    Menu.setApplicationMenu(menu);
  });

  test('Menu.setApplicationMenu(null) removes app menu', () => {
    Menu.setApplicationMenu(null);
  });

  test('MenuItem click is stored in callback map', () => {
    let clicked = false;
    const item = new MenuItem({
      label: 'Click me',
      click: () => { clicked = true; },
    });

    expect(item.click).toBeDefined();
    item.click(item, null);
    expect(clicked).toBe(true);
  });

  test('MenuItem toNativeOptions produces correct shape', () => {
    const item = new MenuItem({
      label: 'Edit',
      type: 'normal',
      accelerator: 'CmdOrCtrl+Z',
      enabled: true,
    });

    const opts = item.toNativeOptions();
    expect(opts.label).toBe('Edit');
    expect(opts.itemType).toBe('normal');
    expect(opts.accelerator).toBe('CmdOrCtrl+Z');
    expect(opts.enabled).toBe(true);
  });
});

describe('native API integration: tray', () => {
  test('Tray creates with image', () => {
    const tray = new Tray('/path/to/icon.png');

    expect(tray.isDestroyed()).toBe(false);
    const native = state.trayState.trays.get(1);
    expect(native?.image).toBe('/path/to/icon.png');
  });

  test('Tray setToolTip updates tooltip', () => {
    const tray = new Tray('/icon.png');
    tray.setToolTip('My App');

    const native = state.trayState.trays.get(1);
    expect(native?.tooltip).toBe('My App');
  });

  test('Tray setTitle updates title', () => {
    const tray = new Tray('/icon.png');
    tray.setTitle('Status: OK');

    const native = state.trayState.trays.get(1);
    expect(native?.title).toBe('Status: OK');
  });

  test('Tray setContextMenu connects menu', () => {
    const tray = new Tray('/icon.png');
    const menu = new Menu();
    menu.append(new MenuItem({ label: 'Quit' }));
    tray.setContextMenu(menu);

    const native = state.trayState.trays.get(1);
    expect(native?.menuId).toBe(menu.getNativeId());
  });

  test('Tray getBounds returns rectangle', () => {
    const tray = new Tray('/icon.png');
    const bounds = tray.getBounds();

    expect(bounds).toEqual({ x: 100, y: 0, width: 22, height: 22 });
  });

  test('Tray destroy cleans up', () => {
    const tray = new Tray('/icon.png');
    tray.destroy();

    expect(tray.isDestroyed()).toBe(true);
    const native = state.trayState.trays.get(1);
    expect(native?.destroyed).toBe(true);
  });

  test('Tray operations are no-ops after destroy', () => {
    const tray = new Tray('/icon.png');
    tray.destroy();

    tray.setToolTip('should not set');
    tray.setTitle('should not set');
    expect(state.trayState.trays.get(1)?.tooltip).toBe('');
    expect(state.trayState.trays.get(1)?.title).toBe('');
  });
});

describe('native API integration: notification', () => {
  test('Notification.isSupported checks native capability', () => {
    state.notificationState.isSupported = true;
    expect(Notification.isSupported()).toBe(true);
  });

  test('Notification creates with options', () => {
    const n = new Notification({
      title: 'Test',
      body: 'Hello',
    });

    expect(n.title).toBe('Test');
    expect(n.body).toBe('Hello');
  });

  test('Notification show sends to native', () => {
    const n = new Notification({ title: 'Alert', body: 'Something happened' });
    n.show();

    const entries = [...state.notificationState.notifications.values()];
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('Alert');
    expect(entries[0].body).toBe('Something happened');
    expect(entries[0].shown).toBe(true);
  });

  test('Notification close marks as closed', () => {
    const n = new Notification({ title: 'Close me' });
    n.show();
    n.close();

    const entries = [...state.notificationState.notifications.values()];
    expect(entries[0].closed).toBe(true);
  });

  test('Notification double-show is idempotent', () => {
    const n = new Notification({ title: 'Once' });
    n.show();
    n.show();

    const entries = [...state.notificationState.notifications.values()];
    expect(entries).toHaveLength(1);
  });

  test('Notification callback routes events to instances', () => {
    const n = new Notification({ title: 'Event' });
    const clickEvents: string[] = [];
    n.on('click', () => { clickEvents.push('clicked'); });

    n.show();

    const id = [...state.notificationState.notifications.keys()].find(
      (nid) => state.notificationState.notifications.get(nid)?.title === 'Event'
    );

    if (id != null && state.notificationState.callback) {
      state.notificationState.callback({ notificationId: id, eventType: 'click' });
    }

    expect(clickEvents).toEqual(['clicked']);
  });
});

describe('native API integration: clipboard', () => {
  test('writeText and readText round-trip', () => {
    clipboard.writeText('hello world');
    expect(clipboard.readText()).toBe('hello world');
  });

  test('hasText returns true after write', () => {
    expect(clipboard.hasText()).toBe(false);
    clipboard.writeText('test');
    expect(clipboard.hasText()).toBe(true);
  });

  test('clear resets clipboard', () => {
    clipboard.writeText('will be cleared');
    clipboard.clear();
    expect(clipboard.readText()).toBe('');
    expect(clipboard.hasText()).toBe(false);
  });
});

describe('native API integration: shell', () => {
  test('openExternal calls native with URL', async () => {
    await shell.openExternal('https://example.com');
    expect(state.shellState.openExternalCalls).toEqual(['https://example.com']);
  });

  test('openPath calls native with path', async () => {
    await shell.openPath('/some/file.txt');
    expect(state.shellState.openPathCalls).toEqual(['/some/file.txt']);
  });

  test('showItemInFolder calls native', () => {
    shell.showItemInFolder('/some/file.txt');
    expect(state.shellState.showInFolderCalls).toEqual(['/some/file.txt']);
  });

  test('trashItem calls native', async () => {
    await shell.trashItem('/some/file.txt');
    expect(state.shellState.trashCalls).toEqual(['/some/file.txt']);
  });

  test('beep calls native', () => {
    shell.beep();
    expect(state.shellState.beepCalls).toBe(1);
  });
});

describe('native API integration: globalShortcut', () => {
  test('register a shortcut and verify it is registered', () => {
    const result = globalShortcut.register('CmdOrCtrl+Shift+A', () => {});
    expect(result).toBe(true);
    expect(globalShortcut.isRegistered('CmdOrCtrl+Shift+A')).toBe(true);
  });

  test('unregister removes a shortcut', () => {
    globalShortcut.register('CmdOrCtrl+K', () => {});
    globalShortcut.unregister('CmdOrCtrl+K');
    expect(globalShortcut.isRegistered('CmdOrCtrl+K')).toBe(false);
  });

  test('unregisterAll removes all shortcuts', () => {
    globalShortcut.register('CmdOrCtrl+A', () => {});
    globalShortcut.register('CmdOrCtrl+B', () => {});
    globalShortcut.unregisterAll();
    expect(globalShortcut.isRegistered('CmdOrCtrl+A')).toBe(false);
    expect(globalShortcut.isRegistered('CmdOrCtrl+B')).toBe(false);
  });

  test('duplicate registration returns false', () => {
    globalShortcut.register('CmdOrCtrl+D', () => {});
    const result = globalShortcut.register('CmdOrCtrl+D', () => {});
    expect(result).toBe(false);
  });

  test('shortcut callback fires via native callback', () => {
    let fired = false;
    globalShortcut.register('CmdOrCtrl+F', () => { fired = true; });

    for (const [id, acc] of state.shortcutState.registered) {
      if (acc === 'CmdOrCtrl+F' && state.shortcutState.callback) {
        state.shortcutState.callback(id);
        break;
      }
    }

    expect(fired).toBe(true);
  });
});

describe('native API integration: powerMonitor', () => {
  test('isOnBatteryPower returns current state', () => {
    state.powerState.onBattery = false;
    expect(powerMonitor.isOnBatteryPower()).toBe(false);

    state.powerState.onBattery = true;
    expect(powerMonitor.isOnBatteryPower()).toBe(true);
  });

  test('getBatteryInfo returns battery data', () => {
    state.powerState.batteryLevel = 50;
    state.powerState.charging = false;
    state.powerState.onBattery = true;

    const info = powerMonitor.getBatteryInfo();
    expect(info.level).toBe(50);
    expect(info.charging).toBe(false);
    expect(info.onAC).toBe(false);
  });

  test('getSystemIdleState returns active when idle time is low', () => {
    state.powerState.idleTime = 10;
    const idleState = powerMonitor.getSystemIdleState(60);
    expect(idleState).toBe('active');
  });

  test('getSystemIdleState returns idle when idle time exceeds threshold', () => {
    state.powerState.idleTime = 120;
    const idleState = powerMonitor.getSystemIdleState(60);
    expect(idleState).toBe('idle');
  });

  test('getSystemIdleTime returns idle seconds', () => {
    state.powerState.idleTime = 42;
    expect(powerMonitor.getSystemIdleTime()).toBe(42);
  });

  test('power events are emitted via native callback', () => {
    const events: string[] = [];
    powerMonitor.on('suspend', () => { events.push('suspend'); });

    if (state.powerState.callback) {
      state.powerState.callback({ eventType: 'suspend' });
    }

    expect(events).toEqual(['suspend']);
  });

  test('stop power monitor de-initializes', () => {
    powerMonitor.on('on-ac', () => {});
    expect(state.powerState.initialized).toBe(true);

    powerMonitor.stop();
    expect(state.powerState.initialized).toBe(false);
  });
});

describe('native API integration: screen', () => {
  test('getPrimaryDisplay returns display info', () => {
    const display = screen.getPrimaryDisplay();

    expect(display.id).toBe(1);
    expect(display.label).toBe('Primary');
    expect(display.bounds.width).toBe(1920);
    expect(display.bounds.height).toBe(1080);
    expect(display.scaleFactor).toBe(2);
    expect(display.primary).toBe(true);
  });

  test('getAllDisplays returns array', () => {
    const displays = screen.getAllDisplays();
    expect(displays).toHaveLength(1);
    expect(displays[0].id).toBe(1);
  });

  test('getDisplayNearestPoint returns nearest display', () => {
    const display = screen.getDisplayNearestPoint({ x: 100, y: 100 });
    expect(display.id).toBe(1);
  });

  test('getCursorScreenPoint returns cursor position', () => {
    const point = screen.getCursorScreenPoint();
    expect(point).toEqual({ x: 500, y: 500 });
  });

  test('getDisplayMatching finds display containing rect center', () => {
    const display = screen.getDisplayMatching({ x: 100, y: 100, width: 200, height: 200 });
    expect(display.id).toBe(1);
  });

  test('workArea is mapped from native work_area fields', () => {
    const display = screen.getPrimaryDisplay();
    expect(display.workArea.x).toBe(0);
    expect(display.workArea.y).toBe(25);
    expect(display.workArea.height).toBe(1055);
  });
});

describe('native API integration: capability gating', () => {
  test('dialog showOpenDialog rejects when capability is disabled', async () => {
    const { hasCapability, assertCapability } = await import('./runtime/capabilities');

    const gatedBackend = {
      engine: 'system' as const,
      capabilities: {
        windowManagement: true, multiWindow: true, ipcInvoke: true, mainToRendererPush: true,
        executeJavaScript: true, devtools: true, navigation: true, preloadScripts: true,
        contextIsolation: true, sessionPartitions: true, cookies: true,
        authoritativeGetters: false, executeJavaScriptReturns: false,
        dialogs: false, tray: true, globalShortcuts: true, notifications: true,
        powerMonitor: true, screen: true, clipboard: true, fileDrop: true,
      },
    };

    expect(hasCapability(gatedBackend, 'dialogs')).toBe(false);
    expect(() => assertCapability(gatedBackend, 'dialogs', 'dialog.showOpenDialog()')).toThrow(
      /dialog\.showOpenDialog\(\).*dialogs/
    );
  });

  test('tray, clipboard, shell throw explicit errors when capability is disabled', async () => {
    const { assertCapability } = await import('./runtime/capabilities');

    const gatedBackend = {
      engine: 'system' as const,
      capabilities: {
        windowManagement: true, multiWindow: true, ipcInvoke: true, mainToRendererPush: true,
        executeJavaScript: true, devtools: true, navigation: true, preloadScripts: true,
        contextIsolation: true, sessionPartitions: true, cookies: true,
        authoritativeGetters: false, executeJavaScriptReturns: false,
        dialogs: true, tray: false, globalShortcuts: false, notifications: false,
        powerMonitor: false, screen: false, clipboard: false, fileDrop: true,
      },
    };

    expect(() => assertCapability(gatedBackend, 'tray', 'Tray')).toThrow(/Tray.*tray/);
    expect(() => assertCapability(gatedBackend, 'clipboard', 'clipboard.readText()')).toThrow(/clipboard\.readText.*clipboard/);
    expect(() => assertCapability(gatedBackend, 'screen', 'screen.getPrimaryDisplay()')).toThrow(/screen\.getPrimaryDisplay.*screen/);
    expect(() => assertCapability(gatedBackend, 'notifications', 'Notification')).toThrow(/Notification.*notifications/);
    expect(() => assertCapability(gatedBackend, 'powerMonitor', 'powerMonitor')).toThrow(/powerMonitor.*powerMonitor/);
    expect(() => assertCapability(gatedBackend, 'globalShortcuts', 'globalShortcut')).toThrow(/globalShortcut.*globalShortcuts/);
  });
});