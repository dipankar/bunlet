/**
 * Clipboard Manager Demo
 *
 * Demonstrates:
 * - Clipboard read/write
 * - Global shortcuts
 * - Clipboard history
 * - System tray integration
 */

import {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  Tray,
  Menu,
  MenuItem,
  z,
} from '@bunlet/core';
import path from 'path';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let clipboardHistory: Array<{ text: string; timestamp: number }> = [];
let lastClipboardContent = '';
let isQuitting = false;
let pollingInterval: ReturnType<typeof setInterval> | null = null;

const MAX_HISTORY = 20;
const POLL_INTERVAL = 500; // Check clipboard every 500ms

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 500,
    title: 'Clipboard Manager',
    webPreferences: {
      preload: path.join(import.meta.dir, 'preload.ts'),
    },
  });

  // Note: center() is disabled on Linux due to screen API limitations
  // mainWindow.center();
  mainWindow.loadFile(path.join(import.meta.dir, 'index.html'));

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  try {
    tray = new Tray(path.join(import.meta.dir, 'assets', 'tray-icon.png'));
    tray.setToolTip('Clipboard Manager');

    const contextMenu = new Menu();

    contextMenu.append(
      new MenuItem({
        label: 'Show Window',
        click: () => showWindow(),
      })
    );

    contextMenu.append(new MenuItem({ type: 'separator' }));

    contextMenu.append(
      new MenuItem({
        label: 'Clear History',
        click: () => {
          clipboardHistory = [];
          mainWindow?.webContents.send('history-updated', clipboardHistory);
        },
      })
    );

    contextMenu.append(new MenuItem({ type: 'separator' }));

    contextMenu.append(
      new MenuItem({
        label: 'Quit',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      })
    );

    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => showWindow());
    console.log('Tray created successfully');
  } catch (error) {
    console.error('Failed to create tray:', error);
  }
}

function registerShortcuts() {
  // Show clipboard manager
  globalShortcut.register('CommandOrControl+Shift+V', () => {
    showWindow();
  });
  console.log('Global shortcuts registered');
}

function showWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
}

function startClipboardPolling() {
  pollingInterval = setInterval(() => {
    const currentContent = clipboard.readText();
    if (currentContent && currentContent !== lastClipboardContent) {
      lastClipboardContent = currentContent;
      addToHistory(currentContent);
    }
  }, POLL_INTERVAL);
  console.log('Clipboard polling started');
}

function addToHistory(text: string) {
  // Check if already in history
  const existingIndex = clipboardHistory.findIndex((item) => item.text === text);
  if (existingIndex !== -1) {
    // Move to top
    clipboardHistory.splice(existingIndex, 1);
  }

  // Add to beginning
  clipboardHistory.unshift({
    text,
    timestamp: Date.now(),
  });

  // Trim to max size
  if (clipboardHistory.length > MAX_HISTORY) {
    clipboardHistory = clipboardHistory.slice(0, MAX_HISTORY);
  }

  mainWindow?.webContents.send('history-updated', clipboardHistory);
}

// IPC handlers - register before app is ready
app.handle('get-history', z.object({}), async () => {
  return clipboardHistory;
});

app.handle(
  'copy-to-clipboard',
  z.object({ text: z.string() }),
  async (params) => {
    clipboard.writeText(params.text);
    lastClipboardContent = params.text;
    return { success: true };
  }
);

app.handle('get-clipboard', z.object({}), async () => {
  return { text: clipboard.readText() };
});

app.handle('clear-history', z.object({}), async () => {
  clipboardHistory = [];
  return { success: true };
});

app.handle('clear-clipboard', z.object({}), async () => {
  clipboard.clear();
  lastClipboardContent = '';
  return { success: true };
});

app.handle(
  'remove-item',
  z.object({ index: z.number() }),
  async (params) => {
    if (params.index >= 0 && params.index < clipboardHistory.length) {
      clipboardHistory.splice(params.index, 1);
    }
    return { history: clipboardHistory };
  }
);

app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
});

app.on('window-all-closed', () => {
  // Keep running in tray
});

// Wait for app to be ready
await app.whenReady();
console.log('Clipboard Manager is ready!');

// Create window, tray, and start polling
createWindow();
createTray();
registerShortcuts();
startClipboardPolling();

// Run the event loop
console.log('About to run app...');
app.run();
