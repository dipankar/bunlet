/**
 * Generic HTTP Provider
 *
 * Fetches updates from any HTTP server hosting update manifests.
 */

import { BaseProvider } from './base';
import type { UpdateInfo, UpdateManifest } from '../types';

export interface GenericProviderOptions {
  url: string;
  channel?: string;
}

/**
 * Generic HTTP update provider
 */
export class GenericProvider extends BaseProvider {
  private baseUrl: string;

  constructor(options: GenericProviderOptions) {
    super(options.channel);
    this.baseUrl = options.url.replace(/\/$/, '');
  }

  /**
   * Get the latest version from the server
   */
  async getLatestVersion(): Promise<UpdateInfo | null> {
    try {
      const manifestUrl = this.getManifestUrl();
      const response = await fetch(manifestUrl);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch manifest: ${response.status}`);
      }

      const text = await response.text();
      const manifest = this.parseYaml(text);

      return this.manifestToUpdateInfo(manifest);
    } catch (error) {
      console.error('Failed to fetch update manifest:', error);
      return null;
    }
  }

  /**
   * Get the download URL for a file
   */
  getDownloadUrl(file: { url: string }): string {
    // If URL is absolute, use it directly
    if (file.url.startsWith('http://') || file.url.startsWith('https://')) {
      return file.url;
    }

    // Otherwise, resolve relative to base URL
    return `${this.baseUrl}/${file.url}`;
  }

  /**
   * Get the manifest URL for the current platform
   */
  private getManifestUrl(): string {
    const platformNames: Record<string, string> = {
      darwin: 'mac',
      win32: 'win',
      linux: 'linux',
    };

    const platform = platformNames[this.platform] || this.platform;
    const channel = this.channel === 'stable' ? '' : `-${this.channel}`;

    // Try platform-specific manifest first
    return `${this.baseUrl}/latest${channel}-${platform}.yml`;
  }

  /**
   * Parse YAML content (simple parser for update manifests)
   */
  private parseYaml(content: string): UpdateManifest {
    const lines = content.split('\n');
    const result: Record<string, unknown> = {};
    const files: Array<Record<string, unknown>> = [];

    let currentFile: Record<string, unknown> | null = null;
    let inFiles = false;
    let releaseNotesLines: string[] = [];
    let inReleaseNotes = false;

    for (const line of lines) {
      if (inReleaseNotes) {
        if (line.startsWith('  ') || line.trim() === '') {
          releaseNotesLines.push(line.replace(/^  /, ''));
          continue;
        } else {
          inReleaseNotes = false;
          result.releaseNotes = releaseNotesLines.join('\n').trim();
        }
      }

      if (line.startsWith('files:')) {
        inFiles = true;
        continue;
      }

      if (inFiles) {
        if (line.startsWith('  - ')) {
          if (currentFile) {
            files.push(currentFile);
          }
          currentFile = {};
          const match = line.match(/^\s+-\s+(\w+):\s*(.*)$/);
          if (match) {
            currentFile[match[1]] = this.parseValue(match[2]);
          }
        } else if (line.startsWith('    ') && currentFile) {
          const match = line.match(/^\s+(\w+):\s*(.*)$/);
          if (match) {
            currentFile[match[1]] = this.parseValue(match[2]);
          }
        } else if (!line.startsWith(' ')) {
          if (currentFile) {
            files.push(currentFile);
            currentFile = null;
          }
          inFiles = false;
        }
      }

      if (!inFiles && !inReleaseNotes) {
        const match = line.match(/^(\w+):\s*(.*)$/);
        if (match) {
          const key = match[1];
          const value = match[2];

          if (value === '|') {
            if (key === 'releaseNotes') {
              inReleaseNotes = true;
              releaseNotesLines = [];
            }
          } else {
            result[key] = this.parseValue(value);
          }
        }
      }
    }

    if (currentFile) {
      files.push(currentFile);
    }

    return {
      version: String(result.version || ''),
      releaseDate: String(result.releaseDate || ''),
      releaseNotes: String(result.releaseNotes || ''),
      files: files.map((f) => ({
        url: String(f.url || ''),
        sha512: String(f.sha512 || ''),
        size: Number(f.size || 0),
      })),
      path: String(result.path || ''),
      sha512: String(result.sha512 || ''),
      blockMapSize: result.blockMapSize ? Number(result.blockMapSize) : undefined,
      blockMapSha512: result.blockMapSha512 ? String(result.blockMapSha512) : undefined,
    };
  }

  /**
   * Parse a YAML value
   */
  private parseValue(value: string): string | number | boolean {
    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Number
    const num = Number(value);
    if (!isNaN(num) && value !== '') return num;

    return value;
  }

  /**
   * Convert manifest to UpdateInfo
   */
  private manifestToUpdateInfo(manifest: UpdateManifest): UpdateInfo {
    return {
      version: manifest.version,
      releaseDate: manifest.releaseDate,
      releaseNotes: manifest.releaseNotes,
      files: manifest.files.map((f) => ({
        url: f.url,
        sha512: f.sha512,
        size: f.size,
        blockMapSize: manifest.blockMapSize,
        blockMapSha512: manifest.blockMapSha512,
      })),
    };
  }
}
