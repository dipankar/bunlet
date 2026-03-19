/**
 * Linux Platform Builder
 *
 * Creates AppImage and .deb packages for Linux.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { generateDesktopFile, generateAppRun, type AppManifest } from '../manifest';
import { generateIconsForPlatform } from '../icons';

export interface LinuxBuildOptions {
  name: string;
  version: string;
  description?: string;
  author?: string;
  category?: string;
  icon?: string;
  buildDir: string;
  outDir: string;
  maintainer?: string;
}

export interface LinuxBuildResult {
  success: boolean;
  appImagePath?: string;
  debPath?: string;
  error?: string;
}

/**
 * Build Linux AppImage
 */
export async function buildAppImage(
  options: LinuxBuildOptions
): Promise<{ success: boolean; path?: string; error?: string }> {
  const { name, version, buildDir, outDir } = options;
  const appName = name.toLowerCase().replace(/\s+/g, '-');

  const appDirPath = path.join(outDir, `${name}.AppDir`);
  const appImageName = `${name}-${version}-linux-${process.arch}.AppImage`;
  const appImagePath = path.join(outDir, appImageName);

  try {
    // Create AppDir structure
    if (fs.existsSync(appDirPath)) {
      fs.rmSync(appDirPath, { recursive: true });
    }

    const usrBinDir = path.join(appDirPath, 'usr', 'bin');
    const usrShareDir = path.join(appDirPath, 'usr', 'share');
    const appDir = path.join(usrShareDir, 'app');

    fs.mkdirSync(usrBinDir, { recursive: true });
    fs.mkdirSync(appDir, { recursive: true });

    // Copy app files
    copyDirSync(buildDir, appDir);

    // Create launcher script
    const launcherScript = `#!/bin/bash
DIR="$(dirname "$(readlink -f "\$0")")"
APP_DIR="\$DIR/../share/app"

# Set library path for native addon
export LD_LIBRARY_PATH="\$APP_DIR:\$LD_LIBRARY_PATH"

# Run with bun
exec bun run "\$APP_DIR/main.js" "\$@"
`;

    const launcherPath = path.join(usrBinDir, appName);
    fs.writeFileSync(launcherPath, launcherScript);
    fs.chmodSync(launcherPath, 0o755);

    // Create AppRun
    const appRunContent = generateAppRun(appName);
    const appRunPath = path.join(appDirPath, 'AppRun');
    fs.writeFileSync(appRunPath, appRunContent);
    fs.chmodSync(appRunPath, 0o755);

    // Create .desktop file
    const manifest: AppManifest = {
      name: options.name,
      version,
      description: options.description,
      author: options.author,
      category: options.category,
    };

    const desktopContent = generateDesktopFile(manifest, appName);
    fs.writeFileSync(
      path.join(appDirPath, `${appName}.desktop`),
      desktopContent
    );

    // Copy/generate icon
    if (options.icon && fs.existsSync(options.icon)) {
      const iconResult = await generateIconsForPlatform(
        options.icon,
        appDirPath,
        'linux',
        appName
      );
      if (!iconResult.success) {
        console.warn(`Warning: Failed to copy icon: ${iconResult.error}`);
      }
    } else {
      // Create a placeholder icon (1x1 PNG)
      const placeholderIcon = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      fs.writeFileSync(path.join(appDirPath, `${appName}.png`), placeholderIcon);
    }

    // Check if appimagetool is available
    let hasAppImageTool = false;
    try {
      execSync('which appimagetool', { stdio: 'pipe' });
      hasAppImageTool = true;
    } catch {
      // appimagetool not available
    }

    if (hasAppImageTool) {
      // Create AppImage using appimagetool
      if (fs.existsSync(appImagePath)) {
        fs.unlinkSync(appImagePath);
      }

      execSync(`ARCH=${process.arch} appimagetool "${appDirPath}" "${appImagePath}"`, {
        stdio: 'pipe',
        env: { ...process.env, ARCH: process.arch },
      });

      // Clean up AppDir
      fs.rmSync(appDirPath, { recursive: true });

      return { success: true, path: appImagePath };
    } else {
      // Return the AppDir path if appimagetool is not available
      console.warn('appimagetool not found. AppDir created but not packaged.');
      console.warn('Install appimagetool: https://github.com/AppImage/AppImageKit');
      return { success: true, path: appDirPath };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Build Debian .deb package
 */
export async function buildDeb(
  options: LinuxBuildOptions
): Promise<{ success: boolean; path?: string; error?: string }> {
  const { name, version, buildDir, outDir } = options;
  const appName = name.toLowerCase().replace(/\s+/g, '-');
  const debName = `${appName}_${version}_${process.arch === 'x64' ? 'amd64' : process.arch}.deb`;
  const debPath = path.join(outDir, debName);

  const debDir = path.join(outDir, `.deb-${appName}`);

  try {
    // Create deb structure
    if (fs.existsSync(debDir)) {
      fs.rmSync(debDir, { recursive: true });
    }

    const debianDir = path.join(debDir, 'DEBIAN');
    const optDir = path.join(debDir, 'opt', appName);
    const applicationsDir = path.join(debDir, 'usr', 'share', 'applications');
    const binDir = path.join(debDir, 'usr', 'bin');
    const iconsDir = path.join(debDir, 'usr', 'share', 'icons', 'hicolor', '256x256', 'apps');

    fs.mkdirSync(debianDir, { recursive: true });
    fs.mkdirSync(optDir, { recursive: true });
    fs.mkdirSync(applicationsDir, { recursive: true });
    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(iconsDir, { recursive: true });

    // Copy app files
    copyDirSync(buildDir, optDir);

    // Create control file
    const controlContent = `Package: ${appName}
Version: ${version}
Section: utils
Priority: optional
Architecture: ${process.arch === 'x64' ? 'amd64' : process.arch}
Maintainer: ${options.maintainer || options.author || 'Unknown'}
Description: ${options.description || name}
`;

    fs.writeFileSync(path.join(debianDir, 'control'), controlContent);

    // Create launcher script
    const launcherScript = `#!/bin/bash
export LD_LIBRARY_PATH="/opt/${appName}:\$LD_LIBRARY_PATH"
exec bun run "/opt/${appName}/main.js" "\$@"
`;

    const launcherPath = path.join(binDir, appName);
    fs.writeFileSync(launcherPath, launcherScript);
    fs.chmodSync(launcherPath, 0o755);

    // Create .desktop file
    const manifest: AppManifest = {
      name: options.name,
      version,
      description: options.description,
      author: options.author,
      category: options.category,
    };

    const desktopContent = generateDesktopFile(manifest, `/usr/bin/${appName}`);
    fs.writeFileSync(
      path.join(applicationsDir, `${appName}.desktop`),
      desktopContent
    );

    // Copy icon
    if (options.icon && fs.existsSync(options.icon)) {
      fs.copyFileSync(options.icon, path.join(iconsDir, `${appName}.png`));
    }

    // Check if dpkg-deb is available
    try {
      execSync('which dpkg-deb', { stdio: 'pipe' });
    } catch {
      console.warn('dpkg-deb not found. Cannot create .deb package.');
      console.warn('Install dpkg: apt-get install dpkg');
      return { success: false, error: 'dpkg-deb not found' };
    }

    // Build deb package
    if (fs.existsSync(debPath)) {
      fs.unlinkSync(debPath);
    }

    execSync(`dpkg-deb --build "${debDir}" "${debPath}"`, { stdio: 'pipe' });

    // Clean up
    fs.rmSync(debDir, { recursive: true });

    return { success: true, path: debPath };
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(debDir)) {
      fs.rmSync(debDir, { recursive: true });
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Build Linux package (AppImage or deb)
 */
export async function buildLinux(
  options: LinuxBuildOptions,
  format: 'appimage' | 'deb' | 'both' = 'appimage'
): Promise<LinuxBuildResult> {
  const results: LinuxBuildResult = { success: true };

  if (format === 'appimage' || format === 'both') {
    const appImageResult = await buildAppImage(options);
    if (appImageResult.success) {
      results.appImagePath = appImageResult.path;
    } else {
      results.success = false;
      results.error = appImageResult.error;
    }
  }

  if (format === 'deb' || format === 'both') {
    const debResult = await buildDeb(options);
    if (debResult.success) {
      results.debPath = debResult.path;
    } else if (!results.error) {
      results.success = false;
      results.error = debResult.error;
    }
  }

  return results;
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
