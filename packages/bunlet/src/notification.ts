/**
 * Notification API for Bunlet
 *
 * Provides cross-platform desktop notifications.
 */

import { EventEmitter } from 'events';
import native from './native/bindings';

/** Whether the callback has been set up */
let callbackInitialized = false;

/** Map of notification ID to Notification instance */
const notifications = new Map<number, Notification>();

/**
 * Notification action button
 */
export interface NotificationAction {
  /** Action type */
  type: 'button';
  /** Button text */
  text: string;
}

/**
 * Options for creating a notification
 */
export interface NotificationOptions {
  /** Notification title */
  title: string;
  /** Notification body text */
  body?: string;
  /** Subtitle (macOS only) */
  subtitle?: string;
  /** Path to notification icon */
  icon?: string;
  /** Whether to suppress notification sound */
  silent?: boolean;
  /** Urgency level (Linux only): 'low' | 'normal' | 'critical' */
  urgency?: 'low' | 'normal' | 'critical';
  /** Timeout behavior: 'default' | 'never' */
  timeoutType?: 'default' | 'never';
  /** Action buttons */
  actions?: NotificationAction[];
  /** Close button text */
  closeButtonText?: string;
  /** Enable reply (macOS only) */
  hasReply?: boolean;
  /** Reply placeholder text (macOS only) */
  replyPlaceholder?: string;
}

/**
 * Initialize the notification callback if not already done
 */
function ensureCallbackInitialized(): void {
  if (callbackInitialized) return;
  callbackInitialized = true;

  native.setNotificationCallback((event: { notificationId: number; eventType: string; actionIndex?: number }) => {
    const notification = notifications.get(event.notificationId);
    if (!notification) return;

    switch (event.eventType) {
      case 'show':
        notification.emit('show');
        break;
      case 'click':
        notification.emit('click');
        break;
      case 'close':
        notification.emit('close');
        notifications.delete(event.notificationId);
        break;
      case 'action':
        if (event.actionIndex !== undefined) {
          notification.emit('action', { type: 'action' }, event.actionIndex);
        }
        break;
    }
  });
}

/**
 * Desktop notification class
 */
export class Notification extends EventEmitter {
  private id: number | null = null;
  private options: NotificationOptions;
  private shown = false;
  private closed = false;

  /**
   * Check if notifications are supported on this platform
   */
  static isSupported(): boolean {
    return native.notificationIsSupported();
  }

  /**
   * Create a new notification
   * @param options - Notification options
   */
  constructor(options: NotificationOptions) {
    super();
    this.options = options;
    ensureCallbackInitialized();
  }

  /**
   * Get the notification title
   */
  get title(): string {
    return this.options.title;
  }

  /**
   * Get the notification body
   */
  get body(): string | undefined {
    return this.options.body;
  }

  /**
   * Get the notification subtitle
   */
  get subtitle(): string | undefined {
    return this.options.subtitle;
  }

  /**
   * Get the notification icon
   */
  get icon(): string | undefined {
    return this.options.icon;
  }

  /**
   * Get whether the notification is silent
   */
  get silent(): boolean {
    return this.options.silent ?? false;
  }

  /**
   * Get the urgency level
   */
  get urgency(): 'low' | 'normal' | 'critical' | undefined {
    return this.options.urgency;
  }

  /**
   * Get the timeout type
   */
  get timeoutType(): 'default' | 'never' | undefined {
    return this.options.timeoutType;
  }

  /**
   * Show the notification
   */
  show(): void {
    if (this.shown || this.closed) return;

    // Convert actions to native format
    const actions = this.options.actions?.map((action) => ({
      actionType: action.type,
      text: action.text,
    }));

    this.id = native.showNotification({
      title: this.options.title,
      body: this.options.body,
      subtitle: this.options.subtitle,
      icon: this.options.icon,
      silent: this.options.silent,
      urgency: this.options.urgency,
      timeoutType: this.options.timeoutType,
      actions,
    });

    this.shown = true;
    notifications.set(this.id, this);
  }

  /**
   * Close the notification
   */
  close(): void {
    if (!this.shown || this.closed || this.id === null) return;

    native.closeNotification(this.id);
    this.closed = true;
    notifications.delete(this.id);
  }

  // Event emitter type overloads
  on(event: 'show', listener: () => void): this;
  on(event: 'click', listener: () => void): this;
  on(event: 'close', listener: () => void): this;
  on(event: 'reply', listener: (event: unknown, reply: string) => void): this;
  on(event: 'action', listener: (event: unknown, index: number) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
}
