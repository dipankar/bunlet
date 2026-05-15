/**
 * File Browser Demo
 *
 * Demonstrates:
 * - File/folder dialogs
 * - File system watching
 * - Navigation (back/forward)
 * - Protocol handling (app:// URLs)
 * - Shell integration (open in system file manager)
 */

import {
  app,
  BrowserWindow,
  dialog,
  fileWatcher,
  shell,
  z,
} from '@bunlet/core';
import path from 'path';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let currentWatcher: ReturnType<typeof fileWatcher.watch> | null = null;
let currentPath = process.env.HOME || '/';

// Navigation history
const history: string[] = [];
let historyIndex = -1;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    title: 'File Browser',
    webPreferences: {
      preload: path.join(import.meta.dir, 'preload.ts'),
    },
  });

  // Note: center() is disabled on Linux due to screen API limitations
  // mainWindow.center();
  mainWindow.loadFile(path.join(import.meta.dir, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (currentWatcher) {
      currentWatcher.close();
      currentWatcher = null;
    }
  });
}

function readDirectory(dirPath: string) {
  try {
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      throw new Error('Not a directory');
    }

    // Update current path
    currentPath = dirPath;

    // Start watching new directory
    if (currentWatcher) {
      currentWatcher.close();
    }
    currentWatcher = fileWatcher.watch(dirPath, { recursive: false });
    currentWatcher.on('change', (event) => {
      // Notify renderer of changes
      mainWindow?.webContents.send('directory-changed', {
        type: event.type,
        paths: event.paths,
      });
    });

    // Read directory contents
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const items = entries
      .map((entry) => {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const stats = fs.statSync(fullPath);
          return {
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
            size: stats.size,
            modified: stats.mtime.toISOString(),
            hidden: entry.name.startsWith('.'),
          };
        } catch {
          return {
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
            size: 0,
            modified: '',
            hidden: entry.name.startsWith('.'),
          };
        }
      })
      .sort((a, b) => {
        // Directories first, then alphabetically
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

    return {
      path: dirPath,
      items,
      canGoBack: historyIndex > 0,
      canGoForward: historyIndex < history.length - 1,
    };
  } catch (error) {
    return {
      path: dirPath,
      items: [],
      error: String(error),
      canGoBack: historyIndex > 0,
      canGoForward: historyIndex < history.length - 1,
    };
  }
}

// Register IPC handlers before app is ready
// Get current directory contents
app.handle(
  'get-directory',
  z.object({ path: z.string().optional() }),
  async (params) => {
    const dirPath = params?.path || currentPath;
    return readDirectory(dirPath);
  }
);

// Navigate to a directory
app.handle(
  'navigate-to',
  z.object({ path: z.string() }),
  async (params) => {
    if (historyIndex === -1 || history[historyIndex] !== params.path) {
      history.splice(historyIndex + 1);
      history.push(params.path);
      historyIndex = history.length - 1;
    }

    return readDirectory(params.path);
  }
);

// Navigate back
app.handle('navigate-back', z.object({}), async () => {
  if (historyIndex > 0) {
    historyIndex--;
    return readDirectory(history[historyIndex]);
  }
  return null;
});

// Navigate forward
app.handle('navigate-forward', z.object({}), async () => {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    return readDirectory(history[historyIndex]);
  }
  return null;
});

// Navigate up
app.handle('navigate-up', z.object({}), async () => {
  const parentPath = path.dirname(currentPath);
  if (parentPath !== currentPath) {
    history.splice(historyIndex + 1);
    history.push(parentPath);
    historyIndex = history.length - 1;
    return readDirectory(parentPath);
  }
  return null;
});

// Open folder dialog
app.handle('open-folder-dialog', z.object({}), async () => {
  const result = await dialog.showOpenDialog(null, {
    properties: ['openDirectory'],
    title: 'Select Folder',
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];
    history.splice(historyIndex + 1);
    history.push(selectedPath);
    historyIndex = history.length - 1;
    return readDirectory(selectedPath);
  }
  return null;
});

// Open file with default application
app.handle(
  'open-file',
  z.object({ path: z.string() }),
  async (params) => {
    await shell.openPath(params.path);
    return { success: true };
  }
);

app.handle(
  'show-in-folder',
  z.object({ path: z.string() }),
  async (params) => {
    shell.showItemInFolder(params.path);
    return { success: true };
  }
);

// Get navigation state
app.handle('get-nav-state', z.object({}), async () => {
  return {
    canGoBack: historyIndex > 0,
    canGoForward: historyIndex < history.length - 1,
    currentPath,
  };
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (currentWatcher) {
    currentWatcher.close();
    currentWatcher = null;
  }
});

// Wait for app to be ready
await app.whenReady();
console.log('File Browser is ready!');

// Create window
createWindow();

// Run the event loop
console.log('About to run app...');
app.run();
