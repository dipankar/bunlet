# Auto Updater

Automatically update your application.

## Overview

Bunlet's auto-updater supports multiple update sources:

- **GitHub Releases** - Public and private repositories
- **Generic HTTP Server** - Self-hosted updates
- **S3** - Amazon S3 or compatible storage

## Basic Setup

```typescript
import { autoUpdater } from 'bunlet';

// Configure update source
autoUpdater.setFeedURL({
  provider: 'github',
  github: {
    owner: 'your-org',
    repo: 'your-app',
  },
});

// Check for updates
autoUpdater.checkForUpdatesAndNotify();
```

## GitHub Provider

### Public Repository

```typescript
autoUpdater.setFeedURL({
  provider: 'github',
  github: {
    owner: 'your-org',
    repo: 'your-app',
  },
});
```

### Private Repository

```typescript
autoUpdater.setFeedURL({
  provider: 'github',
  github: {
    owner: 'your-org',
    repo: 'your-app',
    private: true,
    token: process.env.GITHUB_TOKEN,
  },
});
```

## Generic HTTP Provider

```typescript
autoUpdater.setFeedURL({
  provider: 'generic',
  generic: {
    url: 'https://updates.myapp.com',
    channel: 'stable',
  },
});
```

### Server Requirements

Your server must serve YAML manifest files:

```yaml
# latest.yml (or latest-linux.yml, latest-mac.yml, latest-win.yml)
version: 1.2.3
releaseDate: 2024-01-15T12:00:00Z
releaseNotes: "Bug fixes and improvements"
files:
  - url: MyApp-1.2.3.dmg
    sha512: abc123...
    size: 52428800
```

## S3 Provider

```typescript
autoUpdater.setFeedURL({
  provider: 's3',
  s3: {
    bucket: 'my-app-updates',
    region: 'us-east-1',
    path: 'releases',
  },
});
```

## Update Events

```typescript
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info.version);
});

autoUpdater.on('update-not-available', (info) => {
  console.log('No updates available');
});

autoUpdater.on('download-progress', (progress) => {
  console.log(`Downloaded ${progress.percent.toFixed(1)}%`);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info.version);
  // Prompt user to restart
});

autoUpdater.on('error', (error) => {
  console.error('Update error:', error);
});
```

## Manual Update Flow

```typescript
// Check for updates
const result = await autoUpdater.checkForUpdates();

if (result.isAvailable) {
  // Download the update
  await autoUpdater.downloadUpdate();

  // Install and restart
  autoUpdater.quitAndInstall();
}
```

## Configuration Options

```typescript
// Auto-download updates (default: true)
autoUpdater.autoDownload = true;

// Auto-install on quit (default: true)
autoUpdater.autoInstallOnAppQuit = true;

// Allow downgrading (default: false)
autoUpdater.allowDowngrade = false;

// Update channel
autoUpdater.channel = 'stable'; // 'stable' | 'beta' | 'alpha'
```

## User Prompts

### Update Available

```typescript
autoUpdater.on('update-available', async (info) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Available',
    message: `Version ${info.version} is available`,
    detail: info.releaseNotes || 'A new version is ready to download.',
    buttons: ['Download', 'Later'],
    defaultId: 0,
  });

  if (result.response === 0) {
    autoUpdater.downloadUpdate();
  }
});
```

### Update Downloaded

```typescript
autoUpdater.on('update-downloaded', async (info) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: 'Restart to update?',
    detail: `Version ${info.version} has been downloaded.`,
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
  });

  if (result.response === 0) {
    autoUpdater.quitAndInstall();
  }
});
```

## Progress UI

```typescript
autoUpdater.on('download-progress', (progress) => {
  // Send to renderer
  mainWindow.send('update-progress', {
    percent: progress.percent,
    transferred: progress.transferred,
    total: progress.total,
    bytesPerSecond: progress.bytesPerSecond,
  });
});
```

```javascript
// Renderer
window.__bunlet.onMessage((data) => {
  const parsed = JSON.parse(data);
  if (parsed.channel === 'update-progress') {
    const { percent } = parsed.args[0];
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent.toFixed(1)}%`;
  }
});
```

## Channels

Support different release channels:

```typescript
// Set channel based on user preference
const channel = settings.get('updateChannel') || 'stable';
autoUpdater.channel = channel;

autoUpdater.setFeedURL({
  provider: 'github',
  github: {
    owner: 'your-org',
    repo: 'your-app',
  },
  channel,
});
```

On GitHub, use prereleases for beta/alpha:
- `stable`: Regular releases
- `beta`: Prereleases tagged with `-beta`
- `alpha`: Prereleases tagged with `-alpha`

## Error Handling

```typescript
autoUpdater.on('error', (error) => {
  // Log the error
  console.error('Update error:', error);

  // Notify user if critical
  if (error.message.includes('network')) {
    // Network error - try again later
  } else {
    dialog.showErrorBox(
      'Update Error',
      'Failed to check for updates. Please try again later.'
    );
  }
});
```

## Menu Integration

```typescript
const menu = Menu.buildFromTemplate([
  {
    label: 'Help',
    submenu: [
      {
        label: 'Check for Updates...',
        click: async () => {
          const result = await autoUpdater.checkForUpdates();
          if (!result.isAvailable) {
            dialog.showMessageBox({
              message: 'You are up to date!',
              detail: `Version ${app.getVersion()} is the latest.`,
            });
          }
        },
      },
    ],
  },
]);
```

## Platform-Specific Notes

### macOS
- Supports `.dmg` and `.zip` formats
- Code signing required for Gatekeeper
- Use `autoUpdater.quitAndInstall()` after download

### Windows
- Supports `.exe` (NSIS) and `.msi` formats
- Code signing recommended
- Silent installs supported

### Linux
- Supports `.AppImage`, `.deb`, `.rpm`
- AppImage has built-in update support
- Other formats may require manual handling

## Security

1. **Sign your releases** - Code signing builds trust
2. **Use HTTPS** - Always serve updates over HTTPS
3. **Verify checksums** - SHA-512 hashes in manifests
4. **Token security** - Never expose GitHub tokens in client code

## Next Steps

- [CLI Reference](../cli/overview.md) - Build and publish commands
- [API Reference: autoUpdater](../api/auto-updater.md)
