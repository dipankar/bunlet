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
  /** Detailed CEF runtime asset paths (helper binary, cef-binaries dir) */
  cefRuntimeAssets?: {
    helperBinary?: string;
    cefBinariesDir?: string;
    nodeBinary?: string;
  };
  icons?: {
    icns?: string;
    ico?: string;
    png?: string;
  };
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
  sourcemaps?: string[];
}

export function createBuildArtifactManifest(input: {
  name: string;
  version: string;
  webviewEngine: 'system' | 'cef';
  paths: BuildArtifactPaths;
  sourcemaps?: string[];
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
    sourcemaps: input.sourcemaps,
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

  if (manifest.paths.cefRuntimeAssets) {
    const assets = manifest.paths.cefRuntimeAssets;
    if (assets.helperBinary) {
      const helperPath = path.join(outDir, assets.helperBinary);
      if (!fs.existsSync(helperPath)) {
        errors.push(`Missing CEF helper binary: ${assets.helperBinary}`);
      }
    }
    if (assets.cefBinariesDir) {
      const binariesDir = path.join(outDir, assets.cefBinariesDir);
      if (!fs.existsSync(binariesDir)) {
        errors.push(`Missing CEF binaries directory: ${assets.cefBinariesDir}`);
      }
    }
    if (assets.nodeBinary) {
      const nodePath = path.join(outDir, assets.nodeBinary);
      if (!fs.existsSync(nodePath)) {
        errors.push(`Missing CEF node binary: ${assets.nodeBinary}`);
      }
    }
  }

  if (manifest.sourcemaps) {
    for (const sm of manifest.sourcemaps) {
      const smPath = path.join(outDir, sm);
      if (!fs.existsSync(smPath)) {
        errors.push(`Missing source map artifact: ${sm}`);
      }
    }
  }

  if (manifest.paths.icons) {
    for (const [format, iconPath] of Object.entries(manifest.paths.icons)) {
      if (iconPath) {
        const fullPath = path.join(outDir, iconPath);
        if (!fs.existsSync(fullPath)) {
          errors.push(`Missing icon artifact (${format}): ${iconPath}`);
        }
      }
    }
  }

  return errors;
}
