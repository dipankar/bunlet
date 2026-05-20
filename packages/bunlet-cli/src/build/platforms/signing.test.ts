/**
 * Unit tests for the signing/notarize wrapper error contracts. These
 * don't perform real signing — they verify that the wrappers fail with a
 * clean message when credentials are missing or inputs are wrong, and
 * succeed only when given everything they need.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { notarizeDarwinApp } from './darwin';
import { signAppImage } from './linux';

let tmp: string;
let savedEnv: Record<string, string | undefined>;

describe('notarizeDarwinApp', () => {
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bunlet-notarize-'));
    savedEnv = {
      APPLE_ID: process.env.APPLE_ID,
      APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
      APPLE_APP_SPECIFIC_PASSWORD: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    };
    delete process.env.APPLE_ID;
    delete process.env.APPLE_TEAM_ID;
    delete process.env.APPLE_APP_SPECIFIC_PASSWORD;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {}
  });

  test('rejects when all credentials are missing', async () => {
    const fake = path.join(tmp, 'fake.dmg');
    fs.writeFileSync(fake, 'x');
    await expect(notarizeDarwinApp(fake)).rejects.toThrow(/APPLE_ID/);
  });

  test('rejects when artifact does not exist', async () => {
    process.env.APPLE_ID = 'a@b.c';
    process.env.APPLE_TEAM_ID = 'TEAMID';
    process.env.APPLE_APP_SPECIFIC_PASSWORD = 'abcd-efgh-ijkl-mnop';
    await expect(notarizeDarwinApp('/no/such/path.dmg')).rejects.toThrow(/does not exist/);
  });

  test('error message lists each missing credential by name', async () => {
    process.env.APPLE_ID = 'a@b.c';
    const fake = path.join(tmp, 'fake.dmg');
    fs.writeFileSync(fake, 'x');
    await expect(notarizeDarwinApp(fake)).rejects.toThrow(/APPLE_TEAM_ID.*APPLE_APP_SPECIFIC_PASSWORD/);
  });
});

describe('signAppImage', () => {
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bunlet-gpg-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {}
  });

  test('rejects when gpgKeyId is empty', () => {
    const fake = path.join(tmp, 'app.AppImage');
    fs.writeFileSync(fake, 'x');
    expect(() => signAppImage(fake, { gpgKeyId: '' })).toThrow(/gpgKeyId is required/);
  });

  test('rejects when file is missing', () => {
    expect(() => signAppImage('/no/such/path.AppImage', { gpgKeyId: 'ABC' })).toThrow(/not found/);
  });
});
