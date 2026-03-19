/**
 * Hello World - Bunlet Example Application
 */

import { app, BrowserWindow, z } from 'bunlet';

// Register IPC handlers (synchronous, runs immediately)
app.handle(
  'greet',
  z.object({ name: z.string() }),
  async ({ name }) => {
    return `Hello, ${name}! Welcome to Bunlet!`;
  }
);

app.handle(
  'get-platform',
  z.object({}),
  async () => {
    return {
      platform: process.platform,
      arch: process.arch,
      version: process.version,
    };
  }
);

// Handle app events (register before waiting for ready)
app.on('window-all-closed', () => {
  console.log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Wait for app to be ready (MUST complete before app.run())
await app.whenReady();
console.log('Bunlet app is ready!');

// Create window (adds to PENDING_WINDOWS queue)
const mainWindow = new BrowserWindow({
  width: 800,
  height: 600,
  title: 'Hello Bunlet!',
});

// Load the HTML file
mainWindow.loadFile('index.html');

// Handle window events
mainWindow.on('close', () => {
  console.log('Window is closing...');
});

mainWindow.on('closed', () => {
  console.log('Window closed');
});

console.log('Window created with ID:', mainWindow.id);

// Run the event loop (blocking - processes PENDING_WINDOWS)
app.run();
