/**
 * HMR Client Runtime
 *
 * This script is injected into the renderer during development.
 * It connects to the dev server via WebSocket and handles:
 * - Connected/disconnected state
 * - Full reloads
 * - CSS hot updates (swap <link> tags without reload)
 * - JS hot module updates (import module-level accept/reject)
 * - Error overlay display
 */

interface HMRClientModule {
  id: string;
  accept?: (cb?: () => void) => void;
  dispose?: (cb?: () => void) => void;
}

interface PendingAccept {
  id: string;
  callback: ((cb?: () => void) => void) | null;
}

const hmrModules: Map<string, HMRClientModule> = new Map();
const hmrDeclineHandlers: Set<string> = new Set();

function setupHMRClient() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${location.host}/__hmr`);

  socket.addEventListener('open', () => {
    console.log('[hmr] connected');
    clearErrorOverlay();
  });

  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      handleMessage(data);
    } catch (err) {
      console.error('[hmr] failed to parse message:', err);
    }
  });

  socket.addEventListener('close', () => {
    console.log('[hmr] disconnected - reloading...');
    setTimeout(() => location.reload(), 1000);
  });

  socket.addEventListener('error', () => {
    console.error('[hmr] websocket error');
  });

  // Expose hmr API for module registration
  (window as any).__bunlet_hmr = {
    registerModule(id: string, module: HMRClientModule) {
      hmrModules.set(id, module);
    },
    accept(id: string, callback?: (cb?: () => void) => void) {
      const mod = hmrModules.get(id);
      if (mod) {
        mod.accept = callback || (() => {});
      }
    },
    decline(id: string) {
      hmrDeclineHandlers.add(id);
    },
  };
}

function handleMessage(data: any) {
  switch (data.type) {
    case 'connected':
      console.log('[hmr] server connected');
      break;

    case 'full-reload':
      console.log('[hmr] full reload required');
      location.reload();
      break;

    case 'css-update':
      handleCSSUpdate(data);
      break;

    case 'update':
      handleJSUpdate(data);
      break;

    case 'error':
      handleError(data.error);
      break;

    case 'prune':
      handlePrune(data);
      break;

    default:
      console.log('[hmr] unknown message type:', data.type);
  }
}

function handleCSSUpdate(data: any) {
  const path = data.path || data.updates?.[0]?.path;
  if (!path) {
    location.reload();
    return;
  }

  // Find all stylesheet links and update the one matching the path
  const links = document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]');
  let updated = false;

  for (const link of links) {
    const href = link.getAttribute('href');
    if (href && (href.includes(path) || path.includes(href.replace(/^\//, '')))) {
      // Swap the stylesheet by creating a new link element and replacing
      const newLink = document.createElement('link');
      newLink.rel = 'stylesheet';
      newLink.href = href.split('?')[0] + '?t=' + Date.now();
      newLink.onload = () => {
        link.remove();
        console.log('[hmr] css updated:', path);
      };
      newLink.onerror = () => {
        console.error('[hmr] css update failed:', path);
        location.reload();
      };
      link.parentNode?.insertBefore(newLink, link.nextSibling);
      updated = true;
      break;
    }
  }

  if (!updated) {
    // No matching stylesheet found, do full reload
    console.log('[hmr] no matching stylesheet found for', path, '- reloading');
    location.reload();
  }
}

function handleJSUpdate(data: any) {
  const updates = data.updates || [];
  if (!updates.length) {
    console.log('[hmr] no updates in message');
    return;
  }

  // Check if any updated module declines hot updates
  for (const update of updates) {
    if (hmrDeclineHandlers.has(update.path)) {
      console.log('[hmr] module declined hot update:', update.path);
      location.reload();
      return;
    }
  }

  // Try to apply each update
  let hasError = false;
  for (const update of updates) {
    const mod = hmrModules.get(update.path);
    if (mod?.accept) {
      // Module accepts its own updates - reimport it
      try {
        // Dynamic reimport with cache busting
        const importUrl = update.path.includes('?')
          ? `${update.path}&t=${Date.now()}`
          : `${update.path}?t=${Date.now()}`;

        import(importUrl)
          .then((newModule) => {
            if (mod.accept) {
              mod.accept(() => {
                console.log('[hmr] module accepted:', update.path);
              });
            }
          })
          .catch((err) => {
            console.error('[hmr] failed to reimport module:', update.path, err);
            location.reload();
          });
      } catch (err) {
        console.error('[hmr] failed to apply update:', update.path, err);
        hasError = true;
      }
    } else {
      // Module doesn't accept its own updates - try to find a parent that does
      // If we can't find one, fall back to full reload
      console.log('[hmr] module does not accept hot update:', update.path);
      location.reload();
      return;
    }
  }

  if (hasError) {
    location.reload();
  }
}

function handleError(error?: { message?: string; stack?: string; file?: string }) {
  if (!error) return;

  clearErrorOverlay();

  const overlay = document.createElement('div');
  overlay.id = '__bunlet-error-overlay';
  overlay.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: 0',
    'width: 100%',
    'height: 100%',
    'background: rgba(0,0,0,0.85)',
    'color: #ff5555',
    'font-family: monospace',
    'font-size: 14px',
    'padding: 20px',
    'box-sizing: border-box',
    'overflow: auto',
    'z-index: 99999',
  ].join(';');

  const escape = (str?: string) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  overlay.innerHTML = `
    <div style="max-width:800px;margin:0 auto;">
      <h2 style="color:#ff5555;margin:0 0 10px 0;">Build Error</h2>
      <pre style="color:#fff;white-space:pre-wrap;word-wrap:break-word;">${escape(error.message)}</pre>
      ${error.file ? `<p style="color:#888;margin-top:10px;">File: ${escape(error.file)}</p>` : ''}
      ${error.stack ? `<pre style="color:#888;margin-top:10px;font-size:12px;">${escape(error.stack)}</pre>` : ''}
      <p style="color:#666;margin-top:20px;">Fix the error and save the file to continue.</p>
    </div>
  `;

  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}

function clearErrorOverlay() {
  const existing = document.getElementById('__bunlet-error-overlay');
  if (existing) existing.remove();
}

function handlePrune(data: any) {
  // A module was removed - just log it
  console.log('[hmr] module pruned:', data.path);
}

// Auto-initialize when loaded
setupHMRClient();