/**
 * bunlet package command
 *
 * Packages the application for distribution.
 */

import * as path from 'path';
import * as fs from 'fs';
import {
  loadBuildArtifactManifest,
  validateBuildArtifactManifest,
} from '../artifacts/build-manifest';
import {
  createReleaseArtifactManifest,
  writeReleaseArtifactManifest,
  type ReleaseArtifact,
} from '../artifacts/release-manifest';
import { generateBlockMapFile } from '../build/blockmap';
import { generateUpdateManifestsForRelease } from '../artifacts/update-manifest';
import { buildDarwinApp, createDmg } from '../build/platforms/darwin';
import { buildLinux } from '../build/platforms/linux';
import { buildWin32 } from '../build/platforms/win32';
import { loadBunletConfig, loadPackageJson } from '../config';

export interface PackageOptions {
  format?: string;
  sign: boolean;
  mac?: boolean;
  win?: boolean;
  linux?: boolean;
}

/**
 * Package the application
 */
export async function packageCommand(options: PackageOptions): Promise<void> {
  const root = process.cwd();
  const config = await loadBunletConfig(root);

  const buildDir = path.resolve(root, config.build?.outDir || 'dist');
  const packageDir = path.resolve(root, 'release');

  // Verify build exists
  if (!fs.existsSync(buildDir)) {
    console.error('\n  Error: Build directory not found.');
    console.error('  Run `bunlet build` first.\n');
    process.exit(1);
  }

  const buildManifest = loadBuildArtifactManifest(buildDir);
  if (buildManifest) {
    const manifestErrors = validateBuildArtifactManifest(buildDir, buildManifest);
    if (manifestErrors.length > 0) {
      console.error('\n  Error: Build artifact manifest is invalid.');
      for (const error of manifestErrors) {
        console.error(`  - ${error}`);
      }
      console.error('');
      process.exit(1);
    }
  }

  // Get app info from config or package.json
  const packageJson = await loadPackageJson(root);
  const appName =
    config.package?.name || buildManifest?.app.name || packageJson.name || path.basename(root);
  const appVersion =
    config.package?.version || buildManifest?.app.version || packageJson.version || '1.0.0';
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

  const webviewEngine = buildManifest?.app.webviewEngine || 'system';

  console.log(`  Platforms: ${platforms.join(', ')}\n`);
  if (webviewEngine === 'cef') {
    console.log('  WebView: CEF (Chromium Embedded Framework)');
  }
  if (options.sign) {
    console.log('  Signing: enabled');
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
  const results: ReleaseArtifact[] = [];

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
                sign: options.sign,
                signOptions: options.sign ? {
                  identity: config.package?.mac?.identity,
                } : undefined,
                webviewEngine,
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
               webviewEngine,
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
                sign: options.sign,
                signOptions: options.sign ? {
                  certificateFile: process.env.WIN_CERTIFICATE_FILE,
                  certificatePassword: process.env.WIN_CERTIFICATE_PASSWORD,
                  timestampServer: process.env.WIN_TIMESTAMP_SERVER,
                } : undefined,
                webviewEngine,
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

  const releaseArtifactManifest = createReleaseArtifactManifest({
    name: appName,
    version: appVersion,
    artifacts: results.map((result) => ({
      ...result,
      path: path.relative(packageDir, result.path),
    })),
  });
  writeReleaseArtifactManifest(packageDir, releaseArtifactManifest);

  // Generate blockmaps for update manifests
  console.log('  Generating blockmaps...');
  for (const result of results) {
    if (result.kind === 'file' && shouldGenerateBlockMap(result.name)) {
      try {
        const blockMapResult = await generateBlockMapFile(result.path);
        if (blockMapResult) {
          console.log(`    ✓ ${path.basename(blockMapResult.path)}`);
        }
      } catch (e) {
        console.warn(`    ⚠ Blockmap failed for ${result.name}: ${e}`);
      }
    }
  }

  // Generate update manifests
  console.log('  Generating update manifests...');
  try {
    const manifestPaths = await generateUpdateManifestsForRelease(
      packageDir,
      appName,
      appVersion
    );
    for (const manifestPath of manifestPaths) {
      console.log(`    ✓ ${path.basename(manifestPath)}`);
    }
  } catch (e) {
    console.warn(`  ⚠ Update manifest generation skipped: ${e}`);
  }

  console.log(`\n  ✓ Packaging completed in ${duration}s\n`);
  console.log('  Output files:');
  for (const result of results) {
    const stat = fs.statSync(result.path);
    const size = formatSize(stat.size);
    const suffix = result.kind === 'directory' ? '/' : '';
    console.log(`    ${result.name}${suffix} (${size})`);
  }
  console.log('');
}

/**
 * Build for macOS
 */
async function buildForDarwin(
  options: Parameters<typeof buildDarwinApp>[0],
  targets: string[],
  results: ReleaseArtifact[]
): Promise<void> {
  // Always build .app first
  const appResult = await buildDarwinApp(options);

  if (!appResult.success) {
    throw new Error(appResult.error);
  }

  if (appResult.appPath) {
    console.log(`    ✓ ${path.basename(appResult.appPath)}`);
    results.push({
      platform: 'darwin',
      format: 'app',
      path: appResult.appPath,
      name: path.basename(appResult.appPath),
      kind: 'directory',
    });
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
      results.push({
        platform: 'darwin',
        format: 'dmg',
        path: dmgResult.dmgPath,
        name: path.basename(dmgResult.dmgPath),
        kind: 'file',
      });
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
  results: ReleaseArtifact[]
): Promise<void> {
  // Build AppImage if requested
  if (targets.includes('appimage')) {
    const result = await buildLinux(options, 'appimage');
    if (result.success && result.appImagePath) {
      console.log(`    ✓ ${path.basename(result.appImagePath)}`);
      results.push({
        platform: 'linux',
        format: path.extname(result.appImagePath).toLowerCase() === '.appimage' ? 'appimage' : 'folder',
        path: result.appImagePath,
        name: path.basename(result.appImagePath),
        kind: fs.statSync(result.appImagePath).isDirectory() ? 'directory' : 'file',
      });
    } else if (result.error) {
      console.warn(`    ⚠ AppImage creation failed: ${result.error}`);
    }
  }

  // Build deb if requested
  if (targets.includes('deb')) {
    const result = await buildLinux(options, 'deb');
    if (result.success && result.debPath) {
      console.log(`    ✓ ${path.basename(result.debPath)}`);
      results.push({
        platform: 'linux',
        format: 'deb',
        path: result.debPath,
        name: path.basename(result.debPath),
        kind: 'file',
      });
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
  results: ReleaseArtifact[]
): Promise<void> {
  // Build folder
  if (targets.includes('folder') || targets.includes('zip')) {
    const result = await buildWin32(options, 'folder');
    if (result.success && result.folderPath) {
      console.log(`    ✓ ${path.basename(result.folderPath)}/`);
      results.push({
        platform: 'win32',
        format: 'folder',
        path: result.folderPath,
        name: path.basename(result.folderPath),
        kind: 'directory',
      });
    } else if (result.error) {
      console.warn(`    ⚠ Folder creation failed: ${result.error}`);
    }
  }

  // Build exe if requested
  if (targets.includes('exe') || targets.includes('portable')) {
    const result = await buildWin32(options, 'exe');
    if (result.success && result.exePath) {
      console.log(`    ✓ ${path.basename(result.exePath)}`);
      results.push({
        platform: 'win32',
        format: targets.includes('portable') ? 'portable' : 'exe',
        path: result.exePath,
        name: path.basename(result.exePath),
        kind: 'file',
      });
    } else if (result.error) {
      console.warn(`    ⚠ EXE creation failed: ${result.error}`);
    }
  }
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

function shouldGenerateBlockMap(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ['.dmg', '.exe', '.appimage', '.zip'].includes(ext);
}
