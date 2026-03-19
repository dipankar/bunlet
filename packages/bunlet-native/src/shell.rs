//! Shell API for Bunlet
//!
//! Provides cross-platform shell operations like opening URLs,
//! files, and showing items in folder.

use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::path::Path;
use std::process::Command;

/// Open a URL in the default browser
#[napi]
pub async fn shell_open_external(url: String) -> Result<()> {
    open_url(&url).map_err(|e| Error::new(Status::GenericFailure, e))
}

/// Open a file or directory with the default application
#[napi]
pub async fn shell_open_path(path: String) -> Result<String> {
    open_path(&path).map_err(|e| Error::new(Status::GenericFailure, e))?;
    Ok(String::new())
}

/// Show an item in the file manager (Finder/Explorer/Files)
#[napi]
pub fn shell_show_item_in_folder(full_path: String) -> Result<()> {
    show_in_folder(&full_path).map_err(|e| Error::new(Status::GenericFailure, e))
}

/// Move an item to the trash
#[napi]
pub async fn shell_trash_item(path: String) -> Result<()> {
    trash_file(&path).map_err(|e| Error::new(Status::GenericFailure, e))
}

/// Play the system beep sound
#[napi]
pub fn shell_beep() {
    beep();
}

// Platform-specific implementations

#[cfg(target_os = "macos")]
fn open_url(url: &str) -> std::result::Result<(), String> {
    Command::new("open")
        .arg(url)
        .spawn()
        .map_err(|e| format!("Failed to open URL: {}", e))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn open_url(url: &str) -> std::result::Result<(), String> {
    Command::new("xdg-open")
        .arg(url)
        .spawn()
        .map_err(|e| format!("Failed to open URL: {}", e))?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn open_url(url: &str) -> std::result::Result<(), String> {
    Command::new("cmd")
        .args(["/c", "start", "", url])
        .spawn()
        .map_err(|e| format!("Failed to open URL: {}", e))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn open_path(path: &str) -> std::result::Result<(), String> {
    Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|e| format!("Failed to open path: {}", e))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn open_path(path: &str) -> std::result::Result<(), String> {
    Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map_err(|e| format!("Failed to open path: {}", e))?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn open_path(path: &str) -> std::result::Result<(), String> {
    Command::new("cmd")
        .args(["/c", "start", "", path])
        .spawn()
        .map_err(|e| format!("Failed to open path: {}", e))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn show_in_folder(path: &str) -> std::result::Result<(), String> {
    Command::new("open")
        .args(["-R", path])
        .spawn()
        .map_err(|e| format!("Failed to show in folder: {}", e))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn show_in_folder(path: &str) -> std::result::Result<(), String> {
    // Try to use dbus to select the file in the file manager
    let parent = Path::new(path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string());

    // First try nautilus with file selection
    let result = Command::new("nautilus")
        .args(["--select", path])
        .spawn();

    if result.is_ok() {
        return Ok(());
    }

    // Fall back to just opening the parent directory
    Command::new("xdg-open")
        .arg(&parent)
        .spawn()
        .map_err(|e| format!("Failed to show in folder: {}", e))?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn show_in_folder(path: &str) -> std::result::Result<(), String> {
    Command::new("explorer")
        .args(["/select,", path])
        .spawn()
        .map_err(|e| format!("Failed to show in folder: {}", e))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn trash_file(path: &str) -> std::result::Result<(), String> {
    // Use AppleScript to move to trash (preserves undo)
    Command::new("osascript")
        .args([
            "-e",
            &format!(
                "tell application \"Finder\" to delete POSIX file \"{}\"",
                path.replace('\"', "\\\"")
            ),
        ])
        .output()
        .map_err(|e| format!("Failed to trash file: {}", e))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn trash_file(path: &str) -> std::result::Result<(), String> {
    // Try gio trash first (GNOME)
    let result = Command::new("gio")
        .args(["trash", path])
        .output();

    if result.is_ok() {
        return Ok(());
    }

    // Fall back to trash-cli
    let result = Command::new("trash-put")
        .arg(path)
        .output();

    if result.is_ok() {
        return Ok(());
    }

    // Last resort: kioclient (KDE)
    Command::new("kioclient")
        .args(["move", path, "trash:/"])
        .output()
        .map_err(|e| format!("Failed to trash file: {}", e))?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn trash_file(path: &str) -> std::result::Result<(), String> {
    // Use PowerShell to move to recycle bin
    Command::new("powershell")
        .args([
            "-Command",
            &format!(
                "$shell = New-Object -ComObject Shell.Application; $shell.NameSpace(0).ParseName('{}').InvokeVerb('delete')",
                path.replace('\'', "''")
            ),
        ])
        .output()
        .map_err(|e| format!("Failed to trash file: {}", e))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn beep() {
    // Use NSBeep via command
    let _ = Command::new("osascript")
        .args(["-e", "beep"])
        .output();
}

#[cfg(target_os = "linux")]
fn beep() {
    // Try paplay first, then fall back to printf
    let result = Command::new("paplay")
        .arg("/usr/share/sounds/freedesktop/stereo/bell.oga")
        .output();

    if result.is_err() {
        // Fall back to terminal bell
        print!("\x07");
    }
}

#[cfg(target_os = "windows")]
fn beep() {
    // Use Windows MessageBeep
    let _ = Command::new("cmd")
        .args(["/c", "echo \x07"])
        .output();
}
