import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  createBuildArtifactManifest,
  loadBuildArtifactManifest,
  validateBuildArtifactManifest,
  writeBuildArtifactManifest,
} from './build-manifest';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bunlet-build-manifest-'));
  tempDirs.push(dir);
  return dir;
}

describe('build artifact manifest', () => {
  test('writes and reloads build metadata', () => {
    const outDir = createTempDir();
    const manifest = createBuildArtifactManifest({
      name: 'test-app',
      version: '1.0.0',
      webviewEngine: 'system',
      paths: {
        main: 'main.js',
        renderer: 'renderer',
        packageJson: 'package.json',
      },
    });

    writeBuildArtifactManifest(outDir, manifest);

    expect(loadBuildArtifactManifest(outDir)).toEqual(manifest);
  });

  test('validates required artifacts', () => {
    const outDir = createTempDir();
    fs.writeFileSync(path.join(outDir, 'main.js'), 'export {};');
    fs.mkdirSync(path.join(outDir, 'renderer'));
    fs.writeFileSync(path.join(outDir, 'package.json'), '{}');

    const manifest = createBuildArtifactManifest({
      name: 'test-app',
      version: '1.0.0',
      webviewEngine: 'cef',
      paths: {
        main: 'main.js',
        renderer: 'renderer',
        packageJson: 'package.json',
      },
    });

    expect(validateBuildArtifactManifest(outDir, manifest)).toEqual([]);
  });
});
