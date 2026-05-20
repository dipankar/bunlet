import * as fs from 'fs';
import * as crypto from 'crypto';

export interface PackagerArtifact {
  platform: 'darwin' | 'linux' | 'win32';
  format: string;
  path: string;
  name: string;
  size: number;
  sha512: string;
}

export interface SignOptions {
  identity?: string;
  entitlements?: string;
  hardenedRuntime?: boolean;
  certificateFile?: string;
  certificatePassword?: string;
  timestampServer?: string;
}

export interface NotarizeOptions {
  /** Apple ID email. Falls back to APPLE_ID env. */
  appleId?: string;
  /** Apple Developer team ID. Falls back to APPLE_TEAM_ID env. */
  teamId?: string;
  /** App-specific password. Falls back to APPLE_APP_SPECIFIC_PASSWORD env. */
  appSpecificPassword?: string;
  /** If true, run `xcrun stapler staple` after submission succeeds. Default true. */
  staple?: boolean;
}

export interface LinuxSignOptions {
  /** GPG key id (long form or fingerprint) used for `gpg --local-user`. */
  gpgKeyId: string;
  /** Optional passphrase. If not provided, the user's gpg-agent must supply one. */
  passphrase?: string;
}

export interface PackagerContext {
  name: string;
  version: string;
  description?: string;
  author?: string;
  bundleId?: string;
  category?: string;
  maintainer?: string;
  icon?: string;
  buildDir: string;
  outDir: string;
  sign?: boolean;
  signOptions?: SignOptions;
}

export interface PackagerResult {
  success: boolean;
  artifacts: PackagerArtifact[];
  errors: string[];
}

export interface PlatformPackager {
  package(ctx: PackagerContext, formats: string[]): Promise<PackagerResult>;
}

export async function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha512');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export function getArtifactSize(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  return fs.statSync(filePath).size;
}

export async function createPackagerArtifact(
  platform: PackagerArtifact['platform'],
  format: string,
  filePath: string,
  name: string,
): Promise<PackagerArtifact> {
  const size = getArtifactSize(filePath);
  const sha512 = await computeFileHash(filePath);
  return { platform, format, path: filePath, name, size, sha512 };
}