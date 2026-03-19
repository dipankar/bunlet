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

export interface BuildOptions {
  target: string;
  outdir: string;
  minify: boolean;
  sourcemap: boolean;
  webview?: string;
}

interface BunletConfig {
  main?: string;
  renderer?: {
    root?: string;
    index?: string;
  };
  build?: {
    outDir?: string;
    minify?: boolean;
    sourcemap?: boolean | 'inline' | 'external';
    bytecode?: boolean;
    external?: string[];
  };
  package?: {
    name?: string;
    version?: string;
    description?: string;
    author?: string;
    icon?: string;
  };
  webview?: {
    engine?: 'system' | 'cef';
  };
}

/**
 * Build the application
 */
export async function buildCommand(options: BuildOptions): Promise<void> {
  const root = process.cwd();
  const config = await loadConfig(root);
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
  console.log(`  Target: ${options.target}\n`);

  // Clean output directory
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  const errors: string[] = [];
  const startTime = Date.now();

  // 1. Bundle main process
  console.log('  [1/5] Bundling main process...');
  const mainResult = await bundleMain(root, mainEntry, outDir, {
    minify: options.minify,
    sourcemap: options.sourcemap,
  });

  if (!mainResult.success) {
    console.error('  ✗ Failed to bundle main process:');
    mainResult.errors.forEach((e) => console.error(`    ${e}`));
    process.exit(1);
  }
  console.log('  ✓ Main process bundled');

  // 2. Bundle preload (if exists)
  console.log('  [2/5] Bundling preload script...');
  const preloadResult = await bundlePreload(root, outDir, {
    minify: options.minify,
    sourcemap: options.sourcemap,
  });

  if (preloadResult === null) {
    console.log('  - No preload script found (skipped)');
  } else if (!preloadResult.success) {
    console.error('  ✗ Failed to bundle preload:');
    preloadResult.errors.forEach((e) => console.error(`    ${e}`));
    errors.push(...preloadResult.errors);
  } else {
    console.log('  ✓ Preload script bundled');
  }

  // 3. Copy renderer files
  console.log('  [3/5] Copying renderer files...');
  const rendererResult = await copyRenderer(root, rendererDir, outDir);

  if (!rendererResult.success) {
    console.error(`  ✗ Failed to copy renderer: ${rendererResult.error}`);
    errors.push(rendererResult.error || 'Unknown error');
  } else {
    console.log('  ✓ Renderer files copied');
  }

  // 4. Copy native addon
  console.log('  [4/5] Copying native addon...');
  const nativeResult = await copyNativeAddon(outDir, getPlatform(options.target));

  if (!nativeResult.success) {
    console.warn(`  ⚠ Native addon: ${nativeResult.error}`);
    // Not fatal - might be building for different platform
  } else {
    console.log('  ✓ Native addon copied');
  }

  if (webviewEngine === 'cef') {
    console.log('  [4b/5] Copying CEF runtime...');
    const cefResult = await copyCefAddon(outDir, getPlatform(options.target));
    if (!cefResult.success) {
      console.error(`  ✗ CEF runtime: ${cefResult.error}`);
      process.exit(1);
    }
    console.log('  ✓ CEF runtime copied');
  }

  // 5. Generate package.json
  console.log('  [5/5] Generating package.json...');
  const appName = config.package?.name || path.basename(root);
  const appVersion = config.package?.version || '1.0.0';

  generatePackageJson(outDir, {
    name: appName,
    version: appVersion,
    main: 'main.js',
    webviewEngine,
  });
  console.log('  ✓ Package.json generated');

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
 * Load bunlet config
 */
async function loadConfig(root: string): Promise<BunletConfig> {
  const configFiles = [
    'bunlet.config.ts',
    'bunlet.config.js',
    'bunlet.config.mjs',
    'bunlet.config.json',
  ];

  for (const configFile of configFiles) {
    const configPath = path.join(root, configFile);

    if (fs.existsSync(configPath)) {
      try {
        if (configFile.endsWith('.json')) {
          const content = fs.readFileSync(configPath, 'utf-8');
          return JSON.parse(content);
        } else {
          const module = await import(configPath);
          return module.default || module;
        }
      } catch (error) {
        console.warn(`Warning: Failed to load ${configFile}:`, error);
      }
    }
  }

  return {};
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
