/**
 * CLI round-trip test
 *
 * Exercises `create` + `build` against the real CLI command entry points
 * (not via spawning the binary, to avoid shell quoting issues on Windows).
 * Skipped unless BUNLET_CLI_ROUNDTRIP=1 — building requires `@bunlet/native`
 * to be present and the bundler to resolve workspace deps, which only holds
 * inside the monorepo after `bun run setup`.
 *
 * The fixture app is scaffolded inside the monorepo (under tmp-roundtrip/)
 * so Bun's node_modules resolution walks up and finds @bunlet/core via the
 * workspace links — no `bun install` needed.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const ENABLED = process.env.BUNLET_CLI_ROUNDTRIP === '1';
const d = ENABLED ? describe : describe.skip;

const MONOREPO_ROOT = path.resolve(import.meta.dir, '..', '..', '..');
const APP_NAME = 'bunlet-roundtrip-fixture';
let tmpRoot: string;
let prevCwd: string;
let appDir: string;

d('cli roundtrip', () => {
  beforeAll(async () => {
    prevCwd = process.cwd();
    tmpRoot = fs.mkdtempSync(path.join(MONOREPO_ROOT, 'tmp-roundtrip-'));
    process.chdir(tmpRoot);
    appDir = path.join(tmpRoot, APP_NAME);

    fs.mkdirSync(path.join(tmpRoot, 'node_modules', '@bunlet'), { recursive: true });
    const linkSpecs: Array<{ target: string; link: string }> = [
      { target: path.join(MONOREPO_ROOT, 'packages', 'bunlet'),        link: path.join(tmpRoot, 'node_modules', '@bunlet', 'core') },
      { target: path.join(MONOREPO_ROOT, 'packages', 'bunlet-native'), link: path.join(tmpRoot, 'node_modules', '@bunlet', 'native') },
      { target: path.join(MONOREPO_ROOT, 'packages', 'bunlet-cef'),    link: path.join(tmpRoot, 'node_modules', '@bunlet', 'cef') },
    ];
    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    for (const { target, link } of linkSpecs) {
      if (fs.existsSync(target) && !fs.existsSync(link)) {
        fs.symlinkSync(target, link, linkType);
      }
    }
  });

  afterAll(async () => {
    process.chdir(prevCwd);
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  });

  test('create scaffolds an app with main + renderer + package.json', async () => {
    const { createCommand } = await import('./commands/create');
    await createCommand(APP_NAME, {
      template: 'default',
      webview: 'system',
      typescript: true,
      git: false,
      install: false,
    });

    expect(fs.existsSync(path.join(appDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(appDir, 'main.ts'))).toBe(true);
    expect(fs.existsSync(path.join(appDir, 'renderer', 'index.html'))).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf-8'));
    expect(pkg.name).toBe(APP_NAME);
    expect(pkg.scripts?.dev).toBeTruthy();
    expect(pkg.scripts?.build).toBeTruthy();
  });

  test('build produces bundled main.js and a package.json under dist/', async () => {
    process.chdir(appDir);
    const { buildCommand } = await import('./commands/build');
    await buildCommand({
      target: 'bun',
      outdir: 'dist',
      minify: false,
      sourcemap: false,
    });

    expect(fs.existsSync(path.join(appDir, 'dist', 'main.js'))).toBe(true);
    expect(fs.existsSync(path.join(appDir, 'dist', 'package.json'))).toBe(true);

    const distPkg = JSON.parse(
      fs.readFileSync(path.join(appDir, 'dist', 'package.json'), 'utf-8')
    );
    expect(distPkg.main).toBe('main.js');
    expect(distPkg.name).toBe(APP_NAME);
  });

  test('build rejects unknown webview engine cleanly', async () => {
    process.chdir(appDir);
    const { buildCommand } = await import('./commands/build');
    await expect(
      buildCommand({
        target: 'bun',
        outdir: 'dist-bad',
        minify: false,
        sourcemap: false,
        webview: 'firefox' as unknown as string,
      })
    ).rejects.toThrow(/Unsupported webview engine/);
  });
});
