//! Menu API for Bunlet
//!
//! Provides cross-platform menus using the `muda` crate.

use muda::{
    accelerator::Accelerator, AboutMetadata, CheckMenuItem, Menu as MudaMenu, MenuEvent,
    MenuItem as MudaMenuItem, PredefinedMenuItem, Submenu,
};
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use send_wrapper::SendWrapper;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::atomic::{AtomicU32, Ordering};

/// Menu ID counter
static MENU_COUNTER: AtomicU32 = AtomicU32::new(1);

/// Global menu registry (wrapped in SendWrapper for thread safety)
pub(crate) static MENUS: Lazy<Mutex<HashMap<u32, SendWrapper<MudaMenu>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Menu item ID to callback ID mapping
static MENU_ITEM_CALLBACKS: Lazy<Mutex<HashMap<String, u32>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Menu event callback
static MENU_CALLBACK: Lazy<Mutex<Option<ThreadsafeFunction<MenuEventData, ErrorStrategy::Fatal>>>> =
    Lazy::new(|| Mutex::new(None));

/// Application menu reference
static APP_MENU: Lazy<Mutex<Option<u32>>> = Lazy::new(|| Mutex::new(None));

/// Menu event data
#[napi(object)]
pub struct MenuEventData {
    pub menu_id: u32,
    pub item_id: String,
    pub callback_id: u32,
}

/// Menu item options
#[napi(object)]
#[derive(Clone, Default)]
pub struct MenuItemOptions {
    /// Item ID
    pub id: Option<String>,
    /// Item label
    pub label: Option<String>,
    /// Whether item is enabled
    pub enabled: Option<bool>,
    /// Item type: 'normal', 'separator', 'submenu', 'checkbox', 'radio'
    pub item_type: Option<String>,
    /// Keyboard accelerator (e.g., "Ctrl+S")
    pub accelerator: Option<String>,
    /// Whether checked (for checkbox/radio)
    pub checked: Option<bool>,
    /// Role for predefined items
    pub role: Option<String>,
    /// Submenu items
    pub submenu: Option<Vec<MenuItemOptions>>,
    /// Callback ID for click handler
    pub callback_id: Option<u32>,
}

/// Initialize the menu event listener
#[napi]
pub fn init_menu_events() {
    std::thread::spawn(|| {
        loop {
            if let Ok(event) = MenuEvent::receiver().recv() {
                let item_id = event.id.0.to_string();

                // Find callback ID for this menu item
                let callbacks = MENU_ITEM_CALLBACKS.lock();
                if let Some(&callback_id) = callbacks.get(&item_id) {
                    if let Some(callback) = MENU_CALLBACK.lock().as_ref() {
                        callback.call(
                            MenuEventData {
                                menu_id: 0, // We don't track which menu it came from
                                item_id,
                                callback_id,
                            },
                            ThreadsafeFunctionCallMode::NonBlocking,
                        );
                    }
                }
            }
        }
    });
}

/// Set the menu event callback
#[napi]
pub fn set_menu_callback(callback: ThreadsafeFunction<MenuEventData, ErrorStrategy::Fatal>) {
    let mut cb = MENU_CALLBACK.lock();
    *cb = Some(callback);
}

/// Create a new menu
#[napi]
pub fn create_menu() -> u32 {
    let id = MENU_COUNTER.fetch_add(1, Ordering::SeqCst);
    let menu = MudaMenu::new();
    MENUS.lock().insert(id, SendWrapper::new(menu));
    id
}

/// Build a menu item from options
fn build_menu_item(options: &MenuItemOptions) -> Option<Box<dyn muda::IsMenuItem>> {
    let item_type = options.item_type.as_deref().unwrap_or("normal");

    match item_type {
        "separator" => Some(Box::new(PredefinedMenuItem::separator())),
        "submenu" => {
            let label = options.label.as_deref().unwrap_or("Submenu");
            let enabled = options.enabled.unwrap_or(true);
            let submenu = Submenu::new(label, enabled);

            if let Some(items) = &options.submenu {
                for item_opts in items {
                    if let Some(item) = build_menu_item(item_opts) {
                        let _ = submenu.append(item.as_ref());
                    }
                }
            }

            Some(Box::new(submenu))
        }
        "checkbox" => {
            let label = options.label.as_deref().unwrap_or("Checkbox");
            let enabled = options.enabled.unwrap_or(true);
            let checked = options.checked.unwrap_or(false);
            let accelerator = options
                .accelerator
                .as_ref()
                .and_then(|a| Accelerator::from_str(a).ok());

            let item = CheckMenuItem::new(label, enabled, checked, accelerator);

            // Register callback if present
            if let Some(callback_id) = options.callback_id {
                MENU_ITEM_CALLBACKS
                    .lock()
                    .insert(item.id().0.to_string(), callback_id);
            }

            Some(Box::new(item))
        }
        "normal" | _ => {
            // Check for predefined roles first
            if let Some(role) = &options.role {
                match role.as_str() {
                    "about" => {
                        return Some(Box::new(PredefinedMenuItem::about(
                            None,
                            Some(AboutMetadata::default()),
                        )));
                    }
                    "quit" => return Some(Box::new(PredefinedMenuItem::quit(None))),
                    "copy" => return Some(Box::new(PredefinedMenuItem::copy(None))),
                    "cut" => return Some(Box::new(PredefinedMenuItem::cut(None))),
                    "paste" => return Some(Box::new(PredefinedMenuItem::paste(None))),
                    "selectAll" => return Some(Box::new(PredefinedMenuItem::select_all(None))),
                    "undo" => return Some(Box::new(PredefinedMenuItem::undo(None))),
                    "redo" => return Some(Box::new(PredefinedMenuItem::redo(None))),
                    "minimize" => return Some(Box::new(PredefinedMenuItem::minimize(None))),
                    "hide" => return Some(Box::new(PredefinedMenuItem::hide(None))),
                    "hideOthers" => return Some(Box::new(PredefinedMenuItem::hide_others(None))),
                    "showAll" => return Some(Box::new(PredefinedMenuItem::show_all(None))),
                    "closeWindow" => return Some(Box::new(PredefinedMenuItem::close_window(None))),
                    "fullscreen" => return Some(Box::new(PredefinedMenuItem::fullscreen(None))),
                    "services" => return Some(Box::new(PredefinedMenuItem::services(None))),
                    _ => {}
                }
            }

            // Regular menu item
            let label = options.label.as_deref().unwrap_or("Item");
            let enabled = options.enabled.unwrap_or(true);
            let accelerator = options
                .accelerator
                .as_ref()
                .and_then(|a| Accelerator::from_str(a).ok());

            let item = MudaMenuItem::new(label, enabled, accelerator);

            // Register callback if present
            if let Some(callback_id) = options.callback_id {
                MENU_ITEM_CALLBACKS
                    .lock()
                    .insert(item.id().0.to_string(), callback_id);
            }

            Some(Box::new(item))
        }
    }
}

/// Append a menu item to a menu
#[napi]
pub fn append_menu_item(menu_id: u32, options: MenuItemOptions) -> bool {
    let menus = MENUS.lock();
    let Some(menu) = menus.get(&menu_id) else {
        return false;
    };

    if let Some(item) = build_menu_item(&options) {
        menu.append(item.as_ref()).is_ok()
    } else {
        false
    }
}

/// Append multiple menu items from a template
#[napi]
pub fn build_menu_from_template(menu_id: u32, template: Vec<MenuItemOptions>) -> bool {
    let menus = MENUS.lock();
    let Some(menu) = menus.get(&menu_id) else {
        return false;
    };

    for options in &template {
        if let Some(item) = build_menu_item(options) {
            if menu.append(item.as_ref()).is_err() {
                return false;
            }
        }
    }

    true
}

/// Set the application menu
#[napi]
pub fn set_application_menu(menu_id: Option<u32>) -> bool {
    let menus = MENUS.lock();

    #[cfg(target_os = "macos")]
    {
        #[allow(unused_imports)]
        use muda::MenuId;

        if let Some(id) = menu_id {
            if let Some(menu) = menus.get(&id) {
                menu.init_for_nsapp();
                *APP_MENU.lock() = Some(id);
                return true;
            }
        } else {
            // Remove app menu - not directly supported, just clear reference
            *APP_MENU.lock() = None;
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // On Windows/Linux, menus are per-window
        // This is handled when creating windows
        if let Some(id) = menu_id {
            *APP_MENU.lock() = Some(id);
            return menus.contains_key(&id);
        } else {
            *APP_MENU.lock() = None;
        }
    }

    true
}

/// Get the current application menu ID
#[napi]
pub fn get_application_menu() -> Option<u32> {
    *APP_MENU.lock()
}

/// Destroy a menu
#[napi]
pub fn destroy_menu(menu_id: u32) -> bool {
    MENUS.lock().remove(&menu_id).is_some()
}

/// Show a popup/context menu at position
///
/// **Not yet implemented**: Context menu popup requires native window
/// integration that is not yet complete. This will return an error.
#[napi]
pub fn popup_menu(_menu_id: u32, _window_id: u32, _x: i32, _y: i32) -> Result<bool> {
    Err(Error::new(
        Status::GenericFailure,
        "popup_menu is not yet implemented. Context menus require native window integration.",
    ))
}
