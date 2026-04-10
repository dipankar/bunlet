import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadBunletConfig, loadPackageJson } from './index';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createTempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bunlet-cli-config-'));
  tempDirs.push(dir);
  return dir;
}

describe('CLI config loader', () => {
  test('loads bunlet.config.json when present', async () => {
    const root = createTempProject();
    fs.writeFileSync(
      path.join(root, 'bunlet.config.json'),
      JSON.stringify({
        main: './src/main.ts',
        webview: { engine: 'cef' },
        build: { outDir: './build' },
      })
    );

    const config = await loadBunletConfig(root);

    expect(config.main).toBe('./src/main.ts');
    expect(config.webview?.engine).toBe('cef');
    expect(config.build?.outDir).toBe('./build');
  });

  test('returns empty objects when project files are missing', async () => {
    const root = createTempProject();

    expect(await loadBunletConfig(root)).toEqual({});
    expect(await loadPackageJson(root)).toEqual({});
  });

  test('loads package metadata from package.json', async () => {
    const root = createTempProject();
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        version: '1.2.3',
        description: 'fixture app',
        author: 'fixture author',
      })
    );

    const packageJson = await loadPackageJson(root);

    expect(packageJson.name).toBe('test-app');
    expect(packageJson.version).toBe('1.2.3');
    expect(packageJson.description).toBe('fixture app');
    expect(packageJson.author).toBe('fixture author');
  });
});
