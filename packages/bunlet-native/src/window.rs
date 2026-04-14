use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::path::PathBuf;
use tao::dpi::{LogicalSize, PhysicalPosition};

use crate::{
    dispatch_navigation_event, dispatch_window_event, dispatch_window_title_event, next_window_id,
    PendingWindow, PENDING_WINDOWS, WINDOWS,
};

/// Window creation options
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
    /// Parent window ID for child windows
    pub parent_id: Option<u32>,
    /// Whether this is a modal window (blocks parent)
    pub modal: Option<bool>,
}

/// Window bounds
#[napi(object)]
#[derive(Clone)]
pub struct WindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

// Store pending URLs for windows that haven't been created yet
static PENDING_URLS: Lazy<Mutex<HashMap<u32, String>>> = Lazy::new(|| Mutex::new(HashMap::new()));

use once_cell::sync::Lazy;
use parking_lot::Mutex;
use std::collections::HashMap;

/// Create a new window (queued for creation when event loop runs)
#[napi]
pub fn create_window(options: Option<WindowOptions>) -> u32 {
    let opts = options.unwrap_or_default();
    let window_id = next_window_id();

    // Queue window for creation when event loop starts
    PENDING_WINDOWS.lock().push(PendingWindow {
        id: window_id,
        options: opts,
        url: None,
        html: None,
    });

    window_id
}

/// Load URL in window
#[napi]
pub fn load_url(window_id: u32, url: String) -> Result<()> {
    let windows = WINDOWS.lock();

    // If window exists, load URL directly
    if let Some(state) = windows.get(&window_id) {
        state
            .webview
            .load_url(&url)
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;
        dispatch_navigation_event("web-contents-navigation", window_id, Some(&url));
        return Ok(());
    }

    // Otherwise, queue the URL for when the window is created
    drop(windows);

    // Update the pending window with the URL
    let mut pending = PENDING_WINDOWS.lock();
    for pw in pending.iter_mut() {
        if pw.id == window_id {
            pw.url = Some(url.clone());
            dispatch_navigation_event("web-contents-navigation", window_id, Some(&url));
            return Ok(());
        }
    }

    // Also store in PENDING_URLS as fallback
    PENDING_URLS.lock().insert(window_id, url);
    Ok(())
}

/// Load HTML file in window
#[napi]
pub fn load_file(window_id: u32, file_path: String) -> Result<()> {
    let path = PathBuf::from(&file_path);
    let absolute_path = if path.is_absolute() {
        path
    } else {
        std::env::current_dir()
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?
            .join(path)
    };

    // Get the directory containing the file for serving assets
    let base_dir = absolute_path.parent()
        .ok_or_else(|| Error::new(Status::GenericFailure, "Invalid file path"))?
        .to_path_buf();

    let file_name = absolute_path.file_name()
        .ok_or_else(|| Error::new(Status::GenericFailure, "Invalid file name"))?
        .to_string_lossy()
        .to_string();

    // Start local HTTP server and get the URL
    let port = crate::start_file_server(base_dir)
        .map_err(|e| Error::new(Status::GenericFailure, e))?;

    let url = format!("http://localhost:{}/{}", port, file_name);

    // Try to load directly, or queue if window not ready
    load_url(window_id, url)
}

/// Load HTML content directly
#[napi]
pub fn load_html(window_id: u32, html: String) -> Result<()> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    state
        .webview
        .load_url(&format!("data:text/html,{}", urlencoding::encode(&html)))
        .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;
    dispatch_navigation_event("web-contents-navigation", window_id, None);

    Ok(())
}

/// Show window
#[napi]
pub fn show_window(window_id: u32) -> Result<()> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    state.window.set_visible(true);
    Ok(())
}

/// Hide window
#[napi]
pub fn hide_window(window_id: u32) -> Result<()> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    state.window.set_visible(false);
    Ok(())
}

/// Close window
#[napi]
pub fn close_window(window_id: u32) -> Result<()> {
    let mut windows = WINDOWS.lock();
    windows.remove(&window_id);
    dispatch_window_event("window-closed", window_id);
    Ok(())
}

/// Focus window
#[napi]
pub fn focus_window(window_id: u32) -> Result<()> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    state.window.set_focus();
    Ok(())
}

/// Maximize window
#[napi]
pub fn maximize_window(window_id: u32) -> Result<()> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    state.window.set_maximized(true);
    Ok(())
}

/// Minimize window
#[napi]
pub fn minimize_window(window_id: u32) -> Result<()> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    state.window.set_minimized(true);
    Ok(())
}

/// Restore window
#[napi]
pub fn restore_window(window_id: u32) -> Result<()> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    state.window.set_maximized(false);
    state.window.set_minimized(false);
    Ok(())
}

/// Set fullscreen
#[napi]
pub fn set_fullscreen(window_id: u32, fullscreen: bool) -> Result<()> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    if fullscreen {
        state
            .window
            .set_fullscreen(Some(tao::window::Fullscreen::Borderless(None)));
    } else {
        state.window.set_fullscreen(None);
    }
    Ok(())
}

/// Get window bounds
#[napi]
pub fn get_window_bounds(window_id: u32) -> Result<WindowBounds> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    let position = state.window.outer_position().unwrap_or_default();
    let size = state.window.inner_size();

    Ok(WindowBounds {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    })
}

/// Set window bounds
/// When only position or only size is provided, the other dimension
/// is read from the current window state so partial updates work correctly.
#[napi]
pub fn set_window_bounds(
    window_id: u32,
    x: Option<i32>,
    y: Option<i32>,
    width: Option<u32>,
    height: Option<u32>,
) -> Result<()> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    // Position: apply when both x and y are provided, or when one is provided
    // alongside the other. TAO requires setting position atomically.
    if x.is_some() || y.is_some() {
        let current = state.window.outer_position().unwrap_or(PhysicalPosition::new(0, 0));
        let px = x.unwrap_or(current.x);
        let py = y.unwrap_or(current.y);
        state
            .window
            .set_outer_position(PhysicalPosition::new(px, py));
    }

    // Size: apply when both width and height are provided, or when one is provided.
    if width.is_some() || height.is_some() {
        let current = state.window.inner_size();
        let w = width.unwrap_or(current.width);
        let h = height.unwrap_or(current.height);
        state
            .window
            .set_inner_size(LogicalSize::new(w as f64, h as f64));
    }

    Ok(())
}

/// Set window title
#[napi]
pub fn set_window_title(window_id: u32, title: String) -> Result<()> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    state.window.set_title(&title);
    dispatch_window_title_event("window-title-updated", window_id, &title);
    Ok(())
}

/// Set always-on-top flag
#[napi]
pub fn set_window_always_on_top(window_id: u32, always_on_top: bool) -> Result<()> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    state.window.set_always_on_top(always_on_top);
    Ok(())
}

/// Check if window is visible
#[napi]
pub fn is_window_visible(window_id: u32) -> Result<bool> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    Ok(state.window.is_visible())
}

/// Check if window is focused
#[napi]
pub fn is_window_focused(window_id: u32) -> Result<bool> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    Ok(state.window.is_focused())
}

/// Check if window is maximized
#[napi]
pub fn is_window_maximized(window_id: u32) -> Result<bool> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    Ok(state.window.is_maximized())
}

/// Check if window is minimized
#[napi]
pub fn is_window_minimized(window_id: u32) -> Result<bool> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    Ok(state.window.is_minimized())
}

/// Check if window is fullscreen
#[napi]
pub fn is_window_fullscreen(window_id: u32) -> Result<bool> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    Ok(state.window.fullscreen().is_some())
}

/// Get the focused window ID if one exists
#[napi]
pub fn get_focused_window_id() -> Option<u32> {
    let windows = WINDOWS.lock();
    windows
        .iter()
        .find_map(|(id, state)| if state.window.is_focused() { Some(*id) } else { None })
}

/// Execute JavaScript in WebView
///
/// **Important**: With the system webview backend (wry), `evaluate_script`
/// is fire-and-forget — it does NOT return the script result. The caller
/// will always receive an empty string. To obtain a return value from JS,
/// use the IPC channel instead (have the script send the result via
/// `window.__bunlet.send(channel, result)`).
#[napi]
pub async fn execute_java_script(window_id: u32, script: String) -> Result<String> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    state
        .webview
        .evaluate_script(&script)
        .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;

    Ok(String::new())
}

// ============================================================================
// Navigation API
// ============================================================================

/// Navigate back in the webview history
#[napi]
pub fn webview_go_back(window_id: u32) -> Result<()> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    // Execute JavaScript to go back (wry doesn't expose direct navigation API)
    state
        .webview
        .evaluate_script("window.history.back()")
        .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;
    dispatch_navigation_event("web-contents-history-back", window_id, None);
    Ok(())
}

/// Navigate forward in the webview history
#[napi]
pub fn webview_go_forward(window_id: u32) -> Result<()> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    state
        .webview
        .evaluate_script("window.history.forward()")
        .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;
    dispatch_navigation_event("web-contents-history-forward", window_id, None);
    Ok(())
}

/// Reload the webview
#[napi]
pub fn webview_reload(window_id: u32) -> Result<()> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    state
        .webview
        .evaluate_script("window.location.reload()")
        .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;
    dispatch_navigation_event("web-contents-navigation", window_id, None);
    Ok(())
}

/// Stop loading the webview
#[napi]
pub fn webview_stop(window_id: u32) -> Result<()> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    state
        .webview
        .evaluate_script("window.stop()")
        .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;
    Ok(())
}

// ============================================================================
// DevTools Support
// ============================================================================

/// Open DevTools for the window
#[napi]
#[cfg(any(debug_assertions, feature = "devtools"))]
pub fn open_devtools(window_id: u32) -> Result<()> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    state.webview.open_devtools();
    Ok(())
}

/// Close DevTools for the window
#[napi]
#[cfg(any(debug_assertions, feature = "devtools"))]
pub fn close_devtools(window_id: u32) -> Result<()> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    state.webview.close_devtools();
    Ok(())
}

/// Toggle DevTools for the window
#[napi]
#[cfg(any(debug_assertions, feature = "devtools"))]
pub fn toggle_devtools(window_id: u32) -> Result<()> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    if state.webview.is_devtools_open() {
        state.webview.close_devtools();
    } else {
        state.webview.open_devtools();
    }
    Ok(())
}

/// Check if DevTools is open
#[napi]
#[cfg(any(debug_assertions, feature = "devtools"))]
pub fn is_devtools_open(window_id: u32) -> Result<bool> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;

    Ok(state.webview.is_devtools_open())
}

// ============================================================================
// Authoritative WebView State Queries
// ============================================================================

/// Get the current URL of the webview.
///
/// **Limitation**: The system webview backend (wry) does not support returning
/// values from `evaluate_script`, so this cannot synchronously read
/// `location.href`. The TypeScript layer tracks URL changes via navigation
/// events (`WebContentsState`) instead.
#[napi]
pub fn webview_get_url(_window_id: u32) -> Result<String> {
    Err(Error::new(
        Status::GenericFailure,
        "webview_get_url is not supported by the system webview backend; URL is tracked via navigation events",
    ))
}

/// Get the page title.
///
/// **Limitation**: Same as `webview_get_url` — the system webview backend
/// cannot return values from `evaluate_script`. The TypeScript layer tracks
/// title changes via the `web-contents-title-updated` event.
#[napi]
pub fn webview_get_title(_window_id: u32) -> Result<String> {
    Err(Error::new(
        Status::GenericFailure,
        "webview_get_title is not supported by the system webview backend; title is tracked via events",
    ))
}

/// Check if the webview can navigate back.
///
/// **Limitation**: The system webview backend cannot return values from
/// `evaluate_script`. The TypeScript layer tracks history state via
/// `WebContentsState`.
#[napi]
pub fn webview_can_go_back(_window_id: u32) -> Result<bool> {
    Err(Error::new(
        Status::GenericFailure,
        "webview_can_go_back is not supported by the system webview backend; history is tracked via WebContentsState",
    ))
}

/// Check if the webview can navigate forward.
///
/// **Limitation**: Same as `webview_can_go_back`.
#[napi]
pub fn webview_can_go_forward(_window_id: u32) -> Result<bool> {
    Err(Error::new(
        Status::GenericFailure,
        "webview_can_go_forward is not supported by the system webview backend; history is tracked via WebContentsState",
    ))
}
