/**
 * Notes App - Main Process Entry Point
 */

import { app, BrowserWindow, Menu, z } from 'bunlet';
import * as path from 'path';

// Import IPC handlers (registers them on app)
import './main/ipc-handlers';
import { createAppMenu } from './main/menu';
import { getStorage } from './main/storage';
import { exportNoteAsHtml, exportNoteAsMarkdown } from './main/pdf-export';

app.setName('Notes App');

let mainWindow: BrowserWindow | null = null;

// Export handlers (synchronous, runs immediately)
app.handle(
  'notes:export-html',
  z.object({ id: z.string() }),
  async ({ id }, context) => {
    const storage = getStorage();
    const note = storage.getNote(id);
    if (!note) {
      return { success: false, error: 'Note not found' };
    }
    return exportNoteAsHtml(note, context.window);
  }
);

app.handle(
  'notes:export-markdown',
  z.object({ id: z.string() }),
  async ({ id }, context) => {
    const storage = getStorage();
    const note = storage.getNote(id);
    if (!note) {
      return { success: false, error: 'Note not found' };
    }
    return exportNoteAsMarkdown(note, context.window);
  }
);

// Handle app events (register before waiting for ready)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Wait for app to be ready (MUST complete before app.run())
await app.whenReady();
console.log('Notes App is ready!');

// Create window (adds to PENDING_WINDOWS queue)
mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  minWidth: 800,
  minHeight: 600,
  title: 'Notes App',
});

// Set application menu
const menu = createAppMenu(mainWindow);
Menu.setApplicationMenu(menu);

// Load renderer
if (process.env.NODE_ENV === 'development') {
  mainWindow.loadURL('http://localhost:5173');
  mainWindow.webContents.openDevTools({ mode: 'right' });
} else {
  // Use import.meta.dir for runtime path resolution (works with bundled code)
  mainWindow.loadFile(path.join(import.meta.dir, 'renderer', 'index.html'));
}

mainWindow.on('closed', () => {
  mainWindow = null;
});

// Run the event loop (blocking - processes PENDING_WINDOWS)
app.run();
