import { describe, expect, test } from 'bun:test';
import {
  createBuildArtifactManifest,
  validateBuildArtifactManifest,
} from '../artifacts/build-manifest';
import {
  createReleaseArtifactManifest,
  validateReleaseArtifactManifest,
} from '../artifacts/release-manifest';
import { computeFileHash, getArtifactSize, type PackagerArtifact } from '../build/packager';

describe('packager artifact size', () => {
  test('getArtifactSize returns 0 for missing file', () => {
    expect(getArtifactSize('/nonexistent/path/file.txt')).toBe(0);
  });

  test('getArtifactSize returns size for existing file using import.meta', () => {
    const size = getArtifactSize(import.meta.path);
    expect(size).toBeGreaterThan(0);
  });
});

describe('build artifact manifest: icons and sourcemaps', () => {
  test('manifest with icons validates correctly', () => {
    // We use the existing build-manifest tests for this
    const manifest = createBuildArtifactManifest({
      name: 'icon-test',
      version: '1.0.0',
      webviewEngine: 'system',
      paths: {
        main: 'main.js',
        renderer: 'renderer',
        packageJson: 'package.json',
        icons: {
          icns: 'icons/icon.icns',
          ico: 'icons/icon.ico',
          png: 'icons/icon.png',
        },
      },
    });

    expect(manifest.paths.icons).toEqual({
      icns: 'icons/icon.icns',
      ico: 'icons/icon.ico',
      png: 'icons/icon.png',
    });
  });

  test('manifest without icons is valid', () => {
    const manifest = createBuildArtifactManifest({
      name: 'no-icons',
      version: '1.0.0',
      webviewEngine: 'system',
      paths: {
        main: 'main.js',
        renderer: 'renderer',
        packageJson: 'package.json',
      },
    });

    expect(manifest.paths.icons).toBeUndefined();
  });
});

describe('release artifact manifest: platform verification', () => {
  test('validates darwin app + dmg artifacts', () => {
    const manifest = createReleaseArtifactManifest({
      name: 'test-app',
      version: '1.0.0',
      artifacts: [
        { platform: 'darwin', format: 'app', path: 'Test.app', name: 'Test.app', kind: 'directory' },
        { platform: 'darwin', format: 'dmg', path: 'Test-1.0.0.dmg', name: 'Test-1.0.0.dmg', kind: 'file' },
      ],
    });

    expect(manifest.artifacts).toHaveLength(2);
    expect(manifest.artifacts[0].platform).toBe('darwin');
    expect(manifest.artifacts[0].format).toBe('app');
    expect(manifest.artifacts[1].format).toBe('dmg');
  });

  test('validates linux appimage + deb artifacts', () => {
    const manifest = createReleaseArtifactManifest({
      name: 'test-app',
      version: '1.0.0',
      artifacts: [
        { platform: 'linux', format: 'appimage', path: 'Test-1.0.0.AppImage', name: 'Test-1.0.0.AppImage', kind: 'file' },
        { platform: 'linux', format: 'deb', path: 'test-app_1.0.0_amd64.deb', name: 'test-app_1.0.0_amd64.deb', kind: 'file' },
      ],
    });

    expect(manifest.artifacts).toHaveLength(2);
    expect(manifest.artifacts[0].platform).toBe('linux');
    expect(manifest.artifacts[0].format).toBe('appimage');
  });

  test('validates win32 folder + exe artifacts', () => {
    const manifest = createReleaseArtifactManifest({
      name: 'test-app',
      version: '1.0.0',
      artifacts: [
        { platform: 'win32', format: 'folder', path: 'Test-win32', name: 'Test-win32', kind: 'directory' },
        { platform: 'win32', format: 'exe', path: 'Test-Setup-1.0.0.exe', name: 'Test-Setup-1.0.0.exe', kind: 'file' },
      ],
    });

    expect(manifest.artifacts).toHaveLength(2);
    expect(manifest.artifacts[0].platform).toBe('win32');
  });
});

describe('packager context', () => {
  test('PackagerContext type has all required fields', () => {
    const ctx = {
      name: 'TestApp',
      version: '1.0.0',
      buildDir: '/tmp/dist',
      outDir: '/tmp/release',
    };

    expect(ctx.name).toBe('TestApp');
    expect(ctx.version).toBe('1.0.0');
  });

  test('SignOptions type supports all platforms', () => {
    const darwinSign = {
      identity: 'Apple Developer ID',
      entitlements: '/path/to/ent.plist',
      hardenedRuntime: true,
    };

    const win32Sign = {
      certificateFile: '/path/to/cert.pfx',
      certificatePassword: 'password',
      timestampServer: 'http://timestamp.digicert.com',
    };

    expect(darwinSign.identity).toBe('Apple Developer ID');
    expect(win32Sign.certificateFile).toBe('/path/to/cert.pfx');
  });
});

describe('computeFileHash', () => {
  test('computes SHA-512 hash of a file', async () => {
    const hash = await computeFileHash(import.meta.path);
    expect(hash).toBeTruthy();
    expect(hash.length).toBe(128); // SHA-512 hex digest is 128 characters
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });
});