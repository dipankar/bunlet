import { app, BrowserWindow } from 'bunlet';
import * as path from 'path';
import * as fs from 'fs';

await app.whenReady();
console.log('App ready');

const win = new BrowserWindow({
  width: 1000,
  height: 700,
  title: 'Debug Test',
});

// Check what import.meta.dir resolves to
const dir = import.meta.dir;
console.log('import.meta.dir:', dir);

const rendererPath = path.join(dir, 'dist', 'renderer', 'index.html');
console.log('Renderer path:', rendererPath);
console.log('File exists:', fs.existsSync(rendererPath));

// Also check dist/renderer from current dir
const altPath = path.join(process.cwd(), 'dist', 'renderer', 'index.html');
console.log('Alt path (cwd):', altPath);
console.log('Alt exists:', fs.existsSync(altPath));

// List dist/renderer contents
const distRenderer = path.join(process.cwd(), 'dist', 'renderer');
if (fs.existsSync(distRenderer)) {
  console.log('dist/renderer contents:', fs.readdirSync(distRenderer));
}

// Try loading the file
try {
  win.loadFile(rendererPath);
  console.log('Loaded file successfully');
} catch (e) {
  console.error('Failed to load:', e);
  // Try alt path
  try {
    win.loadFile(altPath);
    console.log('Loaded alt path successfully');
  } catch (e2) {
    console.error('Failed to load alt:', e2);
  }
}

app.run();
