# clipboard

Read and write to the system clipboard.

```typescript
import { clipboard } from 'bunlet';
```

## Methods

### `readText(type?)`

Read text from the clipboard.

```typescript
const text = clipboard.readText();
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | `'selection' \| 'clipboard'` | Clipboard type (Linux only) |

**Returns:** `string`

---

### `writeText(text, type?)`

Write text to the clipboard.

```typescript
clipboard.writeText('Hello, World!');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | Text to write |
| `type` | `'selection' \| 'clipboard'` | Clipboard type (Linux only) |

---

### `readHTML(type?)`

Read HTML from the clipboard.

```typescript
const html = clipboard.readHTML();
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | `'selection' \| 'clipboard'` | Clipboard type (Linux only) |

**Returns:** `string`

---

### `writeHTML(markup, type?)`

Write HTML to the clipboard.

```typescript
clipboard.writeHTML('<b>Bold</b>');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `markup` | `string` | HTML to write |
| `type` | `'selection' \| 'clipboard'` | Clipboard type (Linux only) |

---

### `readImage(type?)`

Read image from the clipboard.

```typescript
const image = clipboard.readImage();
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | `'selection' \| 'clipboard'` | Clipboard type (Linux only) |

**Returns:** `NativeImage`

---

### `writeImage(image, type?)`

Write image to the clipboard.

```typescript
clipboard.writeImage(nativeImage);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `image` | `NativeImage` | Image to write |
| `type` | `'selection' \| 'clipboard'` | Clipboard type (Linux only) |

---

### `clear(type?)`

Clear the clipboard.

```typescript
clipboard.clear();
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | `'selection' \| 'clipboard'` | Clipboard type (Linux only) |

---

### `has(format, type?)`

Check if clipboard contains a format.

```typescript
if (clipboard.has('text/plain')) {
  console.log('Has text');
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | `string` | Format to check |
| `type` | `'selection' \| 'clipboard'` | Clipboard type (Linux only) |

**Returns:** `boolean`

---

### `availableFormats(type?)`

Get available clipboard formats.

```typescript
const formats = clipboard.availableFormats();
// ['text/plain', 'text/html']
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | `'selection' \| 'clipboard'` | Clipboard type (Linux only) |

**Returns:** `string[]`

## Examples

### Copy and Paste Text

```typescript
// Copy
clipboard.writeText('Hello from Bunlet!');

// Paste
const text = clipboard.readText();
console.log(text);
```

### Copy Rich Text

```typescript
clipboard.writeHTML(`
  <h1>Title</h1>
  <p>This is <strong>formatted</strong> text.</p>
`);
```

### Check Clipboard Contents

```typescript
const formats = clipboard.availableFormats();

if (formats.includes('text/plain')) {
  const text = clipboard.readText();
  console.log('Text:', text);
}

if (formats.includes('text/html')) {
  const html = clipboard.readHTML();
  console.log('HTML:', html);
}
```
