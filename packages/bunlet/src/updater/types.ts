/**
 * Auto-Updater Types
 *
 * Types for the auto-update system.
 */

/**
 * Update information
 */
export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
  files: UpdateFile[];
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
 * Auto-updater events
 */
export type AutoUpdaterEvent =
  | 'error'
  | 'checking-for-update'
  | 'update-available'
  | 'update-not-available'
  | 'download-progress'
  | 'update-downloaded';

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
}
