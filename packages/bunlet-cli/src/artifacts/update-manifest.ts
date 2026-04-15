import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { computeFileHash } from '../build/packager';

export interface UpdateManifestFile {
  url: string;
  sha512: string;
  size: number;
  blockMapSize?: number;
  blockMapSha512?: string;
}

export interface UpdateManifest {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
  files: UpdateManifestFile[];
  path: string;
  sha512: string;
}

export function createUpdateManifest(input: {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
  files: UpdateManifestFile[];
  mainFile: UpdateManifestFile;
}): UpdateManifest {
  return {
    version: input.version,
    releaseDate: input.releaseDate ?? new Date().toISOString(),
    releaseNotes: input.releaseNotes,
    files: input.files,
    path: input.mainFile.url,
    sha512: input.mainFile.sha512,
  };
}

export function generateYamlManifest(manifest: UpdateManifest): string {
  let yaml = `version: ${manifest.version}\n`;
  yaml += `releaseDate: '${manifest.releaseDate}'\n`;

  if (manifest.releaseNotes) {
    yaml += `releaseNotes: |\n`;
    yaml += manifest.releaseNotes.split('\n').map((line) => `  ${line}`).join('\n') + '\n';
  }

  yaml += '\nfiles:\n';
  for (const file of manifest.files) {
    yaml += `  - url: ${file.url}\n`;
    yaml += `    sha512: ${file.sha512}\n`;
    yaml += `    size: ${file.size}\n`;
    if (file.blockMapSize !== undefined) {
      yaml += `    blockMapSize: ${file.blockMapSize}\n`;
    }
    if (file.blockMapSha512) {
      yaml += `    blockMapSha512: ${file.blockMapSha512}\n`;
    }
  }

  yaml += `\npath: ${manifest.path}\n`;
  yaml += `sha512: ${manifest.sha512}\n`;

  return yaml;
}

export function writeYamlManifest(outDir: string, platform: string, manifest: UpdateManifest): string {
  const fileName = `latest-${platform}.yml`;
  const filePath = path.join(outDir, fileName);
  const content = generateYamlManifest(manifest);
  fs.writeFileSync(filePath, content);
  return filePath;
}

export async function generateUpdateManifestsForRelease(
  releaseDir: string,
  appName: string,
  version: string,
  releaseNotes?: string
): Promise<string[]> {
  const { loadReleaseArtifactManifest } = await import('../artifacts/release-manifest');
  const releaseManifest = loadReleaseArtifactManifest(releaseDir);

  if (!releaseManifest) {
    throw new Error('No release artifact manifest found. Run `bunlet package` first.');
  }

  const platforms: Record<string, UpdateManifestFile[]> = {
    mac: [],
    win: [],
    linux: [],
  };

  for (const artifact of releaseManifest.artifacts) {
    if (artifact.kind !== 'file') continue;

    const ext = path.extname(artifact.name).toLowerCase();
    if (!['.dmg', '.exe', '.msi', '.zip', '.appimage', '.deb', '.rpm'].includes(ext)) continue;

    const filePath = path.join(releaseDir, artifact.path);
    if (!fs.existsSync(filePath)) continue;

    const sha512 = await computeFileHash(filePath);
    const size = fs.statSync(filePath).size;

    const manifestFile: UpdateManifestFile = {
      url: artifact.name,
      sha512,
      size,
    };

    const blockMapPath = `${filePath}.blockmap`;
    if (fs.existsSync(blockMapPath)) {
      const bmStat = fs.statSync(blockMapPath);
      const bmHash = await computeFileHash(blockMapPath);
      manifestFile.blockMapSize = bmStat.size;
      manifestFile.blockMapSha512 = bmHash;
    }

    const nameLower = artifact.name.toLowerCase();
    if (nameLower.includes('darwin') || nameLower.includes('mac') || ext === '.dmg') {
      platforms.mac.push(manifestFile);
    } else if (nameLower.includes('win') || ext === '.exe' || ext === '.msi') {
      platforms.win.push(manifestFile);
    } else if (nameLower.includes('linux') || ext === '.appimage' || ext === '.deb') {
      platforms.linux.push(manifestFile);
    }
  }

  const manifestPaths: string[] = [];

  for (const [platform, files] of Object.entries(platforms)) {
    if (files.length === 0) continue;

    const mainFile = files[0];
    const manifest = createUpdateManifest({
      version,
      releaseNotes,
      files,
      mainFile,
    });

    const manifestPath = writeYamlManifest(releaseDir, platform, manifest);
    manifestPaths.push(manifestPath);
  }

  return manifestPaths;
}