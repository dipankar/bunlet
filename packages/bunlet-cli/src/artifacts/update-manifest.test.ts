import { describe, expect, test } from 'bun:test';
import {
  createUpdateManifest,
  generateYamlManifest,
  type UpdateManifest,
} from '../artifacts/update-manifest';

describe('update manifest', () => {
  test('createUpdateManifest creates correct structure', () => {
    const manifest = createUpdateManifest({
      version: '1.2.3',
      releaseNotes: 'Bug fixes and improvements',
      files: [
        { url: 'app-1.2.3.dmg', sha512: 'abc123', size: 10000000 },
      ],
      mainFile: { url: 'app-1.2.3.dmg', sha512: 'abc123', size: 10000000 },
    });

    expect(manifest.version).toBe('1.2.3');
    expect(manifest.path).toBe('app-1.2.3.dmg');
    expect(manifest.sha512).toBe('abc123');
    expect(manifest.files).toHaveLength(1);
    expect(manifest.releaseDate).toBeTruthy();
  });

  test('generateYamlManifest produces valid YAML', () => {
    const manifest: UpdateManifest = {
      version: '2.0.0',
      releaseDate: '2024-01-15T10:00:00Z',
      releaseNotes: 'Major update',
      files: [
        {
          url: 'app-2.0.0.dmg',
          sha512: 'deadbeef',
          size: 50000000,
          blockMapSize: 1024,
          blockMapSha512: 'cafebabe',
        },
      ],
      path: 'app-2.0.0.dmg',
      sha512: 'deadbeef',
    };

    const yaml = generateYamlManifest(manifest);

    expect(yaml).toContain('version: 2.0.0');
    expect(yaml).toContain('releaseDate: \'2024-01-15T10:00:00Z\'');
    expect(yaml).toContain('releaseNotes: |');
    expect(yaml).toContain('Major update');
    expect(yaml).toContain('url: app-2.0.0.dmg');
    expect(yaml).toContain('sha512: deadbeef');
    expect(yaml).toContain('size: 50000000');
    expect(yaml).toContain('blockMapSize: 1024');
    expect(yaml).toContain('blockMapSha512: cafebabe');
    expect(yaml).toContain('path: app-2.0.0.dmg');
  });

  test('generateYamlManifest works without blockmap or releaseNotes', () => {
    const manifest: UpdateManifest = {
      version: '1.0.0',
      releaseDate: '2024-01-01T00:00:00Z',
      files: [
        { url: 'app.exe', sha512: 'abcd', size: 1000 },
      ],
      path: 'app.exe',
      sha512: 'abcd',
    };

    const yaml = generateYamlManifest(manifest);

    expect(yaml).toContain('version: 1.0.0');
    expect(yaml).not.toContain('releaseNotes');
    expect(yaml).not.toContain('blockMapSize');
  });

  test('multi-platform manifest groups files correctly', () => {
    const macFiles = [
      { url: 'app-1.0.0.dmg', sha512: 'mac-hash', size: 30000000 },
      { url: 'app-1.0.0-mac.zip', sha512: 'mac-zip-hash', size: 35000000 },
    ];

    const manifest = createUpdateManifest({
      version: '1.0.0',
      files: macFiles,
      mainFile: macFiles[0],
    });

    expect(manifest.files).toHaveLength(2);
    expect(manifest.path).toBe('app-1.0.0.dmg');
  });
});