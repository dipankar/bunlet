import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  createReleaseArtifactManifest,
  loadReleaseArtifactManifest,
  validateReleaseArtifactManifest,
  writeReleaseArtifactManifest,
} from './release-manifest';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bunlet-release-manifest-'));
  tempDirs.push(dir);
  return dir;
}

describe('release artifact manifest', () => {
  test('writes and reloads release metadata', () => {
    const outDir = createTempDir();
    const manifest = createReleaseArtifactManifest({
      name: 'test-app',
      version: '1.0.0',
      artifacts: [],
    });

    writeReleaseArtifactManifest(outDir, manifest);

    expect(loadReleaseArtifactManifest(outDir)).toEqual(manifest);
  });

  test('validates file and directory artifacts', () => {
    const outDir = createTempDir();
    fs.writeFileSync(path.join(outDir, 'test.dmg'), 'content');
    fs.mkdirSync(path.join(outDir, 'Test.app'));

    const manifest = createReleaseArtifactManifest({
      name: 'test-app',
      version: '1.0.0',
      artifacts: [
        {
          platform: 'darwin',
          format: 'dmg',
          path: 'test.dmg',
          name: 'test.dmg',
          kind: 'file',
        },
        {
          platform: 'darwin',
          format: 'app',
          path: 'Test.app',
          name: 'Test.app',
          kind: 'directory',
        },
      ],
    });

    expect(validateReleaseArtifactManifest(outDir, manifest)).toEqual([]);
  });
});
