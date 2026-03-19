/**
 * bunlet package command
 *
 * Packages the application for distribution.
 */

import * as path from 'path';
import * as fs from 'fs';
import { buildDarwinApp, createDmg } from '../build/platforms/darwin';
import { buildLinux } from '../build/platforms/linux';
import { buildWin32 } from '../build/platforms/win32';

export interface PackageOptions {
  format?: string;
  sign: boolean;
  mac?: boolean;
  win?: boolean;
  linux?: boolean;
}

interface BunletConfig {
  main?: string;
  renderer?: {
    root?: string;
  };
  build?: {
    outDir?: string;
  };
  package?: {
    name?: string;
    version?: string;
    description?: string;
    author?: string;
    icon?: string;
    bundleId?: string;
    category?: string;
    mac?: {
      category?: string;
      target?: string[];
      identity?: string;
    };
    win?: {
      target?: string[];
    };
    linux?: {
      target?: string[];
      category?: string;
      maintainer?: string;
    };
  };
}

/**
 * Package the application
 */
export async function packageCommand(options: PackageOptions): Promise<void> {
  const root = process.cwd();
  const config = await loadConfig(root);

  const buildDir = path.resolve(root, config.build?.outDir || 'dist');
  const packageDir = path.resolve(root, 'release');

  // Verify build exists
  if (!fs.existsSync(buildDir)) {
    console.error('\n  Error: Build directory not found.');
    console.error('  Run `bunlet build` first.\n');
    process.exit(1);
  }

  // Get app info from config or package.json
  const packageJson = await loadPackageJson(root);
  const appName = config.package?.name || packageJson.name || path.basename(root);
  const appVersion = config.package?.version || packageJson.version || '1.0.0';
  const appDescription = config.package?.description || packageJson.description;
  const appAuthor = config.package?.author || packageJson.author;
  const appIcon = config.package?.icon
    ? path.resolve(root, config.package.icon)
    : null;

  console.log('\n  Bunlet Package\n');
  console.log(`  App: ${appName} v${appVersion}`);
  console.log(`  Build: ${buildDir}`);
  console.log(`  Output: ${packageDir}`);

  // Determine platforms to build
  const platforms: NodeJS.Platform[] = [];

  if (options.mac) {
    platforms.push('darwin');
  }
  if (options.win) {
    platforms.push('win32');
  }
  if (options.linux) {
    platforms.push('linux');
  }

  // If no platform specified, build for current platform
  if (platforms.length === 0) {
    platforms.push(process.platform);
  }

  console.log(`  Platforms: ${platforms.join(', ')}\n`);
  if (options.sign) {
    console.warn('  ⚠ --sign is not implemented yet; building unsigned artifacts.');
  }

  const normalizedFormat = options.format?.toLowerCase();
  const resolveTargets = (platform: NodeJS.Platform, defaults: string[]): string[] => {
    if (!normalizedFormat) {
      return defaults;
    }

    const supported: Record<NodeJS.Platform, string[]> = {
      darwin: ['app', 'dmg'],
      linux: ['appimage', 'deb'],
      win32: ['folder', 'zip', 'exe', 'portable'],
      aix: [],
      android: [],
      cygwin: [],
      freebsd: [],
      haiku: [],
      netbsd: [],
      openbsd: [],
      sunos: [],
    };

    if (supported[platform]?.includes(normalizedFormat)) {
      return [normalizedFormat];
    }

    console.warn(
      `  ⚠ Format "${normalizedFormat}" is not supported for ${platform}. Skipping this platform.`
    );
    return [];
  };

  // Create output directory
  if (!fs.existsSync(packageDir)) {
    fs.mkdirSync(packageDir, { recursive: true });
  }

  const startTime = Date.now();
  const results: string[] = [];

  // Build for each platform
  for (const platform of platforms) {
    console.log(`  Building for ${platform}...`);

    try {
      switch (platform) {
        case 'darwin':
          {
          const targets = resolveTargets('darwin', config.package?.mac?.target || ['app', 'dmg']);
          if (targets.length === 0) break;
          await buildForDarwin(
            {
              name: appName,
              version: appVersion,
              description: appDescription,
              author: appAuthor,
              icon: appIcon || undefined,
              buildDir,
              outDir: packageDir,
              bundleId: config.package?.bundleId,
              category: config.package?.mac?.category || config.package?.category,
            },
            targets,
            results
          );
          }
          break;

        case 'linux':
          {
          const targets = resolveTargets('linux', config.package?.linux?.target || ['appimage']);
          if (targets.length === 0) break;
          await buildForLinux(
            {
              name: appName,
              version: appVersion,
              description: appDescription,
              author: appAuthor,
              icon: appIcon || undefined,
              buildDir,
              outDir: packageDir,
              category: config.package?.linux?.category,
              maintainer: config.package?.linux?.maintainer,
            },
            targets,
            results
          );
          }
          break;

        case 'win32':
          {
          const targets = resolveTargets('win32', config.package?.win?.target || ['folder']);
          if (targets.length === 0) break;
          await buildForWin32(
            {
              name: appName,
              version: appVersion,
              description: appDescription,
              author: appAuthor,
              icon: appIcon || undefined,
              buildDir,
              outDir: packageDir,
            },
            targets,
            results
          );
          }
          break;

        default:
          console.warn(`  ⚠ Unknown platform: ${platform}`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to build for ${platform}:`, error);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n  ✓ Packaging completed in ${duration}s\n`);
  console.log('  Output files:');
  for (const result of results) {
    const stat = fs.statSync(result);
    const size = formatSize(stat.size);
    console.log(`    ${path.basename(result)} (${size})`);
  }
  console.log('');
}

/**
 * Build for macOS
 */
async function buildForDarwin(
  options: Parameters<typeof buildDarwinApp>[0],
  targets: string[],
  results: string[]
): Promise<void> {
  // Always build .app first
  const appResult = await buildDarwinApp(options);

  if (!appResult.success) {
    throw new Error(appResult.error);
  }

  if (appResult.appPath) {
    console.log(`    ✓ ${path.basename(appResult.appPath)}`);
    results.push(appResult.appPath);
  }

  // Create DMG if requested
  if (targets.includes('dmg') && appResult.appPath) {
    const dmgResult = await createDmg(
      appResult.appPath,
      options.outDir,
      options.name,
      options.version
    );

    if (dmgResult.success && dmgResult.dmgPath) {
      console.log(`    ✓ ${path.basename(dmgResult.dmgPath)}`);
      results.push(dmgResult.dmgPath);
    } else {
      console.warn(`    ⚠ DMG creation failed: ${dmgResult.error}`);
    }
  }
}

/**
 * Build for Linux
 */
async function buildForLinux(
  options: Parameters<typeof buildLinux>[0],
  targets: string[],
  results: string[]
): Promise<void> {
  // Build AppImage if requested
  if (targets.includes('appimage')) {
    const result = await buildLinux(options, 'appimage');
    if (result.success && result.appImagePath) {
      console.log(`    ✓ ${path.basename(result.appImagePath)}`);
      results.push(result.appImagePath);
    } else if (result.error) {
      console.warn(`    ⚠ AppImage creation failed: ${result.error}`);
    }
  }

  // Build deb if requested
  if (targets.includes('deb')) {
    const result = await buildLinux(options, 'deb');
    if (result.success && result.debPath) {
      console.log(`    ✓ ${path.basename(result.debPath)}`);
      results.push(result.debPath);
    } else if (result.error) {
      console.warn(`    ⚠ DEB creation failed: ${result.error}`);
    }
  }
}

/**
 * Build for Windows
 */
async function buildForWin32(
  options: Parameters<typeof buildWin32>[0],
  targets: string[],
  results: string[]
): Promise<void> {
  // Build folder
  if (targets.includes('folder') || targets.includes('zip')) {
    const result = await buildWin32(options, 'folder');
    if (result.success && result.folderPath) {
      console.log(`    ✓ ${path.basename(result.folderPath)}/`);
      results.push(result.folderPath);
    } else if (result.error) {
      console.warn(`    ⚠ Folder creation failed: ${result.error}`);
    }
  }

  // Build exe if requested
  if (targets.includes('exe') || targets.includes('portable')) {
    const result = await buildWin32(options, 'exe');
    if (result.success && result.exePath) {
      console.log(`    ✓ ${path.basename(result.exePath)}`);
      results.push(result.exePath);
    } else if (result.error) {
      console.warn(`    ⚠ EXE creation failed: ${result.error}`);
    }
  }
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
 * Load package.json
 */
async function loadPackageJson(
  root: string
): Promise<{ name?: string; version?: string; description?: string; author?: string }> {
  const packageJsonPath = path.join(root, 'package.json');

  if (fs.existsSync(packageJsonPath)) {
    try {
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  return {};
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
