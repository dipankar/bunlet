/**
 * PDF Export functionality
 *
 * Note: Full PDF generation requires Puppeteer or similar.
 * This implementation exports to HTML that can be printed as PDF.
 */

import * as fs from 'fs';
import * as path from 'path';
import { dialog, Notification, shell } from 'bunlet';
import type { BrowserWindow } from 'bunlet';
import type { Note } from '../shared/types';

/**
 * Export note as HTML (can be printed to PDF)
 */
export async function exportNoteAsHtml(
  note: Note,
  parentWindow: BrowserWindow
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const result = await dialog.showSaveDialog(parentWindow, {
      title: 'Export Note as HTML',
      defaultPath: `${sanitizeFilename(note.title)}.html`,
      filters: [{ name: 'HTML Files', extensions: ['html'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Export cancelled' };
    }

    const html = generateHtml(note);
    fs.writeFileSync(result.filePath, html);

    const notification = new Notification({
      title: 'Export Complete',
      body: `Note exported to ${path.basename(result.filePath)}`,
    });
    notification.show();

    return { success: true, path: result.filePath };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}

/**
 * Export note as Markdown
 */
export async function exportNoteAsMarkdown(
  note: Note,
  parentWindow: BrowserWindow
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const result = await dialog.showSaveDialog(parentWindow, {
      title: 'Export Note as Markdown',
      defaultPath: `${sanitizeFilename(note.title)}.md`,
      filters: [{ name: 'Markdown Files', extensions: ['md'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Export cancelled' };
    }

    const markdown = `# ${note.title}\n\n${note.content}`;
    fs.writeFileSync(result.filePath, markdown);

    const notification = new Notification({
      title: 'Export Complete',
      body: `Note exported to ${path.basename(result.filePath)}`,
    });
    notification.show();

    return { success: true, path: result.filePath };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}

/**
 * Open exported file in default app
 */
export async function openExportedFile(filePath: string): Promise<void> {
  await shell.openPath(filePath);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function generateHtml(note: Note): string {
  // Simple markdown to HTML conversion
  let content = escapeHtml(note.content);

  // Convert markdown headers
  content = content.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  content = content.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  content = content.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Convert bold and italic
  content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  content = content.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Convert inline code
  content = content.replace(/`(.+?)`/g, '<code>$1</code>');

  // Convert code blocks
  content = content.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

  // Convert line breaks to paragraphs
  content = content
    .split('\n\n')
    .map((p) => (p.startsWith('<h') || p.startsWith('<pre') ? p : `<p>${p}</p>`))
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(note.title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; border-bottom: 2px solid #eee; padding-bottom: 0.5rem; }
    h2 { font-size: 1.5rem; margin-top: 1.5rem; }
    h3 { font-size: 1.25rem; margin-top: 1rem; }
    p { margin: 1rem 0; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 2rem; }
    code { background: #f5f5f5; padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    @media print {
      body { max-width: none; padding: 0; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(note.title)}</h1>
  <p class="meta">Created: ${new Date(note.createdAt).toLocaleDateString()} | Updated: ${new Date(note.updatedAt).toLocaleDateString()}</p>
  ${content}
</body>
</html>`;
}
