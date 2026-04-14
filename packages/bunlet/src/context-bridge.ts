/**
 * Context Bridge API for bunlet
 *
 * Provides a secure way to expose APIs from preload scripts to the renderer.
 * This mimics Electron's contextBridge API for compatibility.
 *
 * @example
 * ```typescript
 * // In preload.ts
 * import { contextBridge, ipcRenderer } from 'bunlet';
 *
 * contextBridge.exposeInMainWorld('api', {
 *   doThing: () => ipcRenderer.invoke('do-thing'),
 *   getData: (id: string) => ipcRenderer.invoke('get-data', { id }),
 * });
 *
 * // In renderer (browser)
 * window.api.doThing();
 * window.api.getData('123');
 * ```
 */

/**
 * Context bridge API for exposing objects to the renderer
 */
export const contextBridge = {
  /**
   * Expose an API object to the renderer's main world
   *
   * @param apiKey - The key to expose the API under on the window object
   * @param api - The API object to expose
   *
   * @remarks
   * The exposed API is deeply cloned to prevent prototype pollution.
   * Functions are wrapped to maintain proper binding.
   */
  exposeInMainWorld(apiKey: string, api: Record<string, unknown>): void {
    if (typeof window === 'undefined') {
      throw new Error('contextBridge.exposeInMainWorld can only be called in a browser context');
    }

    // Check if contextBridge support is available
    const bridge = (window as unknown as { __bunlet_contextBridge?: ContextBridgeInternal }).__bunlet_contextBridge;

    if (bridge && typeof bridge.exposeInMainWorld === 'function') {
      // Use native context bridge if available
      bridge.exposeInMainWorld(apiKey, api);
    } else {
      // Fallback: directly expose on window (less secure but functional)
      // Deep clone the API to prevent prototype pollution
      const exposedApi = deepCloneWithFunctions(api);
      (window as unknown as Record<string, unknown>)[apiKey] = exposedApi;
    }
  },
};

/**
 * Internal context bridge interface
 */
interface ContextBridgeInternal {
  exposeInMainWorld(apiKey: string, api: Record<string, unknown>): void;
}

/**
 * Deep clone an object while preserving functions
 */
function deepCloneWithFunctions(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (typeof obj === 'function') {
    // Wrap function to prevent access to internal scope
    return function wrappedFunction(...args: unknown[]) {
      return (obj as (...args: unknown[]) => unknown).apply(null, args);
    };
  }

  if (Array.isArray(obj)) {
    return obj.map(deepCloneWithFunctions);
  }

  const cloned: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === 'function') {
      // Wrap functions
      cloned[key] = function wrappedFunction(...args: unknown[]) {
        return (value as (...args: unknown[]) => unknown).apply(null, args);
      };
    } else {
      cloned[key] = deepCloneWithFunctions(value);
    }
  }

  return cloned;
}

/**
 * IPC Renderer API for use in preload scripts
 * Provides a way to communicate with the main process
 */
export const ipcRenderer = {
  /**
   * Invoke a handler in the main process and get the result
   * @param channel - The channel name
   * @param args - Arguments to pass to the handler
   */
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
    if (typeof window === 'undefined') {
      throw new Error('ipcRenderer can only be used in a browser context');
    }

    const bunlet = (window as unknown as { __bunlet?: BunletIPC }).__bunlet;
    if (!bunlet) {
      throw new Error('bunlet IPC not available');
    }

    return bunlet.invoke({ method: channel, params: args.length === 0 ? {} : args.length === 1 ? args[0] : args }) as Promise<T>;
  },

  /**
   * Send a message to the main process (fire and forget)
   * @param channel - The channel name
   * @param args - Arguments to send
   */
  send(channel: string, ...args: unknown[]): void {
    if (typeof window === 'undefined') {
      throw new Error('ipcRenderer can only be used in a browser context');
    }

    const bunlet = (window as unknown as { __bunlet?: BunletIPC }).__bunlet;
    if (!bunlet) {
      throw new Error('bunlet IPC not available');
    }

    bunlet.send(channel, ...args);
  },

  /**
   * Listen for messages from the main process
   * @param channel - The channel name
   * @param listener - The listener function
   */
  on(channel: string, listener: (...args: unknown[]) => void): void {
    if (typeof window === 'undefined') {
      throw new Error('ipcRenderer can only be used in a browser context');
    }

    const bunlet = (window as unknown as { __bunlet?: BunletIPC }).__bunlet;
    if (!bunlet) {
      throw new Error('bunlet IPC not available');
    }

    bunlet.on(channel, listener);
  },

  /**
   * Remove a listener
   * @param channel - The channel name
   * @param listener - The listener function to remove
   */
  off(channel: string, listener: (...args: unknown[]) => void): void {
    if (typeof window === 'undefined') {
      throw new Error('ipcRenderer can only be used in a browser context');
    }

    const bunlet = (window as unknown as { __bunlet?: BunletIPC }).__bunlet;
    if (!bunlet) {
      throw new Error('bunlet IPC not available');
    }

    bunlet.off(channel, listener);
  },
};

/**
 * Internal bunlet IPC interface
 */
interface BunletIPC {
  invoke(payload: { method: string; params?: unknown }): Promise<unknown>;
  send(channel: string, ...args: unknown[]): void;
  on(channel: string, listener: (...args: unknown[]) => void): void;
  off(channel: string, listener: (...args: unknown[]) => void): void;
}
