/**
 * File Watcher
 *
 * Wraps chokidar for file system watching with
 * categorized change events.
 */

import chokidar, { type FSWatcher } from 'chokidar';
import * as path from 'path';

export type FileChangeType = 'add' | 'change' | 'unlink';

export interface FileChange {
  type: FileChangeType;
  path: string;
  category: 'main' | 'renderer' | 'preload' | 'config' | 'other';
}

export interface WatcherOptions {
  root: string;
  mainPatterns?: string[];
  rendererPatterns?: string[];
  preloadPatterns?: string[];
  configPatterns?: string[];
  ignored?: string[];
}

export type ChangeHandler = (change: FileChange) => void;

/**
 * File system watcher for development mode
 */
export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private handlers: Set<ChangeHandler> = new Set();
  private options: Required<WatcherOptions>;

  constructor(options: WatcherOptions) {
    this.options = {
      mainPatterns: ['main.ts', 'main.js', 'src/main/**/*'],
      rendererPatterns: ['renderer/**/*', 'src/renderer/**/*'],
      preloadPatterns: ['preload.ts', 'preload.js', 'src/preload/**/*'],
      configPatterns: ['bunlet.config.*', 'package.json', 'tsconfig.json'],
      ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      ...options,
    };
  }

  /**
   * Start watching files
   */
  start(): void {
    if (this.watcher) {
      return;
    }

    this.watcher = chokidar.watch(this.options.root, {
      ignored: this.options.ignored,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
    });

    this.watcher
      .on('add', (filePath) => this.handleChange('add', filePath))
      .on('change', (filePath) => this.handleChange('change', filePath))
      .on('unlink', (filePath) => this.handleChange('unlink', filePath));
  }

  /**
   * Stop watching files
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Add a change handler
   */
  onChange(handler: ChangeHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Handle a file change
   */
  private handleChange(type: FileChangeType, filePath: string): void {
    const relativePath = path.relative(this.options.root, filePath);
    const category = this.categorizeFile(relativePath);

    const change: FileChange = {
      type,
      path: relativePath,
      category,
    };

    for (const handler of this.handlers) {
      try {
        handler(change);
      } catch (err) {
        console.error('Error in file change handler:', err);
      }
    }
  }

  /**
   * Categorize a file based on its path
   */
  private categorizeFile(
    relativePath: string
  ): 'main' | 'renderer' | 'preload' | 'config' | 'other' {
    const normalized = relativePath.replace(/\\/g, '/');

    // Check config patterns first
    for (const pattern of this.options.configPatterns) {
      if (this.matchPattern(normalized, pattern)) {
        return 'config';
      }
    }

    // Check main patterns
    for (const pattern of this.options.mainPatterns) {
      if (this.matchPattern(normalized, pattern)) {
        return 'main';
      }
    }

    // Check preload patterns
    for (const pattern of this.options.preloadPatterns) {
      if (this.matchPattern(normalized, pattern)) {
        return 'preload';
      }
    }

    // Check renderer patterns
    for (const pattern of this.options.rendererPatterns) {
      if (this.matchPattern(normalized, pattern)) {
        return 'renderer';
      }
    }

    return 'other';
  }

  /**
   * Simple pattern matching
   */
  private matchPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{GLOBSTAR}}/g, '.*')
      .replace(/\./g, '\\.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }
}
