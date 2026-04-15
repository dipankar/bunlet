/**
 * bunlet build command
 *
 * Builds the application for production.
 */

import * as path from 'path';
import * as fs from 'fs';
import {
  bundleMain,
  bundlePreload,
  copyRenderer,
  copyNativeAddon,
  copyCefAddon,
  generatePackageJson,
} from '../build/bundler';
import {
  createBuildArtifactManifest,
  writeBuildArtifactManifest,
  type BuildArtifactPaths,
} from '../artifacts/build-manifest';
import { loadBunletConfig } from '../config';

export type SourceMapOption = boolean | 'inline' | 'external';

export interface BuildOptions {
  target: string;
  outdir: string;
  minify: boolean;
  sourcemap: SourceMapOption;
  webview?: string;
}

export function parseSourcemapOption(value: string | boolean | undefined): SourceMapOption {
  if (value === undefined || value === false) return false;
  if (value === true) return 'external';
  if (value === 'inline') return 'inline';
  if (value === 'external') return 'external';
  return 'external';
}

/**
 * Build the application
 */
export async function buildCommand(options: BuildOptions): Promise<void> {
  const sourcemap = parseSourcemapOption(options.sourcemap);
  const root = process.cwd();
  const config = await loadBunletConfig(root);
  const webviewEngine = options.webview || config.webview?.engine || 'system';
  if (webviewEngine !== 'system' && webviewEngine !== 'cef') {
    throw new Error(`Unsupported webview engine: ${webviewEngine}`);
  }

  const outDir = path.resolve(root, options.outdir || config.build?.outDir || 'dist');
  const mainEntry = config.main || 'main.ts';
  const rendererDir = config.renderer?.root || 'renderer';

  console.log('\n  Bunlet Build\n');
  console.log(`  Root: ${root}`);
  console.log(`  Output: ${outDir}`);
  console.log(`  Main: ${mainEntry}`);
  console.log(`  Renderer: ${rendererDir}`);
  console.log(`  WebView: ${webviewEngine}`);
  console.log(`  Minify: ${options.minify}`);
  console.log(`  Source maps: ${sourcemap === false ? 'disabled' : sourcemap}`);
  console.log(`  Target: ${options.target}\n`);

  // Clean output directory
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  const errors: string[] = [];
  const startTime = Date.now();
  const sourcemapFiles: string[] = [];

  // 1. Bundle main process
  console.log('  [1/6] Bundling main process...');
  const mainResult = await bundleMain(root, mainEntry, outDir, {
    minify: options.minify,
    sourcemap,
  });

  if (!mainResult.success) {
    console.error('  ✗ Failed to bundle main process:');
    mainResult.errors.forEach((e) => console.error(`    ${e}`));
    process.exit(1);
  }
  collectSourcemapFiles(outDir, mainResult.outputs, sourcemapFiles);
  console.log('  ✓ Main process bundled');

  // 2. Bundle preload (if exists)
  console.log('  [2/6] Bundling preload script...');
  const preloadResult = await bundlePreload(root, outDir, {
    minify: options.minify,
    sourcemap,
  });

  if (preloadResult === null) {
    console.log('  - No preload script found (skipped)');
  } else if (!preloadResult.success) {
    console.error('  ✗ Failed to bundle preload:');
    preloadResult.errors.forEach((e) => console.error(`    ${e}`));
    errors.push(...preloadResult.errors);
  } else {
    collectSourcemapFiles(outDir, preloadResult.outputs, sourcemapFiles);
    console.log('  ✓ Preload script bundled');
  }

  // 3. Copy renderer files
  console.log('  [3/6] Copying renderer files...');
  const rendererResult = await copyRenderer(root, rendererDir, outDir);

  if (!rendererResult.success) {
    console.error(`  ✗ Failed to copy renderer: ${rendererResult.error}`);
    errors.push(rendererResult.error || 'Unknown error');
  } else {
    console.log('  ✓ Renderer files copied');
  }

  // 4. Copy native addon
  console.log('  [4/6] Copying native addon...');
  const nativeResult = await copyNativeAddon(outDir, getPlatform(options.target));

  if (!nativeResult.success) {
    console.warn(`  ⚠ Native addon: ${nativeResult.error}`);
    // Not fatal - might be building for different platform
  } else {
    console.log('  ✓ Native addon copied');
  }

  if (webviewEngine === 'cef') {
    console.log('  [4b/6] Copying CEF runtime...');
    const cefResult = await copyCefAddon(outDir, getPlatform(options.target));
    if (!cefResult.success) {
      console.error(`  ✗ CEF runtime: ${cefResult.error}`);
      process.exit(1);
    }
    console.log('  ✓ CEF runtime copied');
  }

  // 5. Generate package.json
  console.log('  [5/6] Generating package.json...');
  const appName = config.package?.name || path.basename(root);
  const appVersion = config.package?.version || '1.0.0';

  generatePackageJson(outDir, {
    name: appName,
    version: appVersion,
    main: 'main.js',
    webviewEngine,
  });
  console.log('  ✓ Package.json generated');

  console.log('  [6/6] Writing build artifact manifest...');
  
  // Collect CEF runtime asset details
  let cefRuntimeAssets: BuildArtifactPaths['cefRuntimeAssets'] | undefined;
  if (webviewEngine === 'cef') {
    const cefModuleDir = path.join(outDir, 'node_modules', '@bunlet', 'cef');
    cefRuntimeAssets = {};
    if (fs.existsSync(path.join(cefModuleDir, 'bunlet-cef-helper'))) {
      cefRuntimeAssets.helperBinary = path.join('node_modules', '@bunlet', 'cef', 'bunlet-cef-helper');
    }
    if (fs.existsSync(path.join(cefModuleDir, 'bunlet-cef-helper.exe'))) {
      cefRuntimeAssets.helperBinary = path.join('node_modules', '@bunlet', 'cef', 'bunlet-cef-helper.exe');
    }
    if (fs.existsSync(path.join(cefModuleDir, 'cef-binaries'))) {
      cefRuntimeAssets.cefBinariesDir = path.join('node_modules', '@bunlet', 'cef', 'cef-binaries');
    }
    const cefNodePattern = /bunlet-cef\..+\.node$/;
    const cefNodeFile = fs.readdirSync(cefModuleDir, { withFileTypes: true })
      .find((f) => f.isFile() && cefNodePattern.test(f.name));
    if (cefNodeFile) {
      cefRuntimeAssets.nodeBinary = path.join('node_modules', '@bunlet', 'cef', cefNodeFile.name);
    }
  }

  const buildArtifactManifest = createBuildArtifactManifest({
    name: appName,
    version: appVersion,
    webviewEngine,
    paths: {
      main: 'main.js',
      preload: preloadResult && preloadResult.success ? 'preload.js' : undefined,
      renderer: 'renderer',
      packageJson: 'package.json',
      nativeRuntime: nativeResult.success ? path.join('node_modules', '@bunlet', 'native') : undefined,
      cefRuntime:
        webviewEngine === 'cef' && fs.existsSync(path.join(outDir, 'node_modules', '@bunlet', 'cef'))
          ? path.join('node_modules', '@bunlet', 'cef')
          : undefined,
      cefRuntimeAssets: cefRuntimeAssets && Object.keys(cefRuntimeAssets).length > 0 ? cefRuntimeAssets : undefined,
    },
    sourcemaps: sourcemapFiles.length > 0 ? sourcemapFiles : undefined,
  });
  writeBuildArtifactManifest(outDir, buildArtifactManifest);
  console.log('  ✓ Build artifact manifest written');

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  if (errors.length > 0) {
    console.log(`\n  Build completed with ${errors.length} warning(s) in ${duration}s`);
  } else {
    console.log(`\n  ✓ Build completed successfully in ${duration}s`);
  }

  // Print output summary
  const files = fs.readdirSync(outDir);
  console.log(`\n  Output (${outDir}):`);
  for (const file of files) {
    const filePath = path.join(outDir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      console.log(`    ${file}/`);
    } else {
      const size = formatSize(stat.size);
      console.log(`    ${file} (${size})`);
    }
  }
  console.log('');
}

/**
 * Get platform from target string
 */
function getPlatform(target: string): NodeJS.Platform {
  if (target === 'darwin' || target === 'mac' || target === 'macos') {
    return 'darwin';
  }
  if (target === 'win32' || target === 'win' || target === 'windows') {
    return 'win32';
  }
  if (target === 'linux') {
    return 'linux';
  }
  return process.platform;
}

/**
 * Format file size
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function collectSourcemapFiles(outDir: string, outputs: string[], collector: string[]): void {
  for (const outputPath of outputs) {
    const mapPath = outputPath + '.map';
    if (fs.existsSync(mapPath)) {
      collector.push(path.relative(outDir, mapPath));
    }
  }
}
