import { describe, expect, test } from 'bun:test';
import {
  composeSourceMaps,
  createIdentitySourceMap,
  appendSourceMapComment,
  vlqEncode,
  vlqDecode,
} from './sourcemap';

describe('sourcemap VLQ encoding', () => {
  test('encode and decode round-trip', () => {
    const values = [0, 1, 5, 10, 100, 1000, -1];
    for (const value of values) {
      const encoded = vlqEncode(value);
      const decoded = vlqDecode(encoded);
      expect(decoded[0]).toBe(value);
    }
  });
});

describe('createIdentitySourceMap', () => {
  test('creates a valid identity source map', () => {
    const source = 'const a = 1;\nconst b = 2;\n';
    const map = createIdentitySourceMap('app.js', source, '/src/app.ts');

    expect(map.version).toBe(3);
    expect(map.file).toBe('app.js');
    expect(map.sources).toEqual(['/src/app.ts']);
    expect(map.sourcesContent).toEqual([source]);
    expect(map.names).toEqual([]);
    expect(map.mappings).toBeTruthy();
  });

  test('identity map has one segment per line', () => {
    const source = 'line1\nline2\nline3';
    const map = createIdentitySourceMap('test.js', source);

    const lines = map.mappings!.split(';');
    expect(lines).toHaveLength(3);
  });
});

describe('composeSourceMaps', () => {
  test('compose with no original map produces shifted empty mappings', () => {
    const composed = composeSourceMaps('out.js', 3, null, null, 'content');
    expect(composed.version).toBe(3);
    expect(composed.sources).toEqual(['out.js']);
    expect(composed.sourcesContent).toEqual(['content']);
    expect(composed.mappings).toBe(';;');
  });

  test('compose with zero prepend lines returns original mappings', () => {
    const original = createIdentitySourceMap('app.js', 'hello\nworld', '/src/app.ts');
    const composed = composeSourceMaps('app.js', 0, null, original, 'hello\nworld');

    expect(composed.version).toBe(3);
    expect(composed.sources).toEqual(['/src/app.ts']);
    expect(composed.mappings).toEqual(original.mappings);
  });

  test('compose shifts original mappings by prepend line count', () => {
    const original = createIdentitySourceMap('app.js', 'hello\nworld', '/src/app.ts');
    const composed = composeSourceMaps('app.js', 2, null, original, 'hello\nworld');

    const originalLines = original.mappings!.split(';');
    const composedLines = composed.mappings!.split(';');

    expect(composedLines.length).toBe(2 + originalLines.length);
  });

  test('appendSourceMapComment adds sourceMappingURL', () => {
    const result = appendSourceMapComment('const x = 1;', 'app.js.map');
    expect(result).toContain('//# sourceMappingURL=app.js.map');
    expect(result).toEndWith('\n');
  });
});

describe('sourcemap end-to-end', () => {
  test('HMR transform produces valid source map with polyfill shift', () => {
    const source = 'import { app } from "@bunlet/core";\nconsole.log("hello");\n';
    const moduleId = '/src/app.ts';
    const polyfill = 'const __bunlet_hmr = {};\n// line 2 of polyfill\n';
    const polyfillLineCount = polyfill.split('\n').length - 1;
    const transformed = polyfill + source;

    const originalMap = createIdentitySourceMap(moduleId, source, '/src/app.ts');
    const composed = composeSourceMaps(
      moduleId,
      polyfillLineCount,
      null,
      originalMap,
      source,
    );

    expect(composed.version).toBe(3);
    expect(composed.sources).toEqual(['/src/app.ts']);
    expect(composed.sourcesContent).toEqual([source]);

    const composedLines = composed.mappings!.split(';');
    const originalLines = originalMap.mappings!.split(';');

    expect(composedLines.length).toBe(polyfillLineCount + originalLines.length);

    for (let i = polyfillLineCount; i < composedLines.length; i++) {
      expect(composedLines[i]).toEqual(originalLines[i - polyfillLineCount]);
    }
  });

  test('multiple source maps compose correctly', () => {
    const sourceA = 'const a = 1;\n';
    const sourceB = 'import foo from "bar";\nconsole.log(foo);\n';

    const mapA = createIdentitySourceMap('a.js', sourceA, '/src/a.ts');
    const mapB = createIdentitySourceMap('b.js', sourceB, '/src/b.ts');

    const composed = composeSourceMaps(
      'bundle.js',
      sourceA.split('\n').length - 1,
      mapA,
      mapB,
      sourceB,
    );

    expect(composed.version).toBe(3);
    expect(composed.sources!.length).toBeGreaterThanOrEqual(2);
  });
});