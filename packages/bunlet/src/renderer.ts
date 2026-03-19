/**
 * Renderer/preload helpers.
 */

type BunletBridge = {
  invoke: (payload: { id?: string | number; method: string; params?: unknown }) => Promise<unknown>;
  send: (channel: string, ...args: unknown[]) => void;
  on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void;
  off: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void;
};

function getBridge(): BunletBridge {
  const bridge = (globalThis as { __bunlet?: BunletBridge }).__bunlet;
  if (!bridge) {
    throw new Error('Bunlet renderer bridge is unavailable. Ensure code runs inside a Bunlet window.');
  }
  return bridge;
}

export interface IpcRenderer {
  invoke: <T = unknown>(channel: string, args?: unknown) => Promise<T>;
  send: (channel: string, ...args: unknown[]) => void;
  on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void;
  off: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void;
}

export const ipcRenderer: IpcRenderer = {
  async invoke<T = unknown>(channel: string, args?: unknown): Promise<T> {
    return (await getBridge().invoke({ method: channel, params: args })) as T;
  },

  send(channel: string, ...args: unknown[]): void {
    getBridge().send(channel, ...args);
  },

  on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void {
    getBridge().on(channel, listener);
  },

  off(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void {
    getBridge().off(channel, listener);
  },
};

export interface ContextBridge {
  exposeInMainWorld: <T extends Record<string, unknown>>(key: string, api: T) => void;
}

export const contextBridge: ContextBridge = {
  exposeInMainWorld<T extends Record<string, unknown>>(key: string, api: T): void {
    Object.defineProperty(globalThis, key, {
      configurable: false,
      enumerable: true,
      writable: false,
      value: api,
    });
  },
};
