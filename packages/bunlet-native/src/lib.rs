#![deny(clippy::all)]

mod clipboard;
mod dialog;
mod event_loop;
mod file_watcher;
mod ipc;
mod menu;
mod notification;
mod power_monitor;
mod runtime_state;
mod screen;
mod session;
mod shell;
mod shortcuts;
mod tray;
mod window;

use napi::bindgen_prelude::*;
use napi_derive::napi;
use tao::event_loop::EventLoopWindowTarget;


pub use clipboard::*;
pub use dialog::*;
pub use event_loop::*;
pub use file_watcher::*;
pub use ipc::*;
pub use menu::*;
pub use notification::*;
pub use power_monitor::*;
pub use runtime_state::*;
pub use screen::*;
pub use session::*;
pub use shell::*;
pub use shortcuts::*;
pub use tray::*;
pub use window::*;

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

fn build_initialization_script(options: &WindowOptions) -> std::result::Result<String, String> {
    let mut script = r#"
        // Bunlet IPC bridge
        window.__bunlet = {
            _handlers: [],
            _channelListeners: {},
            _pending: {},
            _nextId: 1,
            _titleObserverInstalled: false,
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
            },
            _emitInternalWindowEvent: function(event, extra) {
                try {
                    window.ipc.postMessage(JSON.stringify(Object.assign({
                        type: '__bunlet_internal_window_event',
                        event,
                        title: document.title,
                        url: window.location.href
                    }, extra || {})));
                } catch (_) {}
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

        (function registerBunletWindowObservers() {
            function emitNavigation() {
                window.__bunlet._emitInternalWindowEvent('web-contents-navigation', {
                    title: document.title,
                    url: window.location.href
                });
            }

            function emitPageTitle() {
                window.__bunlet._emitInternalWindowEvent('web-contents-title-updated', {
                    title: document.title
                });
            }

            function installTitleObserver() {
                if (window.__bunlet._titleObserverInstalled || typeof MutationObserver !== 'function') {
                    return;
                }

                var target = document.querySelector('title') || document.head || document.documentElement;
                if (!target) {
                    return;
                }

                window.__bunlet._titleObserverInstalled = true;
                var observer = new MutationObserver(function() {
                    emitPageTitle();
                });
                observer.observe(target, { childList: true, characterData: true, subtree: true });
            }

            var originalPushState = history.pushState;
            if (typeof originalPushState === 'function') {
                history.pushState = function() {
                    var result = originalPushState.apply(this, arguments);
                    emitNavigation();
                    return result;
                };
            }

            var originalReplaceState = history.replaceState;
            if (typeof originalReplaceState === 'function') {
                history.replaceState = function() {
                    var result = originalReplaceState.apply(this, arguments);
                    emitNavigation();
                    return result;
                };
            }

            window.addEventListener('popstate', emitNavigation);
            window.addEventListener('hashchange', emitNavigation);
            window.addEventListener('load', function() {
                installTitleObserver();
                emitNavigation();
                emitPageTitle();
            });

            document.addEventListener('readystatechange', function() {
                if (document.readyState === 'interactive' || document.readyState === 'complete') {
                    installTitleObserver();
                    emitNavigation();
                    emitPageTitle();
                }
            });

            if (document.readyState !== 'loading') {
                installTitleObserver();
                emitNavigation();
                emitPageTitle();
            }
        })();
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
    #[cfg(target_os = "linux")]
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
