/**
 * bunlet publish command
 *
 * Publishes the packaged application to a release provider.
 */

import * as path from 'path';
import * as fs from 'fs';
import {
  loadReleaseArtifactManifest,
  validateReleaseArtifactManifest,
} from '../artifacts/release-manifest';
import { generateBlockMapFile } from '../build/blockmap';
import { loadBunletConfig, loadPackageJson, type BunletConfig } from '../config';

export interface PublishOptions {
  github?: boolean;
  s3?: boolean;
  dryRun?: boolean;
  releaseNotes?: string;
}

interface ReleaseFile {
  name: string;
  path: string;
  size: number;
  sha512: string;
}

/**
 * Publish the application
 */
export async function publishCommand(options: PublishOptions): Promise<void> {
  const root = process.cwd();
  const config = await loadBunletConfig(root);
  const packageJson = await loadPackageJson(root);
  const releaseManifest = loadReleaseArtifactManifest(path.resolve(root, 'release'));

  if (releaseManifest) {
    const releaseManifestErrors = validateReleaseArtifactManifest(
      path.resolve(root, 'release'),
      releaseManifest
    );
    if (releaseManifestErrors.length > 0) {
      console.error('\n  Error: Release artifact manifest is invalid.');
      for (const error of releaseManifestErrors) {
        console.error(`  - ${error}`);
      }
      console.error('');
      process.exit(1);
    }
  }

  const appName =
    config.package?.name || releaseManifest?.app.name || packageJson.name || path.basename(root);
  const appVersion =
    config.package?.version || releaseManifest?.app.version || packageJson.version || '1.0.0';
  const releaseDir = path.resolve(root, 'release');

  console.log('\n  Bunlet Publish\n');
  console.log(`  App: ${appName} v${appVersion}`);
  console.log(`  Release dir: ${releaseDir}`);

  // Verify release directory exists
  if (!fs.existsSync(releaseDir)) {
    console.error('\n  Error: Release directory not found.');
    console.error('  Run `bunlet build && bunlet package` first.\n');
    process.exit(1);
  }

  // Find release files
  const releaseFiles = releaseManifest
    ? await loadReleaseFilesFromManifest(releaseDir)
    : await findReleaseFiles(releaseDir, appVersion);

  if (releaseFiles.length === 0) {
    console.error('\n  Error: No release files found.\n');
    process.exit(1);
  }

  console.log(`\n  Found ${releaseFiles.length} release file(s):`);
  for (const file of releaseFiles) {
    console.log(`    ${file.name} (${formatSize(file.size)})`);
  }

  // Generate block maps for differential updates
  console.log('\n  Generating block maps...');
  const blockMaps: ReleaseFile[] = [];

  for (const file of releaseFiles) {
    if (shouldGenerateBlockMap(file.name)) {
      const blockMapResult = await generateBlockMapFile(file.path);
      if (blockMapResult) {
        blockMaps.push({
          name: path.basename(blockMapResult.path),
          path: blockMapResult.path,
          size: blockMapResult.size,
          sha512: blockMapResult.sha512,
        });
        console.log(`    ✓ ${path.basename(blockMapResult.path)}`);
      }
    }
  }

  // Generate update manifests
  console.log('\n  Generating update manifests...');
  const manifests = await generateManifests(
    releaseDir,
    appVersion,
    releaseFiles,
    options.releaseNotes
  );

  for (const manifest of manifests) {
    console.log(`    ✓ ${manifest.name}`);
  }

  // Determine provider
  const provider = options.github
    ? 'github'
    : options.s3
      ? 's3'
      : config.publish?.provider || 'github';

  console.log(`\n  Provider: ${provider}`);

  if (options.dryRun) {
    console.log('\n  Dry run - no files uploaded.\n');
    console.log('  Files that would be uploaded:');
    for (const file of [...releaseFiles, ...blockMaps, ...manifests]) {
      console.log(`    ${file.name}`);
    }
    console.log('');
    return;
  }

  // Publish based on provider
  const allFiles = [...releaseFiles, ...blockMaps, ...manifests];

  try {
    switch (provider) {
      case 'github':
        await publishToGitHub(config, appName, appVersion, allFiles, options);
        break;
      case 's3':
        await publishToS3(config, allFiles);
        break;
      default:
        console.error(`\n  Unknown provider: ${provider}\n`);
        process.exit(1);
    }

    console.log('\n  ✓ Published successfully!\n');
  } catch (error) {
    console.error('\n  ✗ Publish failed:', error);
    process.exit(1);
  }
}

/**
 * Find release files in the release directory
 */
async function findReleaseFiles(
  releaseDir: string,
  version: string
): Promise<ReleaseFile[]> {
  const files: ReleaseFile[] = [];
  const entries = fs.readdirSync(releaseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();

      // Include installer/package files
      if (['.dmg', '.pkg', '.zip', '.exe', '.msi', '.appimage', '.deb', '.rpm'].includes(ext)) {
        const filePath = path.join(releaseDir, entry.name);
        const stat = fs.statSync(filePath);
        const sha512 = await calculateSha512(filePath);

        files.push({
          name: entry.name,
          path: filePath,
          size: stat.size,
          sha512,
        });
      }
    }
  }

  return files;
}

async function loadReleaseFilesFromManifest(releaseDir: string): Promise<ReleaseFile[]> {
  const releaseManifest = loadReleaseArtifactManifest(releaseDir);
  if (!releaseManifest) {
    return [];
  }

  const files: ReleaseFile[] = [];
  for (const artifact of releaseManifest.artifacts) {
    if (artifact.kind !== 'file') {
      continue;
    }

    const ext = path.extname(artifact.name).toLowerCase();
    if (!['.dmg', '.pkg', '.zip', '.exe', '.msi', '.appimage', '.deb', '.rpm'].includes(ext)) {
      continue;
    }

    const filePath = path.join(releaseDir, artifact.path);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const stat = fs.statSync(filePath);
    files.push({
      name: artifact.name,
      path: filePath,
      size: stat.size,
      sha512: await calculateSha512(filePath),
    });
  }

  return files;
}

/**
 * Calculate SHA-512 hash of a file
 */
async function calculateSha512(filePath: string): Promise<string> {
  const data = fs.readFileSync(filePath);
  const hasher = new Bun.CryptoHasher('sha512');
  hasher.update(data);
  return hasher.digest('hex');
}

/**
 * Check if block map should be generated for file
 */
function shouldGenerateBlockMap(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  // Generate block maps for larger installer formats
  return ['.dmg', '.exe', '.appimage', '.zip'].includes(ext);
}

/**
 * Generate update manifests for each platform
 */
async function generateManifests(
  releaseDir: string,
  version: string,
  files: ReleaseFile[],
  releaseNotesPath?: string
): Promise<ReleaseFile[]> {
  const manifests: ReleaseFile[] = [];
  const releaseNotes = releaseNotesPath
    ? fs.readFileSync(releaseNotesPath, 'utf-8')
    : '';

  // Group files by platform
  const platforms: Record<string, ReleaseFile[]> = {
    mac: [],
    win: [],
    linux: [],
  };

  for (const file of files) {
    const nameLower = file.name.toLowerCase();
    if (nameLower.includes('darwin') || nameLower.includes('mac') || nameLower.endsWith('.dmg')) {
      platforms.mac.push(file);
    } else if (nameLower.includes('win') || nameLower.endsWith('.exe') || nameLower.endsWith('.msi')) {
      platforms.win.push(file);
    } else if (nameLower.includes('linux') || nameLower.endsWith('.appimage') || nameLower.endsWith('.deb')) {
      platforms.linux.push(file);
    }
  }

  // Generate manifest for each platform
  for (const [platform, platformFiles] of Object.entries(platforms)) {
    if (platformFiles.length === 0) continue;

    const mainFile = platformFiles[0];
    const blockMapPath = `${mainFile.path}.blockmap`;
    const hasBlockMap = fs.existsSync(blockMapPath);

    let blockMapSize: number | undefined;
    let blockMapSha512: string | undefined;

    if (hasBlockMap) {
      const blockMapStat = fs.statSync(blockMapPath);
      blockMapSize = blockMapStat.size;
      blockMapSha512 = await calculateSha512(blockMapPath);
    }

    const manifest = generateManifestYaml({
      version,
      releaseDate: new Date().toISOString(),
      releaseNotes,
      files: platformFiles.map((f) => ({
        url: f.name,
        sha512: f.sha512,
        size: f.size,
      })),
      path: mainFile.name,
      sha512: mainFile.sha512,
      blockMapSize,
      blockMapSha512,
    });

    const manifestName = `latest-${platform}.yml`;
    const manifestPath = path.join(releaseDir, manifestName);
    fs.writeFileSync(manifestPath, manifest);

    manifests.push({
      name: manifestName,
      path: manifestPath,
      size: Buffer.byteLength(manifest),
      sha512: '', // Not needed for manifests
    });
  }

  return manifests;
}

/**
 * Generate YAML manifest content
 */
function generateManifestYaml(data: {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
  files: Array<{ url: string; sha512: string; size: number }>;
  path: string;
  sha512: string;
  blockMapSize?: number;
  blockMapSha512?: string;
}): string {
  let yaml = `version: ${data.version}
releaseDate: '${data.releaseDate}'
`;

  if (data.releaseNotes) {
    yaml += `releaseNotes: |
${data.releaseNotes.split('\n').map((line) => `  ${line}`).join('\n')}
`;
  }

  yaml += `
files:
`;

  for (const file of data.files) {
    yaml += `  - url: ${file.url}
    sha512: ${file.sha512}
    size: ${file.size}
`;
  }

  yaml += `
path: ${data.path}
sha512: ${data.sha512}
`;

  if (data.blockMapSize !== undefined) {
    yaml += `blockMapSize: ${data.blockMapSize}
`;
  }

  if (data.blockMapSha512) {
    yaml += `blockMapSha512: ${data.blockMapSha512}
`;
  }

  return yaml;
}

/**
 * Publish to GitHub Releases
 */
async function publishToGitHub(
  config: BunletConfig,
  appName: string,
  version: string,
  files: ReleaseFile[],
  options: PublishOptions
): Promise<void> {
  const owner = config.publish?.owner;
  const repo = config.publish?.repo;
  const token = config.publish?.token || process.env.GITHUB_TOKEN;

  if (!owner || !repo) {
    throw new Error('GitHub owner and repo must be configured in bunlet.config');
  }

  if (!token) {
    throw new Error('GitHub token required. Set GITHUB_TOKEN env var or configure in bunlet.config');
  }

  console.log(`\n  Publishing to GitHub: ${owner}/${repo}`);

  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Bunlet-CLI',
  };

  // Create release
  console.log('  Creating release...');
  const releaseNotes = options.releaseNotes
    ? fs.readFileSync(options.releaseNotes, 'utf-8')
    : `Release ${version}`;

  const createResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tag_name: `v${version}`,
        name: `${appName} v${version}`,
        body: releaseNotes,
        draft: false,
        prerelease: false,
      }),
    }
  );

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Failed to create release: ${error}`);
  }

  const release = await createResponse.json() as { upload_url: string; html_url: string };
  console.log(`  ✓ Release created`);

  // Upload assets
  const uploadUrl = release.upload_url.replace('{?name,label}', '');

  for (const file of files) {
    console.log(`  Uploading ${file.name}...`);

    const data = fs.readFileSync(file.path);
    const contentType = getContentType(file.name);

    const uploadResponse = await fetch(`${uploadUrl}?name=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': contentType,
        'Content-Length': String(data.length),
      },
      body: data,
    });

    if (!uploadResponse.ok) {
      console.warn(`  ⚠ Failed to upload ${file.name}`);
    } else {
      console.log(`  ✓ ${file.name}`);
    }
  }

  console.log(`\n  Release URL: ${release.html_url}`);
}

/**
 * Publish to S3
 */
async function publishToS3(
  config: BunletConfig,
  files: ReleaseFile[]
): Promise<void> {
  const bucket = config.publish?.bucket;
  const region = config.publish?.region || 'us-east-1';

  if (!bucket) {
    throw new Error('S3 bucket must be configured in bunlet.config');
  }

  console.log(`\n  Publishing to S3: ${bucket}`);

  // This is a simplified implementation
  // In production, use AWS SDK or proper S3 signing
  for (const file of files) {
    console.log(`  Uploading ${file.name}...`);

    // Using AWS CLI if available
    const { execSync } = require('child_process');
    try {
      execSync(`aws s3 cp "${file.path}" "s3://${bucket}/${file.name}" --region ${region}`, {
        stdio: 'pipe',
      });
      console.log(`  ✓ ${file.name}`);
    } catch (e) {
      console.warn(`  ⚠ Failed to upload ${file.name}: AWS CLI required`);
    }
  }
}

/**
 * Get content type for file
 */
function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const types: Record<string, string> = {
    '.dmg': 'application/x-apple-diskimage',
    '.pkg': 'application/x-newton-compatible-pkg',
    '.zip': 'application/zip',
    '.exe': 'application/x-msdownload',
    '.msi': 'application/x-msi',
    '.appimage': 'application/x-executable',
    '.deb': 'application/x-debian-package',
    '.rpm': 'application/x-rpm',
    '.yml': 'text/yaml',
    '.yaml': 'text/yaml',
    '.blockmap': 'application/octet-stream',
  };
  return types[ext] || 'application/octet-stream';
}

/**
 * Format file size
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
