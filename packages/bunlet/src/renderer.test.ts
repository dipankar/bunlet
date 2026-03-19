import { afterEach, describe, expect, test } from 'bun:test';
import { contextBridge, ipcRenderer } from './renderer';

type TestBridge = {
  invoke: (payload: { method: string; params?: unknown }) => Promise<unknown>;
  send: (channel: string, ...args: unknown[]) => void;
  on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void;
  off: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void;
};

describe('renderer bridge', () => {
  afterEach(() => {
    delete (globalThis as { __bunlet?: TestBridge }).__bunlet;
  });

  test('ipcRenderer.invoke forwards method and params', async () => {
    let payload: { method: string; params?: unknown } | null = null;

    (globalThis as { __bunlet: TestBridge }).__bunlet = {
      invoke: async (input) => {
        payload = input;
        return { ok: true };
      },
      send: () => {},
      on: () => {},
      off: () => {},
    };

    const result = await ipcRenderer.invoke<{ ok: boolean }>('ping', { x: 1 });
    expect(payload).toEqual({ method: 'ping', params: { x: 1 } });
    expect(result.ok).toBe(true);
  });

  test('contextBridge exposes api on global object', () => {
    contextBridge.exposeInMainWorld('bunletRendererApi', { version: '1.0.0' });
    expect(
      (globalThis as { bunletRendererApi?: { version: string } }).bunletRendererApi?.version
    ).toBe('1.0.0');
  });
});
