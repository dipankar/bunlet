/**
 * Dev Server
 *
 * HTTP server for serving renderer files and WebSocket
 * server for HMR communication.
 */

import * as path from 'path';
import * as fs from 'fs';
import type { Server, ServerWebSocket } from 'bun';
import { FileWatcher, type FileChange } from './watcher';
import {
  type HMRUpdate,
  type HMRClientMessage,
  createUpdate,
  createModuleUpdate,
  createErrorUpdate,
} from './hmr';
import { ModuleGraph } from './module-graph';
import { analyzeImports, collectSourceFiles } from './import-analyzer';
import { getImportMetaHotPolyfill, rewriteImportMetaHot } from './hmr-polyfill';
import { createIdentitySourceMap, composeSourceMaps, appendSourceMapComment, type SourceMapInput } from '../build/sourcemap';

export interface DevServerOptions {
  port: number;
  host: string;
  hmr: boolean;
  open: boolean;
  root: string;
  rendererDir: string;
}

interface WebSocketData {
  id: string;
}

/**
 * Development server with HMR support
 */
export class DevServer {
  private server: Server<WebSocketData> | null = null;
  private watcher: FileWatcher | null = null;
  private clients: Set<ServerWebSocket<WebSocketData>> = new Set();
  private options: DevServerOptions;
  private clientIdCounter = 0;
  private transformedSourceMaps: Map<string, SourceMapInput> = new Map();
  private moduleGraph: ModuleGraph = new ModuleGraph();

  constructor(options: Partial<DevServerOptions> = {}) {
    this.options = {
      port: 5173,
      host: 'localhost',
      hmr: true,
      open: true,
      root: process.cwd(),
      rendererDir: 'renderer',
      ...options,
    };
  }

  /**
   * Start the dev server
   */
  async start(): Promise<void> {
    const { port, host, root, rendererDir, hmr } = this.options;
    const staticRoot = path.resolve(root, rendererDir);

    // Start HTTP + WebSocket server
    this.server = Bun.serve<WebSocketData>({
      port,
      hostname: host,

      fetch: async (req, server) => {
        const url = new URL(req.url);

        // Handle WebSocket upgrade for HMR
        if (url.pathname === '/__hmr') {
          const id = String(++this.clientIdCounter);
          const success = server.upgrade(req, { data: { id } });
          if (success) {
            return undefined;
          }
          return new Response('WebSocket upgrade failed', { status: 500 });
        }

        // Serve HMR client script
        if (url.pathname === '/__hmr-client.js') {
          return new Response(this.getHMRClientScript(), {
            headers: { 'Content-Type': 'application/javascript' },
          });
        }

        // Serve dev source maps for transformed files
        if (url.pathname.endsWith('.map') && this.options.hmr) {
          const sm = this.transformedSourceMaps.get(url.pathname);
          if (sm) {
            return new Response(JSON.stringify(sm), {
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }

        // Serve static files
        return this.serveStatic(url.pathname, staticRoot);
      },

      websocket: {
        open: (ws) => {
          this.clients.add(ws);
          console.log(`[HMR] Client connected (${this.clients.size} total)`);

          // Send connected message
          ws.send(JSON.stringify(createUpdate('connected')));
        },

        message: (ws, message) => {
          try {
            const data = JSON.parse(String(message)) as HMRClientMessage;
            this.handleClientMessage(ws, data);
          } catch {
            // Ignore invalid messages
          }
        },

        close: (ws) => {
          this.clients.delete(ws);
          console.log(`[HMR] Client disconnected (${this.clients.size} total)`);
        },
      },
    });

    console.log(`\n  Dev server running at http://${host}:${port}/\n`);

    // Start file watcher if HMR is enabled
    if (hmr) {
      this.populateModuleGraph();
      this.startWatcher();
    }
  }

  /**
   * Stop the dev server
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.stop();
      this.watcher = null;
    }

    if (this.server) {
      this.server.stop();
      this.server = null;
    }

    this.clients.clear();
    this.transformedSourceMaps.clear();
  }

  /**
   * Get the server URL
   */
  getUrl(): string {
    const { host, port } = this.options;
    return `http://${host}:${port}`;
  }

  /**
   * Send an HMR update to all clients
   */
  broadcast(update: HMRUpdate): void {
    const message = JSON.stringify(update);
    for (const client of this.clients) {
      try {
        client.send(message);
      } catch {
        // Client disconnected
        this.clients.delete(client);
      }
    }
  }

  /**
   * Populate the module graph by scanning renderer source files
   */
  private populateModuleGraph(): void {
    const rendererRoot = path.resolve(this.options.root, this.options.rendererDir);
    if (!fs.existsSync(rendererRoot)) {
      return;
    }

    const sourceFiles = collectSourceFiles(rendererRoot);
    for (const filePath of sourceFiles) {
      this.analyzeAndRegisterModule(filePath);
    }

    console.log(`[hmr] Module graph: ${this.moduleGraph.getModuleIds().length} modules`);
  }

  /**
   * Analyze a single file and register it (and its imports) in the module graph
   */
  private analyzeAndRegisterModule(filePath: string): void {
    const ext = path.extname(filePath);
    const moduleType = ext === '.css' || ext === '.scss' || ext === '.less' ? 'css' as const
      : ext === '.html' || ext === '.htm' ? 'html' as const
      : 'js' as const;

    const relativePath = path.relative(this.options.root, filePath).replace(/\\/g, '/');
    const url = '/' + relativePath;

    // Ensure the module exists in the graph
    this.moduleGraph.ensureModule(filePath, url, moduleType);

    // Analyze imports and register them
    const { imports, acceptsHmr } = analyzeImports(filePath, this.options.root);
    if (acceptsHmr) {
      this.moduleGraph.acceptModule(filePath);
    }

    for (const importPath of imports) {
      const importRelPath = path.relative(this.options.root, importPath).replace(/\\/g, '/');
      const importUrl = '/' + importRelPath;
      const importExt = path.extname(importPath);
      const importType = importExt === '.css' || importExt === '.scss' || importExt === '.less' ? 'css' as const
        : importExt === '.html' || importExt === '.htm' ? 'html' as const
        : 'js' as const;

      this.moduleGraph.ensureModule(importPath, importUrl, importType);
      this.moduleGraph.addImport(filePath, importPath);
    }
  }

  /**
   * Start the file watcher
   */
  private startWatcher(): void {
    this.watcher = new FileWatcher({
      root: this.options.root,
    });

    this.watcher.onChange((change) => {
      this.handleFileChange(change);
    });

    this.watcher.start();
    console.log('[HMR] File watcher started');
  }

  /**
   * Handle a file change
   */
  private handleFileChange(change: FileChange): void {
    const { type, path: filePath, category } = change;

    console.log(`[hmr] ${type}: ${filePath} (${category})`);

    // Determine module type
    const moduleType = filePath.endsWith('.css') ? 'css' as const
      : filePath.endsWith('.html') || filePath.endsWith('.htm') ? 'html' as const
      : filePath.endsWith('.js') || filePath.endsWith('.mjs') || filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.jsx') ? 'js' as const
      : 'asset' as const;

    // Update the module graph
    const url = '/' + filePath.replace(/\\/g, '/');
    const mod = this.moduleGraph.ensureModule(filePath, url, moduleType);
    this.moduleGraph.updateModule(filePath);

    // Re-analyze imports for the changed file
    const { imports, acceptsHmr } = analyzeImports(
      path.resolve(this.options.root, filePath),
      this.options.root,
    );
    if (acceptsHmr) {
      this.moduleGraph.acceptModule(filePath);
    } else {
      // If it previously accepted but no longer does, reset
      const existing = this.moduleGraph.getModule(filePath);
      if (existing && existing.isHmrAccepted) {
        existing.isHmrAccepted = false;
      }
    }

    // Re-register import relationships
    for (const importPath of imports) {
      this.moduleGraph.ensureModule(importPath, '/' + path.relative(this.options.root, importPath).replace(/\\/g, '/'), 'js');
      this.moduleGraph.addImport(filePath, importPath);
    }

    switch (category) {
      case 'config':
        console.log('[hmr] Config changed - restart required');
        this.broadcast(createUpdate('full-reload'));
        break;

      case 'main':
      case 'preload':
        console.log('[hmr] Main/preload changed - full reload');
        this.broadcast(createUpdate('full-reload'));
        break;

      case 'renderer': {
        // Use module graph to determine HMR strategy
        const result = this.moduleGraph.resolveUpdate(filePath);

        if (result.type === 'full-reload') {
          console.log('[hmr] No accepting module found - full reload');
          this.broadcast(createUpdate('full-reload'));
        } else if (result.type === 'css-update') {
          console.log('[hmr] CSS update:', filePath);
          this.broadcast(createUpdate('css-update', {
            path: filePath,
            updates: result.updates,
          }));
        } else if (result.type === 'update') {
          console.log('[hmr] Module hot update:', filePath, `(${result.updates.length} module(s))`);
          this.broadcast(createUpdate('update', {
            path: filePath,
            updates: result.updates,
          }));
        }
        break;
      }

      default:
        if (type === 'change') {
          this.broadcast(createUpdate('full-reload'));
        }
    }
  }

  /**
   * Handle a message from a client
   */
  private handleClientMessage(
    ws: ServerWebSocket<WebSocketData>,
    message: HMRClientMessage
  ): void {
    if (message.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
    }
  }

  /**
   * Serve a static file
   */
  private async serveStatic(
    pathname: string,
    staticRoot: string
  ): Promise<Response> {
    let filePath = path.join(staticRoot, pathname);

    // Default to index.html for directory requests
    if (pathname === '/' || pathname.endsWith('/')) {
      filePath = path.join(filePath, 'index.html');
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      // Try adding .html extension
      if (fs.existsSync(filePath + '.html')) {
        filePath = filePath + '.html';
      } else {
        // Fall back to index.html for SPA routing
        filePath = path.join(staticRoot, 'index.html');
        if (!fs.existsSync(filePath)) {
          return new Response('Not Found', { status: 404 });
        }
      }
    }

    // Check if it's a directory
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      if (!fs.existsSync(filePath)) {
        return new Response('Not Found', { status: 404 });
      }
    }

    // Read and serve the file
    const file = Bun.file(filePath);
    let content = await file.text();

    // Transform JS/TS files: inject import.meta.hot polyfill
    if (this.options.hmr && this.isTransformable(filePath)) {
      content = this.transformForHMR(content, filePath);
    }

    // Inject HMR client script into HTML files
    if (filePath.endsWith('.html') && this.options.hmr) {
      content = this.injectHMRClient(content);
    }

    return new Response(content, {
      headers: {
        'Content-Type': this.getContentType(filePath),
        'Cache-Control': 'no-cache',
      },
    });
  }

  /**
   * Inject HMR client script into HTML
   */
  private injectHMRClient(html: string): string {
    const script = `<script type="module" src="/__hmr-client.js"></script>`;

    // Insert before </head> or at the start of <body>
    if (html.includes('</head>')) {
      return html.replace('</head>', `${script}\n</head>`);
    } else if (html.includes('<body>')) {
      return html.replace('<body>', `<body>\n${script}`);
    } else {
      return script + html;
    }
  }

  /**
   * Get the HMR client script
   */
  private getHMRClientScript(): string {
    // Try to load the compiled HMR client; fall back to the minimal inline client.
    // The full client supports module-level hot accept/reject.
    try {
      const clientPath = path.join(__dirname, 'hmr-client.js');
      if (fs.existsSync(clientPath)) {
        return fs.readFileSync(clientPath, 'utf-8');
      }
    } catch {
      // Fall through to inline client
    }

    // Minimal inline fallback (for dev before hmr-client.ts is compiled)
    return `
// Bunlet HMR Client (inline fallback)
(function() {
  const socket = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/__hmr');
  socket.onopen = () => console.log('[hmr] connected');
  socket.onmessage = (event) => {
    try { const data = JSON.parse(event.data); handleUpdate(data); } catch(e) { console.error('[hmr] parse error:', e); }
  };
  socket.onclose = () => { console.log('[hmr] disconnected'); setTimeout(() => location.reload(), 1000); };
  socket.onerror = () => console.error('[hmr] websocket error');

  function handleUpdate(data) {
    switch (data.type) {
      case 'connected': console.log('[hmr] server connected'); break;
      case 'full-reload': console.log('[hmr] full reload'); location.reload(); break;
      case 'css-update': updateCSS(data); break;
      case 'update': location.reload(); break;
      case 'error': console.error('[hmr] error:', data.error); break;
    }
  }

  function updateCSS(data) {
    if (!data.path) { location.reload(); return; }
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href && (href.includes(data.path) || data.path.includes(href.replace(/^\\//, '')))) {
        const newLink = document.createElement('link');
        newLink.rel = 'stylesheet';
        newLink.href = href.split('?')[0] + '?t=' + Date.now();
        newLink.onload = () => link.remove();
        link.parentNode.insertBefore(newLink, link.nextSibling);
        return;
      }
    }
    location.reload();
  }
})();
`;
  }

  /**
   * Check if a file should be transformed for HMR
   */
  private isTransformable(filePath: string): boolean {
    const ext = path.extname(filePath);
    return ['.js', '.mjs', '.ts', '.tsx', '.jsx'].includes(ext);
  }

  /**
   * Transform a JS/TS file for HMR:
   * 1. Replace `import.meta.hot.accept()` calls with `__bunlet_hmr.accept()` calls
   * 2. Inject the HMR polyfill at the top of the file
   */
  private transformForHMR(content: string, filePath: string): string {
    const moduleId = '/' + path.relative(this.options.root, filePath).replace(/\\/g, '/');
    const rewritten = rewriteImportMetaHot(content, moduleId);
    const polyfill = getImportMetaHotPolyfill(moduleId);
    const polyfillLineCount = polyfill.split('\n').length;
    const transformed = polyfill + '\n' + rewritten;

    if (this.options.hmr) {
      const originalMap = createIdentitySourceMap(moduleId, content, filePath);
      const composed = composeSourceMaps(
        moduleId,
        polyfillLineCount,
        null,
        originalMap,
        content,
      );
      const mapPath = moduleId + '.map';
      this.transformedSourceMaps.set(mapPath, composed);
      return appendSourceMapComment(transformed, mapPath);
    }

    return transformed;
  }

  /**
   * Get content type for a file
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const types: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.mjs': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject',
    };
    return types[ext] || 'application/octet-stream';
  }
}
