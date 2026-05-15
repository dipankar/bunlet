# Clipboard

Read and write to the system clipboard.

## Reading Text

```typescript
import { clipboard } from '@bunlet/core';

const text = clipboard.readText();
console.log('Clipboard contains:', text);
```

## Writing Text

```typescript
import { clipboard } from '@bunlet/core';

clipboard.writeText('Hello, World!');
```

## Checking Clipboard

```typescript
if (clipboard.hasText()) {
  const text = clipboard.readText();
  processText(text);
} else {
  console.log('Clipboard is empty or contains non-text data');
}
```

## Clearing Clipboard

```typescript
clipboard.clear();
```

## Examples

### Copy to Clipboard

```typescript
import { app, z, clipboard } from '@bunlet/core';

app.handle('clipboard:copy', z.object({
  text: z.string(),
}), async ({ text }) => {
  clipboard.writeText(text);
  return true;
});
```

### Paste from Clipboard

```typescript
app.handle('clipboard:paste', z.object({}), async () => {
  if (clipboard.hasText()) {
    return clipboard.readText();
  }
  return null;
});
```

### Copy Selection

```typescript
app.handle('copy-selection', z.object({
  text: z.string(),
}), async ({ text }, { window }) => {
  clipboard.writeText(text);

  // Optional: Show notification
  new Notification({
    title: 'Copied',
    body: 'Text copied to clipboard',
  }).show();

  return true;
});
```

### Clipboard History

```typescript
const clipboardHistory: string[] = [];
const MAX_HISTORY = 10;

app.handle('clipboard:copy-with-history', z.object({
  text: z.string(),
}), async ({ text }) => {
  clipboard.writeText(text);

  // Add to history
  clipboardHistory.unshift(text);
  if (clipboardHistory.length > MAX_HISTORY) {
    clipboardHistory.pop();
  }

  return true;
});

app.handle('clipboard:get-history', z.object({}), async () => {
  return clipboardHistory;
});
```

### Format and Copy

```typescript
app.handle('copy-as-markdown', z.object({
  title: z.string(),
  url: z.string(),
}), async ({ title, url }) => {
  const markdown = `[${title}](${url})`;
  clipboard.writeText(markdown);
  return markdown;
});

app.handle('copy-as-html', z.object({
  title: z.string(),
  url: z.string(),
}), async ({ title, url }) => {
  const html = `<a href="${url}">${title}</a>`;
  clipboard.writeText(html);
  return html;
});
```

## API Reference

| Method | Description |
|--------|-------------|
| `readText()` | Read text from clipboard |
| `writeText(text)` | Write text to clipboard |
| `hasText()` | Check if clipboard has text |
| `clear()` | Clear clipboard contents |

## Next Steps

- [Shell](shell.md) - System shell operations
- [API Reference: clipboard](../api/clipboard.md)
