#![deny(clippy::all)]

mod clipboard;
mod dialog;
mod file_watcher;
mod menu;
mod notification;
mod power_monitor;
mod screen;
mod session;
mod shell;
mod shortcuts;
mod tray;
mod window;

use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction};
use napi_derive::napi;
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use send_wrapper::SendWrapper;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoopBuilder, EventLoopWindowTarget};
use tao::window::{Window, WindowId};


pub use clipboard::*;
pub use dialog::*;
pub use file_watcher::*;
pub use menu::*;
pub use notification::*;
pub use power_monitor::*;
pub use screen::*;
pub use session::*;
pub use shell::*;
pub use shortcuts::*;
pub use tray::*;
pub use window::*;

// Global state
static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(1);
static WINDOWS: Lazy<Mutex<HashMap<u32, SendWrapper<WindowState>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
static IPC_CALLBACK: Lazy<Mutex<Option<ThreadsafeFunction<IpcMessage, ErrorStrategy::Fatal>>>> =
    Lazy::new(|| Mutex::new(None));
static APP_EVENT_CALLBACK: Lazy<Mutex<Option<ThreadsafeFunction<AppEvent, ErrorStrategy::Fatal>>>> =
    Lazy::new(|| Mutex::new(None));

// Pending window creations (for async window creation from main thread)
static PENDING_WINDOWS: Lazy<Mutex<Vec<PendingWindow>>> = Lazy::new(|| Mutex::new(Vec::new()));

// File server port tracking by base directory
static FILE_SERVERS: Lazy<Mutex<HashMap<String, u16>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Start a local HTTP server to serve files from the given directory
/// Returns the port number the server is running on
pub fn start_file_server(base_dir: std::path::PathBuf) -> std::result::Result<u16, String> {
    let canonical_base = base_dir
        .canonicalize()
        .unwrap_or(base_dir)
        .to_string_lossy()
        .to_string();

    // Check if a server is already running for this directory
    if let Some(port) = FILE_SERVERS.lock().get(&canonical_base).copied() {
        return Ok(port);
    }

    // Find an available port
    let server = tiny_http::Server::http("127.0.0.1:0")
        .map_err(|e| format!("Failed to start HTTP server: {}", e))?;

    let port = server.server_addr().to_ip()
        .ok_or_else(|| "Failed to get server address".to_string())?
        .port();

    FILE_SERVERS.lock().insert(canonical_base.clone(), port);

    // Spawn server thread
    std::thread::spawn(move || {
        let base_dir = std::path::PathBuf::from(canonical_base);
        for request in server.incoming_requests() {
            let url_path = request.url().trim_start_matches('/');
            let file_path = base_dir.join(url_path);

            let response = if file_path.exists() && file_path.is_file() {
                match std::fs::read(&file_path) {
                    Ok(content) => {
                        let mime_type = match file_path.extension().and_then(|e| e.to_str()) {
                            Some("html") | Some("htm") => "text/html; charset=utf-8",
                            Some("css") => "text/css; charset=utf-8",
                            Some("js") => "application/javascript; charset=utf-8",
                            Some("json") => "application/json; charset=utf-8",
                            Some("png") => "image/png",
                            Some("jpg") | Some("jpeg") => "image/jpeg",
                            Some("gif") => "image/gif",
                            Some("svg") => "image/svg+xml",
                            Some("woff") => "font/woff",
                            Some("woff2") => "font/woff2",
                            Some("ttf") => "font/ttf",
                            Some("ico") => "image/x-icon",
                            Some("webp") => "image/webp",
                            _ => "application/octet-stream",
                        };
                        tiny_http::Response::from_data(content)
                            .with_header(
                                tiny_http::Header::from_bytes(&b"Content-Type"[..], mime_type.as_bytes())
                                    .unwrap()
                            )
                    }
                    Err(_) => tiny_http::Response::from_string("Internal Server Error")
                        .with_status_code(500),
                }
            } else {
                tiny_http::Response::from_string("Not Found").with_status_code(404)
            };

            let _ = request.respond(response);
        }
    });

    Ok(port)
}

/// Window state stored globally (wrapped in SendWrapper for thread safety)
pub struct WindowState {
    pub tao_window_id: WindowId,
    pub window: Window,
    pub webview: wry::WebView,
}

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
}

/// Pending window to be created
pub struct PendingWindow {
    pub id: u32,
    pub options: WindowOptions,
    pub url: Option<String>,
    pub html: Option<String>,
}

/// Generate a new window ID
pub fn next_window_id() -> u32 {
    WINDOW_COUNTER.fetch_add(1, Ordering::SeqCst)
}

/// Initialize the application
#[napi]
pub fn init_app() -> Result<()> {
    // Platform-specific initialization
    #[cfg(target_os = "linux")]
    {
        // Initialize GTK early - this is important because:
        // 1. TAO's event loop will also call gtk::init(), but it's idempotent
        // 2. The screen API uses GDK which requires GTK to be initialized
        // 3. By initializing here, we ensure consistent state before any API calls
        gtk::init().map_err(|e| {
            let display = std::env::var("DISPLAY").unwrap_or_else(|_| "(unset)".to_string());
            let wayland = std::env::var("WAYLAND_DISPLAY").unwrap_or_else(|_| "(unset)".to_string());
            Error::new(
                Status::GenericFailure,
                format!(
                    "Failed to initialize GTK: {} (DISPLAY={}, WAYLAND_DISPLAY={})",
                    e, display, wayland
                ),
            )
        })?;
    }

    Ok(())
}

/// Quit the application
#[napi]
pub fn quit_app() {
    std::process::exit(0);
}

/// Get standard system path
/// Returns None if the path is not available on this platform
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

/// Get all window IDs
#[napi]
pub fn get_all_window_ids() -> Vec<u32> {
    WINDOWS.lock().keys().cloned().collect()
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

// Queue for pending IPC messages
static PENDING_IPC: Lazy<Mutex<Vec<IpcMessage>>> = Lazy::new(|| Mutex::new(Vec::new()));

/// Dispatch IPC message - queue it and trigger processing via GTK timeout
pub fn dispatch_ipc(window_id: u32, message: String) {
    let msg = IpcMessage { window_id, message };
    PENDING_IPC.lock().push(msg);

    // Use GTK's idle handler to process the queue on Linux
    #[cfg(target_os = "linux")]
    gtk::glib::idle_add_local_once(|| {
        process_pending_ipc();
    });

    #[cfg(not(target_os = "linux"))]
    process_pending_ipc();
}

/// Process pending IPC messages by calling the JS callback
fn process_pending_ipc() {
    let messages: Vec<IpcMessage> = PENDING_IPC.lock().drain(..).collect();

    if messages.is_empty() {
        return;
    }

    // Call from a separate thread to ensure proper async semantics
    std::thread::spawn(move || {
        if let Some(callback) = IPC_CALLBACK.lock().as_ref() {
            for msg in messages {
                callback.call(msg, napi::threadsafe_function::ThreadsafeFunctionCallMode::NonBlocking);
            }
        }
    });
}

/// Poll and process pending IPC messages - called from JS (fallback)
#[napi]
pub fn poll_ipc_messages() -> Vec<IpcMessage> {
    PENDING_IPC.lock().drain(..).collect()
}

/// Dispatch app event to callback
pub fn dispatch_app_event(event: &str) {
    if let Some(callback) = APP_EVENT_CALLBACK.lock().as_ref() {
        callback.call(
            AppEvent {
                event: event.to_string(),
            },
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

fn build_initialization_script(options: &WindowOptions) -> std::result::Result<String, String> {
    let mut script = r#"
        // Bunlet IPC bridge
        window.__bunlet = {
            _handlers: [],
            _channelListeners: {},
            _pending: {},
            _nextId: 1,
            invoke: function(payload) {
                const id = (payload && payload.id != null) ? String(payload.id) : String(this._nextId++);
                const message = {
                    jsonrpc: '2.0',
                    id,
                    method: payload?.method,
                    params: payload?.params ?? {}
                };
                return new Promise((resolve, reject) => {
                    this._pending[id] = { resolve, reject };
                    window.ipc.postMessage(JSON.stringify(message));
                });
            },
            send: function(channel) {
                const args = Array.prototype.slice.call(arguments, 1);
                window.ipc.postMessage(JSON.stringify({ type: 'event', channel, args }));
            },
            onMessage: function(handler) {
                this._handlers.push(handler);
            },
            on: function(channel, handler) {
                if (!this._channelListeners[channel]) {
                    this._channelListeners[channel] = [];
                }
                this._channelListeners[channel].push(handler);
            },
            off: function(channel, handler) {
                if (!this._channelListeners[channel]) return;
                this._channelListeners[channel] =
                    this._channelListeners[channel].filter((fn) => fn !== handler);
            }
        };

        window.__bunlet_ipc_handler = function(message) {
            window.__bunlet._handlers.forEach(function(handler) {
                handler(message);
            });

            let data = null;
            try {
                data = typeof message === 'string' ? JSON.parse(message) : message;
            } catch (_) {
                return;
            }

            if (data && data.jsonrpc === '2.0' && data.id != null) {
                const key = String(data.id);
                const pending = window.__bunlet._pending[key];
                if (pending) {
                    delete window.__bunlet._pending[key];
                    if (data.error) {
                        pending.reject(data.error);
                    } else {
                        pending.resolve(data.result);
                    }
                }
                return;
            }

            if (data && data.channel) {
                const listeners = window.__bunlet._channelListeners[data.channel] || [];
                listeners.forEach(function(handler) {
                    try {
                        const args = Array.isArray(data.args) ? data.args : [];
                        handler.apply(null, [undefined].concat(args));
                    } catch (_) {}
                });
            }
        };

        // Context Bridge for preload scripts
        // Provides a secure way to expose APIs from preload to renderer
        window.__bunlet_contextBridge = {
            _exposed: {},
            exposeInMainWorld: function(apiKey, api) {
                if (typeof apiKey !== 'string' || !apiKey) {
                    throw new Error('contextBridge.exposeInMainWorld: apiKey must be a non-empty string');
                }
                if (window[apiKey] !== undefined && !this._exposed[apiKey]) {
                    throw new Error('contextBridge.exposeInMainWorld: ' + apiKey + ' is already defined on window');
                }

                // Deep clone with function wrapping for security
                function cloneValue(value) {
                    if (value === null || value === undefined) return value;
                    if (typeof value === 'function') {
                        return function() {
                            return value.apply(null, arguments);
                        };
                    }
                    if (Array.isArray(value)) {
                        return value.map(cloneValue);
                    }
                    if (typeof value === 'object') {
                        var cloned = {};
                        for (var key in value) {
                            if (Object.prototype.hasOwnProperty.call(value, key)) {
                                cloned[key] = cloneValue(value[key]);
                            }
                        }
                        return cloned;
                    }
                    return value;
                }

                var clonedApi = cloneValue(api);
                Object.freeze(clonedApi);
                this._exposed[apiKey] = true;
                window[apiKey] = clonedApi;
            }
        };
    "#
    .to_string();

    if let Some(preload_script_path) = &options.preload_script {
        let preload_script = std::fs::read_to_string(preload_script_path)
            .map_err(|e| format!("Failed to read preload script '{}': {}", preload_script_path, e))?;
        script.push_str("\ntry {\n");
        script.push_str(&preload_script);
        script.push_str("\n} catch (e) { console.error('Preload execution failed:', e); }\n");
    }

    Ok(script)
}

/// Create a window in the event loop context
pub fn create_window_in_loop(
    window_id: u32,
    options: &WindowOptions,
    event_loop: &EventLoopWindowTarget<()>,
) -> std::result::Result<WindowState, String> {
    use tao::dpi::{LogicalPosition, LogicalSize};
    use tao::window::WindowBuilder;
    use wry::WebViewBuilder;

    let mut builder = WindowBuilder::new()
        .with_title(options.title.clone().unwrap_or_else(|| "Bunlet".to_string()))
        .with_inner_size(LogicalSize::new(
            options.width.unwrap_or(800) as f64,
            options.height.unwrap_or(600) as f64,
        ))
        .with_resizable(options.resizable.unwrap_or(true))
        .with_decorations(options.decorations.unwrap_or(true))
        .with_transparent(options.transparent.unwrap_or(false))
        .with_visible(options.visible.unwrap_or(true))
        .with_always_on_top(options.always_on_top.unwrap_or(false));

    if let (Some(x), Some(y)) = (options.x, options.y) {
        builder = builder.with_position(LogicalPosition::new(x as f64, y as f64));
    }

    if let (Some(min_w), Some(min_h)) = (options.min_width, options.min_height) {
        builder = builder.with_min_inner_size(LogicalSize::new(min_w as f64, min_h as f64));
    }

    if let (Some(max_w), Some(max_h)) = (options.max_width, options.max_height) {
        builder = builder.with_max_inner_size(LogicalSize::new(max_w as f64, max_h as f64));
    }

    // Handle parent window - platform-specific implementations
    #[cfg(target_os = "linux")]
    if let Some(parent_id) = options.parent_id {
        use tao::platform::unix::WindowBuilderExtUnix;
        use tao::platform::unix::WindowExtUnix;

        if let Some(parent_state) = WINDOWS.lock().get(&parent_id) {
            // On Linux/GTK, we can set the parent window
            // Get the GTK window from the parent and set as transient
            let gtk_window = parent_state.window.gtk_window();
            builder = builder.with_transient_for(gtk_window);
        }
    }

    // Handle modal windows on Linux
    #[cfg(target_os = "linux")]
    if options.modal.unwrap_or(false) {
        use tao::platform::unix::WindowBuilderExtUnix;
        builder = builder.with_skip_taskbar(true);
    }

    let window = builder
        .build(event_loop)
        .map_err(|e| e.to_string())?;

    // Set modal behavior after window creation on Linux
    #[cfg(target_os = "linux")]
    if options.modal.unwrap_or(false) {
        use tao::platform::unix::WindowExtUnix;
        use gtk::prelude::GtkWindowExt;
        let gtk_window = window.gtk_window();
        gtk_window.set_modal(true);
    }

    let tao_window_id = window.id();

    // Create IPC handler for this window
    let wid = window_id;
    let ipc_handler = move |request: wry::http::Request<String>| {
        let body = request.body();
        dispatch_ipc(wid, body.clone());
    };

    let init_script = build_initialization_script(options)?;

    // Custom protocol handler for app:// URLs
    // This allows loading local files via app://path/to/file
    let app_protocol_handler = |_webview_id: wry::WebViewId, request: wry::http::Request<Vec<u8>>| {
        use std::borrow::Cow;
        use wry::http::{Response, StatusCode};

        let uri = request.uri();
        let path = uri.path();

        // Remove leading slash from path
        let file_path = path.trim_start_matches('/');

        // Try to resolve relative to current working directory
        let full_path = std::path::PathBuf::from(file_path);
        let absolute_path = if full_path.is_absolute() {
            full_path
        } else {
            std::env::current_dir()
                .unwrap_or_default()
                .join(full_path)
        };

        match std::fs::read(&absolute_path) {
            Ok(content) => {
                let mime_type = match absolute_path.extension().and_then(|e| e.to_str()) {
                    Some("html") | Some("htm") => "text/html",
                    Some("css") => "text/css",
                    Some("js") | Some("mjs") => "application/javascript",
                    Some("json") => "application/json",
                    Some("png") => "image/png",
                    Some("jpg") | Some("jpeg") => "image/jpeg",
                    Some("gif") => "image/gif",
                    Some("svg") => "image/svg+xml",
                    Some("webp") => "image/webp",
                    Some("woff") => "font/woff",
                    Some("woff2") => "font/woff2",
                    Some("ttf") => "font/ttf",
                    Some("otf") => "font/otf",
                    Some("ico") => "image/x-icon",
                    Some("txt") => "text/plain",
                    Some("xml") => "application/xml",
                    Some("pdf") => "application/pdf",
                    _ => "application/octet-stream",
                };

                Response::builder()
                    .status(StatusCode::OK)
                    .header("Content-Type", mime_type)
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Cow::Owned(content))
                    .unwrap_or_else(|_| Response::builder()
                        .status(StatusCode::INTERNAL_SERVER_ERROR)
                        .body(Cow::Borrowed(b"Internal server error" as &[u8]))
                        .unwrap())
            }
            Err(_) => {
                Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .header("Content-Type", "text/plain")
                    .body(Cow::Owned(format!("File not found: {}", absolute_path.display()).into_bytes()))
                    .unwrap_or_else(|_| Response::builder()
                        .status(StatusCode::NOT_FOUND)
                        .body(Cow::Borrowed(b"Not found" as &[u8]))
                        .unwrap())
            }
        }
    };

    // Build WebView with IPC support
    // On Linux, use build_gtk for proper Wayland support
    #[cfg(target_os = "linux")]
    let webview = {
        use tao::platform::unix::WindowExtUnix;
        use wry::WebViewBuilderExtUnix;

        let vbox = window
            .default_vbox()
            .ok_or_else(|| "Failed to get GTK vbox from window".to_string())?;

        WebViewBuilder::new()
            .with_ipc_handler(ipc_handler)
            .with_custom_protocol("app".to_string(), app_protocol_handler)
            .with_background_color((255, 255, 255, 255))
            .with_initialization_script(&init_script)
            .with_devtools(options.open_devtools.unwrap_or(true))
            .build_gtk(vbox)
            .map_err(|e| e.to_string())?
    };

    #[cfg(not(target_os = "linux"))]
    let webview = {
        // Custom protocol handler for app:// URLs (same as Linux version)
        let app_protocol_handler_non_linux = |_webview_id: wry::WebViewId, request: wry::http::Request<Vec<u8>>| {
            use std::borrow::Cow;
            use wry::http::{Response, StatusCode};

            let uri = request.uri();
            let path = uri.path();
            let file_path = path.trim_start_matches('/');
            let full_path = std::path::PathBuf::from(file_path);
            let absolute_path = if full_path.is_absolute() {
                full_path
            } else {
                std::env::current_dir().unwrap_or_default().join(full_path)
            };

            match std::fs::read(&absolute_path) {
                Ok(content) => {
                    let mime_type = match absolute_path.extension().and_then(|e| e.to_str()) {
                        Some("html") | Some("htm") => "text/html",
                        Some("css") => "text/css",
                        Some("js") | Some("mjs") => "application/javascript",
                        Some("json") => "application/json",
                        Some("png") => "image/png",
                        Some("jpg") | Some("jpeg") => "image/jpeg",
                        Some("gif") => "image/gif",
                        Some("svg") => "image/svg+xml",
                        _ => "application/octet-stream",
                    };
                    Response::builder()
                        .status(StatusCode::OK)
                        .header("Content-Type", mime_type)
                        .header("Access-Control-Allow-Origin", "*")
                        .body(Cow::Owned(content))
                        .unwrap_or_else(|_| Response::builder()
                            .status(StatusCode::INTERNAL_SERVER_ERROR)
                            .body(Cow::Borrowed(b"Error" as &[u8]))
                            .unwrap())
                }
                Err(_) => Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .body(Cow::Borrowed(b"Not found" as &[u8]))
                    .unwrap(),
            }
        };

        WebViewBuilder::new()
            .with_ipc_handler(ipc_handler)
            .with_custom_protocol("app".to_string(), app_protocol_handler_non_linux)
            .with_background_color((255, 255, 255, 255))
            .with_initialization_script(&init_script)
            .with_devtools(options.open_devtools.unwrap_or(true))
            .build(&window)
            .map_err(|e| e.to_string())?
    };

    Ok(WindowState {
        tao_window_id,
        window,
        webview,
    })
}

// Global event loop stored for run_return usage
static EVENT_LOOP: Lazy<Mutex<Option<SendWrapper<tao::event_loop::EventLoop<()>>>>> =
    Lazy::new(|| Mutex::new(None));
static SHOULD_QUIT: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Initialize the event loop and create windows
#[napi]
pub fn init_event_loop() -> Result<()> {
    #[cfg(target_os = "linux")]
    let event_loop = {
        use tao::platform::unix::EventLoopBuilderExtUnix;
        EventLoopBuilder::new()
            .with_app_id("com.bunlet.app")
            .build()
    };

    #[cfg(not(target_os = "linux"))]
    let event_loop = EventLoopBuilder::new().build();

    // Process any pending window creations
    {
        let pending = PENDING_WINDOWS.lock().drain(..).collect::<Vec<_>>();
        for pending_window in pending {
            match create_window_in_loop(pending_window.id, &pending_window.options, &event_loop) {
                Ok(state) => {
                    if let Some(url) = &pending_window.url {
                        let _ = state.webview.load_url(url);
                    }
                    if let Some(html) = &pending_window.html {
                        let encoded = urlencoding::encode(html);
                        let _ = state.webview.load_url(&format!("data:text/html,{}", encoded));
                    }
                    WINDOWS.lock().insert(pending_window.id, SendWrapper::new(state));
                }
                Err(e) => {
                    eprintln!("Failed to create window {}: {}", pending_window.id, e);
                }
            }
        }
    }

    *EVENT_LOOP.lock() = Some(SendWrapper::new(event_loop));
    Ok(())
}

/// Result of pumping events
#[napi(object)]
pub struct PumpResult {
    pub should_quit: bool,
    pub messages: Vec<IpcMessage>,
}

/// Pump events (non-blocking) - returns pending IPC messages
#[napi]
#[cfg(target_os = "linux")]
pub fn pump_events() -> Result<PumpResult> {
    use std::sync::atomic::Ordering;

    let messages = PENDING_IPC.lock().drain(..).collect::<Vec<_>>();

    // Process GTK events without blocking
    while gtk::events_pending() {
        gtk::main_iteration();
    }

    // Process any new pending window creations
    if let Some(event_loop_wrapper) = EVENT_LOOP.lock().as_ref() {
        let pending = PENDING_WINDOWS.lock().drain(..).collect::<Vec<_>>();
        for pending_window in pending {
            // Note: This is tricky - we can't easily create windows outside of run/run_return
            // For now, we'll skip this and require windows to be created before init_event_loop
            eprintln!("Warning: Cannot create window after event loop started in pump mode");
        }
    }

    Ok(PumpResult {
        should_quit: SHOULD_QUIT.load(Ordering::SeqCst) || WINDOWS.lock().is_empty(),
        messages,
    })
}

#[napi]
#[cfg(not(target_os = "linux"))]
pub fn pump_events() -> Result<PumpResult> {
    let messages = PENDING_IPC.lock().drain(..).collect::<Vec<_>>();
    Ok(PumpResult {
        should_quit: WINDOWS.lock().is_empty(),
        messages,
    })
}

/// Run the event loop (blocking) - legacy API
/// This creates windows and runs the main loop
#[napi]
pub fn run_event_loop() -> Result<()> {
    #[cfg(target_os = "linux")]
    let event_loop = {
        use tao::platform::unix::EventLoopBuilderExtUnix;
        EventLoopBuilder::new()
            .with_app_id("com.bunlet.app")
            .build()
    };

    #[cfg(not(target_os = "linux"))]
    let event_loop = EventLoopBuilder::new().build();

    let mut window_all_closed_emitted = false;

    // Process any pending window creations
    {
        let pending = PENDING_WINDOWS.lock().drain(..).collect::<Vec<_>>();
        for pending_window in pending {
            match create_window_in_loop(pending_window.id, &pending_window.options, &event_loop) {
                Ok(state) => {
                    if let Some(url) = &pending_window.url {
                        let _ = state.webview.load_url(url);
                    }
                    if let Some(html) = &pending_window.html {
                        let encoded = urlencoding::encode(html);
                        let _ = state.webview.load_url(&format!("data:text/html,{}", encoded));
                    }
                    WINDOWS.lock().insert(pending_window.id, SendWrapper::new(state));
                    window_all_closed_emitted = false;
                }
                Err(e) => {
                    eprintln!("Failed to create window {}: {}", pending_window.id, e);
                }
            }
        }
    }

    event_loop.run(move |event, event_loop, control_flow| {
        *control_flow = ControlFlow::Wait;

        // Process pending window creations
        {
            let pending = PENDING_WINDOWS.lock().drain(..).collect::<Vec<_>>();
            for pending_window in pending {
                match create_window_in_loop(pending_window.id, &pending_window.options, event_loop) {
                    Ok(state) => {
                        if let Some(url) = &pending_window.url {
                            let _ = state.webview.load_url(url);
                        }
                        if let Some(html) = &pending_window.html {
                            let encoded = urlencoding::encode(html);
                            let _ = state.webview.load_url(&format!("data:text/html,{}", encoded));
                        }
                        WINDOWS.lock().insert(pending_window.id, SendWrapper::new(state));
                        window_all_closed_emitted = false;
                    }
                    Err(e) => {
                        eprintln!("Failed to create window {}: {}", pending_window.id, e);
                    }
                }
            }
        }

        match event {
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                window_id,
                ..
            } => {
                let mut windows = WINDOWS.lock();
                let id_to_remove = windows.iter().find_map(|(id, state)| {
                    if state.tao_window_id == window_id {
                        Some(*id)
                    } else {
                        None
                    }
                });

                if let Some(id) = id_to_remove {
                    windows.remove(&id);
                }

                if windows.is_empty() {
                    if !window_all_closed_emitted {
                        dispatch_app_event("window-all-closed");
                        window_all_closed_emitted = true;
                    }
                    *control_flow = ControlFlow::Exit;
                }
            }
            Event::WindowEvent {
                event: WindowEvent::Destroyed,
                ..
            } => {
                let windows = WINDOWS.lock();
                if windows.is_empty() {
                    if !window_all_closed_emitted {
                        dispatch_app_event("window-all-closed");
                        window_all_closed_emitted = true;
                    }
                    *control_flow = ControlFlow::Exit;
                }
            }
            _ => {}
        }
    });
}
