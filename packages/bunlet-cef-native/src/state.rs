//! Global state for the CEF backend

use napi::threadsafe_function::ErrorStrategy;
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};

use napi::threadsafe_function::ThreadsafeFunction;

use crate::WindowOptions;

pub static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(1);

/// CEF process state
pub struct CefState {
    pub initialized: bool,
    pub window_to_browser: HashMap<u32, u32>,
    pub browser_to_window: HashMap<u32, u32>,
    pub preload_scripts: HashMap<u32, String>,
    pub devtools_open: HashMap<u32, bool>,
    pub user_agent: Option<String>,
    pub open_devtools_by_default: bool,
}

impl Default for CefState {
    fn default() -> Self {
        Self {
            initialized: false,
            window_to_browser: HashMap::new(),
            browser_to_window: HashMap::new(),
            preload_scripts: HashMap::new(),
            devtools_open: HashMap::new(),
            user_agent: None,
            open_devtools_by_default: false,
        }
    }
}

pub static CEF_STATE: Lazy<Mutex<CefState>> = Lazy::new(|| Mutex::new(CefState::default()));

pub static PENDING_WINDOWS: Lazy<Mutex<Vec<PendingWindow>>> = Lazy::new(|| Mutex::new(Vec::new()));

pub struct PendingWindow {
    pub id: u32,
    pub options: WindowOptions,
    pub url: Option<String>,
    pub html: Option<String>,
}

pub fn next_window_id() -> u32 {
    WINDOW_COUNTER.fetch_add(1, Ordering::SeqCst)
}

pub fn ensure_cef_initialized() -> Result<(), napi::Error> {
    let mut state = CEF_STATE.lock();
    if state.initialized {
        return Ok(());
    }

    // Load the CEF framework library before any other CEF calls.
    // On macOS, this calls cef_load_library() with the path to the
    // Chromium Embedded Framework.framework.
    #[cfg(target_os = "macos")]
    {
        use std::ffi::CString;
        use std::os::unix::ffi::OsStrExt;

        let cef_dir = cef::sys::get_cef_dir().ok_or_else(|| {
            napi::Error::new(
                napi::Status::GenericFailure,
                "CEF directory not found. Set CEF_PATH environment variable to the directory \
                 containing the CEF binary distribution (e.g., the folder with \
                 cef_macos_aarch64/Chromium Embedded Framework.framework)."
                    .to_string(),
            )
        })?;

        let framework_path = cef_dir
            .join(cef::sys::FRAMEWORK_PATH)
            .canonicalize()
            .map_err(|e| {
                napi::Error::new(
                    napi::Status::GenericFailure,
                    format!(
                        "CEF framework not found at {}: {}",
                        cef_dir.join(cef::sys::FRAMEWORK_PATH).display(),
                        e
                    ),
                )
            })?;

        let framework_cstr = CString::new(framework_path.as_os_str().as_bytes()).map_err(|e| {
            napi::Error::new(
                napi::Status::GenericFailure,
                format!("Invalid framework path: {}", e),
            )
        })?;

        let loaded = unsafe { cef::load_library(Some(&*framework_cstr.as_ptr())) };
        if loaded != 1 {
            return Err(napi::Error::new(
                napi::Status::GenericFailure,
                format!(
                    "Failed to load CEF framework from {}. Ensure the CEF binary distribution \
                     is installed and CEF_PATH is set correctly.",
                    framework_path.display()
                ),
            ));
        }
        log::info!("Loaded CEF framework from {}", framework_path.display());
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(cef_path) = std::env::var("CEF_PATH") {
            log::info!("Using CEF_PATH: {}", cef_path);
        }
    }

    log::info!("Initializing CEF...");
    let main_args = cef::args::Args::new();

    let mut settings = cef::Settings::default();
    settings.no_sandbox = 1;
    settings.multi_threaded_message_loop = 0;
    settings.windowless_rendering_enabled = 0;

    // Set browser_subprocess_path to the helper executable.
    // The helper binary sits alongside the .node addon in the @bunlet/cef package.
    // At runtime, we locate it relative to the current module.
    if let Ok(module_dir) = std::env::var("BUNLET_CEF_MODULE_DIR") {
        let helper_path = std::path::PathBuf::from(module_dir).join("bunlet-cef-helper");
        if helper_path.exists() {
            settings.browser_subprocess_path =
                cef::CefString::from(helper_path.to_string_lossy().as_ref());
            log::info!("Helper subprocess: {}", helper_path.display());
        } else {
            log::warn!("Helper not found at {}", helper_path.display());
        }
    } else {
        // Try to find the helper relative to the current executable
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                // Try multiple locations
                let search_paths = vec![
                    exe_dir.join("bunlet-cef-helper"),
                    exe_dir.join("..").join("bunlet-cef-helper"),
                    exe_dir.join("..").join("..").join("bunlet-cef-helper"),
                ];
                for path in &search_paths {
                    if let Ok(canonical) = path.canonicalize() {
                        if canonical.exists() {
                            settings.browser_subprocess_path =
                                cef::CefString::from(canonical.to_string_lossy().as_ref());
                            log::info!("Helper subprocess: {}", canonical.display());
                            break;
                        }
                    }
                }
            }
        }
    }

    // Set framework_dir_path so CEF can find the Chromium Embedded Framework
    #[cfg(target_os = "macos")]
    {
        if let Some(cef_dir) = cef::sys::get_cef_dir() {
            settings.framework_dir_path = cef::CefString::from(cef_dir.to_string_lossy().as_ref());
            log::info!("Framework dir: {}", cef_dir.display());
        }
    }

    if let Some(cache_dir) = dirs_next::cache_dir() {
        let cache_path = cache_dir.join("bunlet-cef");
        settings.cache_path = cef::CefString::from(cache_path.to_string_lossy().as_ref());
    }

    settings.log_severity = cef::LogSeverity::DISABLE;

    log::info!("Creating CefApp and initializing...");
    let mut app = crate::app_handler::BunletCefApp::new();

    let main_args_ref = main_args.as_main_args();

    let result = cef::initialize(
        Some(&main_args_ref),
        Some(&settings),
        Some(&mut app),
        std::ptr::null_mut(),
    );

    if result != 1 {
        return Err(napi::Error::new(
            napi::Status::GenericFailure,
            format!(
                "CEF initialization failed with code {}. \
                 Make sure the CEF runtime is installed. \
                 Set the CEF_PATH environment variable to the directory containing \
                 the CEF shared libraries.",
                result
            ),
        ));
    }

    state.initialized = true;
    Ok(())
}

pub fn process_pending_windows() {
    let pending: Vec<PendingWindow> = PENDING_WINDOWS.lock().drain(..).collect();
    for pw in pending {
        if let Err(e) = crate::browser::cef_create_browser(
            pw.id,
            &pw.options,
            pw.url.as_deref(),
            pw.html.as_deref(),
        ) {
            log::error!("Failed to create window {}: {}", pw.id, e);
        }
    }
}

pub fn dispatch_app_event(event: &str) {
    let callback: Option<ThreadsafeFunction<crate::AppEvent, ErrorStrategy::Fatal>> =
        APP_EVENT_CALLBACK.lock().clone();
    if let Some(callback) = callback.as_ref() {
        callback.call(
            crate::AppEvent {
                event: event.to_string(),
                window_id: None,
                title: None,
                url: None,
                bounds: None,
            },
            napi::threadsafe_function::ThreadsafeFunctionCallMode::NonBlocking,
        );
    }
}

pub fn dispatch_window_event(event: &str, window_id: u32) {
    let callback: Option<ThreadsafeFunction<crate::AppEvent, ErrorStrategy::Fatal>> =
        APP_EVENT_CALLBACK.lock().clone();
    if let Some(callback) = callback.as_ref() {
        callback.call(
            crate::AppEvent {
                event: event.to_string(),
                window_id: Some(window_id),
                title: None,
                url: None,
                bounds: None,
            },
            napi::threadsafe_function::ThreadsafeFunctionCallMode::NonBlocking,
        );
    }
}

pub fn dispatch_title_event(event: &str, window_id: u32, title: &str) {
    let callback: Option<ThreadsafeFunction<crate::AppEvent, ErrorStrategy::Fatal>> =
        APP_EVENT_CALLBACK.lock().clone();
    if let Some(callback) = callback.as_ref() {
        callback.call(
            crate::AppEvent {
                event: event.to_string(),
                window_id: Some(window_id),
                title: Some(title.to_string()),
                url: None,
                bounds: None,
            },
            napi::threadsafe_function::ThreadsafeFunctionCallMode::NonBlocking,
        );
    }
}

pub fn dispatch_navigation_event(event: &str, window_id: u32, url: Option<&str>) {
    let callback: Option<ThreadsafeFunction<crate::AppEvent, ErrorStrategy::Fatal>> =
        APP_EVENT_CALLBACK.lock().clone();
    if let Some(callback) = callback.as_ref() {
        callback.call(
            crate::AppEvent {
                event: event.to_string(),
                window_id: Some(window_id),
                title: None,
                url: url.map(|s| s.to_string()),
                bounds: None,
            },
            napi::threadsafe_function::ThreadsafeFunctionCallMode::NonBlocking,
        );
    }
}

// IPC pending messages (used for pump_events mode)
pub static PENDING_IPC: Lazy<Mutex<Vec<crate::IpcMessage>>> = Lazy::new(|| Mutex::new(Vec::new()));

pub static IPC_CALLBACK: Lazy<
    Mutex<Option<ThreadsafeFunction<crate::IpcMessage, ErrorStrategy::Fatal>>>,
> = Lazy::new(|| Mutex::new(None));

pub static APP_EVENT_CALLBACK: Lazy<
    Mutex<Option<ThreadsafeFunction<crate::AppEvent, ErrorStrategy::Fatal>>>,
> = Lazy::new(|| Mutex::new(None));
