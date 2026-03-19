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
  private server: Server | null = null;
  private watcher: FileWatcher | null = null;
  private clients: Set<ServerWebSocket<WebSocketData>> = new Set();
  private options: DevServerOptions;
  private clientIdCounter = 0;

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

    console.log(`[HMR] ${type}: ${filePath} (${category})`);

    switch (category) {
      case 'config':
        // Config changes require full restart
        console.log('[HMR] Config changed - restart required');
        this.broadcast(createUpdate('full-reload'));
        break;

      case 'main':
      case 'preload':
        // Main/preload changes require full reload
        this.broadcast(createUpdate('full-reload'));
        break;

      case 'renderer':
        // Renderer changes can be hot-reloaded
        if (filePath.endsWith('.css')) {
          this.broadcast(
            createUpdate('css-update', {
              path: filePath,
              updates: [createModuleUpdate(filePath, 'css-update')],
            })
          );
        } else {
          this.broadcast(
            createUpdate('update', {
              path: filePath,
              updates: [createModuleUpdate(filePath, 'js-update')],
            })
          );
        }
        break;

      default:
        // Other files might need full reload
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
    return `
// Bunlet HMR Client
(function() {
  const socket = new WebSocket('ws://' + location.host + '/__hmr');
  let isConnected = false;

  socket.onopen = () => {
    isConnected = true;
    console.log('[HMR] Connected');
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleUpdate(data);
    } catch (e) {
      console.error('[HMR] Failed to parse message:', e);
    }
  };

  socket.onclose = () => {
    isConnected = false;
    console.log('[HMR] Disconnected - attempting reconnect...');
    setTimeout(() => {
      location.reload();
    }, 1000);
  };

  socket.onerror = (error) => {
    console.error('[HMR] WebSocket error:', error);
  };

  function handleUpdate(data) {
    switch (data.type) {
      case 'connected':
        console.log('[HMR] Server connected');
        break;

      case 'full-reload':
        console.log('[HMR] Full reload requested');
        location.reload();
        break;

      case 'css-update':
        console.log('[HMR] CSS update:', data.path);
        updateCSS(data.path);
        break;

      case 'update':
        console.log('[HMR] Module update:', data.path);
        // For now, do full reload for JS changes
        // TODO: Implement proper HMR acceptance
        location.reload();
        break;

      case 'error':
        console.error('[HMR] Build error:', data.error?.message);
        showErrorOverlay(data.error);
        break;

      case 'prune':
        // Module was removed
        break;
    }
  }

  function updateCSS(path) {
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href && (href.includes(path) || path.includes(href))) {
        const newHref = href.split('?')[0] + '?t=' + Date.now();
        link.setAttribute('href', newHref);
        return;
      }
    }
    // If no matching stylesheet found, reload
    location.reload();
  }

  function showErrorOverlay(error) {
    // Remove existing overlay
    const existing = document.getElementById('bunlet-error-overlay');
    if (existing) existing.remove();

    if (!error) return;

    const overlay = document.createElement('div');
    overlay.id = 'bunlet-error-overlay';
    overlay.style.cssText = \`
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      color: #ff5555;
      font-family: monospace;
      font-size: 14px;
      padding: 20px;
      box-sizing: border-box;
      overflow: auto;
      z-index: 99999;
    \`;

    overlay.innerHTML = \`
      <div style="max-width: 800px; margin: 0 auto;">
        <h2 style="color: #ff5555; margin: 0 0 10px 0;">Build Error</h2>
        <pre style="color: #fff; white-space: pre-wrap; word-wrap: break-word;">\${escapeHtml(error.message)}</pre>
        \${error.file ? \`<p style="color: #888; margin-top: 10px;">File: \${escapeHtml(error.file)}</p>\` : ''}
        \${error.stack ? \`<pre style="color: #888; margin-top: 10px; font-size: 12px;">\${escapeHtml(error.stack)}</pre>\` : ''}
        <p style="color: #666; margin-top: 20px;">Fix the error and save the file to continue.</p>
      </div>
    \`;

    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Expose for debugging
  window.__bunletHMR = { socket, isConnected: () => isConnected };
})();
`;
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
