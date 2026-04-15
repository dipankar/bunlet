/**
 * Auto-Updater Types
 *
 * Types for the auto-update system.
 */

/**
 * Update information with optional artifact metadata from the build pipeline.
 */
export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
  files: UpdateFile[];
  /** Artifact metadata from the build/release pipeline */
  artifact?: ArtifactMetadata;
}

/**
 * Artifact metadata from the build/release pipeline.
 * Links update checks to the exact build artifact metadata
 * produced by `bunlet package` and `bunlet publish`.
 */
export interface ArtifactMetadata {
  /** The app name from the build manifest */
  appName?: string;
  /** The webview engine used (system or cef) */
  webviewEngine?: 'system' | 'cef';
  /** Platform this artifact was built for */
  platform?: string;
  /** Architecture */
  arch?: string;
  /** Build artifact manifest path (relative to release dir) */
  buildManifestPath?: string;
}

/**
 * Update file information
 */
export interface UpdateFile {
  url: string;
  sha512: string;
  size: number;
  blockMapSize?: number;
  blockMapSha512?: string;
}

/**
 * Download progress information
 */
export interface ProgressInfo {
  total: number;
  transferred: number;
  percent: number;
  bytesPerSecond: number;
}

/**
 * Update check result
 */
export interface UpdateCheckResult {
  updateInfo: UpdateInfo | null;
  isAvailable: boolean;
}

/**
 * Update provider configuration
 */
export interface UpdateConfig {
  provider: 'github' | 's3' | 'generic';

  /** GitHub provider options */
  github?: {
    owner: string;
    repo: string;
    private?: boolean;
    token?: string;
  };

  /** S3 provider options */
  s3?: {
    bucket: string;
    region: string;
    path?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };

  /** Generic HTTP provider options */
  generic?: {
    url: string;
    channel?: string;
  };

  /** Release channel */
  channel?: 'stable' | 'beta' | 'alpha';

  /** Enable differential updates */
  differentialUpdates?: boolean;
}

/**
 * Block map for differential updates
 */
export interface BlockMap {
  version: number;
  blockSize: number;
  hashAlgorithm: 'sha512';
  blocks: BlockInfo[];
}

/**
 * Block information
 */
export interface BlockInfo {
  offset: number;
  size: number;
  hash: string;
}

/**
 * Update manifest (latest.yml format)
 */
export interface UpdateManifest {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
  files: Array<{
    url: string;
    sha512: string;
    size: number;
  }>;
  path: string;
  sha512: string;
  blockMapSize?: number;
  blockMapSha512?: string;
}

/**
 * Install strategy result
 */
export interface InstallResult {
  /** Whether the installation requires a restart */
  requiresRestart: boolean;
  /** Path to the installed application */
  installedPath?: string;
  /** Command to run after quit (if not auto-restarted) */
  restartCommand?: string[];
}

/**
 * Install strategy per platform.
 * Each platform implements its own install logic:
 * - macOS: DMG mount + .app copy, ZIP extraction
 * - Windows: EXE/MSI silent install, portable replace
 * - Linux: AppImage replace, DEB/RPM package install
 */
export interface InstallStrategy {
  /**
   * Install the downloaded update file.
   * Must re-verify the file's SHA-512 hash against the manifest
   * before performing any install operations.
   */
  install(
    updatePath: string,
    fileInfo: UpdateFile,
    options: InstallOptions
  ): Promise<InstallResult>;

  /**
   * Determine if the given file extension is supported by this strategy.
   */
  supportsFile(ext: string): boolean;
}

/**
 * Options passed to install strategies
 */
export interface InstallOptions {
  /** Run installer silently (no user interaction) */
  isSilent: boolean;
  /** Force restart after installation */
  isForceRunAfter: boolean;
  /** App name for display purposes */
  appName?: string;
  /** App installation path (if known) */
  appPath?: string;
}

/**
 * Staged rollout policy model.
 * Controls what percentage of users receive an update.
 */
export interface StagedRolloutPolicy {
  /** The percentage of users who should be offered this update (0-100) */
  rolloutPercentage: number;
  /** A stable user identifier for deterministic rollout assignment */
  userId?: string;
}

/**
 * Result of a staged rollout check
 */
export interface RolloutCheckResult {
  /** Whether this user is included in the rollout */
  isEligible: boolean;
  /** The percentage that was evaluated */
  evaluatedPercentage: number;
  /** The bucket this user fell into (0-99) */
  userBucket?: number;
}

/**
 * Provider factory interface.
 * Allows custom provider creation instead of relying on
 * hardcoded provider logic inside AutoUpdater.
 */
export interface ProviderFactory {
  createProvider(config: UpdateConfig): UpdateProvider;
}

/**
 * Update provider interface (re-exported from base for convenience)
 */
export interface UpdateProvider {
  getLatestVersion(): Promise<UpdateInfo | null>;
  downloadUpdate(
    info: UpdateInfo,
    destPath: string,
    onProgress?: (progress: ProgressInfo) => void
  ): Promise<string>;
  getDownloadUrl(file: { url: string }): string;
}

/**
 * Auto-updater events
 */
export type AutoUpdaterEvent =
  | 'error'
  | 'checking-for-update'
  | 'update-available'
  | 'update-not-available'
  | 'download-progress'
  | 'update-downloaded'
  | 'update-verified';

/**
 * Event listener types
 */
export interface AutoUpdaterEventMap {
  error: (error: Error) => void;
  'checking-for-update': () => void;
  'update-available': (info: UpdateInfo) => void;
  'update-not-available': (info: UpdateInfo) => void;
  'download-progress': (progress: ProgressInfo) => void;
  'update-downloaded': (info: UpdateInfo) => void;
  'update-verified': (info: { file: string; hash: string }) => void;
}