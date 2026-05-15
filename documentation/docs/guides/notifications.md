# Notifications

Display native desktop notifications.

## Basic Notification

```typescript
import { Notification } from '@bunlet/core';

const notification = new Notification({
  title: 'Hello',
  body: 'This is a notification!',
});

notification.show();
```

## Notification Options

```typescript
const notification = new Notification({
  title: 'Download Complete',       // Required
  body: 'Your file has been downloaded.',
  subtitle: 'Downloads',            // macOS only
  icon: '/path/to/icon.png',
  silent: false,                    // Suppress sound
  urgency: 'normal',                // Linux: 'low' | 'normal' | 'critical'
  timeoutType: 'default',           // 'default' | 'never'
});
```

## Notification Events

```typescript
const notification = new Notification({
  title: 'New Message',
  body: 'You have a new message',
});

notification.on('show', () => {
  console.log('Notification shown');
});

notification.on('click', () => {
  console.log('Notification clicked');
  // Focus your app window
  mainWindow.show();
  mainWindow.focus();
});

notification.on('close', () => {
  console.log('Notification closed');
});

notification.show();
```

## Actions (Buttons)

Add action buttons to notifications:

```typescript
const notification = new Notification({
  title: 'Incoming Call',
  body: 'John Doe is calling',
  actions: [
    { type: 'button', text: 'Answer' },
    { type: 'button', text: 'Decline' },
  ],
});

notification.on('action', (event, index) => {
  if (index === 0) {
    answerCall();
  } else {
    declineCall();
  }
});

notification.show();
```

## Reply (macOS)

Enable inline replies on macOS:

```typescript
const notification = new Notification({
  title: 'New Message',
  body: 'Hey, what\'s up?',
  hasReply: true,
  replyPlaceholder: 'Type your reply...',
});

notification.on('reply', (event, reply) => {
  console.log('User replied:', reply);
  sendMessage(reply);
});

notification.show();
```

## Check Support

```typescript
if (Notification.isSupported()) {
  new Notification({ title: 'Hello' }).show();
} else {
  console.log('Notifications not supported');
}
```

## Close Notification

```typescript
const notification = new Notification({
  title: 'Processing',
  body: 'Please wait...',
  timeoutType: 'never',  // Keep visible
});

notification.show();

// Later, close it programmatically
notification.close();
```

## Urgency Levels (Linux)

```typescript
// Low priority - may not be shown immediately
new Notification({
  title: 'Tip',
  body: 'Did you know...',
  urgency: 'low',
}).show();

// Normal priority (default)
new Notification({
  title: 'Update',
  body: 'New version available',
  urgency: 'normal',
}).show();

// Critical - requires immediate attention
new Notification({
  title: 'Warning',
  body: 'Disk space is low!',
  urgency: 'critical',
}).show();
```

## Examples

### Download Complete

```typescript
function notifyDownloadComplete(filename: string, filepath: string) {
  const notification = new Notification({
    title: 'Download Complete',
    body: filename,
    icon: '/path/to/download-icon.png',
  });

  notification.on('click', () => {
    shell.showItemInFolder(filepath);
  });

  notification.show();
}
```

### Error Notification

```typescript
function notifyError(error: string) {
  new Notification({
    title: 'Error',
    body: error,
    urgency: 'critical',
  }).show();
}
```

### Progress Notification

```typescript
function notifyProgress(title: string, progress: number) {
  // Note: Progress bars in notifications are system-dependent
  new Notification({
    title,
    body: `Progress: ${Math.round(progress * 100)}%`,
  }).show();
}
```

### Reminder

```typescript
function setReminder(message: string, delayMs: number) {
  setTimeout(() => {
    const notification = new Notification({
      title: 'Reminder',
      body: message,
      urgency: 'normal',
    });

    notification.on('click', () => {
      mainWindow.show();
    });

    notification.show();
  }, delayMs);
}
```

## IPC Integration

Trigger notifications from the renderer:

```typescript
// Main process
app.handle('notify', z.object({
  title: z.string(),
  body: z.string().optional(),
}), async ({ title, body }) => {
  const notification = new Notification({ title, body });
  notification.show();
  return true;
});
```

```javascript
// Renderer
await invoke('notify', {
  title: 'Task Complete',
  body: 'Your export is ready',
});
```

## Best Practices

1. **Don't spam** - Only show important notifications
2. **Be concise** - Keep titles and body text short
3. **Use appropriate urgency** - Reserve 'critical' for truly important alerts
4. **Handle clicks** - Make notifications actionable
5. **Respect user preferences** - Consider adding notification settings

## Platform Differences

| Feature | Windows | macOS | Linux |
|---------|---------|-------|-------|
| Basic notifications | Yes | Yes | Yes |
| Icons | Yes | Yes | Yes |
| Actions | Limited | Yes | Yes |
| Reply | No | Yes | No |
| Urgency | No | No | Yes |
| Subtitle | No | Yes | No |

## Next Steps

- [System Tray](tray.md) - Tray icons and menus
- [API Reference: Notification](../api/notification.md)
