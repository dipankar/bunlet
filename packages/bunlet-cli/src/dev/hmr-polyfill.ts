/**
 * HMR import.meta.hot polyfill generator
 *
 * Generates a polyfill snippet that:
 * 1. Shims `import.meta.hot` to be truthy in dev mode
 * 2. Bridges `import.meta.hot.accept()` to `__bunlet_hmr.accept()`
 * 3. Bridges `import.meta.hot.decline()` to `__bunlet_hmr.decline()`
 *
 * This polyfill is prepended to each JS/TS module served by the dev server
 * after `import.meta.hot.*` calls have been rewritten to `__bunlet_hmr.*` calls.
 */

/**
 * Generate the import.meta.hot polyfill for a specific module ID.
 *
 * The polyfill defines a module-local `import.meta.hot` that delegates
 * to the global `__bunlet_hmr` runtime injected by the HMR client.
 */
export function getImportMetaHotPolyfill(moduleId: string): string {
  return [
    `/* @bunlet-hmr-polyfill ${moduleId} */`,
    `var __bunlet_hmr = window.__bunlet_hmr;`,
    `var import_meta_hot = {`,
    `  get accept() { return __bunlet_hmr ? __bunlet_hmr.accept.bind(__bunlet_hmr, "${moduleId}") : undefined; },`,
    `  get decline() { return __bunlet_hmr ? __bunlet_hmr.decline.bind(__bunlet_hmr, "${moduleId}") : undefined; },`,
    `  get data() { return __bunlet_hmr && __bunlet_hmr._modules ? __bunlet_hmr._modules["${moduleId}"] : {}; },`,
    `};`,
    `Object.defineProperty(import_meta_hot, "id", { get: function() { return "${moduleId}"; } });`,
  ].join('\n');
}

/**
 * Rewrite import.meta.hot calls in a source string to use __bunlet_hmr APIs.
 *
 * Transforms:
 *   import.meta.hot.accept(cb)   →  __bunlet_hmr.accept(moduleId, cb)
 *   import.meta.hot.accept()     →  __bunlet_hmr.accept(moduleId)
 *   import.meta.hot.decline()    →  __bunlet_hmr.decline(moduleId)
 *   if (import.meta.hot)         →  if (__bunlet_hmr)
 *   import.meta.hot              →  __bunlet_hmr (truthy)
 *
 * Non-HMR `import.meta` usages (e.g. `import.meta.url`) are left untouched.
 */
export function rewriteImportMetaHot(source: string, moduleId: string): string {
  let result = source;

  // 1. import.meta.hot.accept(...) → __bunlet_hmr.accept(moduleId, ...)
  result = result.replace(
    /import\.meta\.hot\.accept\s*\(([^)]*)\)/g,
    (_match: string, callbackArg: string) => {
      const trimmed = callbackArg.trim();
      if (trimmed) {
        return `__bunlet_hmr.accept("${moduleId}", ${trimmed})`;
      }
      return `__bunlet_hmr.accept("${moduleId}")`;
    },
  );

  // 2. import.meta.hot.decline() → __bunlet_hmr.decline(moduleId)
  result = result.replace(
    /import\.meta\.hot\.decline\s*\(\s*\)/g,
    `__bunlet_hmr.decline("${moduleId}")`,
  );

  // 3. import.meta.hot (standalone read, e.g. if (import.meta.hot))
  // Only match when NOT followed by . or ( — i.e. not import.meta.hot.accept, etc.
  result = result.replace(
    /import\.meta\.hot\b(?!\s*[\.(])/g,
    `true`,
  );

  return result;
}