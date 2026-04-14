import { describe, expect, test } from 'bun:test';
import { getImportMetaHotPolyfill, rewriteImportMetaHot } from './hmr-polyfill';

describe('rewriteImportMetaHot', () => {
  test('rewrites import.meta.hot.accept() with callback', () => {
    const source = `import.meta.hot.accept(() => { console.log('updated'); });`;
    const result = rewriteImportMetaHot(source, '/app.tsx');
    expect(result).toContain('__bunlet_hmr.accept("/app.tsx", () => { console.log(\'updated\'); })');
    expect(result).not.toContain('import.meta.hot.accept');
  });

  test('rewrites import.meta.hot.accept() without callback', () => {
    const source = `import.meta.hot.accept();`;
    const result = rewriteImportMetaHot(source, '/main.ts');
    expect(result).toContain('__bunlet_hmr.accept("/main.ts")');
    expect(result).not.toContain('import.meta.hot.accept');
  });

  test('rewrites import.meta.hot.decline()', () => {
    const source = `import.meta.hot.decline();`;
    const result = rewriteImportMetaHot(source, '/state.ts');
    expect(result).toContain('__bunlet_hmr.decline("/state.ts")');
  });

  test('replaces import.meta.hot in conditional check', () => {
    const source = `if (import.meta.hot) { console.log('dev mode'); }`;
    const result = rewriteImportMetaHot(source, '/app.ts');
    expect(result).toContain('if (true) { console.log(\'dev mode\'); }');
    expect(result).not.toContain('import.meta.hot');
  });

  test('does not rewrite import.meta.url', () => {
    const source = `const url = import.meta.url;`;
    const result = rewriteImportMetaHot(source, '/app.ts');
    expect(result).toContain('import.meta.url');
    expect(result).not.toContain('__bunlet_hmr');
  });

  test('handles multiple rewrites in same file', () => {
    const source = `
import.meta.hot.accept(() => console.log('hmr'));
if (import.meta.hot) {
  console.log('dev');
}
import.meta.hot.decline();
`;
    const result = rewriteImportMetaHot(source, '/app.ts');
    expect(result).toContain('__bunlet_hmr.accept');
    expect(result).toContain('__bunlet_hmr.decline');
    expect(result).toContain('true');
    expect(result).not.toContain('import.meta.hot');
  });
});

describe('getImportMetaHotPolyfill', () => {
  test('generates polyfill with module ID', () => {
    const polyfill = getImportMetaHotPolyfill('/components/App.tsx');
    expect(polyfill).toContain('/components/App.tsx');
    expect(polyfill).toContain('__bunlet_hmr');
    expect(polyfill).toContain('import_meta_hot');
  });

  test('polyfill references window.__bunlet_hmr', () => {
    const polyfill = getImportMetaHotPolyfill('/app.ts');
    expect(polyfill).toContain('window.__bunlet_hmr');
  });
});