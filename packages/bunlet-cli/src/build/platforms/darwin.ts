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
import type { SignOptions, NotarizeOptions } from '../packager';

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
  sign?: boolean;
  signOptions?: SignOptions;
  /** Whether the build includes CEF runtime assets */
  webviewEngine?: 'system' | 'cef';
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
    const cefLibPath = options.webviewEngine === 'cef'
      ? '":"$RESOURCES_DIR/../Frameworks/cef/cef-binaries"'
      : '';
    const launcherScript = `#!/bin/bash
DIR="$(cd "$(dirname "\$0")" && pwd)"
RESOURCES_DIR="$(dirname "\$DIR")/Resources"

# Set library path for native addon
export DYLD_LIBRARY_PATH="\$RESOURCES_DIR/app${cefLibPath}:\$DYLD_LIBRARY_PATH"

# Set CEF helper path if using CEF backend
${options.webviewEngine === 'cef' ? 'export BUNLET_CEF_HELPER_PATH="$RESOURCES_DIR/../Frameworks/cef/bunlet-cef-helper"' : ''}

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
      fs.copyFileSync(nativeAddon, path.join(appDir, 'bunlet-native.node'));
    }

    // Copy CEF runtime assets to Frameworks (helper process, .node binary, libraries)
    if (options.webviewEngine === 'cef') {
      const cefAddon = path.join(buildDir, 'bunlet-cef.node');
      if (fs.existsSync(cefAddon)) {
        fs.copyFileSync(cefAddon, path.join(frameworksDir, 'bunlet-cef.node'));
        fs.copyFileSync(cefAddon, path.join(appDir, 'bunlet-cef.node'));
      }

      const cefModuleDir = path.join(buildDir, 'node_modules', '@bunlet', 'cef');
      if (fs.existsSync(cefModuleDir)) {
        const cefRuntimeDest = path.join(frameworksDir, 'cef');
        if (!fs.existsSync(cefRuntimeDest)) {
          fs.mkdirSync(cefRuntimeDest, { recursive: true });
        }
        const cefHelper = path.join(cefModuleDir, 'bunlet-cef-helper');
        if (fs.existsSync(cefHelper)) {
          fs.copyFileSync(cefHelper, path.join(cefRuntimeDest, 'bunlet-cef-helper'));
          fs.chmodSync(path.join(cefRuntimeDest, 'bunlet-cef-helper'), 0o755);
        }
        const cefBinaries = path.join(cefModuleDir, 'cef-binaries');
        if (fs.existsSync(cefBinaries)) {
          copyDirSync(cefBinaries, path.join(cefRuntimeDest, 'cef-binaries'));
        }
      }
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
    if (options.sign && options.signOptions?.identity) {
      try {
        await signApp(appPath, options.signOptions);
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
  options: NonNullable<DarwinBuildOptions['signOptions']>
): Promise<void> {
  const identity = options.identity || '';
  const entitlements = options.entitlements;
  const hardenedRuntime = options.hardenedRuntime ?? true;

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
 * Notarize a signed .dmg or .app via Apple's notary service.
 *
 * Reads credentials from `options` first, falls back to env vars
 * (`APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_SPECIFIC_PASSWORD`). Throws a
 * descriptive error when any required credential is missing — does NOT
 * silently skip. On success, by default also runs `xcrun stapler staple`
 * so the notarization ticket is bundled with the artifact for offline
 * Gatekeeper validation.
 *
 * Requires Xcode 13+ (for `notarytool`). The wrapper does not run real
 * notarization in CI in this PR — it gives a working entry point for
 * release pipelines that have Apple Developer credentials.
 */
export async function notarizeDarwinApp(
  artifactPath: string,
  options: NotarizeOptions = {}
): Promise<void> {
  const appleId = options.appleId ?? process.env.APPLE_ID;
  const teamId = options.teamId ?? process.env.APPLE_TEAM_ID;
  const password = options.appSpecificPassword ?? process.env.APPLE_APP_SPECIFIC_PASSWORD;

  const missing: string[] = [];
  if (!appleId) missing.push('APPLE_ID');
  if (!teamId) missing.push('APPLE_TEAM_ID');
  if (!password) missing.push('APPLE_APP_SPECIFIC_PASSWORD');
  if (missing.length > 0) {
    throw new Error(
      `[bunlet] notarizeDarwinApp: missing credential(s): ${missing.join(', ')}. ` +
        `Set the env vars or pass them in NotarizeOptions. ` +
        `See docs/packaging/signing.md.`
    );
  }
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`[bunlet] notarizeDarwinApp: artifact does not exist: ${artifactPath}`);
  }

  const args = [
    'xcrun',
    'notarytool',
    'submit',
    `"${artifactPath}"`,
    '--apple-id',
    `"${appleId}"`,
    '--team-id',
    `"${teamId}"`,
    '--password',
    `"${password}"`,
    '--wait',
  ];
  execSync(args.join(' '), { stdio: 'inherit' });

  if (options.staple !== false) {
    execSync(`xcrun stapler staple "${artifactPath}"`, { stdio: 'inherit' });
  }
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
