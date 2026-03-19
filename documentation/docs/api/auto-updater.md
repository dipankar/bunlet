# autoUpdater

Enable automatic application updates.

```typescript
import { autoUpdater } from 'bunlet';
```

## Methods

### `setFeedURL(options)`

Set the update server URL.

```typescript
autoUpdater.setFeedURL({
  url: 'https://update.example.com/releases',
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `options` | `FeedURLOptions` | Feed configuration |

#### FeedURLOptions

```typescript
interface FeedURLOptions {
  url: string;
  headers?: Record<string, string>;
  serverType?: 'json' | 'default';
}
```

---

### `getFeedURL()`

Get the current feed URL.

```typescript
const url = autoUpdater.getFeedURL();
```

**Returns:** `string`

---

### `checkForUpdates()`

Check for available updates.

```typescript
autoUpdater.checkForUpdates();
```

---

### `quitAndInstall()`

Quit the app and install the update.

```typescript
autoUpdater.quitAndInstall();
```

## Events

### `checking-for-update`

Emitted when checking for updates.

```typescript
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for updates...');
});
```

---

### `update-available`

Emitted when an update is available.

```typescript
autoUpdater.on('update-available', () => {
  console.log('Update available!');
});
```

---

### `update-not-available`

Emitted when no update is available.

```typescript
autoUpdater.on('update-not-available', () => {
  console.log('App is up to date');
});
```

---

### `update-downloaded`

Emitted when update has been downloaded.

```typescript
autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
  const response = dialog.showMessageBoxSync({
    type: 'info',
    buttons: ['Restart', 'Later'],
    title: 'Update Ready',
    message: `Version ${releaseName} is ready to install.`,
    detail: releaseNotes,
  });

  if (response === 0) {
    autoUpdater.quitAndInstall();
  }
});
```

---

### `error`

Emitted when an error occurs.

```typescript
autoUpdater.on('error', (error) => {
  console.error('Update error:', error);
});
```

---

### `before-quit-for-update`

Emitted before quitting to install.

```typescript
autoUpdater.on('before-quit-for-update', () => {
  // Save any state before restart
});
```

## Example

```typescript
import { app, autoUpdater, dialog, Notification } from 'bunlet';

const UPDATE_SERVER = 'https://releases.example.com';

function setupAutoUpdater() {
  // Configure update feed
  autoUpdater.setFeedURL({
    url: `${UPDATE_SERVER}/${process.platform}/${app.getVersion()}`,
  });

  // Check for updates on startup
  autoUpdater.checkForUpdates();

  // Check periodically (every 4 hours)
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 4 * 60 * 60 * 1000);

  // Event handlers
  autoUpdater.on('update-available', () => {
    new Notification({
      title: 'Update Available',
      body: 'A new version is being downloaded.',
    }).show();
  });

  autoUpdater.on('update-downloaded', (event, notes, name) => {
    const notification = new Notification({
      title: 'Update Ready',
      body: `Version ${name} is ready to install.`,
      actions: [{ type: 'button', text: 'Install Now' }],
    });

    notification.on('action', () => {
      autoUpdater.quitAndInstall();
    });

    notification.show();
  });

  autoUpdater.on('error', (error) => {
    console.error('Auto-update error:', error.message);
  });
}

app.whenReady().then(() => {
  // Only enable auto-updates in production
  if (!app.isPackaged) return;

  setupAutoUpdater();
});
```

## Server Response Format

The update server should return JSON:

```json
{
  "url": "https://releases.example.com/app-1.2.0.zip",
  "name": "1.2.0",
  "notes": "Bug fixes and performance improvements",
  "pub_date": "2024-01-15T12:00:00Z"
}
```

Return HTTP 204 when no update is available.

## Notes

- Auto-updates only work in packaged applications
- Code signing is required on macOS
- Use `app.isPackaged` to check if running in production
- Consider providing manual download fallback for update failures
