/**
 * Base Update Provider
 *
 * Abstract interface for update providers.
 */

import type { UpdateInfo, ProgressInfo } from '../types';

export type ProgressCallback = (progress: ProgressInfo) => void;

/**
 * Update provider interface
 */
export interface UpdateProvider {
  /**
   * Get the latest version info
   */
  getLatestVersion(): Promise<UpdateInfo | null>;

  /**
   * Download an update
   */
  downloadUpdate(
    info: UpdateInfo,
    destPath: string,
    onProgress?: ProgressCallback
  ): Promise<string>;

  /**
   * Get the download URL for a specific file
   */
  getDownloadUrl(file: { url: string }): string;
}

/**
 * Base provider with common functionality
 */
export abstract class BaseProvider implements UpdateProvider {
  protected channel: string;
  protected platform: string;
  protected arch: string;

  constructor(channel = 'stable') {
    this.channel = channel;
    this.platform = process.platform;
    this.arch = process.arch;
  }

  abstract getLatestVersion(): Promise<UpdateInfo | null>;
  abstract getDownloadUrl(file: { url: string }): string;

  /**
   * Download a file with progress tracking
   */
  async downloadUpdate(
    info: UpdateInfo,
    destPath: string,
    onProgress?: ProgressCallback
  ): Promise<string> {
    // Find the appropriate file for this platform
    const file = this.findPlatformFile(info.files);
    if (!file) {
      throw new Error(`No update file found for ${this.platform}-${this.arch}`);
    }

    const url = this.getDownloadUrl(file);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download update: ${response.status}`);
    }

    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    const chunks: Uint8Array[] = [];
    let transferred = 0;
    let lastUpdate = Date.now();
    let lastTransferred = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      transferred += value.length;

      // Report progress (throttled to every 100ms)
      const now = Date.now();
      if (onProgress && now - lastUpdate >= 100) {
        const elapsed = (now - lastUpdate) / 1000;
        const bytesPerSecond = (transferred - lastTransferred) / elapsed;

        onProgress({
          total: contentLength || file.size,
          transferred,
          percent: contentLength ? (transferred / contentLength) * 100 : 0,
          bytesPerSecond,
        });

        lastUpdate = now;
        lastTransferred = transferred;
      }
    }

    // Combine chunks and write to file
    const data = new Uint8Array(transferred);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.length;
    }

    await Bun.write(destPath, data);

    // Verify checksum
    if (file.sha512) {
      const hash = new Bun.CryptoHasher('sha512');
      hash.update(data);
      const computed = hash.digest('hex');

      if (computed !== file.sha512) {
        throw new Error('Download checksum mismatch');
      }
    }

    return destPath;
  }

  /**
   * Find the update file for the current platform
   */
  protected findPlatformFile(files: UpdateInfo['files']): UpdateInfo['files'][0] | null {
    const platformPatterns: Record<string, string[]> = {
      darwin: ['darwin', 'mac', 'macos', 'osx'],
      win32: ['win32', 'win', 'windows'],
      linux: ['linux'],
    };

    const archPatterns: Record<string, string[]> = {
      x64: ['x64', 'x86_64', 'amd64'],
      arm64: ['arm64', 'aarch64'],
      arm: ['arm', 'armv7l'],
    };

    const platform = platformPatterns[this.platform] || [this.platform];
    const arch = archPatterns[this.arch] || [this.arch];

    // Try to find exact match first
    for (const file of files) {
      const urlLower = file.url.toLowerCase();
      const hasPlatform = platform.some((p) => urlLower.includes(p));
      const hasArch = arch.some((a) => urlLower.includes(a));

      if (hasPlatform && hasArch) {
        return file;
      }
    }

    // Fall back to platform-only match
    for (const file of files) {
      const urlLower = file.url.toLowerCase();
      const hasPlatform = platform.some((p) => urlLower.includes(p));

      if (hasPlatform) {
        return file;
      }
    }

    // Return first file as last resort
    return files[0] || null;
  }

  /**
   * Parse a version string into comparable parts
   */
  protected parseVersion(version: string): number[] {
    return version
      .replace(/^v/, '')
      .split(/[.-]/)
      .map((part) => parseInt(part, 10) || 0);
  }

  /**
   * Compare two versions
   * Returns: -1 if a < b, 0 if a == b, 1 if a > b
   */
  protected compareVersions(a: string, b: string): number {
    const partsA = this.parseVersion(a);
    const partsB = this.parseVersion(b);

    const maxLength = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < maxLength; i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;

      if (numA > numB) return 1;
      if (numA < numB) return -1;
    }

    return 0;
  }
}
