/**
 * Error Overlay
 *
 * Provides error overlay functionality for development mode.
 * The overlay is injected into the renderer to display build errors.
 */

import type { HMRError } from './hmr';

/**
 * Generate error overlay HTML
 */
export function generateErrorOverlayHTML(error: HMRError): string {
  const escapedMessage = escapeHtml(error.message);
  const escapedFile = error.file ? escapeHtml(error.file) : '';
  const escapedStack = error.stack ? escapeHtml(error.stack) : '';
  const escapedFrame = error.frame ? escapeHtml(error.frame) : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Build Error - Bunlet Dev</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #1a1a2e;
      color: #eee;
      min-height: 100vh;
      padding: 40px;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }

    .error-icon {
      width: 40px;
      height: 40px;
      background: #ff5555;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }

    h1 {
      color: #ff5555;
      font-size: 24px;
      font-weight: 600;
    }

    .error-box {
      background: #16213e;
      border: 1px solid #ff5555;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .error-message {
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
      font-size: 14px;
      line-height: 1.6;
      color: #ff8888;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .file-info {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #2a2a4a;
    }

    .file-path {
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
      font-size: 13px;
      color: #888;
    }

    .file-path a {
      color: #6bc5ff;
      text-decoration: none;
    }

    .file-path a:hover {
      text-decoration: underline;
    }

    .code-frame {
      background: #0f0f1a;
      border-radius: 6px;
      padding: 16px;
      margin-top: 16px;
      overflow-x: auto;
    }

    .code-frame pre {
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
      font-size: 13px;
      line-height: 1.5;
      color: #aaa;
    }

    .stack-trace {
      margin-top: 20px;
    }

    .stack-trace h3 {
      color: #888;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 12px;
    }

    .stack-trace pre {
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
      font-size: 12px;
      line-height: 1.5;
      color: #666;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #2a2a4a;
      color: #666;
      font-size: 13px;
    }

    .tip {
      margin-top: 12px;
      padding: 12px 16px;
      background: #1a2744;
      border-radius: 6px;
      color: #8899aa;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="error-icon">!</div>
      <h1>Build Error</h1>
    </div>

    <div class="error-box">
      <div class="error-message">${escapedMessage}</div>
      ${
        escapedFile
          ? `
      <div class="file-info">
        <span class="file-path">
          <a href="vscode://file/${escapedFile}${error.line ? `:${error.line}` : ''}${error.column ? `:${error.column}` : ''}">${escapedFile}${error.line ? `:${error.line}` : ''}${error.column ? `:${error.column}` : ''}</a>
        </span>
      </div>
      `
          : ''
      }
      ${
        escapedFrame
          ? `
      <div class="code-frame">
        <pre>${escapedFrame}</pre>
      </div>
      `
          : ''
      }
    </div>

    ${
      escapedStack
        ? `
    <div class="stack-trace">
      <h3>Stack Trace</h3>
      <pre>${escapedStack}</pre>
    </div>
    `
        : ''
    }

    <div class="footer">
      <p>Fix the error and save the file to continue development.</p>
      <div class="tip">
        <strong>Tip:</strong> Click the file path above to open in your editor.
      </div>
    </div>
  </div>

  <script>
    // Auto-reconnect and refresh when error is fixed
    const ws = new WebSocket('ws://' + location.host + '/__hmr');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'error') {
          location.reload();
        }
      } catch {}
    };
  </script>
</body>
</html>
`;
}

/**
 * Generate error overlay script to inject into pages
 */
export function generateErrorOverlayScript(): string {
  return `
(function() {
  window.__bunletShowError = function(error) {
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
      background: rgba(26, 26, 46, 0.98);
      color: #eee;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 40px;
      box-sizing: border-box;
      overflow: auto;
      z-index: 99999;
    \`;

    const fileLink = error.file
      ? \`<a href="vscode://file/\${error.file}\${error.line ? ':' + error.line : ''}\${error.column ? ':' + error.column : ''}"
           style="color: #6bc5ff; text-decoration: none;">
          \${error.file}\${error.line ? ':' + error.line : ''}\${error.column ? ':' + error.column : ''}
        </a>\`
      : '';

    overlay.innerHTML = \`
      <div style="max-width: 900px; margin: 0 auto;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
          <div style="width: 40px; height: 40px; background: #ff5555; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px;">!</div>
          <h1 style="color: #ff5555; font-size: 24px; font-weight: 600; margin: 0;">Build Error</h1>
        </div>
        <div style="background: #16213e; border: 1px solid #ff5555; border-radius: 8px; padding: 20px;">
          <pre style="font-family: monospace; font-size: 14px; color: #ff8888; white-space: pre-wrap; word-break: break-word; margin: 0;">\${escapeHtml(error.message)}</pre>
          \${fileLink ? '<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #2a2a4a; font-family: monospace; font-size: 13px;">' + fileLink + '</div>' : ''}
          \${error.frame ? '<div style="background: #0f0f1a; border-radius: 6px; padding: 16px; margin-top: 16px;"><pre style="font-family: monospace; font-size: 13px; color: #aaa; margin: 0;">' + escapeHtml(error.frame) + '</pre></div>' : ''}
        </div>
        \${error.stack ? '<div style="margin-top: 20px;"><h3 style="color: #888; font-size: 14px; margin-bottom: 12px;">Stack Trace</h3><pre style="font-family: monospace; font-size: 12px; color: #666; white-space: pre-wrap;">' + escapeHtml(error.stack) + '</pre></div>' : ''}
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #2a2a4a; color: #666; font-size: 13px;">
          <p>Fix the error and save the file to continue development.</p>
        </div>
      </div>
    \`;

    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };

    document.body.appendChild(overlay);
  };

  window.__bunletHideError = function() {
    const overlay = document.getElementById('bunlet-error-overlay');
    if (overlay) overlay.remove();
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
