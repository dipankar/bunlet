#![deny(clippy::all)]

use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction};
use napi_derive::napi;
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use send_wrapper::SendWrapper;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use tao::dpi::{LogicalPosition, LogicalSize};
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoopBuilder, EventLoopWindowTarget};
use tao::window::{Window, WindowBuilder, WindowId};

// CEF scaffold runtime state
static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(1);
static WINDOWS: Lazy<Mutex<HashMap<u32, SendWrapper<WindowState>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
static PENDING_WINDOWS: Lazy<Mutex<Vec<PendingWindow>>> = Lazy::new(|| Mutex::new(Vec::new()));

static IPC_CALLBACK: Lazy<Mutex<Option<ThreadsafeFunction<IpcMessage, ErrorStrategy::Fatal>>>> =
    Lazy::new(|| Mutex::new(None));
static APP_EVENT_CALLBACK: Lazy<Mutex<Option<ThreadsafeFunction<AppEvent, ErrorStrategy::Fatal>>>> =
    Lazy::new(|| Mutex::new(None));

static WARN_NO_RENDERER: AtomicBool = AtomicBool::new(false);
static WARN_IPC_UNSUPPORTED: AtomicBool = AtomicBool::new(false);
static CLIPBOARD_TEXT: Lazy<Mutex<String>> = Lazy::new(|| Mutex::new(String::new()));

static SHORTCUT_COUNTER: AtomicU32 = AtomicU32::new(1);
static SHORTCUTS: Lazy<Mutex<HashMap<String, u32>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static SHORTCUT_CALLBACK: Lazy<Mutex<Option<ThreadsafeFunction<u32, ErrorStrategy::Fatal>>>> =
    Lazy::new(|| Mutex::new(None));

static NOTIFICATION_COUNTER: AtomicU32 = AtomicU32::new(1);
static NOTIFICATIONS: Lazy<Mutex<HashMap<u32, NotificationOptions>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
static NOTIFICATION_CALLBACK: Lazy<
    Mutex<Option<ThreadsafeFunction<NotificationEvent, ErrorStrategy::Fatal>>>,
> = Lazy::new(|| Mutex::new(None));

static MENU_COUNTER: AtomicU32 = AtomicU32::new(1);
static MENUS: Lazy<Mutex<HashMap<u32, Vec<MenuItemOptions>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
static APPLICATION_MENU: Lazy<Mutex<Option<u32>>> = Lazy::new(|| Mutex::new(None));
static MENU_CALLBACK: Lazy<Mutex<Option<ThreadsafeFunction<MenuEventData, ErrorStrategy::Fatal>>>> =
    Lazy::new(|| Mutex::new(None));

static TRAY_COUNTER: AtomicU32 = AtomicU32::new(1);
static TRAYS: Lazy<Mutex<HashMap<u32, TrayState>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static TRAY_CALLBACK: Lazy<Mutex<Option<ThreadsafeFunction<TrayEventData, ErrorStrategy::Fatal>>>> =
    Lazy::new(|| Mutex::new(None));

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
}

#[napi(object)]
pub struct WindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[napi(object)]
pub struct IpcMessage {
    pub window_id: u32,
    pub message: String,
}

#[napi(object)]
pub struct AppEvent {
    pub event: String,
}

#[napi(object)]
#[derive(Clone)]
pub struct DialogFileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

#[napi(object)]
pub struct OpenDialogOptions {
    pub title: Option<String>,
    pub default_path: Option<String>,
    pub button_label: Option<String>,
    pub filters: Option<Vec<DialogFileFilter>>,
    pub open_file: Option<bool>,
    pub open_directory: Option<bool>,
    pub multi_selections: Option<bool>,
}

#[napi(object)]
pub struct OpenDialogResult {
    pub canceled: bool,
    pub file_paths: Vec<String>,
}

#[napi(object)]
pub struct SaveDialogOptions {
    pub title: Option<String>,
    pub default_path: Option<String>,
    pub button_label: Option<String>,
    pub filters: Option<Vec<DialogFileFilter>>,
}

#[napi(object)]
pub struct SaveDialogResult {
    pub canceled: bool,
    pub file_path: Option<String>,
}

#[napi(object)]
pub struct MessageBoxOptions {
    pub message_type: Option<String>,
    pub title: Option<String>,
    pub message: String,
    pub detail: Option<String>,
    pub buttons: Option<Vec<String>>,
    pub default_id: Option<u32>,
    pub cancel_id: Option<u32>,
}

#[napi(object)]
pub struct MessageBoxResult {
    pub response: u32,
}

#[napi(object)]
#[derive(Clone)]
pub struct NotificationOptions {
    pub title: String,
    pub body: Option<String>,
    pub subtitle: Option<String>,
    pub icon: Option<String>,
    pub silent: Option<bool>,
    pub urgency: Option<String>,
    pub timeout_type: Option<String>,
}

#[napi(object)]
pub struct NotificationEvent {
    pub notification_id: u32,
    pub event_type: String,
    pub action_index: Option<u32>,
}

#[napi(object)]
#[derive(Clone)]
pub struct MenuItemOptions {
    pub id: Option<String>,
    pub label: Option<String>,
    pub enabled: Option<bool>,
    pub item_type: Option<String>,
    pub accelerator: Option<String>,
    pub checked: Option<bool>,
    pub role: Option<String>,
    pub submenu: Option<Vec<MenuItemOptions>>,
    pub callback_id: Option<u32>,
}

#[napi(object)]
pub struct MenuEventData {
    pub menu_id: u32,
    pub item_id: String,
    pub callback_id: u32,
}

#[napi(object)]
pub struct TrayEventData {
    pub tray_id: u32,
    pub event_type: String,
    pub x: i32,
    pub y: i32,
}

#[napi(object)]
pub struct TrayBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

pub struct PendingWindow {
    pub id: u32,
    pub options: WindowOptions,
    pub url: Option<String>,
    pub html: Option<String>,
}

pub struct WindowState {
    pub tao_window_id: WindowId,
    pub window: Window,
    pub current_url: Option<String>,
    pub current_html: Option<String>,
}

#[derive(Clone)]
struct TrayState {
    icon_path: String,
    tooltip: Option<String>,
    title: Option<String>,
    menu_id: Option<u32>,
}

#[napi]
pub fn init_app() -> Result<()> {
    Ok(())
}

#[napi]
pub fn quit_app() {
    std::process::exit(0);
}

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

#[napi]
pub fn get_all_window_ids() -> Vec<u32> {
    WINDOWS.lock().keys().cloned().collect()
}

#[napi]
pub fn set_ipc_handler(callback: ThreadsafeFunction<IpcMessage, ErrorStrategy::Fatal>) {
    *IPC_CALLBACK.lock() = Some(callback);
}

#[napi]
pub fn set_app_event_handler(callback: ThreadsafeFunction<AppEvent, ErrorStrategy::Fatal>) {
    *APP_EVENT_CALLBACK.lock() = Some(callback);
}

#[napi]
pub fn send_ipc_message(_window_id: u32, _message: String) -> Result<()> {
    if !WARN_IPC_UNSUPPORTED.swap(true, Ordering::SeqCst) {
        eprintln!(
            "[bunlet-cef] IPC bridge is not connected yet in the CEF scaffold backend."
        );
    }
    Ok(())
}

#[napi]
pub fn create_window(options: Option<WindowOptions>) -> u32 {
    let id = WINDOW_COUNTER.fetch_add(1, Ordering::SeqCst);
    PENDING_WINDOWS.lock().push(PendingWindow {
        id,
        options: options.unwrap_or_default(),
        url: None,
        html: None,
    });
    id
}

#[napi]
pub fn load_url(window_id: u32, url: String) -> Result<()> {
    if !WARN_NO_RENDERER.swap(true, Ordering::SeqCst) {
        eprintln!(
            "[bunlet-cef] CEF renderer process is not wired yet. Window content is not rendered."
        );
    }

    {
        let mut windows = WINDOWS.lock();
        if let Some(state) = windows.get_mut(&window_id) {
            state.current_url = Some(url);
            state.current_html = None;
            return Ok(());
        }
    }

    let mut pending = PENDING_WINDOWS.lock();
    if let Some(state) = pending.iter_mut().find(|w| w.id == window_id) {
        state.url = Some(url);
        state.html = None;
        return Ok(());
    }

    Err(Error::new(
        Status::InvalidArg,
        format!("Window {} not found", window_id),
    ))
}

#[napi]
pub fn load_file(window_id: u32, file_path: String) -> Result<()> {
    let absolute = std::path::PathBuf::from(file_path);
    let resolved = if absolute.is_absolute() {
        absolute
    } else {
        std::env::current_dir()
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?
            .join(absolute)
    };
    let as_url = format!("file://{}", resolved.to_string_lossy());
    load_url(window_id, as_url)
}

#[napi]
pub fn load_html(window_id: u32, html: String) -> Result<()> {
    if !WARN_NO_RENDERER.swap(true, Ordering::SeqCst) {
        eprintln!(
            "[bunlet-cef] CEF renderer process is not wired yet. Window content is not rendered."
        );
    }

    {
        let mut windows = WINDOWS.lock();
        if let Some(state) = windows.get_mut(&window_id) {
            state.current_url = None;
            state.current_html = Some(html);
            return Ok(());
        }
    }

    let mut pending = PENDING_WINDOWS.lock();
    if let Some(state) = pending.iter_mut().find(|w| w.id == window_id) {
        state.url = None;
        state.html = Some(html);
        return Ok(());
    }

    Err(Error::new(
        Status::InvalidArg,
        format!("Window {} not found", window_id),
    ))
}

#[napi]
pub fn show_window(window_id: u32) -> Result<()> {
    with_window(window_id, |state| {
        state.window.set_visible(true);
        Ok(())
    })
}

#[napi]
pub fn hide_window(window_id: u32) -> Result<()> {
    with_window(window_id, |state| {
        state.window.set_visible(false);
        Ok(())
    })
}

#[napi]
pub fn close_window(window_id: u32) -> Result<()> {
    let mut windows = WINDOWS.lock();
    windows
        .remove(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;
    Ok(())
}

#[napi]
pub fn focus_window(window_id: u32) -> Result<()> {
    with_window(window_id, |state| {
        state.window.set_focus();
        Ok(())
    })
}

#[napi]
pub fn maximize_window(window_id: u32) -> Result<()> {
    with_window(window_id, |state| {
        state.window.set_maximized(true);
        Ok(())
    })
}

#[napi]
pub fn minimize_window(window_id: u32) -> Result<()> {
    with_window(window_id, |state| {
        state.window.set_minimized(true);
        Ok(())
    })
}

#[napi]
pub fn restore_window(window_id: u32) -> Result<()> {
    with_window(window_id, |state| {
        state.window.set_maximized(false);
        state.window.set_minimized(false);
        Ok(())
    })
}

#[napi]
pub fn set_fullscreen(window_id: u32, fullscreen: bool) -> Result<()> {
    with_window(window_id, |state| {
        if fullscreen {
            state
                .window
                .set_fullscreen(Some(tao::window::Fullscreen::Borderless(None)));
        } else {
            state.window.set_fullscreen(None);
        }
        Ok(())
    })
}

#[napi]
pub fn get_window_bounds(window_id: u32) -> Result<WindowBounds> {
    with_window(window_id, |state| {
        let position = state.window.outer_position().unwrap_or_default();
        let size = state.window.inner_size();
        Ok(WindowBounds {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
        })
    })
}

#[napi]
pub fn set_window_bounds(
    window_id: u32,
    x: Option<i32>,
    y: Option<i32>,
    width: Option<u32>,
    height: Option<u32>,
) -> Result<()> {
    with_window(window_id, |state| {
        if let (Some(px), Some(py)) = (x, y) {
            state
                .window
                .set_outer_position(LogicalPosition::new(px as f64, py as f64));
        }
        if let (Some(w), Some(h)) = (width, height) {
            state
                .window
                .set_inner_size(LogicalSize::new(w as f64, h as f64));
        }
        Ok(())
    })
}

#[napi]
pub fn set_window_title(window_id: u32, title: String) -> Result<()> {
    with_window(window_id, |state| {
        state.window.set_title(&title);
        Ok(())
    })
}

#[napi]
pub fn set_window_always_on_top(window_id: u32, always_on_top: bool) -> Result<()> {
    with_window(window_id, |state| {
        state.window.set_always_on_top(always_on_top);
        Ok(())
    })
}

#[napi]
pub fn is_window_visible(window_id: u32) -> Result<bool> {
    with_window(window_id, |state| Ok(state.window.is_visible()))
}

#[napi]
pub fn is_window_focused(window_id: u32) -> Result<bool> {
    with_window(window_id, |state| Ok(state.window.is_focused()))
}

#[napi]
pub fn is_window_maximized(window_id: u32) -> Result<bool> {
    with_window(window_id, |state| Ok(state.window.is_maximized()))
}

#[napi]
pub fn is_window_minimized(window_id: u32) -> Result<bool> {
    with_window(window_id, |state| Ok(state.window.is_minimized()))
}

#[napi]
pub fn is_window_fullscreen(window_id: u32) -> Result<bool> {
    with_window(window_id, |state| Ok(state.window.fullscreen().is_some()))
}

#[napi]
pub fn get_focused_window_id() -> Option<u32> {
    let windows = WINDOWS.lock();
    windows.iter().find_map(|(id, state)| {
        if state.window.is_focused() {
            Some(*id)
        } else {
            None
        }
    })
}

#[napi]
pub async fn execute_java_script(_window_id: u32, _script: String) -> Result<String> {
    Err(Error::new(
        Status::GenericFailure,
        "executeJavaScript is not implemented in the CEF scaffold backend".to_string(),
    ))
}

#[napi]
pub fn run_event_loop() -> Result<()> {
    let event_loop = EventLoopBuilder::new().build();
    let mut window_all_closed_emitted = false;

    process_pending_windows(&event_loop);
    if WINDOWS.lock().is_empty() {
        dispatch_app_event("window-all-closed");
        return Ok(());
    }

    event_loop.run(move |event, event_loop_target, control_flow| {
        *control_flow = ControlFlow::Wait;
        process_pending_windows(event_loop_target);

        match event {
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                window_id,
                ..
            }
            | Event::WindowEvent {
                event: WindowEvent::Destroyed,
                window_id,
                ..
            } => {
                remove_window_by_tao_id(window_id);
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

#[napi]
pub fn open_devtools(_window_id: u32) -> Result<()> {
    Err(Error::new(
        Status::GenericFailure,
        "DevTools are not implemented in the CEF scaffold backend".to_string(),
    ))
}

#[napi]
pub fn close_devtools(_window_id: u32) -> Result<()> {
    Ok(())
}

#[napi]
pub fn toggle_devtools(_window_id: u32) -> Result<()> {
    Err(Error::new(
        Status::GenericFailure,
        "DevTools are not implemented in the CEF scaffold backend".to_string(),
    ))
}

#[napi]
pub fn is_devtools_open(_window_id: u32) -> Result<bool> {
    Ok(false)
}

// ============================================================================
// Clipboard API (scaffold)
// ============================================================================

#[napi]
pub fn clipboard_read_text() -> String {
    CLIPBOARD_TEXT.lock().clone()
}

#[napi]
pub fn clipboard_write_text(text: String) {
    *CLIPBOARD_TEXT.lock() = text;
}

#[napi]
pub fn clipboard_clear() {
    CLIPBOARD_TEXT.lock().clear();
}

#[napi]
pub fn clipboard_has_text() -> bool {
    !CLIPBOARD_TEXT.lock().is_empty()
}

// ============================================================================
// Shell API (scaffold)
// ============================================================================

#[napi]
pub async fn shell_open_external(_url: String) -> Result<()> {
    Ok(())
}

#[napi]
pub async fn shell_open_path(_path: String) -> Result<String> {
    Ok(String::new())
}

#[napi]
pub fn shell_show_item_in_folder(_full_path: String) {}

#[napi]
pub async fn shell_trash_item(_path: String) -> Result<()> {
    Ok(())
}

#[napi]
pub fn shell_beep() {}

// ============================================================================
// Dialog API (scaffold)
// ============================================================================

#[napi]
pub async fn show_open_dialog(_options: OpenDialogOptions) -> Result<OpenDialogResult> {
    Ok(OpenDialogResult {
        canceled: true,
        file_paths: Vec::new(),
    })
}

#[napi]
pub async fn show_save_dialog(_options: SaveDialogOptions) -> Result<SaveDialogResult> {
    Ok(SaveDialogResult {
        canceled: true,
        file_path: None,
    })
}

#[napi]
pub async fn show_message_box(_options: MessageBoxOptions) -> Result<MessageBoxResult> {
    Ok(MessageBoxResult { response: 0 })
}

#[napi]
pub fn show_error_box(title: String, content: String) {
    eprintln!("[bunlet-cef] {}: {}", title, content);
}

// ============================================================================
// Global Shortcuts API (scaffold)
// ============================================================================

#[napi]
pub fn init_global_shortcuts() {}

#[napi]
pub fn set_shortcut_callback(callback: ThreadsafeFunction<u32, ErrorStrategy::Fatal>) {
    *SHORTCUT_CALLBACK.lock() = Some(callback);
}

#[napi]
pub fn register_shortcut(accelerator: String) -> u32 {
    let id = SHORTCUT_COUNTER.fetch_add(1, Ordering::SeqCst);
    SHORTCUTS.lock().insert(accelerator, id);
    id
}

#[napi]
pub fn unregister_shortcut(accelerator: String) -> bool {
    SHORTCUTS.lock().remove(&accelerator).is_some()
}

#[napi]
pub fn unregister_all_shortcuts() {
    SHORTCUTS.lock().clear();
}

#[napi]
pub fn is_shortcut_registered(accelerator: String) -> bool {
    SHORTCUTS.lock().contains_key(&accelerator)
}

// ============================================================================
// Notification API (scaffold)
// ============================================================================

#[napi]
pub fn notification_is_supported() -> bool {
    false
}

#[napi]
pub fn set_notification_callback(
    callback: ThreadsafeFunction<NotificationEvent, ErrorStrategy::Fatal>,
) {
    *NOTIFICATION_CALLBACK.lock() = Some(callback);
}

#[napi]
pub fn show_notification(options: NotificationOptions) -> u32 {
    let id = NOTIFICATION_COUNTER.fetch_add(1, Ordering::SeqCst);
    NOTIFICATIONS.lock().insert(id, options);
    id
}

#[napi]
pub fn close_notification(notification_id: u32) -> bool {
    NOTIFICATIONS.lock().remove(&notification_id).is_some()
}

// ============================================================================
// Menu API (scaffold)
// ============================================================================

#[napi]
pub fn init_menu_events() {}

#[napi]
pub fn set_menu_callback(callback: ThreadsafeFunction<MenuEventData, ErrorStrategy::Fatal>) {
    *MENU_CALLBACK.lock() = Some(callback);
}

#[napi]
pub fn create_menu() -> u32 {
    let id = MENU_COUNTER.fetch_add(1, Ordering::SeqCst);
    MENUS.lock().insert(id, Vec::new());
    id
}

#[napi]
pub fn append_menu_item(menu_id: u32, options: MenuItemOptions) -> bool {
    let mut menus = MENUS.lock();
    if let Some(items) = menus.get_mut(&menu_id) {
        items.push(options);
        return true;
    }
    false
}

#[napi]
pub fn build_menu_from_template(menu_id: u32, template: Vec<MenuItemOptions>) -> bool {
    let mut menus = MENUS.lock();
    if let Some(items) = menus.get_mut(&menu_id) {
        *items = template;
        return true;
    }
    false
}

#[napi]
pub fn set_application_menu(menu_id: Option<u32>) -> bool {
    let mut app_menu = APPLICATION_MENU.lock();
    match menu_id {
        Some(id) => {
            if MENUS.lock().contains_key(&id) {
                *app_menu = Some(id);
                true
            } else {
                false
            }
        }
        None => {
            *app_menu = None;
            true
        }
    }
}

#[napi]
pub fn get_application_menu() -> Option<u32> {
    *APPLICATION_MENU.lock()
}

#[napi]
pub fn destroy_menu(menu_id: u32) -> bool {
    let removed = MENUS.lock().remove(&menu_id).is_some();
    if removed {
        let mut app_menu = APPLICATION_MENU.lock();
        if *app_menu == Some(menu_id) {
            *app_menu = None;
        }
    }
    removed
}

#[napi]
pub fn popup_menu(menu_id: u32, _window_id: u32, _x: i32, _y: i32) -> bool {
    MENUS.lock().contains_key(&menu_id)
}

// ============================================================================
// Tray API (scaffold)
// ============================================================================

#[napi]
pub fn init_tray_events() {}

#[napi]
pub fn set_tray_callback(callback: ThreadsafeFunction<TrayEventData, ErrorStrategy::Fatal>) {
    *TRAY_CALLBACK.lock() = Some(callback);
}

#[napi]
pub fn create_tray(icon_path: String) -> u32 {
    let id = TRAY_COUNTER.fetch_add(1, Ordering::SeqCst);
    TRAYS.lock().insert(
        id,
        TrayState {
            icon_path,
            tooltip: None,
            title: None,
            menu_id: None,
        },
    );
    id
}

#[napi]
pub fn create_tray_with_tooltip(icon_path: String, tooltip: String) -> u32 {
    let id = TRAY_COUNTER.fetch_add(1, Ordering::SeqCst);
    TRAYS.lock().insert(
        id,
        TrayState {
            icon_path,
            tooltip: Some(tooltip),
            title: None,
            menu_id: None,
        },
    );
    id
}

#[napi]
pub fn set_tray_icon(tray_id: u32, icon_path: String) {
    if let Some(state) = TRAYS.lock().get_mut(&tray_id) {
        state.icon_path = icon_path;
    }
}

#[napi]
pub fn set_tray_tooltip(tray_id: u32, tooltip: String) {
    if let Some(state) = TRAYS.lock().get_mut(&tray_id) {
        state.tooltip = Some(tooltip);
    }
}

#[napi]
pub fn set_tray_title(tray_id: u32, title: String) {
    if let Some(state) = TRAYS.lock().get_mut(&tray_id) {
        state.title = Some(title);
    }
}

#[napi]
pub fn set_tray_menu(tray_id: u32, menu_id: u32) {
    if let Some(state) = TRAYS.lock().get_mut(&tray_id) {
        state.menu_id = Some(menu_id);
    }
}

#[napi]
pub fn get_tray_bounds(_tray_id: u32) -> TrayBounds {
    TrayBounds {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
    }
}

#[napi]
pub fn destroy_tray(tray_id: u32) -> bool {
    TRAYS.lock().remove(&tray_id).is_some()
}

#[napi]
pub fn is_tray_destroyed(tray_id: u32) -> bool {
    !TRAYS.lock().contains_key(&tray_id)
}

fn with_window<T, F>(window_id: u32, callback: F) -> Result<T>
where
    F: FnOnce(&mut WindowState) -> Result<T>,
{
    let mut windows = WINDOWS.lock();
    let state = windows
        .get_mut(&window_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, format!("Window {} not found", window_id)))?;
    callback(state)
}

fn dispatch_app_event(event: &str) {
    if let Some(callback) = APP_EVENT_CALLBACK.lock().as_ref() {
        callback.call(
            AppEvent {
                event: event.to_string(),
            },
            napi::threadsafe_function::ThreadsafeFunctionCallMode::NonBlocking,
        );
    }
}

fn process_pending_windows<T>(event_loop: &EventLoopWindowTarget<T>) {
    let pending = PENDING_WINDOWS.lock().drain(..).collect::<Vec<_>>();
    for pending_window in pending {
        match create_window_in_loop(pending_window.id, &pending_window.options, event_loop) {
            Ok(mut state) => {
                state.current_url = pending_window.url.clone();
                state.current_html = pending_window.html.clone();
                WINDOWS
                    .lock()
                    .insert(pending_window.id, SendWrapper::new(state));
            }
            Err(e) => {
                eprintln!(
                    "[bunlet-cef] Failed to create window {}: {}",
                    pending_window.id, e
                );
            }
        }
    }
}

fn create_window_in_loop<T>(
    _window_id: u32,
    options: &WindowOptions,
    event_loop: &EventLoopWindowTarget<T>,
) -> std::result::Result<WindowState, String> {
    let mut builder = WindowBuilder::new();

    let width = options.width.unwrap_or(800);
    let height = options.height.unwrap_or(600);

    builder = builder
        .with_title(
            options
                .title
                .clone()
                .unwrap_or_else(|| "Bunlet (CEF Scaffold)".to_string()),
        )
        .with_inner_size(LogicalSize::new(width as f64, height as f64))
        .with_resizable(options.resizable.unwrap_or(true))
        .with_decorations(options.decorations.unwrap_or(true))
        .with_transparent(options.transparent.unwrap_or(false))
        .with_visible(options.visible.unwrap_or(true))
        .with_always_on_top(options.always_on_top.unwrap_or(false));

    if let (Some(x), Some(y)) = (options.x, options.y) {
        builder = builder.with_position(LogicalPosition::new(x as f64, y as f64));
    }

    if let (Some(w), Some(h)) = (options.min_width, options.min_height) {
        builder = builder.with_min_inner_size(LogicalSize::new(w as f64, h as f64));
    }

    if let (Some(w), Some(h)) = (options.max_width, options.max_height) {
        builder = builder.with_max_inner_size(LogicalSize::new(w as f64, h as f64));
    }

    let window = builder.build(event_loop).map_err(|e| e.to_string())?;

    Ok(WindowState {
        tao_window_id: window.id(),
        window,
        current_url: None,
        current_html: None,
    })
}

fn remove_window_by_tao_id(window_id: WindowId) {
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
}
