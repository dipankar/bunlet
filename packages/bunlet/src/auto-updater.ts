/**
 * AutoUpdater
 *
 * Automatic update system for Bunlet applications.
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import type {
  UpdateInfo,
  UpdateCheckResult,
  ProgressInfo,
  UpdateConfig,
  AutoUpdaterEventMap,
} from './updater/types';
import type { UpdateProvider } from './updater/providers/base';
import { GitHubProvider } from './updater/providers/github';
import { GenericProvider } from './updater/providers/generic';
import { BaseProvider } from './updater/providers/base';

/**
 * Shell-quote a string for safe use in shell commands.
 * Wraps the string in single quotes and escapes any embedded single quotes.
 */
function shellQuote(str: string): string {
  return `'${str.replace(/'/g, "'\\''")}'`;
}

/**
 * AutoUpdater class
 */
export class AutoUpdater extends EventEmitter {
  /** Automatically download updates when available */
  autoDownload = true;

  /** Automatically install updates when app quits */
  autoInstallOnAppQuit = true;

  /** Allow downgrading to older versions */
  allowDowngrade = false;

  /** Release channel */
  channel: 'stable' | 'beta' | 'alpha' = 'stable';

  private provider: UpdateProvider | null = null;
  private config: UpdateConfig | null = null;
  private currentVersion: string;
  private updateInfo: UpdateInfo | null = null;
  private downloadedPath: string | null = null;
  private updateDir: string;

  constructor() {
    super();
    this.currentVersion = this.getCurrentVersion();
    this.updateDir = path.join(os.tmpdir(), 'bunlet-updates');
  }

  /**
   * Set update configuration
   */
  setFeedURL(config: UpdateConfig): void {
    this.config = config;
    this.channel = config.channel || 'stable';
    this.provider = this.createProvider(config);
  }

  /**
   * Check for updates
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    if (!this.provider) {
      throw new Error('Update feed URL not set. Call setFeedURL first.');
    }

    this.emit('checking-for-update');

    try {
      const updateInfo = await this.provider.getLatestVersion();

      if (!updateInfo) {
        const result: UpdateCheckResult = {
          updateInfo: null,
          isAvailable: false,
        };
        this.emit('update-not-available', { version: this.currentVersion } as UpdateInfo);
        return result;
      }

      const comparison = this.compareVersions(updateInfo.version, this.currentVersion);
      const isAvailable = comparison > 0 || (this.allowDowngrade && comparison < 0);

      if (isAvailable) {
        this.updateInfo = updateInfo;
        this.emit('update-available', updateInfo);

        if (this.autoDownload) {
          this.downloadUpdate();
        }
      } else {
        this.emit('update-not-available', updateInfo);
      }

      return {
        updateInfo,
        isAvailable,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Check for updates and show notification
   */
  async checkForUpdatesAndNotify(): Promise<UpdateCheckResult> {
    const result = await this.checkForUpdates();

    if (result.isAvailable && result.updateInfo) {
      // Could integrate with native notifications here
      console.log(`Update available: ${result.updateInfo.version}`);
    }

    return result;
  }

  /**
   * Download the update
   */
  async downloadUpdate(): Promise<string[]> {
    if (!this.provider || !this.updateInfo) {
      throw new Error('No update available to download');
    }

    // Create update directory
    if (!fs.existsSync(this.updateDir)) {
      fs.mkdirSync(this.updateDir, { recursive: true });
    }

    const file = this.updateInfo!.files[0];
    if (!file) {
      throw new Error('No update file available');
    }

    const filename = path.basename(file.url);
    const destPath = path.join(this.updateDir, filename);

    try {
      await this.provider.downloadUpdate(
        this.updateInfo,
        destPath,
        (progress: ProgressInfo) => {
          this.emit('download-progress', progress);
        }
      );

      // Verify artifact integrity against manifest hashes before accepting the download
      await this.verifyUpdateIntegrity(destPath, file);

      this.downloadedPath = destPath;
      this.emit('update-downloaded', this.updateInfo);

      return [destPath];
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Quit and install the update
   */
  quitAndInstall(isSilent = false, isForceRunAfter = false): void {
    if (!this.downloadedPath) {
      throw new Error('No update downloaded');
    }

    // Re-verify integrity before installation
    const file = this.updateInfo?.files[0];
    if (file?.sha512) {
      try {
        const hash = this.calculateSHA512(this.downloadedPath);
        if (hash !== file.sha512) {
          throw new Error(
            `Update integrity check failed before install.\n` +
            `Expected: ${file.sha512}\n` +
            `Actual: ${hash}\n` +
            `File: ${this.downloadedPath}\n` +
            `The download may have been tampered with. Aborting installation.`
          );
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('integrity check failed')) {
          throw err;
        }
        // If we can't verify (e.g. no crypto), warn but proceed
        console.warn('[bunlet] Warning: Could not re-verify update integrity before install:', err);
      }
    }

    // Platform-specific installation
    const platform = process.platform;
    const downloadedPath = this.downloadedPath;

    if (platform === 'darwin') {
      this.installMacOS(downloadedPath, isSilent);
    } else if (platform === 'win32') {
      this.installWindows(downloadedPath, isSilent, isForceRunAfter);
    } else if (platform === 'linux') {
      this.installLinux(downloadedPath, isSilent);
    }
  }

  /**
   * Verify the downloaded file's integrity against the manifest hash
   */
  private async verifyUpdateIntegrity(
    filePath: string,
    fileInfo: { sha512?: string; url: string }
  ): Promise<void> {
    if (!fileInfo.sha512) {
      console.warn('[bunlet] Update manifest has no sha512 hash - skipping integrity verification');
      return;
    }

    const hash = this.calculateSHA512(filePath);
    if (hash !== fileInfo.sha512) {
      // Delete the corrupted file
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Ignore cleanup errors
      }
      throw new Error(
        `Update integrity verification failed!\n` +
        `Expected SHA-512: ${fileInfo.sha512}\n` +
        `Actual SHA-512:   ${hash}\n` +
        `File: ${path.basename(fileInfo.url)}\n` +
        `\n` +
        `The downloaded file does not match the manifest hash. ` +
        `This could mean the download was corrupted or tampered with. ` +
        `The file has been deleted for safety.`
      );
    }

    this.emit('update-verified', { file: path.basename(fileInfo.url), hash });
  }

  /**
   * Calculate SHA-512 hash of a file
   */
  private calculateSHA512(filePath: string): string {
    const data = fs.readFileSync(filePath);
    const hasher = new Bun.CryptoHasher('sha512');
    hasher.update(data);
    return hasher.digest('hex');
  }

  /**
   * Get the current app version
   */
  private getCurrentVersion(): string {
    // Try to get version from package.json
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        return pkg.version || '0.0.0';
      }
    } catch {
      // Ignore
    }

    // Try environment variable
    if (process.env.npm_package_version) {
      return process.env.npm_package_version;
    }

    return '0.0.0';
  }

  /**
   * Create update provider from config
   */
  private createProvider(config: UpdateConfig): UpdateProvider {
    switch (config.provider) {
      case 'github':
        if (!config.github) {
          throw new Error('GitHub provider requires github config');
        }
        return new GitHubProvider({
          ...config.github,
          channel: this.channel,
        });

      case 'generic':
        if (!config.generic) {
          throw new Error('Generic provider requires generic config');
        }
        return new GenericProvider({
          ...config.generic,
          channel: this.channel,
        });

      case 's3':
        // S3 provider uses generic provider with S3 URL
        if (!config.s3) {
          throw new Error('S3 provider requires s3 config');
        }
        const s3Url = `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com${config.s3.path || ''}`;
        return new GenericProvider({
          url: s3Url,
          channel: this.channel,
        });

      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  /**
   * Compare two versions using shared semver-lite logic.
   * Delegates to BaseProvider.compareVersions for consistency with update providers.
   */
  private compareVersions(a: string, b: string): number {
    return versionComparer.compareVersions(a, b);
  }

  /**
   * Install update on macOS
   */
  private installMacOS(updatePath: string, isSilent: boolean): void {
    const ext = path.extname(updatePath).toLowerCase();

    if (ext === '.dmg') {
      const mountResults = require('child_process').execSync(
        `hdiutil attach ${shellQuote(updatePath)} -nobrowse -quiet`,
        { encoding: 'utf-8', stdio: isSilent ? 'ignore' : 'pipe' }
      );

      const volumeMatch = mountResults.match(/\/Volumes\/[^\n]+/);
      if (!volumeMatch) {
        throw new Error('Failed to mount DMG: could not find volume path');
      }
      const volume = volumeMatch[0].trim();

      try {
        const apps = fs.readdirSync(volume).filter((f) => f.endsWith('.app'));
        if (apps.length > 0) {
          const appPath = path.join(volume, apps[0]);
          const destPath = `/Applications/${apps[0]}`;
          if (fs.existsSync(destPath)) {
            fs.rmSync(destPath, { recursive: true, force: true });
          }
          fs.cpSync(appPath, destPath, { recursive: true });

          try {
            require('child_process').execSync(
              `osascript -e 'tell application "System Events" to quit application ${shellQuote(process.title || 'bunlet')}'`,
              { stdio: isSilent ? 'ignore' : 'inherit' }
            );
          } catch {
            // Ignore failure to quit the current app
          }

          require('child_process').execSync(`open ${shellQuote(destPath)}`, {
            stdio: isSilent ? 'ignore' : 'inherit',
          });
        }
      } finally {
        require('child_process').execSync(`hdiutil detach ${shellQuote(volume)} -quiet`, {
          stdio: 'ignore',
        });
      }
    } else if (ext === '.zip') {
      const { execSync } = require('child_process') as typeof import('child_process');
      const tempDir = path.join(this.updateDir, 'unzip');

      execSync(`unzip -o ${shellQuote(updatePath)} -d ${shellQuote(tempDir)}`, { stdio: 'ignore' });

      const apps = fs.readdirSync(tempDir).filter((f) => f.endsWith('.app'));
      if (apps.length > 0) {
        const appPath = path.join(tempDir, apps[0]);
        const destPath = `/Applications/${apps[0]}`;
        if (fs.existsSync(destPath)) {
          fs.rmSync(destPath, { recursive: true, force: true });
        }
        fs.cpSync(appPath, destPath, { recursive: true });
        execSync(`open ${shellQuote(destPath)}`, { stdio: 'ignore' });
      }
    }

    process.exit(0);
  }

  /**
   * Install update on Windows
   */
  private installWindows(updatePath: string, isSilent: boolean, isForceRunAfter: boolean): void {
    const ext = path.extname(updatePath).toLowerCase();
    const { spawn } = require('child_process') as typeof import('child_process');

    if (ext === '.exe') {
      const args = isSilent ? ['/S'] : [];
      if (isForceRunAfter) {
        args.push('/run');
      }

      spawn(updatePath, args, {
        detached: true,
        stdio: 'ignore',
      }).unref();
    } else if (ext === '.msi') {
      const args = ['msiexec', '/i', updatePath];
      if (isSilent) {
        args.push('/quiet');
      }

      spawn(args[0], args.slice(1), {
        detached: true,
        stdio: 'ignore',
      }).unref();
    }

    process.exit(0);
  }

  /**
   * Install update on Linux
   */
  private installLinux(updatePath: string, isSilent: boolean): void {
    const ext = path.extname(updatePath).toLowerCase();

    if (ext === '.appimage') {
      // Replace AppImage
      const currentPath = process.execPath;
      fs.chmodSync(updatePath, 0o755);
      const backupPath = currentPath + '.bak';
      try {
        fs.renameSync(currentPath, backupPath);
        fs.renameSync(updatePath, currentPath);
      } catch {
        // If rename fails (e.g. across filesystems), use copy
        fs.copyFileSync(updatePath, currentPath);
        try { fs.unlinkSync(updatePath); } catch { /* ignore */ }
      }

      // Restart
      const { spawn } = require('child_process') as typeof import('child_process');
      spawn(currentPath, [], {
        detached: true,
        stdio: 'ignore',
      }).unref();
    } else if (ext === '.deb') {
      const { spawn } = require('child_process') as typeof import('child_process');
      spawn('sudo', ['dpkg', '-i', updatePath], {
        detached: true,
        stdio: isSilent ? 'ignore' : 'inherit',
      }).unref();
    }

    process.exit(0);
  }

  // Type-safe event emitter methods
  on<K extends keyof AutoUpdaterEventMap>(
    event: K,
    listener: AutoUpdaterEventMap[K]
  ): this {
    return super.on(event, listener);
  }

  once<K extends keyof AutoUpdaterEventMap>(
    event: K,
    listener: AutoUpdaterEventMap[K]
  ): this {
    return super.once(event, listener);
  }

  emit<K extends keyof AutoUpdaterEventMap>(
    event: K,
    ...args: Parameters<AutoUpdaterEventMap[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

/**
 * Singleton instance
 */
export const autoUpdater = new AutoUpdater();

/**
 * Shared version comparer — a minimal BaseProvider subclass used only
 * for the compareVersions method so AutoUpdater doesn't duplicate the logic.
 */
class VersionComparer extends BaseProvider {
  constructor() { super(); }
  async getLatestVersion() { return null; }
  getDownloadUrl() { return ''; }
}
const versionComparer = new VersionComparer();
