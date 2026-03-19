import { app, BrowserWindow } from 'bunlet';

await app.whenReady();
console.log('Test app ready');

const win = new BrowserWindow({
  width: 800,
  height: 600,
  title: 'Test Window',
});

win.loadFile('/tmp/test-render.html');
console.log('Loading test HTML...');

app.run();
