/**
 * Main Process Watcher
 *
 * Watches the main process files and automatically
 * restarts when changes are detected.
 */

import { type Subprocess } from 'bun';
import * as path from 'path';
import * as fs from 'fs';
import chokidar, { type FSWatcher } from 'chokidar';

export interface MainWatcherOptions {
  root: string;
  mainEntry: string;
  onRestart?: () => void;
  onError?: (error: Error) => void;
  openDevtools?: boolean;
  webviewEngine?: 'system' | 'cef';
}

/**
 * Main process watcher with auto-restart
 */
export class MainWatcher {
  private process: Subprocess | null = null;
  private watcher: FSWatcher | null = null;
  private options: MainWatcherOptions;
  private isRestarting = false;
  private restartTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(options: MainWatcherOptions) {
    this.options = options;
  }

  /**
   * Start the main process and watch for changes
   */
  async start(): Promise<void> {
    // Find the main entry file
    const mainPath = this.resolveMainEntry();
    if (!mainPath) {
      throw new Error(`Main entry not found: ${this.options.mainEntry}`);
    }

    // Start the main process
    await this.startProcess(mainPath);

    // Watch main process files
    this.startWatcher(mainPath);
  }

  /**
   * Stop the main process and watcher
   */
  async stop(): Promise<void> {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    await this.stopProcess();
  }

  /**
   * Resolve the main entry file
   */
  private resolveMainEntry(): string | null {
    const { root, mainEntry } = this.options;

    // Try exact path first
    const exactPath = path.resolve(root, mainEntry);
    if (fs.existsSync(exactPath)) {
      return exactPath;
    }

    // Try common variations
    const variations = [
      mainEntry,
      `${mainEntry}.ts`,
      `${mainEntry}.js`,
      `src/${mainEntry}`,
      `src/${mainEntry}.ts`,
      `src/${mainEntry}.js`,
    ];

    for (const variation of variations) {
      const fullPath = path.resolve(root, variation);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    // Try common default locations
    const defaults = ['main.ts', 'main.js', 'src/main.ts', 'src/main.js'];
    for (const def of defaults) {
      const fullPath = path.resolve(root, def);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    return null;
  }

  /**
   * Start the main process
   */
  private async startProcess(mainPath: string): Promise<void> {
    console.log(`[Main] Starting: ${path.relative(this.options.root, mainPath)}`);

    this.process = Bun.spawn(['bun', 'run', mainPath], {
      cwd: this.options.root,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        BUNLET_DEV: '1',
        BUNLET_OPEN_DEVTOOLS: this.options.openDevtools ? '1' : '0',
        BUNLET_WEBVIEW_ENGINE: this.options.webviewEngine || 'system',
      },
      stdio: ['inherit', 'inherit', 'inherit'],
      onExit: (proc, exitCode, signalCode, error) => {
        if (error) {
          console.error('[Main] Process error:', error.message);
          this.options.onError?.(error);
        } else if (exitCode !== 0 && exitCode !== null) {
          console.log(`[Main] Process exited with code ${exitCode}`);
        }
      },
    });
  }

  /**
   * Stop the main process
   */
  private async stopProcess(): Promise<void> {
    if (!this.process) {
      return;
    }

    try {
      this.process.kill();
      // Wait for process to exit
      await Promise.race([
        this.process.exited,
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    } catch {
      // Process might already be dead
    }

    this.process = null;
  }

  /**
   * Restart the main process
   */
  private async restart(): Promise<void> {
    if (this.isRestarting) {
      return;
    }

    this.isRestarting = true;
    console.log('[Main] Restarting...');

    try {
      await this.stopProcess();

      const mainPath = this.resolveMainEntry();
      if (mainPath) {
        await this.startProcess(mainPath);
        this.options.onRestart?.();
      }
    } finally {
      this.isRestarting = false;
    }
  }

  /**
   * Start watching main process files
   */
  private startWatcher(mainPath: string): void {
    const mainDir = path.dirname(mainPath);
    const patterns = [
      mainPath,
      path.join(mainDir, '**/*.ts'),
      path.join(mainDir, '**/*.js'),
      path.join(this.options.root, 'preload.ts'),
      path.join(this.options.root, 'preload.js'),
      path.join(this.options.root, 'src/preload.ts'),
      path.join(this.options.root, 'src/preload.js'),
    ];

    this.watcher = chokidar.watch(patterns, {
      ignored: ['**/node_modules/**', '**/dist/**'],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
    });

    this.watcher.on('change', (filePath) => {
      console.log(`[Main] File changed: ${path.relative(this.options.root, filePath)}`);

      // Debounce restart
      if (this.restartTimeout) {
        clearTimeout(this.restartTimeout);
      }

      this.restartTimeout = setTimeout(() => {
        this.restart();
      }, 200);
    });

    console.log('[Main] Watching for changes...');
  }
}
