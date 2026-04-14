/**
 * Multi-Window Demo (Simplified)
 *
 * Note: The screen API is currently disabled on Linux due to a GTK/D-Bus conflict
 * with TAO's event loop. This will be fixed in a future release.
 */

import { app, BrowserWindow, z } from 'bunlet';
import path from 'path';

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let currentSettings = { theme: 'light', fontSize: 14 };

// Register IPC handlers before app is ready
app.handle('get-settings', z.object({}), async () => {
  return currentSettings;
});

app.handle(
  'save-settings',
  z.object({ theme: z.string(), fontSize: z.number() }),
  async (params) => {
    currentSettings = { theme: params.theme, fontSize: params.fontSize };
    mainWindow?.webContents.send('settings-changed', currentSettings);
    return { success: true };
  }
);

app.handle('open-settings', z.object({}), async () => {
  if (settingsWindow) {
    settingsWindow.focus();
    return { success: true };
  }

  settingsWindow = new BrowserWindow({
    width: 400,
    height: 350,
    title: 'Settings',
    parent: mainWindow ?? undefined,
    modal: false,
  });

  settingsWindow.loadFile(path.join(import.meta.dir, 'settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return { success: true };
});

app.handle('close-settings', z.object({}), async () => {
  if (settingsWindow) {
    settingsWindow.close();
  }
  return { success: true };
});

app.on('window-all-closed', () => {
  app.quit();
});

// Wait for app to be ready
await app.whenReady();
console.log('Multi-Window Demo is ready!');

// Create main window
mainWindow = new BrowserWindow({
  width: 800,
  height: 600,
  title: 'Multi-Window Demo',
});

// Load the main window HTML
mainWindow.loadFile(path.join(import.meta.dir, 'index.html'));

mainWindow.on('closed', () => {
  mainWindow = null;
});

// Run the event loop
console.log('About to run app...');
app.run();