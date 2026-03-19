//! File Watcher API for Bunlet
//!
//! Provides cross-platform file system watching using the `notify` crate.

use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::mpsc::channel;
use std::thread;

/// Watcher ID counter
static WATCHER_COUNTER: AtomicU32 = AtomicU32::new(1);

/// Active watchers
static WATCHERS: Lazy<Mutex<HashMap<u32, WatcherHandle>>> = Lazy::new(|| Mutex::new(HashMap::new()));

/// Global callback for file events
static FILE_WATCHER_CALLBACK: Lazy<
    Mutex<Option<ThreadsafeFunction<FileWatchEvent, ErrorStrategy::Fatal>>>,
> = Lazy::new(|| Mutex::new(None));

/// Handle to a file watcher
struct WatcherHandle {
    _watcher: RecommendedWatcher,
    // Keep the thread handle to ensure it stays alive
    _thread: Option<thread::JoinHandle<()>>,
}

/// File watch event
#[napi(object)]
#[derive(Clone)]
pub struct FileWatchEvent {
    /// Watcher ID that generated this event
    pub watcher_id: u32,
    /// Event type: 'create', 'modify', 'remove', 'rename', 'any'
    pub event_type: String,
    /// Paths affected by the event
    pub paths: Vec<String>,
}

/// Set the file watcher callback
#[napi]
pub fn set_file_watcher_callback(
    callback: ThreadsafeFunction<FileWatchEvent, ErrorStrategy::Fatal>,
) {
    let mut cb = FILE_WATCHER_CALLBACK.lock();
    *cb = Some(callback);
}

/// Watch a path for changes
/// Returns a watcher ID that can be used to stop watching
#[napi]
pub fn watch_path(path: String, recursive: Option<bool>) -> napi::Result<u32> {
    let watcher_id = WATCHER_COUNTER.fetch_add(1, Ordering::SeqCst);
    let recursive_mode = if recursive.unwrap_or(true) {
        RecursiveMode::Recursive
    } else {
        RecursiveMode::NonRecursive
    };

    // Create a channel to receive events
    let (tx, rx) = channel();

    // Create the watcher
    let mut watcher = RecommendedWatcher::new(
        move |res: Result<notify::Event, notify::Error>| {
            if let Ok(event) = res {
                let _ = tx.send(event);
            }
        },
        Config::default(),
    )
    .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))?;

    // Start watching the path
    watcher
        .watch(Path::new(&path), recursive_mode)
        .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))?;

    // Spawn a thread to process events
    let thread_watcher_id = watcher_id;
    let handle = thread::spawn(move || {
        for event in rx {
            // Convert event kind to string
            let event_type = match event.kind {
                notify::EventKind::Create(_) => "create",
                notify::EventKind::Modify(_) => "modify",
                notify::EventKind::Remove(_) => "remove",
                notify::EventKind::Access(_) => "access",
                notify::EventKind::Other => "other",
                notify::EventKind::Any => "any",
            };

            // Convert paths to strings
            let paths: Vec<String> = event
                .paths
                .iter()
                .filter_map(|p| p.to_str().map(|s| s.to_string()))
                .collect();

            // Only emit if we have paths
            if !paths.is_empty() {
                if let Some(callback) = FILE_WATCHER_CALLBACK.lock().as_ref() {
                    callback.call(
                        FileWatchEvent {
                            watcher_id: thread_watcher_id,
                            event_type: event_type.to_string(),
                            paths,
                        },
                        ThreadsafeFunctionCallMode::NonBlocking,
                    );
                }
            }
        }
    });

    // Store the watcher
    WATCHERS.lock().insert(
        watcher_id,
        WatcherHandle {
            _watcher: watcher,
            _thread: Some(handle),
        },
    );

    Ok(watcher_id)
}

/// Stop watching a path
#[napi]
pub fn unwatch(watcher_id: u32) -> bool {
    WATCHERS.lock().remove(&watcher_id).is_some()
}

/// Stop all watchers
#[napi]
pub fn unwatch_all() {
    WATCHERS.lock().clear();
}

/// Get the number of active watchers
#[napi]
pub fn get_watcher_count() -> u32 {
    WATCHERS.lock().len() as u32
}
