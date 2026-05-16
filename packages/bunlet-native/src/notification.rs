//! Notification API for Bunlet
//!
//! Provides cross-platform desktop notifications using the `notify-rust` crate.

use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use notify_rust::Notification as NativeNotification;
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};

/// Notification counter for unique IDs
static NOTIFICATION_COUNTER: AtomicU32 = AtomicU32::new(1);

/// Active notification handles
static NOTIFICATIONS: Lazy<Mutex<HashMap<u32, NotificationHandle>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Event callback
static NOTIFICATION_CALLBACK: Lazy<
    Mutex<Option<ThreadsafeFunction<NotificationEvent, ErrorStrategy::Fatal>>>,
> = Lazy::new(|| Mutex::new(None));

/// Notification handle (platform-specific)
#[cfg(any(target_os = "macos", target_os = "linux"))]
struct NotificationHandle {
    #[allow(dead_code)]
    handle: Option<notify_rust::NotificationHandle>,
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
struct NotificationHandle;

/// Notification event types
#[napi(object)]
pub struct NotificationEvent {
    pub notification_id: u32,
    /// Event type: 'show', 'click', 'close', 'action'
    pub event_type: String,
    /// Action index (for 'action' events)
    pub action_index: Option<i32>,
}

/// Notification action button
#[napi(object)]
#[derive(Clone, Default)]
pub struct NotificationAction {
    /// Action type: currently only 'button' is supported
    pub action_type: String,
    /// Button label text
    pub text: String,
}

/// Notification options
#[napi(object)]
#[derive(Clone, Default)]
pub struct NotificationOptions {
    pub title: String,
    pub body: Option<String>,
    pub subtitle: Option<String>,
    pub icon: Option<String>,
    pub silent: Option<bool>,
    /// 'low' | 'normal' | 'critical' (Linux only)
    pub urgency: Option<String>,
    /// 'default' | 'never'
    pub timeout_type: Option<String>,
    /// Action buttons (Linux only currently)
    pub actions: Option<Vec<NotificationAction>>,
}

/// Check if notifications are supported on this platform
#[napi]
pub fn notification_is_supported() -> bool {
    #[cfg(target_os = "linux")]
    {
        // Check if a notification daemon is available via D-Bus
        std::process::Command::new("dbus-send")
            .args([
                "--session",
                "--dest=org.freedesktop.Notifications",
                "--type=method_call",
                "/org/freedesktop/Notifications",
                "org.freedesktop.Notifications.GetServerInfo",
            ])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    #[cfg(target_os = "macos")]
    {
        // macOS always supports notifications via Notification Center
        true
    }

    #[cfg(target_os = "windows")]
    {
        // Windows supports notifications via Windows Runtime
        true
    }
}

/// Set the notification event callback
#[napi]
pub fn set_notification_callback(
    callback: ThreadsafeFunction<NotificationEvent, ErrorStrategy::Fatal>,
) {
    let mut cb = NOTIFICATION_CALLBACK.lock();
    *cb = Some(callback);
}

/// Show a notification
#[napi]
pub fn show_notification(options: NotificationOptions) -> u32 {
    let id = NOTIFICATION_COUNTER.fetch_add(1, Ordering::SeqCst);

    let mut notification = NativeNotification::new();
    notification.summary(&options.title);

    if let Some(body) = &options.body {
        notification.body(body);
    }

    if let Some(subtitle) = &options.subtitle {
        notification.subtitle(subtitle);
    }

    if let Some(icon) = &options.icon {
        notification.icon(icon);
    }

    // Set urgency on Linux
    #[cfg(target_os = "linux")]
    {
        use notify_rust::Urgency;
        if let Some(urgency) = &options.urgency {
            let u = match urgency.as_str() {
                "low" => Urgency::Low,
                "critical" => Urgency::Critical,
                _ => Urgency::Normal,
            };
            notification.urgency(u);
        }
    }

    // Set timeout
    if let Some(timeout_type) = &options.timeout_type {
        use notify_rust::Timeout;
        let timeout = match timeout_type.as_str() {
            "never" => Timeout::Never,
            _ => Timeout::Default,
        };
        notification.timeout(timeout);
    }

    // Add action buttons (Linux only - uses D-Bus actions)
    #[cfg(target_os = "linux")]
    if let Some(actions) = &options.actions {
        for (index, action) in actions.iter().enumerate() {
            // notify-rust uses (action_id, label) pairs
            // We use the index as the action ID for callback purposes
            notification.action(&format!("action_{}", index), &action.text);
        }
    }

    // Show notification
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    let handle = notification.show().ok();

    // Emit 'show' event
    if let Some(callback) = NOTIFICATION_CALLBACK.lock().as_ref() {
        callback.call(
            NotificationEvent {
                notification_id: id,
                event_type: "show".to_string(),
                action_index: None,
            },
            ThreadsafeFunctionCallMode::NonBlocking,
        );
    }

    // Store handle
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    let notification_handle = NotificationHandle { handle };
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    let notification_handle = NotificationHandle;
    NOTIFICATIONS.lock().insert(id, notification_handle);

    id
}

/// Close a notification
#[napi]
pub fn close_notification(notification_id: u32) -> bool {
    let mut notifications = NOTIFICATIONS.lock();

    if notifications.remove(&notification_id).is_some() {
        // Emit 'close' event
        if let Some(callback) = NOTIFICATION_CALLBACK.lock().as_ref() {
            callback.call(
                NotificationEvent {
                    notification_id,
                    event_type: "close".to_string(),
                    action_index: None,
                },
                ThreadsafeFunctionCallMode::NonBlocking,
            );
        }
        true
    } else {
        false
    }
}
