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

  test('includes sourcemaps in manifest and validates them', () => {
    const outDir = createTempDir();
    fs.writeFileSync(path.join(outDir, 'main.js'), 'export {};');
    fs.mkdirSync(path.join(outDir, 'renderer'));
    fs.writeFileSync(path.join(outDir, 'package.json'), '{}');
    fs.writeFileSync(path.join(outDir, 'main.js.map'), '{"version":3}');

    const manifest = createBuildArtifactManifest({
      name: 'test-app',
      version: '1.0.0',
      webviewEngine: 'system',
      paths: {
        main: 'main.js',
        renderer: 'renderer',
        packageJson: 'package.json',
      },
      sourcemaps: ['main.js.map'],
    });

    expect(manifest.sourcemaps).toEqual(['main.js.map']);
    expect(validateBuildArtifactManifest(outDir, manifest)).toEqual([]);
  });

  test('reports missing source map artifacts', () => {
    const outDir = createTempDir();
    fs.writeFileSync(path.join(outDir, 'main.js'), 'export {};');
    fs.mkdirSync(path.join(outDir, 'renderer'));
    fs.writeFileSync(path.join(outDir, 'package.json'), '{}');

    const manifest = createBuildArtifactManifest({
      name: 'test-app',
      version: '1.0.0',
      webviewEngine: 'system',
      paths: {
        main: 'main.js',
        renderer: 'renderer',
        packageJson: 'package.json',
      },
      sourcemaps: ['main.js.map', 'preload.js.map'],
    });

    const errors = validateBuildArtifactManifest(outDir, manifest);
    expect(errors).toEqual([
      'Missing source map artifact: main.js.map',
      'Missing source map artifact: preload.js.map',
    ]);
  });

  test('manifest without sourcemaps is valid', () => {
    const outDir = createTempDir();
    fs.writeFileSync(path.join(outDir, 'main.js'), 'export {};');
    fs.mkdirSync(path.join(outDir, 'renderer'));
    fs.writeFileSync(path.join(outDir, 'package.json'), '{}');

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

    expect(manifest.sourcemaps).toBeUndefined();
    expect(validateBuildArtifactManifest(outDir, manifest)).toEqual([]);
  });

  test('validates CEF runtime assets', () => {
    const outDir = createTempDir();
    fs.writeFileSync(path.join(outDir, 'main.js'), 'export {};');
    fs.mkdirSync(path.join(outDir, 'renderer'));
    fs.writeFileSync(path.join(outDir, 'package.json'), '{}');

    const cefDir = path.join(outDir, 'node_modules', '@bunlet', 'cef');
    fs.mkdirSync(cefDir, { recursive: true });
    fs.writeFileSync(path.join(cefDir, 'bunlet-cef-helper'), '');
    fs.mkdirSync(path.join(cefDir, 'cef-binaries'));
    fs.writeFileSync(path.join(cefDir, 'bunlet-cef.darwin-arm64.node'), '');

    const manifest = createBuildArtifactManifest({
      name: 'test-app',
      version: '1.0.0',
      webviewEngine: 'cef',
      paths: {
        main: 'main.js',
        renderer: 'renderer',
        packageJson: 'package.json',
        cefRuntime: 'node_modules/@bunlet/cef',
        cefRuntimeAssets: {
          helperBinary: 'node_modules/@bunlet/cef/bunlet-cef-helper',
          cefBinariesDir: 'node_modules/@bunlet/cef/cef-binaries',
          nodeBinary: 'node_modules/@bunlet/cef/bunlet-cef.darwin-arm64.node',
        },
      },
    });

    expect(validateBuildArtifactManifest(outDir, manifest)).toEqual([]);
  });

  test('reports missing CEF runtime assets', () => {
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
        cefRuntime: 'node_modules/@bunlet/cef',
        cefRuntimeAssets: {
          helperBinary: 'node_modules/@bunlet/cef/bunlet-cef-helper',
          cefBinariesDir: 'node_modules/@bunlet/cef/cef-binaries',
          nodeBinary: 'node_modules/@bunlet/cef/bunlet-cef.darwin-arm64.node',
        },
      },
    });

    const errors = validateBuildArtifactManifest(outDir, manifest);
    expect(errors).toContain('Missing CEF runtime artifact: node_modules/@bunlet/cef');
    expect(errors).toContain('Missing CEF helper binary: node_modules/@bunlet/cef/bunlet-cef-helper');
    expect(errors).toContain('Missing CEF binaries directory: node_modules/@bunlet/cef/cef-binaries');
    expect(errors).toContain('Missing CEF node binary: node_modules/@bunlet/cef/bunlet-cef.darwin-arm64.node');
  });

  test('manifest without CEF runtime assets is valid for system webview', () => {
    const outDir = createTempDir();
    fs.writeFileSync(path.join(outDir, 'main.js'), 'export {};');
    fs.mkdirSync(path.join(outDir, 'renderer'));
    fs.writeFileSync(path.join(outDir, 'package.json'), '{}');

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

    expect(manifest.paths.cefRuntime).toBeUndefined();
    expect(manifest.paths.cefRuntimeAssets).toBeUndefined();
    expect(validateBuildArtifactManifest(outDir, manifest)).toEqual([]);
  });
});
