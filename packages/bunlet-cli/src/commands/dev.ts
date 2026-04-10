/**
 * bunlet dev command
 *
 * Starts the development server with HMR support.
 */

import { DevServer } from '../dev/server';
import { MainWatcher } from '../dev/main-watcher';
import { loadBunletConfig } from '../config';

interface DevOptions {
  port: string;
  host: string;
  hmr: boolean;
  open: boolean;
  devtools: boolean;
  webview?: string;
}

/**
 * Start development mode
 */
export async function devCommand(options: DevOptions): Promise<void> {
  const root = process.cwd();
  const config = await loadBunletConfig(root);
  const webviewEngine = options.webview || config.webview?.engine || 'system';
  if (webviewEngine !== 'system' && webviewEngine !== 'cef') {
    throw new Error(`Unsupported webview engine: ${webviewEngine}`);
  }

  console.log('\n  Bunlet Dev Server\n');
  console.log(`  Root: ${root}`);
  console.log(`  Main: ${config.main || 'main.ts'}`);
  console.log(`  Renderer: ${config.renderer?.root || 'renderer'}`);
  console.log(`  WebView: ${webviewEngine}`);
  console.log(`  HMR: ${options.hmr ? 'enabled' : 'disabled'}`);

  // Create and start dev server
  const server = new DevServer({
    port: parseInt(options.port, 10),
    host: options.host,
    hmr: options.hmr,
    open: options.open,
    root,
    rendererDir: config.renderer?.root || 'renderer',
  });

  // Create main process watcher
  const mainWatcher = new MainWatcher({
    root,
    mainEntry: config.main || 'main.ts',
    onRestart: () => {
      console.log('[Main] Process restarted');
    },
    onError: (error) => {
      console.error('[Main] Error:', error.message);
    },
    openDevtools: options.devtools,
    webviewEngine,
  });

  // Handle shutdown
  const shutdown = async () => {
    console.log('\n  Shutting down...');
    await mainWatcher.stop();
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    // Start dev server first
    await server.start();

    // Then start main process
    await mainWatcher.start();

    console.log('\n  Press Ctrl+C to stop\n');
  } catch (error) {
    console.error('Failed to start dev server:', error);
    process.exit(1);
  }
}
