import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';
import type {
  UpdateInfo,
  UpdateCheckResult,
  ProgressInfo,
  UpdateConfig,
  AutoUpdaterEventMap,
  InstallStrategy,
  InstallOptions,
  InstallResult,
  StagedRolloutPolicy,
  RolloutCheckResult,
  ProviderFactory,
  UpdateProvider,
  UpdateFile,
} from './updater/types';
import { GitHubProvider } from './updater/providers/github';
import { GenericProvider } from './updater/providers/generic';
import { compareVersions } from './updater/providers/base';

function shellQuote(str: string): string {
  return `'${str.replace(/'/g, "'\\''")}'`;
}

export class AutoUpdater extends EventEmitter {
  autoDownload = true;
  autoInstallOnAppQuit = true;
  allowDowngrade = false;
  channel: 'stable' | 'beta' | 'alpha' = 'stable';

  private provider: UpdateProvider | null = null;
  private providerFactory: ProviderFactory | null = null;
  private config: UpdateConfig | null = null;
  private currentVersion: string;
  private updateInfo: UpdateInfo | null = null;
  private downloadedPath: string | null = null;
  private downloadedFileInfo: UpdateFile | null = null;
  private updateDir: string;
  private installStrategies: Map<string, InstallStrategy> = new Map();
  private rolloutPolicy: StagedRolloutPolicy | null = null;

  constructor() {
    super();
    this.currentVersion = this.getCurrentVersion();
    this.updateDir = path.join(os.tmpdir(), 'bunlet-updates');
    this.registerDefaultInstallStrategies();
  }

  setFeedURL(config: UpdateConfig): void {
    this.config = config;
    this.channel = config.channel || 'stable';
    this.provider = this.createProvider(config);
  }

  setProviderFactory(factory: ProviderFactory): void {
    this.providerFactory = factory;
  }

  setProvider(provider: UpdateProvider): void {
    this.provider = provider;
  }

  registerInstallStrategy(platform: string, strategy: InstallStrategy): void {
    this.installStrategies.set(platform, strategy);
  }

  setRolloutPolicy(policy: StagedRolloutPolicy): void {
    this.rolloutPolicy = policy;
  }

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

      if (this.rolloutPolicy) {
        const rolloutCheck = this.evaluateRollout(this.rolloutPolicy, updateInfo);
        if (!rolloutCheck.isEligible) {
          this.emit('update-not-available', updateInfo);
          return {
            updateInfo,
            isAvailable: false,
          };
        }
      }

      const comparison = compareVersions(updateInfo.version, this.currentVersion);
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

  async checkForUpdatesAndNotify(): Promise<UpdateCheckResult> {
    const result = await this.checkForUpdates();

    if (result.isAvailable && result.updateInfo) {
      console.log(`Update available: ${result.updateInfo.version}`);
    }

    return result;
  }

  async downloadUpdate(): Promise<string[]> {
    if (!this.provider || !this.updateInfo) {
      throw new Error('No update available to download');
    }

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

      await this.verifyUpdateIntegrity(destPath, file);

      this.downloadedPath = destPath;
      this.downloadedFileInfo = file;
      this.emit('update-downloaded', this.updateInfo);

      return [destPath];
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      throw err;
    }
  }

  async quitAndInstall(isSilent = false, isForceRunAfter = false): Promise<void> {
    if (!this.downloadedPath) {
      throw new Error('No update downloaded');
    }

    const file = this.downloadedFileInfo || this.updateInfo?.files[0];
    if (file?.sha512) {
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
    }

    const platform = process.platform;
    const strategy = this.installStrategies.get(platform);

    if (strategy) {
      const installOptions: InstallOptions = {
        isSilent,
        isForceRunAfter,
        appName: this.updateInfo?.artifact?.appName,
      };

      const result = await strategy.install(
        this.downloadedPath,
        file || { url: this.downloadedPath, sha512: '', size: 0 },
        installOptions
      );

      if (result.requiresRestart) {
        process.exit(0);
      }
    } else {
      throw new Error(`No install strategy registered for platform: ${platform}`);
    }
  }

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

  private calculateSHA512(filePath: string): string {
    const data = fs.readFileSync(filePath);
    const hasher = new Bun.CryptoHasher('sha512');
    hasher.update(data);
    return hasher.digest('hex');
  }

  private getCurrentVersion(): string {
    if (process.env.BUNLET_APP_VERSION) {
      return process.env.BUNLET_APP_VERSION;
    }

    const candidates = [
      path.join(process.cwd(), 'package.json'),
      path.join(path.dirname(process.execPath), 'package.json'),
    ];

    for (const pkgPath of candidates) {
      try {
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: string };
          if (pkg.version) return pkg.version;
        }
      } catch {
        // skip unreadable
      }
    }

    return '0.0.0';
  }

  private createProvider(config: UpdateConfig): UpdateProvider {
    if (this.providerFactory) {
      return this.providerFactory.createProvider(config);
    }

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

  private registerDefaultInstallStrategies(): void {
    this.installStrategies.set('darwin', new DarwinInstallStrategy(this.updateDir));
    this.installStrategies.set('win32', new WindowsInstallStrategy());
    this.installStrategies.set('linux', new LinuxInstallStrategy());
  }

  private evaluateRollout(policy: StagedRolloutPolicy, info: UpdateInfo): RolloutCheckResult {
    const userId = policy.userId || this.getMachineId();
    const bucket = this.computeBucket(userId, info.version);
    const evaluatedPercentage = Math.min(100, Math.max(0, policy.rolloutPercentage));
    const isEligible = bucket < evaluatedPercentage;

    return {
      isEligible,
      evaluatedPercentage,
      userBucket: bucket,
    };
  }

  private computeBucket(userId: string, version: string): number {
    const hash = crypto.createHash('sha256').update(`${userId}:${version}`).digest('hex');
    return parseInt(hash.slice(0, 8), 16) % 100;
  }

  private getMachineId(): string {
    try {
      const machineId = crypto.createHash('sha256')
        .update(os.hostname() + os.userInfo().username)
        .digest('hex');
      return machineId;
    } catch {
      return 'unknown';
    }
  }

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

export class DarwinInstallStrategy implements InstallStrategy {
  private updateDir: string;

  constructor(updateDir: string) {
    this.updateDir = updateDir;
  }

  supportsFile(ext: string): boolean {
    return ['.dmg', '.zip', '.pkg'].includes(ext);
  }

  async install(
    updatePath: string,
    fileInfo: UpdateFile,
    options: InstallOptions
  ): Promise<InstallResult> {
    const ext = path.extname(updatePath).toLowerCase();

    if (ext === '.dmg') {
      return this.installFromDmg(updatePath, options);
    } else if (ext === '.zip') {
      return this.installFromZip(updatePath, options);
    } else if (ext === '.pkg') {
      return this.installPkg(updatePath, options);
    }

    throw new Error(`Unsupported macOS update format: ${ext}`);
  }

  private async installFromDmg(updatePath: string, options: InstallOptions): Promise<InstallResult> {
    const mountResults = require('child_process').execSync(
      `hdiutil attach ${shellQuote(updatePath)} -nobrowse -quiet`,
      { encoding: 'utf-8', stdio: options.isSilent ? 'ignore' : 'pipe' }
    );

    const volumeMatch = mountResults.match(/\/Volumes\/[^\n]+/);
    if (!volumeMatch) {
      throw new Error('Failed to mount DMG: could not find volume path');
    }
    const volume = volumeMatch[0].trim();

    try {
      const apps = fs.readdirSync(volume).filter((f: string) => f.endsWith('.app'));
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
            { stdio: options.isSilent ? 'ignore' : 'inherit' }
          );
        } catch {
          // Ignore failure to quit the current app
        }

        require('child_process').execSync(`open ${shellQuote(destPath)}`, {
          stdio: options.isSilent ? 'ignore' : 'inherit',
        });

        return { requiresRestart: true, installedPath: destPath };
      }
    } finally {
      require('child_process').execSync(`hdiutil detach ${shellQuote(volume)} -quiet`, {
        stdio: 'ignore',
      });
    }

    return { requiresRestart: true };
  }

  private async installFromZip(updatePath: string, options: InstallOptions): Promise<InstallResult> {
    const { execSync } = require('child_process') as typeof import('child_process');
    const tempDir = path.join(this.updateDir, 'unzip');

    execSync(`unzip -o ${shellQuote(updatePath)} -d ${shellQuote(tempDir)}`, { stdio: 'ignore' });

    const apps = fs.readdirSync(tempDir).filter((f: string) => f.endsWith('.app'));
    if (apps.length > 0) {
      const appPath = path.join(tempDir, apps[0]);
      const destPath = `/Applications/${apps[0]}`;
      if (fs.existsSync(destPath)) {
        fs.rmSync(destPath, { recursive: true, force: true });
      }
      fs.cpSync(appPath, destPath, { recursive: true });
      execSync(`open ${shellQuote(destPath)}`, { stdio: 'ignore' });
      return { requiresRestart: true, installedPath: destPath };
    }

    return { requiresRestart: true };
  }

  private async installPkg(updatePath: string, options: InstallOptions): Promise<InstallResult> {
    const args = ['-pkg', updatePath, '-target', '/'];
    if (options.isSilent) {
      args.push('-quiet');
    }

    require('child_process').execSync(`installer ${args.map(shellQuote).join(' ')}`, {
      stdio: options.isSilent ? 'ignore' : 'inherit',
    });

    return { requiresRestart: true };
  }
}

export class WindowsInstallStrategy implements InstallStrategy {
  supportsFile(ext: string): boolean {
    return ['.exe', '.msi'].includes(ext);
  }

  async install(
    updatePath: string,
    fileInfo: UpdateFile,
    options: InstallOptions
  ): Promise<InstallResult> {
    const ext = path.extname(updatePath).toLowerCase();
    const { spawn } = require('child_process') as typeof import('child_process');

    if (ext === '.exe') {
      const args: string[] = options.isSilent ? ['/S'] : [];
      if (options.isForceRunAfter) {
        args.push('/run');
      }

      spawn(updatePath, args, {
        detached: true,
        stdio: 'ignore',
      }).unref();

      return {
        requiresRestart: true,
        restartCommand: [updatePath, ...args],
      };
    } else if (ext === '.msi') {
      const args = ['msiexec', '/i', updatePath];
      if (options.isSilent) {
        args.push('/quiet');
      }

      spawn(args[0], args.slice(1), {
        detached: true,
        stdio: 'ignore',
      }).unref();

      return {
        requiresRestart: true,
        restartCommand: args,
      };
    }

    throw new Error(`Unsupported Windows update format: ${ext}`);
  }
}

export class LinuxInstallStrategy implements InstallStrategy {
  supportsFile(ext: string): boolean {
    return ['.appimage', '.deb', '.rpm'].includes(ext);
  }

  async install(
    updatePath: string,
    fileInfo: UpdateFile,
    options: InstallOptions
  ): Promise<InstallResult> {
    const ext = path.extname(updatePath).toLowerCase();

    if (ext === '.appimage') {
      return this.installAppImage(updatePath);
    } else if (ext === '.deb') {
      return this.installDeb(updatePath, options);
    } else if (ext === '.rpm') {
      return this.installRpm(updatePath, options);
    }

    throw new Error(`Unsupported Linux update format: ${ext}`);
  }

  private async installAppImage(updatePath: string): Promise<InstallResult> {
    const currentPath = process.execPath;
    fs.chmodSync(updatePath, 0o755);
    const backupPath = currentPath + '.bak';
    try {
      fs.renameSync(currentPath, backupPath);
      fs.renameSync(updatePath, currentPath);
    } catch {
      fs.copyFileSync(updatePath, currentPath);
      try { fs.unlinkSync(updatePath); } catch { /* ignore */ }
    }

    const { spawn } = require('child_process') as typeof import('child_process');
    spawn(currentPath, [], {
      detached: true,
      stdio: 'ignore',
    }).unref();

    return {
      requiresRestart: true,
      installedPath: currentPath,
    };
  }

  private async installDeb(updatePath: string, options: InstallOptions): Promise<InstallResult> {
    const { spawn } = require('child_process') as typeof import('child_process');
    spawn('sudo', ['dpkg', '-i', updatePath], {
      detached: true,
      stdio: options.isSilent ? 'ignore' : 'inherit',
    }).unref();

    return { requiresRestart: true };
  }

  private async installRpm(updatePath: string, options: InstallOptions): Promise<InstallResult> {
    const { spawn } = require('child_process') as typeof import('child_process');
    spawn('sudo', ['rpm', '-Uvh', updatePath], {
      detached: true,
      stdio: options.isSilent ? 'ignore' : 'inherit',
    }).unref();

    return { requiresRestart: true };
  }
}

export const autoUpdater = new AutoUpdater();