/**
 * Global Shortcuts API for Bunlet
 *
 * Provides cross-platform global keyboard shortcuts.
 */

import { assertRuntimeCapability } from './runtime/capabilities';
import { native } from './runtime';

/** Map of accelerator -> callback */
const callbacks = new Map<string, () => void>();

/** Map of callback ID -> accelerator */
const idToAccelerator = new Map<number, string>();

/** Whether the system has been initialized */
let initialized = false;

/**
 * Initialize the global shortcuts system
 */
function ensureInitialized(): void {
  if (initialized) return;
  assertRuntimeCapability('globalShortcuts', 'globalShortcut');
  initialized = true;

  // Initialize native shortcuts
  native.initGlobalShortcuts();

  // Set up callback handler
  native.setShortcutCallback((id: number) => {
    const accelerator = idToAccelerator.get(id);
    if (accelerator) {
      const callback = callbacks.get(accelerator);
      if (callback) {
        try {
          callback();
        } catch (error) {
          console.error(`Error in shortcut handler for ${accelerator}:`, error);
        }
      }
    }
  });
}

/**
 * Global shortcut module
 */
export const globalShortcut = {
  /**
   * Register a global keyboard shortcut
   * @param accelerator - Keyboard shortcut string (e.g., "Ctrl+Shift+A")
   * @param callback - Function to call when the shortcut is pressed
   * @returns true if registration was successful
   */
  register(accelerator: string, callback: () => void): boolean {
    ensureInitialized();

    // Check if already registered
    if (callbacks.has(accelerator)) {
      return false;
    }

    const id = native.registerShortcut(accelerator);
    if (id === 0) {
      return false;
    }

    callbacks.set(accelerator, callback);
    idToAccelerator.set(id, accelerator);
    return true;
  },

  /**
   * Register multiple shortcuts with the same callback
   * @param accelerators - Array of keyboard shortcut strings
   * @param callback - Function to call when any shortcut is pressed
   */
  registerAll(accelerators: string[], callback: () => void): void {
    for (const accelerator of accelerators) {
      this.register(accelerator, callback);
    }
  },

  /**
   * Unregister a global keyboard shortcut
   * @param accelerator - Keyboard shortcut string to unregister
   */
  unregister(accelerator: string): void {
    if (!callbacks.has(accelerator)) {
      return;
    }

    native.unregisterShortcut(accelerator);
    callbacks.delete(accelerator);

    // Remove from ID map
    for (const [id, acc] of idToAccelerator) {
      if (acc === accelerator) {
        idToAccelerator.delete(id);
        break;
      }
    }
  },

  /**
   * Unregister all global keyboard shortcuts
   */
  unregisterAll(): void {
    native.unregisterAllShortcuts();
    callbacks.clear();
    idToAccelerator.clear();
  },

  /**
   * Check if a shortcut is registered
   * @param accelerator - Keyboard shortcut string
   * @returns true if the shortcut is registered
   */
  isRegistered(accelerator: string): boolean {
    return callbacks.has(accelerator) && native.isShortcutRegistered(accelerator);
  },
};
