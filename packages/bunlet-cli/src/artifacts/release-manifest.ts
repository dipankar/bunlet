import * as fs from 'fs';
import * as path from 'path';

export const RELEASE_ARTIFACT_MANIFEST_FILE = 'bunlet-release-artifact.json';

export type ReleaseArtifactPlatform = 'darwin' | 'linux' | 'win32';
export type ReleaseArtifactFormat =
  | 'app'
  | 'dmg'
  | 'appimage'
  | 'deb'
  | 'folder'
  | 'zip'
  | 'exe'
  | 'portable';

export interface ReleaseArtifact {
  platform: ReleaseArtifactPlatform;
  format: ReleaseArtifactFormat;
  path: string;
  name: string;
  kind: 'file' | 'directory';
}

export interface ReleaseArtifactManifest {
  schemaVersion: 1;
  createdAt: string;
  app: {
    name: string;
    version: string;
  };
  artifacts: ReleaseArtifact[];
}

export function createReleaseArtifactManifest(input: {
  name: string;
  version: string;
  artifacts: ReleaseArtifact[];
}): ReleaseArtifactManifest {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    app: {
      name: input.name,
      version: input.version,
    },
    artifacts: input.artifacts,
  };
}

export function writeReleaseArtifactManifest(
  outDir: string,
  manifest: ReleaseArtifactManifest
): string {
  const manifestPath = path.join(outDir, RELEASE_ARTIFACT_MANIFEST_FILE);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return manifestPath;
}

export function loadReleaseArtifactManifest(
  outDir: string
): ReleaseArtifactManifest | null {
  const manifestPath = path.join(outDir, RELEASE_ARTIFACT_MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as ReleaseArtifactManifest;
  } catch {
    return null;
  }
}

export function validateReleaseArtifactManifest(
  outDir: string,
  manifest: ReleaseArtifactManifest
): string[] {
  const errors: string[] = [];

  for (const artifact of manifest.artifacts) {
    const artifactPath = path.join(outDir, artifact.path);
    if (!fs.existsSync(artifactPath)) {
      errors.push(`Missing release artifact: ${artifact.path}`);
      continue;
    }

    const stat = fs.statSync(artifactPath);
    if (artifact.kind === 'file' && !stat.isFile()) {
      errors.push(`Release artifact should be a file: ${artifact.path}`);
    }
    if (artifact.kind === 'directory' && !stat.isDirectory()) {
      errors.push(`Release artifact should be a directory: ${artifact.path}`);
    }
  }

  return errors;
}
