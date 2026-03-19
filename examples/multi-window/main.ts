/**
 * Multi-Window Demo (Simplified)
 *
 * Note: The screen API is currently disabled on Linux due to a GTK/D-Bus conflict
 * with TAO's event loop. This will be fixed in a future release.
 */

import { app, BrowserWindow, z } from 'bunlet';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

// Register IPC handlers before app is ready
app.handle('get-settings', z.object({}), async () => {
  return { theme: 'light', fontSize: 14 };
});

// Note: get-displays handler removed due to screen API Linux limitation
// The screen API causes a GTK/D-Bus conflict with TAO's event loop

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
