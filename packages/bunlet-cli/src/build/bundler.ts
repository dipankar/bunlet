/**
 * Bundler - Bundles main process and renderer using Bun.build
 */

import * as path from 'path';
import * as fs from 'fs';

export interface BundleOptions {
  entrypoint: string;
  outDir: string;
  minify: boolean;
  sourcemap: boolean | 'inline' | 'external';
  target: 'bun' | 'node' | 'browser';
  external?: string[];
  define?: Record<string, string>;
}

export interface BundleResult {
  success: boolean;
  outputs: string[];
  errors: string[];
  warnings: string[];
}

/**
 * Bundle a single entrypoint
 */
export async function bundle(options: BundleOptions): Promise<BundleResult> {
  const {
    entrypoint,
    outDir,
    minify,
    sourcemap,
    target,
    external = [],
    define = {},
  } = options;

  // Ensure output directory exists
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  try {
    // Use indirection to prevent bundler from inlining NODE_ENV at CLI build time
    // This ensures the runtime value is used when building the user's app
    const env = process['env'];
    const nodeEnvValue = JSON.stringify(env['NODE_ENV'] || 'production');
    const result = await Bun.build({
      entrypoints: [entrypoint],
      outdir: outDir,
      target,
      minify,
      sourcemap: sourcemap === true ? 'external' : sourcemap === false ? 'none' : sourcemap,
      external: ['@bunlet/native', ...external],
      define: {
        'process.env.NODE_ENV': nodeEnvValue,
        ...define,
      },
    });

    if (!result.success) {
      return {
        success: false,
        outputs: [],
        errors: result.logs
          .filter((log) => log.level === 'error')
          .map((log) => log.message),
        warnings: result.logs
          .filter((log) => log.level === 'warning')
          .map((log) => log.message),
      };
    }

    return {
      success: true,
      outputs: result.outputs.map((output) => output.path),
      errors: [],
      warnings: result.logs
        .filter((log) => log.level === 'warning')
        .map((log) => log.message),
    };
  } catch (error) {
    return {
      success: false,
      outputs: [],
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
    };
  }
}

/**
 * Bundle the main process
 */
export async function bundleMain(
  root: string,
  mainEntry: string,
  outDir: string,
  options: { minify: boolean; sourcemap: boolean | 'inline' | 'external'; define?: Record<string, string> }
): Promise<BundleResult> {
  const entrypoint = path.resolve(root, mainEntry);

  if (!fs.existsSync(entrypoint)) {
    return {
      success: false,
      outputs: [],
      errors: [`Main entry not found: ${entrypoint}`],
      warnings: [],
    };
  }

  return bundle({
    entrypoint,
    outDir,
    minify: options.minify,
    sourcemap: options.sourcemap,
    target: 'bun',
    external: ['@bunlet/native'],
    define: options.define,
  });
}

/**
 * Bundle the preload script if it exists
 */
export async function bundlePreload(
  root: string,
  outDir: string,
  options: { minify: boolean; sourcemap: boolean | 'inline' | 'external' }
): Promise<BundleResult | null> {
  // Try common preload locations
  const preloadPaths = [
    'preload.ts',
    'preload.js',
    'src/preload.ts',
    'src/preload.js',
  ];

  let preloadEntry: string | null = null;
  for (const preloadPath of preloadPaths) {
    const fullPath = path.resolve(root, preloadPath);
    if (fs.existsSync(fullPath)) {
      preloadEntry = fullPath;
      break;
    }
  }

  if (!preloadEntry) {
    return null; // No preload script
  }

  return bundle({
    entrypoint: preloadEntry,
    outDir,
    minify: options.minify,
    sourcemap: options.sourcemap,
    target: 'browser',
    external: [],
  });
}

/**
 * Copy renderer files (static copy for now)
 */
export async function copyRenderer(
  root: string,
  rendererDir: string,
  outDir: string
): Promise<{ success: boolean; error?: string }> {
  const srcDir = path.resolve(root, rendererDir);
  const destDir = path.join(outDir, 'renderer');

  if (!fs.existsSync(srcDir)) {
    return { success: false, error: `Renderer directory not found: ${srcDir}` };
  }

  try {
    await copyDir(srcDir, destDir);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Recursively copy a directory
 */
async function copyDir(src: string, dest: string): Promise<void> {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Copy native addon
 */
export async function copyNativeAddon(
  outDir: string,
  platform: NodeJS.Platform = process.platform
): Promise<{ success: boolean; error?: string }> {
  const sourceRoot = findPackageRoot('@bunlet/native', [
    path.resolve(process.cwd(), 'node_modules/@bunlet/native'),
    path.resolve(process.cwd(), 'node_modules/bunlet/node_modules/@bunlet/native'),
    path.resolve(process.cwd(), '../../packages/bunlet-native'),
    path.resolve(process.cwd(), '../../packages/bunlet/node_modules/@bunlet/native'),
  ]);
  if (!sourceRoot) {
    return {
      success: false,
      error: 'Native addon package not found. Run `bun install` first.',
    };
  }

  try {
    const runtimeDir = path.join(outDir, 'node_modules', '@bunlet', 'native');
    fs.mkdirSync(runtimeDir, { recursive: true });

    // Copy runtime loader files for require('@bunlet/native')
    for (const fileName of ['index.js', 'package.json', 'index.d.ts']) {
      const src = path.join(sourceRoot, fileName);
      const dest = path.join(runtimeDir, fileName);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }

    // Copy all bundled native binaries
    const sourceEntries = fs.readdirSync(sourceRoot, { withFileTypes: true });
    for (const entry of sourceEntries) {
      if (entry.isFile() && entry.name.endsWith('.node')) {
        fs.copyFileSync(
          path.join(sourceRoot, entry.name),
          path.join(runtimeDir, entry.name)
        );
      }
    }

    const expectedBinary = getPlatformBinaryName(platform, process.arch);
    const expectedRuntimePath = path.join(runtimeDir, expectedBinary);
    const platformBinary = findExistingBinary(sourceRoot, platform, process.arch);

    if (!platformBinary) {
      return {
        success: false,
        error: `No native binary found for ${platform}-${process.arch}`,
      };
    }

    // Keep legacy build layout compatibility
    fs.copyFileSync(platformBinary, path.join(outDir, 'bunlet-native.node'));

    // Ensure the runtime loader's expected filename exists
    if (!fs.existsSync(expectedRuntimePath)) {
      fs.copyFileSync(platformBinary, expectedRuntimePath);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function copyCefAddon(
  outDir: string,
  platform: NodeJS.Platform = process.platform
): Promise<{ success: boolean; error?: string }> {
  const sourceRoot = findPackageRoot('@bunlet/cef', [
    path.resolve(process.cwd(), 'node_modules/@bunlet/cef'),
    path.resolve(process.cwd(), '../../packages/bunlet-cef'),
  ]);

  if (!sourceRoot) {
    return {
      success: false,
      error: 'CEF package not found. Install @bunlet/cef to use webview engine "cef".',
    };
  }

  try {
    const runtimeDir = path.join(outDir, 'node_modules', '@bunlet', 'cef');
    fs.mkdirSync(runtimeDir, { recursive: true });

    for (const fileName of ['index.js', 'package.json', 'index.d.ts']) {
      const src = path.join(sourceRoot, fileName);
      const dest = path.join(runtimeDir, fileName);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }

    const sourceEntries = fs.readdirSync(sourceRoot, { withFileTypes: true });
    for (const entry of sourceEntries) {
      const src = path.join(sourceRoot, entry.name);
      const dest = path.join(runtimeDir, entry.name);

      if (entry.isFile() && entry.name.endsWith('.node')) {
        fs.copyFileSync(src, dest);
      }

      if (entry.isDirectory() && entry.name === 'cef-binaries') {
        await copyDir(src, dest);
      }
    }

    const expectedBinary = getCefPlatformBinaryName(platform, process.arch);
    const expectedRuntimePath = path.join(runtimeDir, expectedBinary);
    const platformBinary = findExistingCefBinary(sourceRoot, platform, process.arch);

    if (!platformBinary) {
      return {
        success: false,
        error: `No CEF addon binary found for ${platform}-${process.arch}. Run "bun --filter @bunlet/cef run build" first.`,
      };
    }

    // Preserve legacy runtime compatibility for older loaders
    fs.copyFileSync(platformBinary, path.join(outDir, 'bunlet-cef.node'));

    if (!fs.existsSync(expectedRuntimePath)) {
      fs.copyFileSync(platformBinary, expectedRuntimePath);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function findExistingCefBinary(
  root: string,
  platform: NodeJS.Platform,
  arch: string
): string | null {
  const candidates = [
    path.join(root, getCefPlatformBinaryName(platform, arch)),
    path.join(root, `bunlet-cef.${platform}-${arch}.node`),
    path.join(root, 'bunlet-cef.node'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const firstNodeBinary = fs
    .readdirSync(root, { withFileTypes: true })
    .find((entry) => entry.isFile() && entry.name.endsWith('.node'));

  return firstNodeBinary ? path.join(root, firstNodeBinary.name) : null;
}

function findPackageRoot(packageName: string, candidates: string[]): string | null {
  try {
    const packageJsonPath = require.resolve(`${packageName}/package.json`);
    candidates.unshift(path.dirname(packageJsonPath));
  } catch {
    // Ignore; fallback candidates will be checked.
  }

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'index.js'))) {
      return candidate;
    }
  }

  return null;
}

function findExistingBinary(
  root: string,
  platform: NodeJS.Platform,
  arch: string
): string | null {
  const candidates = [
    path.join(root, getPlatformBinaryName(platform, arch)),
    path.join(root, `bunlet-native.${platform}-${arch}.node`),
    path.join(root, 'bunlet-native.node'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const firstNodeBinary = fs
    .readdirSync(root, { withFileTypes: true })
    .find((entry) => entry.isFile() && entry.name.endsWith('.node'));

  return firstNodeBinary ? path.join(root, firstNodeBinary.name) : null;
}

function getPlatformBinaryName(platform: NodeJS.Platform, arch: string): string {
  if (platform === 'linux') {
    return `bunlet-native.linux-${arch}-gnu.node`;
  }
  if (platform === 'win32') {
    return `bunlet-native.win32-${arch}-msvc.node`;
  }
  if (platform === 'darwin') {
    return `bunlet-native.darwin-${arch}.node`;
  }
  return `bunlet-native.${platform}-${arch}.node`;
}

function getCefPlatformBinaryName(platform: NodeJS.Platform, arch: string): string {
  if (platform === 'linux') {
    return `bunlet-cef.linux-${arch}-gnu.node`;
  }
  if (platform === 'win32') {
    return `bunlet-cef.win32-${arch}-msvc.node`;
  }
  if (platform === 'darwin') {
    return `bunlet-cef.darwin-${arch}.node`;
  }
  return `bunlet-cef.${platform}-${arch}.node`;
}

/**
 * Generate a minimal package.json for the bundle
 */
export function generatePackageJson(
  outDir: string,
  config: {
    name: string;
    version: string;
    main: string;
    webviewEngine?: 'system' | 'cef';
  }
): void {
  const packageJson = {
    name: config.name,
    version: config.version,
    main: config.main,
    type: 'module',
    bunlet: {
      webview: {
        engine: config.webviewEngine || 'system',
      },
    },
  };

  fs.writeFileSync(
    path.join(outDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
}
