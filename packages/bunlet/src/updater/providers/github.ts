/**
 * GitHub Releases Provider
 *
 * Fetches updates from GitHub Releases.
 */

import { BaseProvider } from './base';
import type { UpdateInfo, UpdateFile } from '../types';

export interface GitHubProviderOptions {
  owner: string;
  repo: string;
  private?: boolean;
  token?: string;
  channel?: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  assets: GitHubAsset[];
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

/**
 * GitHub Releases update provider
 */
export class GitHubProvider extends BaseProvider {
  private owner: string;
  private repo: string;
  private token?: string;
  private isPrivate: boolean;
  private apiBase = 'https://api.github.com';

  constructor(options: GitHubProviderOptions) {
    super(options.channel);
    this.owner = options.owner;
    this.repo = options.repo;
    this.token = options.token;
    this.isPrivate = options.private ?? false;
  }

  /**
   * Get the latest version from GitHub Releases
   */
  async getLatestVersion(): Promise<UpdateInfo | null> {
    try {
      const release = await this.fetchLatestRelease();
      if (!release) {
        return null;
      }

      return this.releaseToUpdateInfo(release);
    } catch (error) {
      console.error('Failed to fetch GitHub release:', error);
      return null;
    }
  }

  /**
   * Get the download URL for a file
   */
  getDownloadUrl(file: { url: string }): string {
    // For private repos, we need to use the API URL with token
    if (this.isPrivate && this.token) {
      // Convert browser_download_url to API URL
      const match = file.url.match(/\/releases\/download\/([^/]+)\/(.+)$/);
      if (match) {
        const [, tag, filename] = match;
        return `${this.apiBase}/repos/${this.owner}/${this.repo}/releases/assets/${filename}`;
      }
    }
    return file.url;
  }

  /**
   * Fetch the latest release from GitHub
   */
  private async fetchLatestRelease(): Promise<GitHubRelease | null> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Bunlet-AutoUpdater',
    };

    if (this.token) {
      headers.Authorization = `token ${this.token}`;
    }

    // Determine which releases to fetch based on channel
    const includePrerelease = this.channel === 'beta' || this.channel === 'alpha';

    let url: string;
    if (includePrerelease) {
      // Fetch all releases to find prereleases
      url = `${this.apiBase}/repos/${this.owner}/${this.repo}/releases?per_page=10`;
    } else {
      // Fetch only the latest stable release
      url = `${this.apiBase}/repos/${this.owner}/${this.repo}/releases/latest`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // No releases found
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    if (includePrerelease) {
      const releases: GitHubRelease[] = await response.json();

      // Filter based on channel
      for (const release of releases) {
        if (release.draft) continue;

        if (this.channel === 'stable' && !release.prerelease) {
          return release;
        }
        if (this.channel === 'beta' && release.prerelease) {
          // Check if it's a beta (not alpha)
          const tagLower = release.tag_name.toLowerCase();
          if (tagLower.includes('beta') || !tagLower.includes('alpha')) {
            return release;
          }
        }
        if (this.channel === 'alpha') {
          return release; // Any release including alpha
        }
      }

      return null;
    } else {
      return response.json();
    }
  }

  /**
   * Convert GitHub release to UpdateInfo
   */
  private releaseToUpdateInfo(release: GitHubRelease): UpdateInfo {
    const files: UpdateFile[] = release.assets
      .filter((asset) => this.isUpdateFile(asset.name))
      .map((asset) => ({
        url: asset.browser_download_url,
        sha512: '', // Will be computed or fetched from yml
        size: asset.size,
      }));

    // Try to find and parse latest.yml for checksums
    const ymlAsset = release.assets.find(
      (a) =>
        a.name.endsWith('.yml') &&
        (a.name.includes('latest') || a.name.includes(this.platform))
    );

    if (ymlAsset) {
      // In a real implementation, we'd fetch and parse the yml
      // For now, we'll proceed without checksums
    }

    return {
      version: release.tag_name.replace(/^v/, ''),
      releaseDate: release.published_at,
      releaseNotes: release.body,
      files,
    };
  }

  /**
   * Check if a filename is an update file
   */
  private isUpdateFile(filename: string): boolean {
    const lower = filename.toLowerCase();

    // Skip YAML manifests
    if (lower.endsWith('.yml') || lower.endsWith('.yaml')) {
      return false;
    }

    // Skip block maps
    if (lower.endsWith('.blockmap')) {
      return false;
    }

    // Platform-specific installers
    const extensions = [
      '.dmg',
      '.pkg',
      '.zip',
      '.exe',
      '.msi',
      '.appimage',
      '.deb',
      '.rpm',
      '.snap',
    ];

    return extensions.some((ext) => lower.endsWith(ext));
  }
}
