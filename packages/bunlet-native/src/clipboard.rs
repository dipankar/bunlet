//! Clipboard API for Bunlet
//!
//! Provides cross-platform clipboard operations using the `arboard` crate.

use arboard::Clipboard;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use once_cell::sync::Lazy;
use parking_lot::Mutex;

/// Global clipboard instance (thread-safe)
static CLIPBOARD: Lazy<Mutex<Option<Clipboard>>> = Lazy::new(|| {
    Mutex::new(Clipboard::new().ok())
});

/// Read text from the clipboard
#[napi]
pub fn clipboard_read_text() -> Result<String> {
    let mut clipboard_guard = CLIPBOARD.lock();
    let clipboard = clipboard_guard
        .as_mut()
        .ok_or_else(|| Error::new(Status::GenericFailure, "Clipboard not available"))?;

    clipboard
        .get_text()
        .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to read clipboard: {}", e)))
}

/// Write text to the clipboard
#[napi]
pub fn clipboard_write_text(text: String) -> Result<()> {
    let mut clipboard_guard = CLIPBOARD.lock();
    let clipboard = clipboard_guard
        .as_mut()
        .ok_or_else(|| Error::new(Status::GenericFailure, "Clipboard not available"))?;

    clipboard
        .set_text(text)
        .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to write to clipboard: {}", e)))
}

/// Clear the clipboard
#[napi]
pub fn clipboard_clear() -> Result<()> {
    let mut clipboard_guard = CLIPBOARD.lock();
    let clipboard = clipboard_guard
        .as_mut()
        .ok_or_else(|| Error::new(Status::GenericFailure, "Clipboard not available"))?;

    clipboard
        .clear()
        .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to clear clipboard: {}", e)))
}

/// Check if clipboard has text content
#[napi]
pub fn clipboard_has_text() -> bool {
    let mut clipboard_guard = CLIPBOARD.lock();
    if let Some(clipboard) = clipboard_guard.as_mut() {
        clipboard.get_text().is_ok()
    } else {
        false
    }
}
