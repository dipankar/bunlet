/**
 * Auto-updater real-HTTP integration test.
 *
 * Spins up a local Bun.serve() server that hosts a synthetic update
 * manifest (`latest-<platform>.yml`) and a payload file. Drives the real
 * `AutoUpdater` end-to-end through `setFeedURL` → `checkForUpdates` →
 * `downloadUpdate`, then asserts the on-disk file matches the manifest
 * sha512. Stops short of `quitAndInstall` — that would attempt to
 * replace the running Bun runtime.
 *
 * Gated behind `BUNLET_UPDATER_E2E=1` so a normal `bun test` run stays
 * hermetic and fast.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ENABLED = process.env.BUNLET_UPDATER_E2E === '1';
const d = ENABLED ? describe : describe.skip;

const PAYLOAD_NAME = 'bunlet-fixture-1.5.0.tar.gz';
const NEW_VERSION = '1.5.0';
const OLD_VERSION = '1.0.0';

const PLATFORM_TO_MANIFEST: Record<string, string> = {
  darwin: 'latest-mac.yml',
  win32: 'latest-win.yml',
  linux: 'latest-linux.yml',
};

let server: import('bun').Server | undefined;
let baseUrl: string;
let payload: Uint8Array;
let payloadSha512: string;
let savedAppVersion: string | undefined;

function buildManifest(): string {
  return [
    `version: ${NEW_VERSION}`,
    `releaseDate: 2026-05-20T00:00:00.000Z`,
    `path: ${PAYLOAD_NAME}`,
    `sha512: ${payloadSha512}`,
    `files:`,
    `  - url: ${PAYLOAD_NAME}`,
    `    sha512: ${payloadSha512}`,
    `    size: ${payload.length}`,
  ].join('\n');
}

d('auto-updater integration', () => {
  beforeAll(async () => {
    payload = new TextEncoder().encode('this is a tiny test update payload; real updates would be ~MB');
    payloadSha512 = createHash('sha512').update(payload).digest('hex');

    savedAppVersion = process.env.BUNLET_APP_VERSION;
    process.env.BUNLET_APP_VERSION = OLD_VERSION;

    const manifestPath = PLATFORM_TO_MANIFEST[process.platform];
    if (!manifestPath) {
      throw new Error(`unsupported platform for fixture: ${process.platform}`);
    }
    const manifestBody = buildManifest();

    server = Bun.serve({
      port: 0,
      fetch(req: Request) {
        const url = new URL(req.url);
        if (url.pathname.endsWith(manifestPath)) {
          return new Response(manifestBody, { headers: { 'content-type': 'text/yaml' } });
        }
        if (url.pathname.endsWith(PAYLOAD_NAME)) {
          return new Response(payload, {
            headers: { 'content-length': String(payload.length), 'content-type': 'application/octet-stream' },
          });
        }
        return new Response('not found', { status: 404 });
      },
    });
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(async () => {
    if (server) {
      server.stop(true);
    }
    if (savedAppVersion === undefined) delete process.env.BUNLET_APP_VERSION;
    else process.env.BUNLET_APP_VERSION = savedAppVersion;

    const updateDir = path.join(os.tmpdir(), 'bunlet-updates');
    if (fs.existsSync(updateDir)) {
      try {
        fs.rmSync(updateDir, { recursive: true, force: true });
      } catch {}
    }
  });

  test('checkForUpdates finds the served manifest version', async () => {
    const { AutoUpdater } = await import('./auto-updater');
    const updater = new AutoUpdater();
    updater.autoDownload = false;
    updater.setFeedURL({ provider: 'generic', generic: { url: baseUrl } });

    const result = await updater.checkForUpdates();
    expect(result.updateInfo?.version).toBe(NEW_VERSION);
    expect(result.isAvailable).toBe(true);
  });

  test('downloadUpdate writes the payload locally with a matching sha512', async () => {
    const { AutoUpdater } = await import('./auto-updater');
    const updater = new AutoUpdater();
    updater.autoDownload = false;
    updater.setFeedURL({ provider: 'generic', generic: { url: baseUrl } });

    await updater.checkForUpdates();
    const [downloadedPath] = await updater.downloadUpdate();
    expect(downloadedPath.endsWith(PAYLOAD_NAME)).toBe(true);

    const onDisk = fs.readFileSync(downloadedPath);
    const hash = createHash('sha512').update(onDisk).digest('hex');
    expect(hash).toBe(payloadSha512);

    expect(onDisk.length).toBe(payload.length);
  });

  test('returns no-update for a server that has no newer version', async () => {
    process.env.BUNLET_APP_VERSION = NEW_VERSION;
    const { AutoUpdater } = await import('./auto-updater');
    const updater = new AutoUpdater();
    updater.autoDownload = false;
    updater.setFeedURL({ provider: 'generic', generic: { url: baseUrl } });

    const result = await updater.checkForUpdates();
    expect(result.isAvailable).toBe(false);

    process.env.BUNLET_APP_VERSION = OLD_VERSION;
  });
});
