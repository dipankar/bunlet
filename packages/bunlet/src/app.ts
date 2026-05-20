/**
 * App module - Application lifecycle management
 */

import { EventEmitter } from 'events';
import { z, ZodType } from 'zod';
import type { NativeWindowEvent } from './windows/events';
import type { PathName, IPCContext, BunletEvent } from './types';
import { createCloseEvent } from './windows/events';
import { BunletError, BunletErrorCode } from './errors';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { native } from './runtime';
import { windowManager } from './windows/manager';

function resolveAppVersion(): string {
  if (process.env.BUNLET_APP_VERSION) {
    return process.env.BUNLET_APP_VERSION;
  }

  const candidates = [
    path.join(process.cwd(), 'package.json'),
    path.join(path.dirname(process.execPath), 'package.json'),
  ];

  for (const pkgPath of candidates) {
    try {
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: string };
        if (pkg.version) return pkg.version;
      }
    } catch {
      // skip unreadable package.json
    }
  }

  return '0.0.0';
}

/**
 * IPC handler function type
 */
type IPCHandler<T> = (args: T, context: IPCContext) => Promise<unknown> | unknown;

/**
 * Stored handler with schema
 */
interface StoredHandler {
  schema: ZodType;
  handler: IPCHandler<unknown>;
}

interface NativeAppEvent extends Partial<NativeWindowEvent> {
  event: string;
}

/**
 * App class - Singleton for application lifecycle
 */
class App extends EventEmitter {
  private static instance: App;
  private readyPromise: Promise<void>;
  private readyResolve!: () => void;
  private isAppReady = false;
  private handlers: Map<string, StoredHandler> = new Map();
  private appName = 'Bunlet';
  private appVersion = resolveAppVersion();

  private constructor() {
    super();

    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });

    // Initialize native app
    this.initialize();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): App {
    if (!App.instance) {
      App.instance = new App();
    }
    return App.instance;
  }

  /**
   * Initialize the application
   */
  private initialize(): void {
    try {
      if (process.platform === 'linux') {
        const hasDisplay = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
        if (!hasDisplay) {
          throw new Error(
            'No graphical display detected on Linux. Set DISPLAY/WAYLAND_DISPLAY or run inside a desktop session.'
          );
        }
      }

      native.initApp();

      // Linux: cache primary display info while GTK is freshly initialized.
      // Subsequent screen queries return cached data, sidestepping GDK
      // re-entrancy hangs once the event loop is running.
      const nativeAny = native as unknown as Record<string, (...args: unknown[]) => unknown>;
      if (typeof nativeAny.primeScreenCache === 'function') {
        try {
          nativeAny.primeScreenCache();
        } catch (err) {
          if (process.env.BUNLET_DEBUG) {
            console.warn('[bunlet] primeScreenCache failed (non-fatal):', err);
          }
        }
      }

      // Set up IPC handler
      native.setIpcHandler((msg: { windowId: number; message: string }) => {
        this.handleIpcMessage(msg.windowId, msg.message);
      });

      // Set up native app lifecycle handler
      if (typeof native.setAppEventHandler === 'function') {
        native.setAppEventHandler((event: NativeAppEvent) => {
          this.handleNativeAppEvent(event);
        });
      }

      // Mark as ready after a tick to allow event handlers to be registered
      process.nextTick(() => {
        this.isAppReady = true;
        this.readyResolve();
        this.emit('ready');
      });
    } catch (error) {
      console.error('Failed to initialize app:', error);
      throw error;
    }
  }

  private handleNativeAppEvent(event: NativeAppEvent): void {
    if (event.event === 'window-all-closed') {
      this.emit('window-all-closed');
      return;
    }

    if (typeof event.windowId !== 'number') {
      return;
    }

    const window = windowManager.get(event.windowId);
    if (!window) {
      return;
    }

    window.handleNativeEvent({
      event: event.event,
      windowId: event.windowId,
      title: event.title,
      url: event.url,
      bounds: event.bounds,
      scaleFactor: event.scaleFactor,
      theme: event.theme,
      files: event.files,
      preloadPath: event.preloadPath,
      errorMessage: event.errorMessage,
      errorStack: event.errorStack,
    });
  }

  /**
   * Handle incoming IPC message from a window
   */
  private async handleIpcMessage(windowId: number, message: string): Promise<void> {
    try {
      const request = JSON.parse(message);

      if (
        request?.type === '__bunlet_internal_window_event' &&
        typeof request.event === 'string'
      ) {
        this.handleNativeAppEvent({
          event: request.event,
          windowId,
          title: typeof request.title === 'string' ? request.title : undefined,
          url: typeof request.url === 'string' ? request.url : undefined,
          bounds: request.bounds,
        });
        return;
      }

      // Fire-and-forget event messages from renderer
      if (request?.type === 'event' && typeof request.channel === 'string') {
        const window = windowManager.get(windowId);
        const args = Array.isArray(request.args) ? request.args : [];
        this.emit(request.channel, { window, windowId }, ...args);
        return;
      }

      // JSON-RPC 2.0 format
      if (request.jsonrpc !== '2.0' || !request.method || request.id == null) {
        console.error('Invalid IPC message format:', message);
        return;
      }

      const { id, method, params } = request;
      const handler = this.handlers.get(method);

      if (!handler) {
        this.sendIpcResponse(windowId, id, null, {
          code: -32601,
          message: `Method not found: ${method}`,
          data: { bunletCode: BunletErrorCode.IPC_METHOD_NOT_FOUND },
        });
        return;
      }

      try {
        // Validate params with Zod schema
        const validatedParams = handler.schema.parse(params);

        // Get window from registry
        const window = windowManager.get(windowId);
        if (!window) {
          this.sendIpcResponse(windowId, id, null, {
            code: -32000,
            message: `Window not found: ${windowId}`,
            data: { bunletCode: BunletErrorCode.WINDOW_NOT_FOUND },
          });
          return;
        }

        const context: IPCContext = {
          window,
          windowId,
        };

        // Call handler
        const result = await handler.handler(validatedParams, context);
        this.sendIpcResponse(windowId, id, result, null);
      } catch (error) {
        if (error instanceof z.ZodError) {
          // Validation error
          this.sendIpcResponse(windowId, id, null, {
            code: -32602,
            message: 'Invalid params',
            data: { bunletCode: BunletErrorCode.IPC_VALIDATION_FAILED, issues: error.errors },
          });
        } else {
          // Handler error
          const err = error as Error;
          this.sendIpcResponse(windowId, id, null, {
            code: -32000,
            message: err.message || 'Unknown error',
            data: { bunletCode: BunletErrorCode.UNKNOWN },
          });
        }
      }
    } catch (error) {
      console.error('Failed to handle IPC message:', error);
    }
  }

  /**
   * Send IPC response back to window
   */
  private sendIpcResponse(
    windowId: number,
    id: string | number,
    result: unknown,
    error: { code: number; message: string; data?: unknown } | null
  ): void {
    const response = {
      jsonrpc: '2.0',
      id,
      ...(error ? { error } : { result }),
    };

    native.sendIpcMessage(windowId, JSON.stringify(response));
  }

  /**
   * Wait for app to be ready
   */
  whenReady(): Promise<void> {
    if (this.isAppReady) {
      return Promise.resolve();
    }
    return this.readyPromise;
  }

  /**
   * Check if app is ready
   */
  isReady(): boolean {
    return this.isAppReady;
  }

  /**
   * Register an IPC handler
   */
  handle<T extends ZodType>(
    channel: string,
    schema: T,
    handler: IPCHandler<z.infer<T>>
  ): void {
    this.handlers.set(channel, {
      schema,
      handler: handler as IPCHandler<unknown>,
    });
  }

  /**
   * Remove an IPC handler
   */
  removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  /**
   * Quit the application.
   *
   * Emits `before-quit` first. If any listener calls
   * `event.preventDefault()`, the quit is aborted.
   * Otherwise emits `will-quit` and `quit`, then terminates.
   */
  quit(): void {
    const event: BunletEvent = createCloseEvent();
    this.emit('before-quit', event);

    if (event.defaultPrevented) {
      return;
    }

    this.emit('will-quit');
    this.emit('quit');
    native.quitApp();
  }

  /**
   * Exit with code
   */
  exit(exitCode = 0): void {
    process.exit(exitCode);
  }

  /**
   * Relaunch the application
   *
   * Quits the current instance and launches a new one with the same
   * executable and arguments. On macOS, this will also re-activate
   * the app via the dock.
   */
  relaunch(options?: { args?: string[]; execPath?: string }): void {
    const execPath = options?.execPath ?? process.execPath;
    const args = options?.args ?? process.argv.slice(1);

    const { spawn } = require('child_process') as typeof import('child_process');

    const child = spawn(execPath, args, {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    });

    child.unref();

    this.quit();
  }

  /**
   * Get app name
   */
  getName(): string {
    return this.appName;
  }

  /**
   * Set app name
   */
  setName(name: string): void {
    this.appName = name;
  }

  /**
   * Get app version
   */
  getVersion(): string {
    return this.appVersion;
  }

  /**
   * Get system locale
   */
  getLocale(): string {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  }

  /**
   * Get app path
   */
  getAppPath(): string {
    return process.cwd();
  }

  /**
   * Get standard path, with backend contract fallback.
   *
   * Tries the native module first, then falls back to a JS implementation.
   */
  getPath(name: PathName): string {
    // Try native backend first
    if (typeof native.getPath === 'function') {
      try {
        const result = native.getPath(name);
        if (typeof result === 'string' && result.length > 0) {
          return result;
        }
      } catch {
        // Fall through to JS fallback
      }
    }

    const home = os.homedir();

    switch (name) {
      case 'home':
        return home;
      case 'appData':
        if (process.platform === 'win32') {
          return process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
        } else if (process.platform === 'darwin') {
          return path.join(home, 'Library', 'Application Support');
        }
        return process.env.XDG_CONFIG_HOME || path.join(home, '.config');
      case 'userData':
        return path.join(this.getPath('appData'), this.appName);
      case 'temp':
        return os.tmpdir();
      case 'exe':
        return process.execPath;
      case 'desktop':
        return path.join(home, 'Desktop');
      case 'documents':
        return path.join(home, 'Documents');
      case 'downloads':
        return path.join(home, 'Downloads');
      case 'music':
        return path.join(home, 'Music');
      case 'pictures':
        return path.join(home, 'Pictures');
      case 'videos':
        return path.join(home, 'Videos');
      case 'cache':
        if (process.platform === 'darwin') {
          return path.join(home, 'Library', 'Caches', this.appName);
        } else if (process.platform === 'win32') {
          return path.join(home, 'AppData', 'Local', this.appName, 'Cache');
        }
        return process.env.XDG_CACHE_HOME || path.join(home, '.cache');
      case 'data':
        if (process.platform === 'darwin') {
          return path.join(home, 'Library', 'Application Support', this.appName);
        } else if (process.platform === 'win32') {
          return process.env.APPDATA || path.join(home, 'AppData', 'Roaming', this.appName);
        }
        return process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
      case 'dataLocal':
        if (process.platform === 'darwin') {
          return path.join(home, 'Library', 'Application Support', this.appName);
        } else if (process.platform === 'win32') {
          return process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local', this.appName);
        }
        return process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
      case 'runtime':
        if (process.platform === 'linux') {
          return process.env.XDG_RUNTIME_DIR || path.join('/run', 'user', String(process.getuid?.() ?? 0));
        }
        return os.tmpdir();
      default:
        throw new Error(`Unknown path name: ${name}`);
    }
  }

  /**
   * Run the event loop (blocking)
   * Call this after creating windows
   */
  run(): void {
    // Check if we have the new pumping API (for Linux Wayland support)
    if (typeof native.initEventLoop === 'function' && typeof native.pumpEvents === 'function') {
      this.runWithPumping();
    } else {
      native.runEventLoop();
    }
  }

  /**
   * Run with event pumping (allows IPC callbacks to work on Linux)
   */
  private runWithPumping(): void {
    native.initEventLoop();

    const poll = () => {
      const result = native.pumpEvents();

      // Process any IPC messages
      for (const msg of result.messages) {
        this.handleIpcMessage(msg.windowId, msg.message);
      }

      if (result.shouldQuit) {
        if (process.platform !== 'darwin') {
          this.quit();
        }
      } else {
        // Use setImmediate for efficient polling
        setImmediate(poll);
      }
    };

    poll();
  }
}

function getAppInstance(): App {
  return App.getInstance();
}

// Lazily initialize native app on first access.
export const app = new Proxy({} as App, {
  get(_target, prop, _receiver) {
    const instance = getAppInstance() as unknown as Record<PropertyKey, unknown>;
    const value = instance[prop];
    if (typeof value === 'function') {
      return (value as Function).bind(instance);
    }
    return value;
  },
  set(_target, prop, value, _receiver) {
    const instance = getAppInstance() as unknown as Record<PropertyKey, unknown>;
    instance[prop] = value;
    return true;
  },
}) as App;
