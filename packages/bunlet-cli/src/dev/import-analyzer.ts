/**
 * Import Analyzer
 *
 * Parses JavaScript/TypeScript source files to extract import/require
 * declarations and `import.meta.hot.accept()` calls so the module graph
 * can be populated for HMR.
 *
 * The analysis is deliberately simple and regex-based (not AST-based) so
 * it stays fast for dev-mode watching.  It covers the following patterns:
 *
 *   - `import ... from '...'`
 *   - `import '...'`
 *   - `require('...')`
 *   - `import.meta.hot.accept()`
 *   - `import.meta.hot.accept(() => { ... })`
 *   - CSS `@import '...'`
 */

import * as path from 'path';
import * as fs from 'fs';

export interface ImportAnalysis {
  /** Absolute file paths of static imports */
  imports: string[];
  /** Whether this module calls `import.meta.hot.accept()` */
  acceptsHmr: boolean;
}

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

const IMPORT_FROM_RE = /import\s+(?:[\w{},*\s]+from\s+)?['"]([^'"]+)['"]/g;
const SIDE_EFFECT_IMPORT_RE = /import\s+['"]([^'"]+)['"]/g;
const REQUIRE_RE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const CSS_IMPORT_RE = /@import\s+(?:url\()?['"]([^'"]+)['"]\)?/g;
const HMR_ACCEPT_RE = /import\.meta\.hot\.accept\s*\(/;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyse a source file and return its imports and HMR acceptance status.
 *
 * @param filePath  Absolute path to the file
 * @param rootDir  Project root — used to resolve bare/relative imports
 */
export function analyzeImports(filePath: string, rootDir: string): ImportAnalysis {
  const source = readFileSafe(filePath);
  if (source === null) {
    return { imports: [], acceptsHmr: false };
  }

  const ext = path.extname(filePath);
  const imports: Set<string> = new Set();

  if (ext === '.css' || ext === '.scss' || ext === '.less') {
    collectCSSImports(source, filePath, rootDir, imports);
  } else {
    collectJSImports(source, filePath, rootDir, imports);
  }

  const acceptsHmr = HMR_ACCEPT_RE.test(source);

  return { imports: Array.from(imports), acceptsHmr };
}

/**
 * Walk a directory recursively and return all source files matching
 * the given extensions (defaults to JS/TS/CSS extensions).
 */
export function collectSourceFiles(
  rootDir: string,
  extensions?: string[],
): string[] {
  const exts = extensions ?? ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.scss', '.less'];
  const files: string[] = [];

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
          walk(fullPath);
        }
      } else if (exts.includes(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return files;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function collectJSImports(
  source: string,
  fromFile: string,
  rootDir: string,
  out: Set<string>,
): void {
  // import ... from '...'
  let match: RegExpExecArray | null;
  IMPORT_FROM_RE.lastIndex = 0;
  while ((match = IMPORT_FROM_RE.exec(source)) !== null) {
    const resolved = resolveImport(match[1], fromFile, rootDir);
    if (resolved) out.add(resolved);
  }

  // import '...'
  SIDE_EFFECT_IMPORT_RE.lastIndex = 0;
  while ((match = SIDE_EFFECT_IMPORT_RE.exec(source)) !== null) {
    // Skip specifiers that contain 'from' — they are already captured by IMPORT_FROM_RE
    if (match[0].includes(' from ')) continue;
    const resolved = resolveImport(match[1], fromFile, rootDir);
    if (resolved) out.add(resolved);
  }

  // require('...')
  REQUIRE_RE.lastIndex = 0;
  while ((match = REQUIRE_RE.exec(source)) !== null) {
    const resolved = resolveImport(match[1], fromFile, rootDir);
    if (resolved) out.add(resolved);
  }
}

function collectCSSImports(
  source: string,
  fromFile: string,
  rootDir: string,
  out: Set<string>,
): void {
  let match: RegExpExecArray | null;
  CSS_IMPORT_RE.lastIndex = 0;
  while ((match = CSS_IMPORT_RE.exec(source)) !== null) {
    const resolved = resolveImport(match[1], fromFile, rootDir);
    if (resolved) out.add(resolved);
  }
}

/**
 * Resolve a raw import specifier to an absolute file path.
 *
 * - Relative paths (`./foo`, `../bar`) are resolved relative to the
 *   importing file's directory.
 * - Absolute paths start from the project root.
 * - Bare specifiers (e.g. `react`) are resolved from node_modules
 *   but **not** added to the module graph (they are external).
 */
function resolveImport(
  specifier: string,
  fromFile: string,
  rootDir: string,
): string | null {
  // Skip data: and http: URLs
  if (specifier.startsWith('data:') || specifier.startsWith('http:') || specifier.startsWith('https:')) {
    return null;
  }

  // Bare specifiers — skip for HMR graph (external deps don't change in dev)
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    return null;
  }

  const fromDir = path.dirname(fromFile);

  let resolved: string;
  if (specifier.startsWith('/')) {
    resolved = path.join(rootDir, specifier);
  } else {
    resolved = path.resolve(fromDir, specifier);
  }

  // Try to resolve extensions
  resolved = resolveExtension(resolved);
  return resolved;
}

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.scss', '.less'];

/**
 * If a path doesn't exist as-is, try appending common extensions
 * or look for an index file.
 */
function resolveExtension(filePath: string): string {
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return filePath;
  }

  for (const ext of EXTENSIONS) {
    const withExt = filePath + ext;
    if (fs.existsSync(withExt)) {
      return withExt;
    }
  }

  // Try index files
  for (const ext of EXTENSIONS) {
    const indexPath = path.join(filePath, 'index' + ext);
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }
  }

  // Return as-is if not resolvable (will be filtered out by the graph)
  return filePath;
}