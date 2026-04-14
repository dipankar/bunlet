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
use tray_icon::{Icon, MouseButton, TrayIcon, TrayIconBuilder, TrayIconEvent};

/// Tray ID counter
static TRAY_COUNTER: AtomicU32 = AtomicU32::new(1);

/// Active tray icons (wrapped in SendWrapper for thread safety)
static TRAYS: Lazy<Mutex<HashMap<u32, SendWrapper<TrayIcon>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Map tray native ID to our ID (unused but kept for future menu integration)
#[allow(dead_code)]
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
    std::thread::spawn(|| loop {
        if let Ok(event) = TrayIconEvent::receiver().recv() {
            // Get the event's native tray icon ID
            let event_native_id = match &event {
                TrayIconEvent::Click { id, .. } => id.clone(),
                TrayIconEvent::DoubleClick { id, .. } => id.clone(),
                TrayIconEvent::Enter { id, .. } => id.clone(),
                TrayIconEvent::Move { id, .. } => id.clone(),
                TrayIconEvent::Leave { id, .. } => id.clone(),
                _ => continue, // Unknown event type, skip
            };

            let trays = TRAYS.lock();

            // Find which of our trays matches this event
            for (&tray_id, tray) in trays.iter() {
                if *tray.id() == event_native_id {
                    let (event_type, x, y) = match &event {
                        TrayIconEvent::Click {
                            button, position, ..
                        } => {
                            #[allow(unreachable_patterns)]
                            let etype = match button {
                                MouseButton::Left => "click",
                                MouseButton::Right => "right-click",
                                MouseButton::Middle => "middle-click",
                                _ => "click",
                            };
                            (etype, position.x, position.y)
                        }
                        TrayIconEvent::DoubleClick { position, .. } => {
                            ("double-click", position.x, position.y)
                        }
                        TrayIconEvent::Enter { position, .. } => ("enter", position.x, position.y),
                        TrayIconEvent::Move { position, .. } => ("move", position.x, position.y),
                        TrayIconEvent::Leave { position, .. } => ("leave", position.x, position.y),
                        _ => continue,
                    };

                    if let Some(callback) = TRAY_CALLBACK.lock().as_ref() {
                        callback.call(
                            TrayEventData {
                                tray_id,
                                event_type: event_type.to_string(),
                                x,
                                y,
                            },
                            ThreadsafeFunctionCallMode::NonBlocking,
                        );
                    }
                    break;
                }
            }
            drop(trays);
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
        .map_err(|e| {
            Error::new(
                Status::GenericFailure,
                format!("Failed to create tray: {}", e),
            )
        })?;

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
        .map_err(|e| {
            Error::new(
                Status::GenericFailure,
                format!("Failed to create tray: {}", e),
            )
        })?;

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

/// Set the tray menu
///
/// Attaches a muda menu to a tray icon. The menu will appear when
/// the tray icon is clicked (behavior varies by platform — on some
/// platforms the menu appears on right-click, on others on left-click).
///
/// Note: the menu is removed from the menu registry after being attached
/// to the tray, as it becomes owned by the tray icon.
#[napi]
pub fn set_tray_menu(tray_id: u32, menu_id: u32) -> Result<()> {
    // Remove the menu from the global registry so we can take ownership
    let menu = {
        let mut menus = crate::menu::MENUS.lock();
        menus
            .remove(&menu_id)
            .ok_or_else(|| Error::new(Status::InvalidArg, "Menu not found"))?
    };

    // Take the inner MudaMenu out of the SendWrapper.
    // This must be called on the same thread that created the menu,
    // which is guaranteed since NAPI callbacks run on the main thread.
    let menu_inner: tray_icon::menu::Menu = menu.take();

    // Set the menu on the tray icon
    let trays = TRAYS.lock();
    let tray = trays
        .get(&tray_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, "Tray not found"))?;

    tray.set_menu(Some(Box::new(menu_inner)));

    Ok(())
}

/// Tray bounds (integer positions)
#[napi(object)]
pub struct TrayBounds {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
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
        x: rect.map(|r| r.position.x as i32).unwrap_or(0),
        y: rect.map(|r| r.position.y as i32).unwrap_or(0),
        width: rect.map(|r| r.size.width as i32).unwrap_or(0),
        height: rect.map(|r| r.size.height as i32).unwrap_or(0),
    })
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
