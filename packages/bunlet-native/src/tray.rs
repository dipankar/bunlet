//! Tray API for Bunlet
//!
//! Provides cross-platform system tray icons using the `tray-icon` crate.

use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use send_wrapper::SendWrapper;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use tray_icon::{Icon, TrayIcon, TrayIconBuilder, TrayIconEvent};

/// Tray ID counter
static TRAY_COUNTER: AtomicU32 = AtomicU32::new(1);

/// Active tray icons (wrapped in SendWrapper for thread safety)
static TRAYS: Lazy<Mutex<HashMap<u32, SendWrapper<TrayIcon>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Map tray native ID to our ID
static TRAY_ID_MAP: Lazy<Mutex<HashMap<u32, u32>>> = Lazy::new(|| Mutex::new(HashMap::new()));

/// Tray event callback
static TRAY_CALLBACK: Lazy<Mutex<Option<ThreadsafeFunction<TrayEventData, ErrorStrategy::Fatal>>>> =
    Lazy::new(|| Mutex::new(None));

/// Tray event data
#[napi(object)]
pub struct TrayEventData {
    pub tray_id: u32,
    /// Event type: 'click', 'right-click', 'double-click'
    pub event_type: String,
    /// Mouse x position
    pub x: f64,
    /// Mouse y position
    pub y: f64,
}

/// Initialize tray event listener
#[napi]
pub fn init_tray_events() {
    std::thread::spawn(|| {
        loop {
            if let Ok(event) = TrayIconEvent::receiver().recv() {
                // Find which tray this event belongs to by matching the native ID
                let trays = TRAYS.lock();
                let id_map = TRAY_ID_MAP.lock();

                for (&tray_id, tray) in trays.iter() {
                    if tray.id() == event.id() {
                        // Default to "click" - tray-icon v0.14 uses simpler events
                        let event_type = "click";

                        if let Some(callback) = TRAY_CALLBACK.lock().as_ref() {
                            callback.call(
                                TrayEventData {
                                    tray_id,
                                    event_type: event_type.to_string(),
                                    x: 0.0, // Position not available in v0.14
                                    y: 0.0,
                                },
                                ThreadsafeFunctionCallMode::NonBlocking,
                            );
                        }
                        break;
                    }
                }
                drop(trays);
                drop(id_map);
            }
        }
    });
}

/// Set the tray event callback
#[napi]
pub fn set_tray_callback(callback: ThreadsafeFunction<TrayEventData, ErrorStrategy::Fatal>) {
    let mut cb = TRAY_CALLBACK.lock();
    *cb = Some(callback);
}

/// Load an icon from a file path
fn load_icon(path: &str) -> Option<Icon> {
    // Try to load the image file
    let image = image::open(path).ok()?;
    let rgba = image.to_rgba8();
    let (width, height) = rgba.dimensions();

    Icon::from_rgba(rgba.into_raw(), width, height).ok()
}

/// Create a tray icon
#[napi]
pub fn create_tray(icon_path: String) -> Result<u32> {
    let id = TRAY_COUNTER.fetch_add(1, Ordering::SeqCst);

    let icon = load_icon(&icon_path)
        .ok_or_else(|| Error::new(Status::GenericFailure, "Failed to load tray icon"))?;

    let tray = TrayIconBuilder::new()
        .with_icon(icon)
        .build()
        .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to create tray: {}", e)))?;

    TRAYS.lock().insert(id, SendWrapper::new(tray));
    Ok(id)
}

/// Create a tray icon with a tooltip
#[napi]
pub fn create_tray_with_tooltip(icon_path: String, tooltip: String) -> Result<u32> {
    let id = TRAY_COUNTER.fetch_add(1, Ordering::SeqCst);

    let icon = load_icon(&icon_path)
        .ok_or_else(|| Error::new(Status::GenericFailure, "Failed to load tray icon"))?;

    let tray = TrayIconBuilder::new()
        .with_icon(icon)
        .with_tooltip(&tooltip)
        .build()
        .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to create tray: {}", e)))?;

    TRAYS.lock().insert(id, SendWrapper::new(tray));
    Ok(id)
}

/// Set the tray icon
#[napi]
pub fn set_tray_icon(tray_id: u32, icon_path: String) -> Result<()> {
    let trays = TRAYS.lock();
    let tray = trays
        .get(&tray_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, "Tray not found"))?;

    let icon = load_icon(&icon_path)
        .ok_or_else(|| Error::new(Status::GenericFailure, "Failed to load icon"))?;

    tray.set_icon(Some(icon))
        .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))
}

/// Set the tray tooltip
#[napi]
pub fn set_tray_tooltip(tray_id: u32, tooltip: String) -> Result<()> {
    let trays = TRAYS.lock();
    let tray = trays
        .get(&tray_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, "Tray not found"))?;

    tray.set_tooltip(Some(&tooltip))
        .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))
}

/// Set the tray title (macOS only)
#[napi]
pub fn set_tray_title(tray_id: u32, title: String) -> Result<()> {
    let trays = TRAYS.lock();
    let tray = trays
        .get(&tray_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, "Tray not found"))?;

    tray.set_title(Some(&title));
    Ok(())
}

/// Set the tray menu (uses muda menu ID)
#[napi]
pub fn set_tray_menu(_tray_id: u32, _menu_id: u32) -> Result<()> {
    // Integration with muda menus would require more work
    // The tray-icon crate has its own menu system
    // For now, return Ok but don't actually set the menu
    Ok(())
}

/// Get tray bounds
#[napi]
pub fn get_tray_bounds(tray_id: u32) -> Result<TrayBounds> {
    let trays = TRAYS.lock();
    let tray = trays
        .get(&tray_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, "Tray not found"))?;

    let rect = tray.rect();
    Ok(TrayBounds {
        x: rect.map(|r| r.position.x as f64).unwrap_or(0.0),
        y: rect.map(|r| r.position.y as f64).unwrap_or(0.0),
        width: rect.map(|r| r.size.width as f64).unwrap_or(0.0),
        height: rect.map(|r| r.size.height as f64).unwrap_or(0.0),
    })
}

/// Tray bounds
#[napi(object)]
pub struct TrayBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Destroy a tray icon
#[napi]
pub fn destroy_tray(tray_id: u32) -> bool {
    TRAYS.lock().remove(&tray_id).is_some()
}

/// Check if a tray is destroyed
#[napi]
pub fn is_tray_destroyed(tray_id: u32) -> bool {
    !TRAYS.lock().contains_key(&tray_id)
}
