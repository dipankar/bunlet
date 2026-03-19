/**
 * macOS Platform Builder
 *
 * Creates .app bundles and .dmg installers for macOS.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { generateInfoPlist, type AppManifest } from '../manifest';
import { generateIconsForPlatform } from '../icons';

export interface DarwinBuildOptions {
  name: string;
  version: string;
  description?: string;
  author?: string;
  bundleId?: string;
  category?: string;
  icon?: string;
  buildDir: string;
  outDir: string;
  sign?: {
    identity: string;
    entitlements?: string;
    hardenedRuntime?: boolean;
  };
}

export interface DarwinBuildResult {
  success: boolean;
  appPath?: string;
  dmgPath?: string;
  error?: string;
}

/**
 * Build macOS .app bundle
 */
export async function buildDarwinApp(
  options: DarwinBuildOptions
): Promise<DarwinBuildResult> {
  const { name, version, buildDir, outDir } = options;

  const appName = `${name}.app`;
  const appPath = path.join(outDir, appName);

  try {
    // Create .app bundle structure
    const contentsDir = path.join(appPath, 'Contents');
    const macOSDir = path.join(contentsDir, 'MacOS');
    const resourcesDir = path.join(contentsDir, 'Resources');
    const frameworksDir = path.join(contentsDir, 'Frameworks');

    // Clean and create directories
    if (fs.existsSync(appPath)) {
      fs.rmSync(appPath, { recursive: true });
    }

    fs.mkdirSync(macOSDir, { recursive: true });
    fs.mkdirSync(resourcesDir, { recursive: true });
    fs.mkdirSync(frameworksDir, { recursive: true });

    // Generate Info.plist
    const manifest: AppManifest = {
      name,
      version,
      description: options.description,
      author: options.author,
      bundleId: options.bundleId,
      category: options.category,
    };

    fs.writeFileSync(
      path.join(contentsDir, 'Info.plist'),
      generateInfoPlist(manifest)
    );

    // Create launcher script that runs bun with the app
    const launcherScript = `#!/bin/bash
DIR="$(cd "$(dirname "\$0")" && pwd)"
RESOURCES_DIR="$(dirname "\$DIR")/Resources"

# Set library path for native addon
export DYLD_LIBRARY_PATH="\$RESOURCES_DIR/app:\$DYLD_LIBRARY_PATH"

# Run with bun
exec bun run "\$RESOURCES_DIR/app/main.js" "\$@"
`;

    const launcherPath = path.join(macOSDir, name);
    fs.writeFileSync(launcherPath, launcherScript);
    fs.chmodSync(launcherPath, 0o755);

    // Copy app files to Resources/app
    const appDir = path.join(resourcesDir, 'app');
    fs.mkdirSync(appDir, { recursive: true });

    // Copy all files from buildDir
    copyDirSync(buildDir, appDir);

    // Copy native addon to Frameworks
    const nativeAddon = path.join(buildDir, 'bunlet-native.node');
    if (fs.existsSync(nativeAddon)) {
      fs.copyFileSync(nativeAddon, path.join(frameworksDir, 'bunlet-native.node'));
      // Also copy to app dir for require() to find it
      fs.copyFileSync(nativeAddon, path.join(appDir, 'bunlet-native.node'));
    }

    // Generate icon
    if (options.icon && fs.existsSync(options.icon)) {
      const iconResult = await generateIconsForPlatform(
        options.icon,
        resourcesDir,
        'darwin',
        'app'
      );
      if (!iconResult.success) {
        console.warn(`Warning: Failed to generate icon: ${iconResult.error}`);
      }
    }

    // Sign if requested
    if (options.sign) {
      try {
        await signApp(appPath, options.sign);
      } catch (e) {
        console.warn(`Warning: Code signing failed: ${e}`);
      }
    }

    return { success: true, appPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create DMG installer
 */
export async function createDmg(
  appPath: string,
  outDir: string,
  name: string,
  version: string
): Promise<{ success: boolean; dmgPath?: string; error?: string }> {
  const dmgName = `${name}-${version}-darwin-${process.arch}.dmg`;
  const dmgPath = path.join(outDir, dmgName);

  try {
    // Check if create-dmg is available
    let useCreateDmg = false;
    try {
      execSync('which create-dmg', { stdio: 'pipe' });
      useCreateDmg = true;
    } catch {
      // create-dmg not available, use hdiutil
    }

    if (useCreateDmg) {
      // Use create-dmg for prettier DMG
      execSync(
        `create-dmg \
          --volname "${name}" \
          --window-pos 200 120 \
          --window-size 600 400 \
          --icon-size 100 \
          --icon "${name}.app" 150 185 \
          --app-drop-link 450 185 \
          "${dmgPath}" \
          "${appPath}"`,
        { stdio: 'pipe' }
      );
    } else {
      // Use hdiutil (always available on macOS)
      const tempDir = path.join(outDir, '.dmg-temp');
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      // Copy app to temp directory
      const appName = path.basename(appPath);
      copyDirSync(appPath, path.join(tempDir, appName));

      // Create symlink to Applications
      fs.symlinkSync('/Applications', path.join(tempDir, 'Applications'));

      // Create DMG
      if (fs.existsSync(dmgPath)) {
        fs.unlinkSync(dmgPath);
      }

      execSync(
        `hdiutil create -volname "${name}" -srcfolder "${tempDir}" -ov -format UDZO "${dmgPath}"`,
        { stdio: 'pipe' }
      );

      // Clean up
      fs.rmSync(tempDir, { recursive: true });
    }

    return { success: true, dmgPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Sign the macOS app
 */
async function signApp(
  appPath: string,
  options: NonNullable<DarwinBuildOptions['sign']>
): Promise<void> {
  const { identity, entitlements, hardenedRuntime = true } = options;

  let codesignArgs = [
    'codesign',
    '--force',
    '--deep',
    '--sign',
    `"${identity}"`,
  ];

  if (hardenedRuntime) {
    codesignArgs.push('--options', 'runtime');
  }

  if (entitlements) {
    codesignArgs.push('--entitlements', `"${entitlements}"`);
  }

  codesignArgs.push(`"${appPath}"`);

  execSync(codesignArgs.join(' '), { stdio: 'pipe' });
}

/**
 * Recursively copy a directory
 */
function copyDirSync(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      const target = fs.readlinkSync(srcPath);
      fs.symlinkSync(target, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
