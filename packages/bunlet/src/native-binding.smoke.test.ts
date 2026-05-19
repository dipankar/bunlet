/**
 * Native binding smoke test
 *
 * Confirms the real Rust native addon loads on the host platform and that
 * critical entry points exist and are callable without panic. Unlike the
 * other tests in this directory, this file does NOT mock `./runtime`.
 *
 * Skipped on Linux when no DISPLAY/WAYLAND_DISPLAY is available — the
 * native module's static init touches GTK on Linux and will abort otherwise.
 * In CI under xvfb-run, DISPLAY is set so the test runs.
 */

import { describe, expect, test } from 'bun:test';

const SKIP =
  process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;

const d = SKIP ? describe.skip : describe;

d('native binding smoke', () => {
  test('loads the platform-specific .node file', async () => {
    const mod = await import('@bunlet/native');
    expect(mod).toBeTruthy();
    expect(typeof mod).toBe('object');
  });

  test('exposes the core entry points used by app/BrowserWindow', async () => {
    const native = (await import('@bunlet/native')) as Record<string, unknown>;
    const expected = ['initApp', 'createWindow', 'closeWindow', 'runEventLoop'];
    const missing = expected.filter((name) => typeof native[name] !== 'function');
    expect(missing).toEqual([]);
  });

  test('binding filename matches host platform/arch', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.resolve(import.meta.dir, '..', '..', 'bunlet-native');
    const files = fs.readdirSync(dir).filter((f) => /^bunlet-native\..*\.node$/.test(f));
    expect(files.length).toBeGreaterThan(0);

    const plat = process.platform;
    const arch = process.arch;
    const expectedFragment =
      plat === 'darwin' ? `darwin-${arch}` :
      plat === 'linux' ? `linux-${arch}-gnu` :
      plat === 'win32' ? `win32-${arch}-msvc` :
      '';
    expect(files.some((f) => f.includes(expectedFragment))).toBe(true);
  });
});
