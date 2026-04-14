//! CEF (Chromium Embedded Framework) backend for Bunlet
//!
//! This module provides a full Chromium-based webview as an alternative
//! to the system webview backend. It offers full web compatibility
//! including DevTools, executeJavaScript, proper navigation, and
//! multi-process architecture.

#![deny(clippy::all)]

mod app_handler;
mod browser;
mod ipc;
mod state;

use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction};
use napi_derive::napi;

pub use app_handler::*;
pub use browser::*;
pub use state::*;

// ============================================================================
// Application lifecycle
// ============================================================================

#[napi]
pub fn init_app() -> Result<()> {
    Ok(())
}

#[napi]
pub fn quit_app() {
    let state = CEF_STATE.lock();
    if state.initialized {
        drop(state);
        cef::quit_message_loop();
    } else {
        std::process::exit(0);
    }
}

#[napi]
pub fn get_path(name: String) -> Option<String> {
    use dirs_next as dirs;

    match name.as_str() {
        "home" => dirs::home_dir().map(|p| p.to_string_lossy().to_string()),
        "appData" | "config" => dirs::config_dir().map(|p| p.to_string_lossy().to_string()),
        "temp" => Some(std::env::temp_dir().to_string_lossy().to_string()),
        "desktop" => dirs::desktop_dir().map(|p| p.to_string_lossy().to_string()),
        "documents" => dirs::document_dir().map(|p| p.to_string_lossy().to_string()),
        "downloads" => dirs::download_dir().map(|p| p.to_string_lossy().to_string()),
        "music" => dirs::audio_dir().map(|p| p.to_string_lossy().to_string()),
        "pictures" => dirs::picture_dir().map(|p| p.to_string_lossy().to_string()),
        "videos" => dirs::video_dir().map(|p| p.to_string_lossy().to_string()),
        "cache" => dirs::cache_dir().map(|p| p.to_string_lossy().to_string()),
        "data" => dirs::data_dir().map(|p| p.to_string_lossy().to_string()),
        "dataLocal" => dirs::data_local_dir().map(|p| p.to_string_lossy().to_string()),
        "exe" => std::env::current_exe()
            .ok()
            .map(|p| p.to_string_lossy().to_string()),
        "runtime" => dirs::runtime_dir().map(|p| p.to_string_lossy().to_string()),
        _ => None,
    }
}

// ============================================================================
// Window management
// ============================================================================

#[napi(object)]
#[derive(Default, Clone)]
pub struct WindowOptions {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub title: Option<String>,
    pub resizable: Option<bool>,
    pub decorations: Option<bool>,
    pub transparent: Option<bool>,
    pub visible: Option<bool>,
    pub always_on_top: Option<bool>,
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub min_width: Option<u32>,
    pub min_height: Option<u32>,
    pub max_width: Option<u32>,
    pub max_height: Option<u32>,
    pub preload_script: Option<String>,
    pub open_devtools: Option<bool>,
    pub parent_id: Option<u32>,
    pub modal: Option<bool>,
}

#[napi(object)]
pub struct WindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[napi(object)]
pub struct IpcMessage {
    pub window_id: u32,
    pub message: String,
}

#[napi(object)]
pub struct AppEvent {
    pub event: String,
    pub window_id: Option<u32>,
    pub title: Option<String>,
    pub url: Option<String>,
    pub bounds: Option<WindowBounds>,
}

#[napi]
pub fn create_window(options: Option<WindowOptions>) -> u32 {
    let opts = options.unwrap_or_default();
    let id = state::next_window_id();
    PENDING_WINDOWS.lock().push(state::PendingWindow {
        id,
        options: opts,
        url: None,
        html: None,
    });
    id
}

#[napi]
pub fn load_url(window_id: u32, url: String) -> Result<()> {
    let state = CEF_STATE.lock();
    if let Some(browser_id) = state.window_to_browser.get(&window_id) {
        let browser_id = *browser_id;
        drop(state);
        browser::cef_load_url(browser_id, &url)
    } else {
        drop(state);
        let mut pending = PENDING_WINDOWS.lock();
        for pw in pending.iter_mut() {
            if pw.id == window_id {
                pw.url = Some(url);
                pw.html = None;
                return Ok(());
            }
        }
        Err(Error::new(
            Status::InvalidArg,
            format!("Window {} not found", window_id),
        ))
    }
}

#[napi]
pub fn load_file(window_id: u32, file_path: String) -> Result<()> {
    let absolute = std::path::PathBuf::from(&file_path);
    let resolved = if absolute.is_absolute() {
        absolute
    } else {
        std::env::current_dir()
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?
            .join(absolute)
    };
    let url = format!("file://{}", resolved.to_string_lossy());
    load_url(window_id, url)
}

#[napi]
pub fn load_html(window_id: u32, html: String) -> Result<()> {
    let state = CEF_STATE.lock();
    if let Some(_browser_id) = state.window_to_browser.get(&window_id) {
        drop(state);
        let encoded = urlencoding::encode(&html);
        let url = format!("data:text/html,{}", encoded);
        load_url(window_id, url)
    } else {
        drop(state);
        let mut pending = PENDING_WINDOWS.lock();
        for pw in pending.iter_mut() {
            if pw.id == window_id {
                pw.url = None;
                pw.html = Some(html);
                return Ok(());
            }
        }
        Err(Error::new(
            Status::InvalidArg,
            format!("Window {} not found", window_id),
        ))
    }
}

#[napi]
pub fn show_window(window_id: u32) -> Result<()> {
    browser::cef_show_window(window_id)
}

#[napi]
pub fn hide_window(window_id: u32) -> Result<()> {
    browser::cef_hide_window(window_id)
}

#[napi]
pub fn close_window(window_id: u32) -> Result<()> {
    browser::cef_close_window(window_id)
}

#[napi]
pub fn focus_window(window_id: u32) -> Result<()> {
    browser::cef_focus_window(window_id)
}

#[napi]
pub fn maximize_window(window_id: u32) -> Result<()> {
    browser::cef_maximize_window(window_id)
}

#[napi]
pub fn minimize_window(window_id: u32) -> Result<()> {
    browser::cef_minimize_window(window_id)
}

#[napi]
pub fn restore_window(window_id: u32) -> Result<()> {
    browser::cef_restore_window(window_id)
}

#[napi]
pub fn set_fullscreen(window_id: u32, fullscreen: bool) -> Result<()> {
    browser::cef_set_fullscreen(window_id, fullscreen)
}

#[napi]
pub fn get_window_bounds(window_id: u32) -> Result<WindowBounds> {
    browser::cef_get_window_bounds(window_id)
}

#[napi]
pub fn set_window_bounds(
    window_id: u32,
    x: Option<i32>,
    y: Option<i32>,
    width: Option<u32>,
    height: Option<u32>,
) -> Result<()> {
    browser::cef_set_window_bounds(window_id, x, y, width, height)
}

#[napi]
pub fn set_window_title(window_id: u32, title: String) -> Result<()> {
    browser::cef_set_window_title(window_id, &title)
}

#[napi]
pub fn set_window_always_on_top(window_id: u32, always_on_top: bool) -> Result<()> {
    browser::cef_set_always_on_top(window_id, always_on_top)
}

#[napi]
pub fn is_window_visible(window_id: u32) -> Result<bool> {
    browser::cef_is_window_visible(window_id)
}

#[napi]
pub fn is_window_focused(window_id: u32) -> Result<bool> {
    browser::cef_is_window_focused(window_id)
}

#[napi]
pub fn is_window_maximized(window_id: u32) -> Result<bool> {
    browser::cef_is_window_maximized(window_id)
}

#[napi]
pub fn is_window_minimized(window_id: u32) -> Result<bool> {
    browser::cef_is_window_minimized(window_id)
}

#[napi]
pub fn is_window_fullscreen(window_id: u32) -> Result<bool> {
    browser::cef_is_window_fullscreen(window_id)
}

#[napi]
pub fn get_focused_window_id() -> Option<u32> {
    browser::cef_get_focused_window_id()
}

#[napi]
pub fn get_all_window_ids() -> Vec<u32> {
    CEF_STATE.lock().window_to_browser.keys().cloned().collect()
}

// ============================================================================
// WebView / Navigation
// ============================================================================

#[napi]
pub async fn execute_java_script(window_id: u32, script: String) -> Result<String> {
    browser::cef_execute_java_script(window_id, &script)
}

#[napi]
pub fn webview_reload(window_id: u32) -> Result<()> {
    browser::cef_webview_reload(window_id)
}

#[napi]
pub fn webview_stop(window_id: u32) -> Result<()> {
    browser::cef_webview_stop(window_id)
}

#[napi]
pub fn webview_go_back(window_id: u32) -> Result<()> {
    browser::cef_webview_go_back(window_id)
}

#[napi]
pub fn webview_go_forward(window_id: u32) -> Result<()> {
    browser::cef_webview_go_forward(window_id)
}

// ============================================================================
// DevTools
// ============================================================================

#[napi]
pub fn open_devtools(window_id: u32) -> Result<()> {
    browser::cef_open_devtools(window_id)
}

#[napi]
pub fn close_devtools(window_id: u32) -> Result<()> {
    browser::cef_close_devtools(window_id)
}

#[napi]
pub fn toggle_devtools(window_id: u32) -> Result<()> {
    browser::cef_toggle_devtools(window_id)
}

#[napi]
pub fn is_devtools_open(window_id: u32) -> Result<bool> {
    browser::cef_is_devtools_open(window_id)
}

// ============================================================================
// IPC
// ============================================================================

#[napi]
pub fn set_ipc_handler(callback: ThreadsafeFunction<IpcMessage, ErrorStrategy::Fatal>) {
    *IPC_CALLBACK.lock() = Some(callback);
}

#[napi]
pub fn set_app_event_handler(callback: ThreadsafeFunction<AppEvent, ErrorStrategy::Fatal>) {
    *APP_EVENT_CALLBACK.lock() = Some(callback);
}

#[napi]
pub fn send_ipc_message(window_id: u32, message: String) -> Result<()> {
    browser::cef_send_ipc_message(window_id, &message)
}

#[napi]
pub fn poll_ipc_messages() -> Vec<IpcMessage> {
    PENDING_IPC.lock().drain(..).collect()
}

// ============================================================================
// Event loop integration
// ============================================================================

#[napi]
pub fn init_event_loop() -> Result<()> {
    state::ensure_cef_initialized()?;
    Ok(())
}

#[napi]
pub fn pump_events() -> Result<PumpResult> {
    let messages: Vec<IpcMessage> = PENDING_IPC.lock().drain(..).collect();

    let state = CEF_STATE.lock();
    if state.initialized {
        drop(state);
        cef::do_message_loop_work();
    }

    #[cfg(target_os = "linux")]
    {
        while gtk::events_pending() {
            gtk::main_iteration();
        }
    }

    let should_quit = CEF_STATE.lock().window_to_browser.is_empty();

    Ok(PumpResult {
        should_quit,
        messages,
    })
}

#[napi]
pub fn run_event_loop() -> Result<()> {
    state::ensure_cef_initialized()?;
    state::process_pending_windows();

    let state = CEF_STATE.lock();
    if state.window_to_browser.is_empty() {
        state::dispatch_app_event("window-all-closed");
        return Ok(());
    }
    drop(state);

    cef::run_message_loop();

    Ok(())
}

#[napi(object)]
pub struct PumpResult {
    pub should_quit: bool,
    pub messages: Vec<IpcMessage>,
}

// ============================================================================
// Session / Cookies
// ============================================================================

#[napi(object)]
pub struct NativeCookie {
    pub name: String,
    pub value: String,
    pub domain: Option<String>,
    pub path: Option<String>,
    pub secure: Option<bool>,
    pub http_only: Option<bool>,
    pub same_site: Option<String>,
    pub expiration_date: Option<f64>,
}

#[napi(object)]
pub struct SetCookieParams {
    pub name: String,
    pub value: String,
    pub domain: Option<String>,
    pub path: Option<String>,
    pub secure: Option<bool>,
    pub http_only: Option<bool>,
    pub same_site: Option<String>,
    pub expiration_date: Option<f64>,
}

#[napi(object)]
pub struct ClearStorageOptions {
    pub cookies: Option<bool>,
    pub local_storage: Option<bool>,
    pub session_storage: Option<bool>,
    pub indexed_db: Option<bool>,
    pub cache_storage: Option<bool>,
}

#[napi]
pub async fn get_cookies(window_id: u32) -> Result<Vec<NativeCookie>> {
    browser::cef_get_cookies(window_id)
}

#[napi]
pub fn set_cookie(window_id: u32, cookie: SetCookieParams) -> Result<()> {
    browser::cef_set_cookie(window_id, &cookie)
}

#[napi]
pub fn remove_cookie(window_id: u32, name: String, url: String) -> Result<()> {
    browser::cef_remove_cookie(window_id, &name, &url)
}

#[napi]
pub fn clear_storage_data(window_id: u32, options: Option<ClearStorageOptions>) -> Result<()> {
    browser::cef_clear_storage_data(window_id, options.as_ref())
}

#[napi]
pub async fn get_user_agent(window_id: u32) -> Result<String> {
    browser::cef_get_user_agent(window_id)
}