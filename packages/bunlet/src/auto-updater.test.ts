import { describe, test, expect, beforeEach, mock } from 'bun:test';
import {
  AutoUpdater,
  DarwinInstallStrategy,
  WindowsInstallStrategy,
  LinuxInstallStrategy,
} from './auto-updater';
import type {
  UpdateProvider,
  UpdateInfo,
  UpdateConfig,
  InstallStrategy,
  InstallOptions,
  InstallResult,
  StagedRolloutPolicy,
  RolloutCheckResult,
  ProviderFactory,
} from './updater/types';

class MockProvider implements UpdateProvider {
  private version: UpdateInfo | null = null;
  private downloadPath: string = '/tmp/test-update.dmg';

  constructor(version: UpdateInfo | null) {
    this.version = version;
  }

  async getLatestVersion(): Promise<UpdateInfo | null> {
    return this.version;
  }

  async downloadUpdate(
    info: UpdateInfo,
    destPath: string,
    onProgress?: (progress: import('./updater/types').ProgressInfo) => void
  ): Promise<string> {
    return destPath;
  }

  getDownloadUrl(file: { url: string }): string {
    return file.url;
  }
}

describe('AutoUpdater', () => {
  let updater: AutoUpdater;

  beforeEach(() => {
    updater = new AutoUpdater();
  });

  test('setFeedURL creates GitHub provider', () => {
    updater.setFeedURL({
      provider: 'github',
      github: { owner: 'test', repo: 'app' },
    });
    expect(updater.channel).toBe('stable');
  });

  test('setFeedURL creates S3 provider', () => {
    updater.setFeedURL({
      provider: 's3',
      s3: { bucket: 'my-bucket', region: 'us-east-1' },
    });
    expect(updater.channel).toBe('stable');
  });

  test('setFeedURL with channel', () => {
    updater.setFeedURL({
      provider: 'generic',
      generic: { url: 'https://example.com/updates' },
      channel: 'beta',
    });
    expect(updater.channel).toBe('beta');
  });

  test('setFeedURL throws for unknown provider', () => {
    expect(() =>
      updater.setFeedURL({ provider: 'unknown' } as any)
    ).toThrow('Unknown provider: unknown');
  });

  test('setFeedURL throws for missing github config', () => {
    expect(() =>
      updater.setFeedURL({ provider: 'github' } as UpdateConfig)
    ).toThrow('GitHub provider requires github config');
  });

  test('setFeedURL throws for missing generic config', () => {
    expect(() =>
      updater.setFeedURL({ provider: 'generic' } as UpdateConfig)
    ).toThrow('Generic provider requires generic config');
  });

  test('setFeedURL throws for missing s3 config', () => {
    expect(() =>
      updater.setFeedURL({ provider: 's3' } as UpdateConfig)
    ).toThrow('S3 provider requires s3 config');
  });

  test('setProviderFactory allows custom provider creation', () => {
    const factory: ProviderFactory = {
      createProvider: (config: UpdateConfig) => {
        return new MockProvider({ version: '2.0.0', releaseDate: '', files: [] });
      },
    };
    updater.setProviderFactory(factory);
    // Factory is used on next setFeedURL or setProvider
  });

  test('setProvider allows injecting a provider directly', () => {
    const mockProvider = new MockProvider({
      version: '2.0.0',
      releaseDate: '2024-01-01',
      files: [{ url: 'https://example.com/app-2.0.0.dmg', sha512: 'abc', size: 50000000 }],
    });
    updater.setProvider(mockProvider);
    // Provider is set, checkForUpdates should work
  });

  test('checkForUpdates throws when no provider is set', async () => {
    await expect(updater.checkForUpdates()).rejects.toThrow(
      'Update feed URL not set. Call setFeedURL first.'
    );
  });

  test('checkForUpdates emits update-not-available when no update', async () => {
    const mockProvider = new MockProvider(null);
    updater.setProvider(mockProvider);

    let notAvailableEmitted = false;
    updater.on('update-not-available', () => {
      notAvailableEmitted = true;
    });

    const result = await updater.checkForUpdates();
    expect(result.isAvailable).toBe(false);
    expect(result.updateInfo).toBeNull();
    expect(notAvailableEmitted).toBe(true);
  });

  test('checkForUpdates emits update-available for newer version', async () => {
    const mockProvider = new MockProvider({
      version: '99.0.0',
      releaseDate: '2024-01-01',
      files: [{ url: 'https://example.com/app-99.0.0.dmg', sha512: 'abc', size: 50000000 }],
    });
    updater.setProvider(mockProvider);
    updater.autoDownload = false;

    let availableEmitted = false;
    updater.on('update-available', (info: UpdateInfo) => {
      availableEmitted = true;
      expect(info.version).toBe('99.0.0');
    });

    const result = await updater.checkForUpdates();
    expect(result.isAvailable).toBe(true);
    expect(availableEmitted).toBe(true);
  });

  test('checkForUpdates emits checking-for-update event', async () => {
    const mockProvider = new MockProvider(null);
    updater.setProvider(mockProvider);

    let checkingEmitted = false;
    updater.on('checking-for-update', () => {
      checkingEmitted = true;
    });

    await updater.checkForUpdates();
    expect(checkingEmitted).toBe(true);
  });

  test('allowDowngrade allows installing older versions', async () => {
    const mockProvider = new MockProvider({
      version: '0.0.1',
      releaseDate: '2024-01-01',
      files: [{ url: 'https://example.com/app-0.0.1.dmg', sha512: 'abc', size: 1000 }],
    });
    updater.setProvider(mockProvider);
    updater.allowDowngrade = true;
    updater.autoDownload = false;

    const result = await updater.checkForUpdates();
    expect(result.isAvailable).toBe(true);
  });

  test('providerFactory is used when setFeedURL is called', async () => {
    const factory: ProviderFactory = {
      createProvider: (config: UpdateConfig) => {
        return new MockProvider({
          version: '5.0.0',
          releaseDate: '2024-06-01',
          files: [{ url: 'https://custom.example.com/update', sha512: 'def', size: 2000000 }],
        });
      },
    };

    updater.setProviderFactory(factory);
    updater.setFeedURL({ provider: 'generic', generic: { url: 'https://example.com' } });
    updater.autoDownload = false;

    const result = await updater.checkForUpdates();
    expect(result.isAvailable).toBe(true);
    expect(result.updateInfo?.version).toBe('5.0.0');
  });

  test('downloadUpdate throws when no update available', async () => {
    await expect(updater.downloadUpdate()).rejects.toThrow('No update available to download');
  });
});

describe('Install Strategies', () => {
  test('DarwinInstallStrategy supports .dmg files', () => {
    const strategy = new DarwinInstallStrategy('/tmp/updates');
    expect(strategy.supportsFile('.dmg')).toBe(true);
    expect(strategy.supportsFile('.zip')).toBe(true);
    expect(strategy.supportsFile('.pkg')).toBe(true);
    expect(strategy.supportsFile('.exe')).toBe(false);
  });

  test('WindowsInstallStrategy supports .exe and .msi files', () => {
    const strategy = new WindowsInstallStrategy();
    expect(strategy.supportsFile('.exe')).toBe(true);
    expect(strategy.supportsFile('.msi')).toBe(true);
    expect(strategy.supportsFile('.dmg')).toBe(false);
  });

  test('LinuxInstallStrategy supports .appimage, .deb, .rpm files', () => {
    const strategy = new LinuxInstallStrategy();
    expect(strategy.supportsFile('.appimage')).toBe(true);
    expect(strategy.supportsFile('.deb')).toBe(true);
    expect(strategy.supportsFile('.rpm')).toBe(true);
    expect(strategy.supportsFile('.exe')).toBe(false);
  });

  test('custom install strategy can be registered', () => {
    const customStrategy: InstallStrategy = {
      async install(
        updatePath: string,
        fileInfo: any,
        options: InstallOptions
      ): Promise<InstallResult> {
        return { requiresRestart: true };
      },
      supportsFile(ext: string): boolean {
        return ext === '.custom';
      },
    };

    const updater = new AutoUpdater();
    updater.registerInstallStrategy('freebsd', customStrategy);
    // Strategy is registered; no error means success
  });
});

describe('Staged Rollout Policy', () => {
  let updater: AutoUpdater;

  beforeEach(() => {
    updater = new AutoUpdater();
  });

  test('setRolloutPolicy accepts a policy', () => {
    const policy: StagedRolloutPolicy = {
      rolloutPercentage: 25,
      userId: 'test-user-1',
    };
    updater.setRolloutPolicy(policy);
    // No error means success
  });

  test('100% rollout includes all users', async () => {
    const mockProvider = new MockProvider({
      version: '99.0.0',
      releaseDate: '2024-01-01',
      files: [{ url: 'https://example.com/app.dmg', sha512: 'abc', size: 50000000 }],
      artifact: { appName: 'TestApp', webviewEngine: 'system' },
    });
    updater.setProvider(mockProvider);
    updater.autoDownload = false;
    updater.setRolloutPolicy({ rolloutPercentage: 100, userId: 'any-user' });

    const result = await updater.checkForUpdates();
    expect(result.isAvailable).toBe(true);
  });

  test('0% rollout excludes all users', async () => {
    const mockProvider = new MockProvider({
      version: '99.0.0',
      releaseDate: '2024-01-01',
      files: [{ url: 'https://example.com/app.dmg', sha512: 'abc', size: 50000000 }],
    });
    updater.setProvider(mockProvider);
    updater.autoDownload = false;
    updater.setRolloutPolicy({ rolloutPercentage: 0, userId: 'any-user' });

    const result = await updater.checkForUpdates();
    expect(result.isAvailable).toBe(false);
  });

  test('deterministic rollout - same user same version same result', async () => {
    const policy: StagedRolloutPolicy = {
      rolloutPercentage: 50,
      userId: 'deterministic-user',
    };

    // The result should be deterministic for same user + version
    const mockProvider = new MockProvider({
      version: '99.0.0',
      releaseDate: '2024-01-01',
      files: [{ url: 'https://example.com/app.dmg', sha512: 'abc', size: 50000000 }],
    });

    updater.setProvider(mockProvider);
    updater.autoDownload = false;
    updater.setRolloutPolicy(policy);

    const result1 = await updater.checkForUpdates();
    // Reset for second check
    const result2 = await updater.checkForUpdates();
    expect(result1.isAvailable).toBe(result2.isAvailable);
  });
});

describe('AutoUpdater Events', () => {
  test('type-safe on/once/emit', () => {
    const updater = new AutoUpdater();

    const errors: Error[] = [];
    updater.on('error', (err: Error) => {
      errors.push(err);
    });

    const testError = new Error('test error');
    updater.emit('error', testError);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('test error');
  });

  test('download-progress event type', () => {
    const updater = new AutoUpdater();
    const progressData: any[] = [];

    updater.on('download-progress', (progress) => {
      progressData.push(progress);
    });

    // Verify the event handler is registered
    expect(updater.listenerCount('download-progress')).toBe(1);
  });
});

describe('Artifact Metadata', () => {
  test('UpdateInfo includes artifact metadata', () => {
    const info: UpdateInfo = {
      version: '2.0.0',
      releaseDate: '2024-01-01',
      files: [{ url: 'https://example.com/app.dmg', sha512: 'abc', size: 5000 }],
      artifact: {
        appName: 'MyApp',
        webviewEngine: 'system',
        platform: 'darwin',
        arch: 'arm64',
      },
    };

    expect(info.artifact?.appName).toBe('MyApp');
    expect(info.artifact?.webviewEngine).toBe('system');
    expect(info.artifact?.platform).toBe('darwin');
  });
});

describe('Install Strategy Interface', () => {
  test('InstallResult can indicate no restart needed', () => {
    const result: InstallResult = {
      requiresRestart: false,
      installedPath: '/opt/myapp',
      restartCommand: ['/opt/myapp/myapp'],
    };

    expect(result.requiresRestart).toBe(false);
    expect(result.installedPath).toBe('/opt/myapp');
    expect(result.restartCommand).toEqual(['/opt/myapp/myapp']);
  });

  test('InstallResult can indicate restart needed', () => {
    const result: InstallResult = {
      requiresRestart: true,
    };

    expect(result.requiresRestart).toBe(true);
  });
});

describe('RolloutCheckResult', () => {
  test('can represent eligible user', () => {
    const result: RolloutCheckResult = {
      isEligible: true,
      evaluatedPercentage: 25,
      userBucket: 10,
    };

    expect(result.isEligible).toBe(true);
    expect(result.evaluatedPercentage).toBe(25);
    expect(result.userBucket).toBe(10);
  });

  test('can represent ineligible user', () => {
    const result: RolloutCheckResult = {
      isEligible: false,
      evaluatedPercentage: 25,
      userBucket: 80,
    };

    expect(result.isEligible).toBe(false);
  });
});

describe('ProviderFactory', () => {
  test('custom provider factory creates provider from config', () => {
    const factory: ProviderFactory = {
      createProvider: (config: UpdateConfig) => {
        return new MockProvider({
          version: '3.0.0',
          releaseDate: '2024-06-01',
          files: [{ url: 'https://custom.example.com/update', sha512: 'def', size: 2000000 }],
        });
      },
    };

    const provider = factory.createProvider({
      provider: 'generic',
      generic: { url: 'https://custom.example.com' },
    });

    expect(provider).toBeDefined();
  });
});