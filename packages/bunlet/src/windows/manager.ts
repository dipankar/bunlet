import { native } from '../runtime';
import type { BrowserWindow } from '../browser-window';

/**
 * Central registry and lookup service for open windows.
 *
 * This keeps ownership of process-wide window state out of BrowserWindow
 * itself so later lifecycle and event synchronization work can attach here.
 */
class WindowManager {
  private readonly windows = new Map<number, BrowserWindow>();

  /**
   * Temporary compatibility surface while older code still imports
   * `windowRegistry` directly.
   */
  get registry(): ReadonlyMap<number, BrowserWindow> {
    return this.windows;
  }

  register(window: BrowserWindow): void {
    this.windows.set(window.id, window);
  }

  unregister(windowId: number): void {
    this.windows.delete(windowId);
  }

  get(windowId: number): BrowserWindow | null {
    return this.windows.get(windowId) ?? null;
  }

  getAll(): BrowserWindow[] {
    return Array.from(this.windows.values());
  }

  getFocused(): BrowserWindow | null {
    if (typeof native.getFocusedWindowId !== 'function') {
      return null;
    }

    const focusedWindowId = native.getFocusedWindowId();
    if (typeof focusedWindowId !== 'number') {
      return null;
    }

    return this.get(focusedWindowId);
  }
}

export const windowManager = new WindowManager();
export const windowRegistry = windowManager.registry;
