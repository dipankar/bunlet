/**
 * HMR Module Graph
 *
 * Tracks import dependencies between modules so that when a file changes,
 * we can determine the minimal set of modules that need to be updated
 * (the "hot boundary") instead of doing a full page reload.
 *
 * This is inspired by Vite's HMR architecture:
 * - Each module can declare `import.meta.hot.accept()` to handle its own updates
 * - If a changed module is not accepted by any parent, walk up the import graph
 *   until we find an accepted module or fall back to full reload
 */

export interface ModuleNode {
  id: string;
  url: string;
  importers: Set<string>;
  importedModules: Set<string>;
  isHmrAccepted: boolean;
  lastModified: number;
  type: 'js' | 'css' | 'html' | 'asset';
}

export class ModuleGraph {
  private modules: Map<string, ModuleNode> = new Map();
  private urlToId: Map<string, string> = new Map();

  /**
   * Ensure a module exists in the graph, creating it if needed
   */
  ensureModule(id: string, url: string, type: ModuleNode['type'] = 'js'): ModuleNode {
    const existing = this.modules.get(id);
    if (existing) {
      return existing;
    }

    const mod: ModuleNode = {
      id,
      url,
      importers: new Set(),
      importedModules: new Set(),
      isHmrAccepted: false,
      lastModified: Date.now(),
      type,
    };

    this.modules.set(id, mod);
    this.urlToId.set(url, id);
    return mod;
  }

  /**
   * Register an import relationship
   */
  addImport(importerId: string, importedId: string): void {
    const importer = this.modules.get(importerId);
    const imported = this.modules.get(importedId);

    if (importer && imported) {
      importer.importedModules.add(importedId);
      imported.importers.add(importerId);
    }
  }

  /**
   * Mark a module as accepting its own hot updates
   */
  acceptModule(id: string): void {
    const mod = this.modules.get(id);
    if (mod) {
      mod.isHmrAccepted = true;
    }
  }

  /**
   * Update a module's timestamp
   */
  updateModule(id: string): void {
    const mod = this.modules.get(id);
    if (mod) {
      mod.lastModified = Date.now();
    }
  }

  /**
   * Remove a module and clean up import relationships
   */
  removeModule(id: string): void {
    const mod = this.modules.get(id);
    if (!mod) return;

    // Remove this module from its importers' importedModules
    for (const importerId of mod.importers) {
      const importer = this.modules.get(importerId);
      if (importer) {
        importer.importedModules.delete(id);
      }
    }

    // Remove this module from its importedModules' importers
    for (const importedId of mod.importedModules) {
      const imported = this.modules.get(importedId);
      if (imported) {
        imported.importers.delete(id);
      }
    }

    this.urlToId.delete(mod.url);
    this.modules.delete(id);
  }

  /**
   * Determine what kind of HMR update is needed when a file changes.
   *
   * Returns:
   * - { type: 'full-reload' } if no module in the chain accepts the update
   * - { type: 'update', modules: [...] } with the list of modules to hot-update
   * - { type: 'css-update', path } for CSS files
   */
  resolveUpdate(changedId: string): HMRUpdateResult {
    const changed = this.modules.get(changedId);
    if (!changed) {
      return { type: 'full-reload' };
    }

    // CSS files always get CSS updates
    if (changed.type === 'css') {
      return {
        type: 'css-update',
        path: changed.url,
        updates: [
          {
            type: 'css-update',
            path: changed.url,
            acceptedPath: changed.url,
            timestamp: Date.now(),
          },
        ],
      };
    }

    // HTML changes always require full reload
    if (changed.type === 'html') {
      return { type: 'full-reload' };
    }

    // If the module accepts its own updates, just update it
    if (changed.isHmrAccepted) {
      return {
        type: 'update',
        updates: [
          {
            type: 'js-update',
            path: changed.url,
            acceptedPath: changed.url,
            timestamp: Date.now(),
          },
        ],
      };
    }

    // Walk up the import graph to find accepting modules
    const acceptedModules = this.findAcceptingModules(changedId);
    if (acceptedModules.size > 0) {
      return {
        type: 'update',
        updates: Array.from(acceptedModules).map((id) => {
          const mod = this.modules.get(id)!;
          return {
            type: 'js-update' as const,
            path: mod.url,
            acceptedPath: changed.url,
            timestamp: Date.now(),
          };
        }),
      };
    }

    // No accepting module found - full reload
    return { type: 'full-reload' };
  }

  /**
   * Walk up the import graph from a changed module to find modules
   * that accept hot updates (i.e., have import.meta.hot.accept())
   */
  private findAcceptingModules(changedId: string): Set<string> {
    const accepted = new Set<string>();
    const visited = new Set<string>();
    const queue = [changedId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const mod = this.modules.get(currentId);
      if (!mod) continue;

      // Check all importers of this module
      for (const importerId of mod.importers) {
        const importer = this.modules.get(importerId);
        if (!importer) continue;

        if (importer.isHmrAccepted) {
          accepted.add(importerId);
        } else {
          // Keep walking up
          queue.push(importerId);
        }
      }
    }

    return accepted;
  }

  /**
   * Get a module by its ID
   */
  getModule(id: string): ModuleNode | undefined {
    return this.modules.get(id);
  }

  /**
   * Get a module by its URL
   */
  getModuleByUrl(url: string): ModuleNode | undefined {
    const id = this.urlToId.get(url);
    if (id) {
      return this.modules.get(id);
    }
    return undefined;
  }

  /**
   * Invalidate a module and all its importers (mark as stale)
   */
  invalidateModule(id: string): string[] {
    const invalid = new Set<string>();
    const queue = [id];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (invalid.has(currentId)) continue;

      const mod = this.modules.get(currentId);
      if (!mod) continue;

      invalid.add(currentId);
      mod.lastModified = Date.now();

      for (const importerId of mod.importers) {
        if (!invalid.has(importerId)) {
          queue.push(importerId);
        }
      }
    }

    return Array.from(invalid);
  }

  /**
   * Clear all modules
   */
  clear(): void {
    this.modules.clear();
    this.urlToId.clear();
  }

  /**
   * Get all module IDs
   */
  getModuleIds(): string[] {
    return Array.from(this.modules.keys());
  }
}

export type HMRUpdateResult =
  | { type: 'full-reload' }
  | { type: 'update'; updates: import('./hmr').ModuleUpdate[] }
  | { type: 'css-update'; path: string; updates: import('./hmr').ModuleUpdate[] };