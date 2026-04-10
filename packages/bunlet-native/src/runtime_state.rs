use once_cell::sync::Lazy;
use parking_lot::Mutex;
use send_wrapper::SendWrapper;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use tao::window::{Window, WindowId};

use crate::WindowOptions;

// Global state
pub static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(1);
pub static WINDOWS: Lazy<Mutex<HashMap<u32, SendWrapper<WindowState>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

// Pending window creations (for async window creation from main thread)
pub static PENDING_WINDOWS: Lazy<Mutex<Vec<PendingWindow>>> =
    Lazy::new(|| Mutex::new(Vec::new()));

// File server port tracking by base directory
pub static FILE_SERVERS: Lazy<Mutex<HashMap<String, u16>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Window state stored globally (wrapped in SendWrapper for thread safety)
pub struct WindowState {
    pub tao_window_id: WindowId,
    pub window: Window,
    pub webview: wry::WebView,
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
