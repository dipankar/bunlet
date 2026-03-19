/**
 * Windows Platform Builder
 *
 * Creates portable executables and folders for Windows.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { generateWindowsManifest, type AppManifest } from '../manifest';
import { generateIconsForPlatform } from '../icons';

export interface Win32BuildOptions {
  name: string;
  version: string;
  description?: string;
  author?: string;
  icon?: string;
  buildDir: string;
  outDir: string;
  sign?: {
    certificateFile: string;
    certificatePassword: string;
    timestampServer?: string;
  };
}

export interface Win32BuildResult {
  success: boolean;
  folderPath?: string;
  exePath?: string;
  error?: string;
}

/**
 * Build Windows portable folder structure
 */
export async function buildWin32Folder(
  options: Win32BuildOptions
): Promise<Win32BuildResult> {
  const { name, version, buildDir, outDir } = options;

  const appDir = path.join(outDir, name);
  const resourcesDir = path.join(appDir, 'resources');
  const appResourcesDir = path.join(resourcesDir, 'app');

  try {
    // Clean and create directories
    if (fs.existsSync(appDir)) {
      fs.rmSync(appDir, { recursive: true });
    }

    fs.mkdirSync(appResourcesDir, { recursive: true });

    // Copy app files
    copyDirSync(buildDir, appResourcesDir);

    // Copy native addon to app root
    const nativeAddon = path.join(buildDir, 'bunlet-native.node');
    if (fs.existsSync(nativeAddon)) {
      fs.copyFileSync(nativeAddon, path.join(appDir, 'bunlet-native.node'));
    }

    // Create launcher batch script
    const launcherBat = `@echo off
setlocal
set "DIR=%~dp0"
set "APP_DIR=%DIR%resources\\app"
bun run "%APP_DIR%\\main.js" %*
`;

    fs.writeFileSync(path.join(appDir, `${name}.bat`), launcherBat);

    // Generate manifest
    const manifest: AppManifest = {
      name,
      version,
      description: options.description,
      author: options.author,
    };

    fs.writeFileSync(
      path.join(appDir, `${name}.exe.manifest`),
      generateWindowsManifest(manifest)
    );

    // Copy/generate icon
    if (options.icon && fs.existsSync(options.icon)) {
      const iconResult = await generateIconsForPlatform(
        options.icon,
        appDir,
        'win32',
        'app'
      );
      if (!iconResult.success) {
        console.warn(`Warning: Failed to generate icon: ${iconResult.error}`);
      }
    }

    return { success: true, folderPath: appDir };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Build Windows standalone executable using bun build --compile
 * This creates a single .exe file with the Bun runtime embedded
 */
export async function buildWin32Exe(
  options: Win32BuildOptions
): Promise<{ success: boolean; path?: string; error?: string }> {
  const { name, version, buildDir, outDir } = options;

  const exeName = `${name}-${version}-win32-${process.arch}.exe`;
  const exePath = path.join(outDir, exeName);
  const mainJs = path.join(buildDir, 'main.js');

  try {
    if (!fs.existsSync(mainJs)) {
      return {
        success: false,
        error: `Main entry not found: ${mainJs}`,
      };
    }

    // Use bun build --compile to create standalone executable
    try {
      execSync(
        `bun build "${mainJs}" --compile --outfile "${exePath}" --target=bun-windows-x64`,
        {
          stdio: 'pipe',
          cwd: buildDir,
        }
      );
    } catch (e) {
      // If cross-compilation fails, try without target (native platform only)
      if (process.platform === 'win32') {
        execSync(`bun build "${mainJs}" --compile --outfile "${exePath}"`, {
          stdio: 'pipe',
          cwd: buildDir,
        });
      } else {
        throw new Error(
          'Cross-compilation to Windows requires running on Windows or using proper toolchain'
        );
      }
    }

    // Sign if requested and on Windows
    if (options.sign && process.platform === 'win32') {
      try {
        await signExe(exePath, options.sign);
      } catch (e) {
        console.warn(`Warning: Code signing failed: ${e}`);
      }
    }

    return { success: true, path: exePath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create Windows ZIP archive
 */
export async function createWin32Zip(
  folderPath: string,
  outDir: string,
  name: string,
  version: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  const zipName = `${name}-${version}-win32-${process.arch}.zip`;
  const zipPath = path.join(outDir, zipName);

  try {
    // Check if archiver is available via dynamic import
    const archiver = await import('archiver');
    const output = fs.createWriteStream(zipPath);
    const archive = archiver.default('zip', { zlib: { level: 9 } });

    return new Promise((resolve) => {
      output.on('close', () => {
        resolve({ success: true, path: zipPath });
      });

      archive.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      archive.pipe(output);
      archive.directory(folderPath, path.basename(folderPath));
      archive.finalize();
    });
  } catch (error) {
    // Fallback to PowerShell on Windows
    if (process.platform === 'win32') {
      try {
        execSync(
          `powershell -command "Compress-Archive -Path '${folderPath}' -DestinationPath '${zipPath}' -Force"`,
          { stdio: 'pipe' }
        );
        return { success: true, path: zipPath };
      } catch (e) {
        return {
          success: false,
          error: `Failed to create ZIP: ${e}`,
        };
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Sign Windows executable
 */
async function signExe(
  exePath: string,
  options: NonNullable<Win32BuildOptions['sign']>
): Promise<void> {
  const { certificateFile, certificatePassword, timestampServer } = options;

  const signtoolArgs = [
    'signtool',
    'sign',
    '/f',
    `"${certificateFile}"`,
    '/p',
    `"${certificatePassword}"`,
    '/fd',
    'SHA256',
  ];

  if (timestampServer) {
    signtoolArgs.push('/tr', `"${timestampServer}"`, '/td', 'SHA256');
  }

  signtoolArgs.push(`"${exePath}"`);

  execSync(signtoolArgs.join(' '), { stdio: 'pipe' });
}

/**
 * Build Windows package
 */
export async function buildWin32(
  options: Win32BuildOptions,
  format: 'folder' | 'exe' | 'zip' = 'folder'
): Promise<Win32BuildResult> {
  // Always create folder first
  const folderResult = await buildWin32Folder(options);

  if (!folderResult.success) {
    return folderResult;
  }

  const results: Win32BuildResult = {
    success: true,
    folderPath: folderResult.folderPath,
  };

  if (format === 'exe') {
    const exeResult = await buildWin32Exe(options);
    if (exeResult.success) {
      results.exePath = exeResult.path;
    } else {
      console.warn(`Warning: Failed to create exe: ${exeResult.error}`);
    }
  } else if (format === 'zip' && folderResult.folderPath) {
    const zipResult = await createWin32Zip(
      folderResult.folderPath,
      options.outDir,
      options.name,
      options.version
    );
    if (!zipResult.success) {
      console.warn(`Warning: Failed to create ZIP: ${zipResult.error}`);
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
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
