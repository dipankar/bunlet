import * as fs from 'fs';
import * as path from 'path';

export const BUILD_ARTIFACT_MANIFEST_FILE = 'bunlet-artifact.json';

export interface BuildArtifactPaths {
  main: string;
  preload?: string;
  renderer: string;
  packageJson: string;
  nativeRuntime?: string;
  cefRuntime?: string;
}

export interface BuildArtifactManifest {
  schemaVersion: 1;
  createdAt: string;
  app: {
    name: string;
    version: string;
    webviewEngine: 'system' | 'cef';
  };
  paths: BuildArtifactPaths;
}

export function createBuildArtifactManifest(input: {
  name: string;
  version: string;
  webviewEngine: 'system' | 'cef';
  paths: BuildArtifactPaths;
}): BuildArtifactManifest {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    app: {
      name: input.name,
      version: input.version,
      webviewEngine: input.webviewEngine,
    },
    paths: input.paths,
  };
}

export function writeBuildArtifactManifest(
  outDir: string,
  manifest: BuildArtifactManifest
): string {
  const manifestPath = path.join(outDir, BUILD_ARTIFACT_MANIFEST_FILE);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return manifestPath;
}

export function loadBuildArtifactManifest(outDir: string): BuildArtifactManifest | null {
  const manifestPath = path.join(outDir, BUILD_ARTIFACT_MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as BuildArtifactManifest;
  } catch {
    return null;
  }
}

export function validateBuildArtifactManifest(
  outDir: string,
  manifest: BuildArtifactManifest
): string[] {
  const errors: string[] = [];
  const requiredPaths = [
    ['main', manifest.paths.main],
    ['renderer', manifest.paths.renderer],
    ['packageJson', manifest.paths.packageJson],
  ] as const;

  for (const [label, relativePath] of requiredPaths) {
    const fullPath = path.join(outDir, relativePath);
    if (!fs.existsSync(fullPath)) {
      errors.push(`Missing ${label} artifact: ${relativePath}`);
    }
  }

  if (manifest.paths.preload) {
    const preloadPath = path.join(outDir, manifest.paths.preload);
    if (!fs.existsSync(preloadPath)) {
      errors.push(`Missing preload artifact: ${manifest.paths.preload}`);
    }
  }

  if (manifest.paths.nativeRuntime) {
    const nativeRuntimePath = path.join(outDir, manifest.paths.nativeRuntime);
    if (!fs.existsSync(nativeRuntimePath)) {
      errors.push(`Missing native runtime artifact: ${manifest.paths.nativeRuntime}`);
    }
  }

  if (manifest.paths.cefRuntime) {
    const cefRuntimePath = path.join(outDir, manifest.paths.cefRuntime);
    if (!fs.existsSync(cefRuntimePath)) {
      errors.push(`Missing CEF runtime artifact: ${manifest.paths.cefRuntime}`);
    }
  }

  return errors;
}
