import { describe, expect, test } from 'bun:test';
import { WebContents } from './browser-window';
import { WebContentsState } from './windows/state';
import { session } from './session';

describe('WebContents', () => {
  test('send() method exists on WebContents class', () => {
    const state = new WebContentsState('Test');
    const sess = session.defaultSession;
    const wc = new WebContents(1, sess, state);
    expect(typeof wc.send).toBe('function');
    expect(wc.send.length).toBe(1);
  });

  test('send() delegates to native.sendIpcMessage with windowId and serialized message', () => {
    const state = new WebContentsState('Test');
    const sess = session.defaultSession;
    const wc = new WebContents(42, sess, state);

    let capturedWindowId: number | undefined;
    let capturedMessage: string | undefined;

    const originalSend = require('./runtime').native.sendIpcMessage;
    require('./runtime').native.sendIpcMessage = (windowId: number, message: string) => {
      capturedWindowId = windowId;
      capturedMessage = message;
    };

    wc.send('test-channel', { foo: 'bar' }, 123);

    expect(capturedWindowId).toBe(42);
    expect(capturedMessage).toBeDefined();
    const parsed = JSON.parse(capturedMessage!);
    expect(parsed.channel).toBe('test-channel');
    expect(parsed.args).toEqual([{ foo: 'bar' }, 123]);

    require('./runtime').native.sendIpcMessage = originalSend;
  });

  test('send() with no args sends channel-only message', () => {
    const state = new WebContentsState('Test');
    const sess = session.defaultSession;
    const wc = new WebContents(1, sess, state);

    let capturedMessage: string | undefined;
    const originalSend = require('./runtime').native.sendIpcMessage;
    require('./runtime').native.sendIpcMessage = (_windowId: number, message: string) => {
      capturedMessage = message;
    };

    wc.send('ping');

    expect(capturedMessage).toBeDefined();
    const parsed = JSON.parse(capturedMessage!);
    expect(parsed.channel).toBe('ping');
    expect(parsed.args).toEqual([]);

    require('./runtime').native.sendIpcMessage = originalSend;
  });
});

describe('ipcRenderer.invoke empty args', () => {
  test('invoke with no extra arg sends empty object as params', () => {
    const { ipcRenderer } = require('./context-bridge');

    let invokedPayload: unknown = null;
    const mockBunlet = {
      invoke: (payload: unknown) => {
        invokedPayload = payload;
        return Promise.resolve({ result: 'ok' });
      },
    };

    const originalWindow = globalThis.window;
    (globalThis as unknown as Record<string, unknown>).window = {
      __bunlet: mockBunlet,
    };

    ipcRenderer.invoke('test-channel');

    expect(invokedPayload).toEqual({ method: 'test-channel', params: {} });

    (globalThis as unknown as Record<string, unknown>).window = originalWindow;
  });

  test('invoke with single arg passes it as params', () => {
    const { ipcRenderer } = require('./context-bridge');

    let invokedPayload: unknown = null;
    const mockBunlet = {
      invoke: (payload: unknown) => {
        invokedPayload = payload;
        return Promise.resolve({ result: 'ok' });
      },
    };

    const originalWindow = globalThis.window;
    (globalThis as unknown as Record<string, unknown>).window = {
      __bunlet: mockBunlet,
    };

    ipcRenderer.invoke('test-channel', { name: 'hello' });

    expect(invokedPayload).toEqual({ method: 'test-channel', params: { name: 'hello' } });

    (globalThis as unknown as Record<string, unknown>).window = originalWindow;
  });

  test('invoke with multiple args wraps them in array', () => {
    const { ipcRenderer } = require('./context-bridge');

    let invokedPayload: unknown = null;
    const mockBunlet = {
      invoke: (payload: unknown) => {
        invokedPayload = payload;
        return Promise.resolve({ result: 'ok' });
      },
    };

    const originalWindow = globalThis.window;
    (globalThis as unknown as Record<string, unknown>).window = {
      __bunlet: mockBunlet,
    };

    ipcRenderer.invoke('test-channel', 'arg1', 'arg2');

    expect(invokedPayload).toEqual({ method: 'test-channel', params: ['arg1', 'arg2'] });

    (globalThis as unknown as Record<string, unknown>).window = originalWindow;
  });
});