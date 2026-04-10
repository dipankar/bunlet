/**
 * File Watcher API for bunlet
 *
 * Provides cross-platform file system watching.
 *
 * @example
 * ```typescript
 * import { fileWatcher } from 'bunlet';
 *
 * // Watch a directory for changes
 * const watcher = fileWatcher.watch('/path/to/dir', {
 *   recursive: true,
 * });
 *
 * watcher.on('change', (event) => {
 *   console.log(`${event.type}: ${event.paths.join(', ')}`);
 * });
 *
 * // Stop watching
 * watcher.close();
 * ```
 */

import { EventEmitter } from 'events';
import { native } from './runtime';

/** Whether the callback has been set up */
let callbackInitialized = false;

/** Map of watcher ID to FileWatcher instance */
const watchers = new Map<number, FileWatcher>();

/**
 * File watch event types
 */
export type FileWatchEventType = 'create' | 'modify' | 'remove' | 'rename' | 'access' | 'any' | 'other';

/**
 * File watch event
 */
export interface FileWatchEvent {
  /** Event type */
  type: FileWatchEventType;
  /** Paths affected by the event */
  paths: string[];
}

/**
 * File watcher options
 */
export interface FileWatcherOptions {
  /** Watch subdirectories recursively (default: true) */
  recursive?: boolean;
  /** Debounce delay in milliseconds (not yet implemented) */
  debounce?: number;
}

/**
 * Initialize the callback handler
 */
function initCallback() {
  if (callbackInitialized) return;
  callbackInitialized = true;

  native.setFileWatcherCallback((event: { watcherId: number; eventType: string; paths: string[] }) => {
    const watcher = watchers.get(event.watcherId);
    if (watcher) {
      watcher.emit('change', {
        type: event.eventType as FileWatchEventType,
        paths: event.paths,
      });

      // Also emit specific event type
      watcher.emit(event.eventType, event.paths);
    }
  });
}

/**
 * File watcher class
 */
export class FileWatcher extends EventEmitter {
  private id: number | null = null;
  private path: string;
  private options: FileWatcherOptions;
  private closed = false;

  constructor(path: string, options: FileWatcherOptions = {}) {
    super();
    this.path = path;
    this.options = options;

    initCallback();
    this.start();
  }

  /**
   * Start watching
   */
  private start(): void {
    if (this.closed) return;

    try {
      this.id = native.watchPath(this.path, this.options.recursive ?? true);
      watchers.set(this.id, this);
      this.emit('ready');
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Close the watcher
   */
  close(): void {
    if (this.closed || this.id === null) return;

    native.unwatch(this.id);
    watchers.delete(this.id);
    this.closed = true;
    this.emit('close');
  }

  /**
   * Check if the watcher is closed
   */
  get isClosed(): boolean {
    return this.closed;
  }

  // Event emitter type overloads
  on(event: 'change', listener: (event: FileWatchEvent) => void): this;
  on(event: 'create', listener: (paths: string[]) => void): this;
  on(event: 'modify', listener: (paths: string[]) => void): this;
  on(event: 'remove', listener: (paths: string[]) => void): this;
  on(event: 'ready', listener: () => void): this;
  on(event: 'close', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
}

/**
 * File watcher API
 */
export const fileWatcher = {
  /**
   * Watch a path for changes
   * @param path - Path to watch
   * @param options - Watch options
   * @returns FileWatcher instance
   */
  watch(path: string, options?: FileWatcherOptions): FileWatcher {
    return new FileWatcher(path, options);
  },

  /**
   * Stop all watchers
   */
  unwatchAll(): void {
    native.unwatchAll();
    watchers.clear();
  },

  /**
   * Get the number of active watchers
   */
  getWatcherCount(): number {
    return native.getWatcherCount();
  },
};
