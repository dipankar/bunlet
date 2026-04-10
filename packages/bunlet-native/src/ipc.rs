use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction};
use napi_derive::napi;
use once_cell::sync::Lazy;
use parking_lot::Mutex;

use crate::{WindowBounds, WINDOWS};

pub static IPC_CALLBACK: Lazy<Mutex<Option<ThreadsafeFunction<IpcMessage, ErrorStrategy::Fatal>>>> =
    Lazy::new(|| Mutex::new(None));
pub static APP_EVENT_CALLBACK: Lazy<Mutex<Option<ThreadsafeFunction<AppEvent, ErrorStrategy::Fatal>>>> =
    Lazy::new(|| Mutex::new(None));
pub static PENDING_IPC: Lazy<Mutex<Vec<IpcMessage>>> = Lazy::new(|| Mutex::new(Vec::new()));

/// IPC message from WebView
#[napi(object)]
pub struct IpcMessage {
    pub window_id: u32,
    pub message: String,
}

/// App-level event from native runtime
#[napi(object)]
pub struct AppEvent {
    pub event: String,
    pub window_id: Option<u32>,
    pub title: Option<String>,
    pub url: Option<String>,
    pub bounds: Option<WindowBounds>,
}

/// Set IPC handler callback
#[napi]
pub fn set_ipc_handler(callback: ThreadsafeFunction<IpcMessage, ErrorStrategy::Fatal>) {
    let mut handler = IPC_CALLBACK.lock();
    *handler = Some(callback);
}

/// Set app event handler callback
#[napi]
pub fn set_app_event_handler(callback: ThreadsafeFunction<AppEvent, ErrorStrategy::Fatal>) {
    let mut handler = APP_EVENT_CALLBACK.lock();
    *handler = Some(callback);
}

/// Dispatch IPC message - queue it and trigger processing via GTK timeout
pub fn dispatch_ipc(window_id: u32, message: String) {
    let msg = IpcMessage { window_id, message };
    PENDING_IPC.lock().push(msg);

    #[cfg(target_os = "linux")]
    gtk::glib::idle_add_local_once(|| {
        process_pending_ipc();
    });

    #[cfg(not(target_os = "linux"))]
    process_pending_ipc();
}

/// Poll and process pending IPC messages - called from JS (fallback)
#[napi]
pub fn poll_ipc_messages() -> Vec<IpcMessage> {
    PENDING_IPC.lock().drain(..).collect()
}

/// Dispatch app event to callback
pub fn dispatch_app_event(event: &str) {
    dispatch_app_event_payload(AppEvent {
        event: event.to_string(),
        window_id: None,
        title: None,
        url: None,
        bounds: None,
    });
}

pub fn dispatch_window_event(event: &str, window_id: u32) {
    dispatch_app_event_payload(AppEvent {
        event: event.to_string(),
        window_id: Some(window_id),
        title: None,
        url: None,
        bounds: None,
    });
}

pub fn dispatch_window_title_event(event: &str, window_id: u32, title: &str) {
    dispatch_app_event_payload(AppEvent {
        event: event.to_string(),
        window_id: Some(window_id),
        title: Some(title.to_string()),
        url: None,
        bounds: None,
    });
}

pub fn dispatch_navigation_event(event: &str, window_id: u32, url: Option<&str>) {
    dispatch_app_event_payload(AppEvent {
        event: event.to_string(),
        window_id: Some(window_id),
        title: None,
        url: url.map(ToOwned::to_owned),
        bounds: None,
    });
}

pub fn dispatch_window_bounds_event(event: &str, window_id: u32, bounds: WindowBounds) {
    dispatch_app_event_payload(AppEvent {
        event: event.to_string(),
        window_id: Some(window_id),
        title: None,
        url: None,
        bounds: Some(bounds),
    });
}

fn dispatch_app_event_payload(event: AppEvent) {
    if let Some(callback) = APP_EVENT_CALLBACK.lock().as_ref() {
        callback.call(
            event,
            napi::threadsafe_function::ThreadsafeFunctionCallMode::NonBlocking,
        );
    }
}

/// Send IPC message to a window
#[napi]
pub fn send_ipc_message(window_id: u32, message: String) -> Result<()> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    let script = format!(
        r#"
        if (window.__bunlet_ipc_handler) {{
            window.__bunlet_ipc_handler({});
        }}
        "#,
        serde_json::to_string(&message).unwrap_or_else(|_| "null".to_string())
    );

    state
        .webview
        .evaluate_script(&script)
        .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;

    Ok(())
}

fn process_pending_ipc() {
    let messages: Vec<IpcMessage> = PENDING_IPC.lock().drain(..).collect();

    if messages.is_empty() {
        return;
    }

    std::thread::spawn(move || {
        if let Some(callback) = IPC_CALLBACK.lock().as_ref() {
            for msg in messages {
                callback.call(msg, napi::threadsafe_function::ThreadsafeFunctionCallMode::NonBlocking);
            }
        }
    });
}
