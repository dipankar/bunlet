import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { analyzeImports, collectSourceFiles } from './import-analyzer';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bunlet-import-analyzer-'));
  tempDirs.push(dir);
  return dir;
}

describe('analyzeImports', () => {
  test('detects relative JS imports', () => {
    const root = createTempDir();
    const targetFile = path.join(root, 'utils.ts');
    fs.writeFileSync(targetFile, 'export function add(a: number, b: number) { return a + b; }');

    const sourceFile = path.join(root, 'main.ts');
    fs.writeFileSync(sourceFile, `import { add } from './utils';\nconsole.log(add(1, 2));`);

    const result = analyzeImports(sourceFile, root);
    expect(result.imports).toContain(targetFile);
    expect(result.acceptsHmr).toBe(false);
  });

  test('detects multiple imports from different files', () => {
    const root = createTempDir();
    fs.writeFileSync(path.join(root, 'a.ts'), 'export const a = 1;');
    fs.writeFileSync(path.join(root, 'b.ts'), 'export const b = 2;');

    const sourceFile = path.join(root, 'main.ts');
    fs.writeFileSync(sourceFile, `import { a } from './a';\nimport { b } from './b';\nconsole.log(a, b);`);

    const result = analyzeImports(sourceFile, root);
    expect(result.imports.length).toBe(2);
    expect(result.imports).toContain(path.join(root, 'a.ts'));
    expect(result.imports).toContain(path.join(root, 'b.ts'));
  });

  test('detects import.meta.hot.accept()', () => {
    const root = createTempDir();
    const sourceFile = path.join(root, 'component.ts');
    fs.writeFileSync(sourceFile, `import.meta.hot.accept(() => { console.log('updated'); });`);

    const result = analyzeImports(sourceFile, root);
    expect(result.acceptsHmr).toBe(true);
  });

  test('detects import.meta.hot.accept() without callback', () => {
    const root = createTempDir();
    const sourceFile = path.join(root, 'component.ts');
    fs.writeFileSync(sourceFile, `import.meta.hot.accept();`);

    const result = analyzeImports(sourceFile, root);
    expect(result.acceptsHmr).toBe(true);
  });

  test('ignores bare specifier imports (external packages)', () => {
    const root = createTempDir();
    const sourceFile = path.join(root, 'main.ts');
    fs.writeFileSync(sourceFile, `import React from 'react';\nconsole.log(React);`);

    const result = analyzeImports(sourceFile, root);
    expect(result.imports.length).toBe(0);
  });

  test('detects CSS @import declarations', () => {
    const root = createTempDir();
    const otherCss = path.join(root, 'reset.css');
    fs.writeFileSync(otherCss, '/* reset */');

    const sourceFile = path.join(root, 'styles.css');
    fs.writeFileSync(sourceFile, `@import './reset.css';\nbody { margin: 0; }`);

    const result = analyzeImports(sourceFile, root);
    expect(result.imports).toContain(otherCss);
  });

  test('detects side-effect imports', () => {
    const root = createTempDir();
    const polyfillFile = path.join(root, 'polyfill.ts');
    fs.writeFileSync(polyfillFile, '// polyfill');

    const sourceFile = path.join(root, 'main.ts');
    fs.writeFileSync(sourceFile, `import './polyfill';\nconsole.log('done');`);

    const result = analyzeImports(sourceFile, root);
    expect(result.imports).toContain(polyfillFile);
  });

  test('resolves imports from subdirectories', () => {
    const root = createTempDir();
    const subDir = path.join(root, 'src');
    fs.mkdirSync(subDir);
    const componentFile = path.join(subDir, 'component.ts');
    fs.writeFileSync(componentFile, 'export const x = 1;');

    const sourceFile = path.join(root, 'main.ts');
    fs.writeFileSync(sourceFile, `import { x } from './src/component';`);

    const result = analyzeImports(sourceFile, root);
    expect(result.imports).toContain(componentFile);
  });

  test('skips http and data URLs', () => {
    const root = createTempDir();
    const sourceFile = path.join(root, 'main.ts');
    fs.writeFileSync(sourceFile, `import data from 'data:text/plain,hello';\nimport('http://example.com/module');\n`);

    const result = analyzeImports(sourceFile, root);
    expect(result.imports.length).toBe(0);
  });

  test('returns empty result for missing files', () => {
    const result = analyzeImports('/nonexistent/file.ts', '/');
    expect(result.imports).toEqual([]);
    expect(result.acceptsHmr).toBe(false);
  });
});

describe('collectSourceFiles', () => {
  test('collects files by extension', () => {
    const root = createTempDir();
    fs.writeFileSync(path.join(root, 'main.ts'), '// main');
    fs.writeFileSync(path.join(root, 'app.js'), '// app');
    fs.writeFileSync(path.join(root, 'style.css'), '/* style */');
    fs.writeFileSync(path.join(root, 'data.json'), '{}');

    const files = collectSourceFiles(root);
    expect(files.length).toBe(3);
    expect(files.some((f) => f.endsWith('main.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('app.js'))).toBe(true);
    expect(files.some((f) => f.endsWith('style.css'))).toBe(true);
    expect(files.some((f) => f.endsWith('data.json'))).toBe(false);
  });

  test('skips node_modules and dist directories', () => {
    const root = createTempDir();
    const nmDir = path.join(root, 'node_modules');
    const distDir = path.join(root, 'dist');
    fs.mkdirSync(nmDir);
    fs.mkdirSync(distDir);
    fs.writeFileSync(path.join(nmDir, 'foo.ts'), '// external');
    fs.writeFileSync(path.join(distDir, 'bundle.js'), '// built');
    fs.writeFileSync(path.join(root, 'main.ts'), '// main');

    const files = collectSourceFiles(root);
    expect(files.length).toBe(1);
    expect(files[0]).toContain('main.ts');
  });

  test('walks subdirectories', () => {
    const root = createTempDir();
    const srcDir = path.join(root, 'src');
    fs.mkdirSync(srcDir);
    fs.writeFileSync(path.join(root, 'main.ts'), '// main');
    fs.writeFileSync(path.join(srcDir, 'component.tsx'), '// component');

    const files = collectSourceFiles(root);
    expect(files.length).toBe(2);
  });
});