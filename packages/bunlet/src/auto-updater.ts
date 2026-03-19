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

    const file = this.updateInfo.files[0];
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
   * Compare two versions
   */
  private compareVersions(a: string, b: string): number {
    const partsA = a.replace(/^v/, '').split(/[.-]/).map((p) => parseInt(p, 10) || 0);
    const partsB = b.replace(/^v/, '').split(/[.-]/).map((p) => parseInt(p, 10) || 0);

    const maxLength = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < maxLength; i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;

      if (numA > numB) return 1;
      if (numA < numB) return -1;
    }

    return 0;
  }

  /**
   * Install update on macOS
   */
  private installMacOS(updatePath: string, isSilent: boolean): void {
    const ext = path.extname(updatePath).toLowerCase();

    if (ext === '.dmg') {
      // Mount DMG and copy app
      const script = `
        hdiutil attach "${updatePath}" -nobrowse -quiet
        # Find mounted volume and app
        VOLUME=$(hdiutil info | grep -o '/Volumes/[^"]*' | head -1)
        APP=$(ls "$VOLUME"/*.app 2>/dev/null | head -1)
        if [ -n "$APP" ]; then
          # Quit current app, copy new app, restart
          osascript -e 'tell application "System Events" to quit application "${process.title}"' 2>/dev/null || true
          rm -rf "/Applications/$(basename "$APP")"
          cp -R "$APP" /Applications/
          hdiutil detach "$VOLUME" -quiet
          open "/Applications/$(basename "$APP")"
        fi
      `;

      const { execSync } = require('child_process');
      execSync(script, { stdio: isSilent ? 'ignore' : 'inherit' });
    } else if (ext === '.zip') {
      // Unzip and copy app
      const { execSync } = require('child_process');
      const tempDir = path.join(this.updateDir, 'unzip');

      execSync(`unzip -o "${updatePath}" -d "${tempDir}"`, { stdio: 'ignore' });

      const apps = fs.readdirSync(tempDir).filter((f) => f.endsWith('.app'));
      if (apps.length > 0) {
        const appPath = path.join(tempDir, apps[0]);
        execSync(`rm -rf "/Applications/${apps[0]}"`, { stdio: 'ignore' });
        execSync(`cp -R "${appPath}" /Applications/`, { stdio: 'ignore' });
        execSync(`open "/Applications/${apps[0]}"`, { stdio: 'ignore' });
      }
    }

    process.exit(0);
  }

  /**
   * Install update on Windows
   */
  private installWindows(updatePath: string, isSilent: boolean, isForceRunAfter: boolean): void {
    const ext = path.extname(updatePath).toLowerCase();
    const { execSync, spawn } = require('child_process');

    if (ext === '.exe') {
      // Run installer
      const args = isSilent ? ['/S'] : [];
      if (isForceRunAfter) {
        args.push('/run');
      }

      // Spawn installer and exit
      spawn(updatePath, args, {
        detached: true,
        stdio: 'ignore',
      }).unref();
    } else if (ext === '.msi') {
      // Run MSI installer
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
    const { execSync, spawn } = require('child_process');

    if (ext === '.appimage') {
      // Replace AppImage
      const currentPath = process.execPath;
      fs.chmodSync(updatePath, 0o755);
      fs.renameSync(updatePath, currentPath);

      // Restart
      spawn(currentPath, [], {
        detached: true,
        stdio: 'ignore',
      }).unref();
    } else if (ext === '.deb') {
      // Install deb package
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
