# Notification

Display desktop notifications.

```typescript
import { Notification } from 'bunlet';
```

## Constructor

```typescript
new Notification(options: NotificationOptions)
```

### NotificationOptions

```typescript
interface NotificationOptions {
  title: string;
  body?: string;
  subtitle?: string;        // macOS only
  icon?: string;
  silent?: boolean;
  urgency?: 'low' | 'normal' | 'critical';  // Linux only
  timeoutType?: 'default' | 'never';
  actions?: NotificationAction[];
  closeButtonText?: string;
  hasReply?: boolean;       // macOS only
  replyPlaceholder?: string; // macOS only
}
```

### NotificationAction

```typescript
interface NotificationAction {
  type: 'button';
  text: string;
}
```

## Static Methods

### `isSupported()`

Check if notifications are supported.

```typescript
if (Notification.isSupported()) {
  // Notifications are available
}
```

**Returns:** `boolean`

## Instance Methods

### `show()`

Show the notification.

```typescript
notification.show();
```

---

### `close()`

Close the notification.

```typescript
notification.close();
```

## Instance Properties

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Notification title |
| `body` | `string \| undefined` | Notification body |
| `subtitle` | `string \| undefined` | Subtitle (macOS) |
| `icon` | `string \| undefined` | Icon path |
| `silent` | `boolean` | Suppress sound |
| `urgency` | `string \| undefined` | Urgency level |
| `timeoutType` | `string \| undefined` | Timeout behavior |

## Events

### `show`

Emitted when notification is displayed.

```typescript
notification.on('show', () => {
  console.log('Notification shown');
});
```

---

### `click`

Emitted when notification is clicked.

```typescript
notification.on('click', () => {
  mainWindow.show();
});
```

---

### `close`

Emitted when notification is closed.

```typescript
notification.on('close', () => {
  console.log('Notification closed');
});
```

---

### `action`

Emitted when an action button is clicked.

```typescript
notification.on('action', (event, index) => {
  console.log('Action clicked:', index);
});
```

---

### `reply`

Emitted when user replies (macOS only).

```typescript
notification.on('reply', (event, reply) => {
  console.log('User replied:', reply);
});
```

## Example

```typescript
const notification = new Notification({
  title: 'Download Complete',
  body: 'Your file has been downloaded.',
  icon: '/path/to/icon.png',
});

notification.on('click', () => {
  shell.showItemInFolder(downloadPath);
});

notification.show();
```
