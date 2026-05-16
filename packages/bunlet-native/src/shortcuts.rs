//! Global Shortcuts API for Bunlet
//!
//! Provides cross-platform global keyboard shortcuts using the `global-hotkey` crate.

use global_hotkey::{
    hotkey::{Code, HotKey, Modifiers},
    GlobalHotKeyEvent, GlobalHotKeyManager,
};
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use std::collections::HashMap;

/// Wrapper that forces `Send` because `GlobalHotKeyManager` contains raw
/// pointers on Windows and the crate does not implement `Send` there.
struct SendManager(GlobalHotKeyManager);

// SAFETY: `GlobalHotKeyManager` is thread-safe in practice (it is designed
// to be used across threads for registering/unregistering hotkeys).
unsafe impl Send for SendManager {}

/// Global hotkey manager state
struct ShortcutState {
    manager: Option<SendManager>,
    /// Map accelerator string to (HotKey, callback_id)
    registered: HashMap<String, (HotKey, u32)>,
    /// Callback to invoke when a shortcut is triggered
    callback: Option<ThreadsafeFunction<u32, ErrorStrategy::Fatal>>,
    /// Next callback ID
    next_id: u32,
}

static SHORTCUT_STATE: Lazy<Mutex<ShortcutState>> = Lazy::new(|| {
    Mutex::new(ShortcutState {
        manager: GlobalHotKeyManager::new().ok().map(SendManager),
        registered: HashMap::new(),
        callback: None,
        next_id: 1,
    })
});

/// Shortcut event for callback
#[napi(object)]
pub struct ShortcutEvent {
    pub accelerator: String,
    pub id: u32,
}

/// Initialize the global shortcuts system
/// Call this once at startup
#[napi]
pub fn init_global_shortcuts() {
    // Start event listener
    std::thread::spawn(|| {
        loop {
            if let Ok(event) = GlobalHotKeyEvent::receiver().recv() {
                // Find the accelerator string for this hotkey
                let state = SHORTCUT_STATE.lock();
                if let Some(callback) = &state.callback {
                    for (accelerator, (hotkey, id)) in &state.registered {
                        if hotkey.id() == event.id {
                            let _ = accelerator; // We could send accelerator too
                            callback.call(*id, ThreadsafeFunctionCallMode::NonBlocking);
                            break;
                        }
                    }
                }
            }
        }
    });
}

/// Set the callback for shortcut events
#[napi]
pub fn set_shortcut_callback(callback: ThreadsafeFunction<u32, ErrorStrategy::Fatal>) {
    let mut state = SHORTCUT_STATE.lock();
    state.callback = Some(callback);
}

/// Parse an accelerator string into a HotKey
/// Supports formats like: "Ctrl+Shift+A", "Cmd+Option+Z", "Alt+F4"
fn parse_accelerator(accelerator: &str) -> Option<HotKey> {
    let parts: Vec<&str> = accelerator.split('+').map(|s| s.trim()).collect();
    if parts.is_empty() {
        return None;
    }

    let mut modifiers = Modifiers::empty();
    let mut key_code: Option<Code> = None;

    for part in parts {
        let lower = part.to_lowercase();
        match lower.as_str() {
            // Modifiers
            "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
            "cmd" | "command" | "meta" | "super" => modifiers |= Modifiers::META,
            "alt" | "option" => modifiers |= Modifiers::ALT,
            "shift" => modifiers |= Modifiers::SHIFT,

            // Function keys
            "f1" => key_code = Some(Code::F1),
            "f2" => key_code = Some(Code::F2),
            "f3" => key_code = Some(Code::F3),
            "f4" => key_code = Some(Code::F4),
            "f5" => key_code = Some(Code::F5),
            "f6" => key_code = Some(Code::F6),
            "f7" => key_code = Some(Code::F7),
            "f8" => key_code = Some(Code::F8),
            "f9" => key_code = Some(Code::F9),
            "f10" => key_code = Some(Code::F10),
            "f11" => key_code = Some(Code::F11),
            "f12" => key_code = Some(Code::F12),

            // Special keys
            "space" => key_code = Some(Code::Space),
            "tab" => key_code = Some(Code::Tab),
            "enter" | "return" => key_code = Some(Code::Enter),
            "escape" | "esc" => key_code = Some(Code::Escape),
            "backspace" => key_code = Some(Code::Backspace),
            "delete" | "del" => key_code = Some(Code::Delete),
            "insert" => key_code = Some(Code::Insert),
            "home" => key_code = Some(Code::Home),
            "end" => key_code = Some(Code::End),
            "pageup" => key_code = Some(Code::PageUp),
            "pagedown" => key_code = Some(Code::PageDown),
            "up" | "arrowup" => key_code = Some(Code::ArrowUp),
            "down" | "arrowdown" => key_code = Some(Code::ArrowDown),
            "left" | "arrowleft" => key_code = Some(Code::ArrowLeft),
            "right" | "arrowright" => key_code = Some(Code::ArrowRight),

            // Number keys
            "0" => key_code = Some(Code::Digit0),
            "1" => key_code = Some(Code::Digit1),
            "2" => key_code = Some(Code::Digit2),
            "3" => key_code = Some(Code::Digit3),
            "4" => key_code = Some(Code::Digit4),
            "5" => key_code = Some(Code::Digit5),
            "6" => key_code = Some(Code::Digit6),
            "7" => key_code = Some(Code::Digit7),
            "8" => key_code = Some(Code::Digit8),
            "9" => key_code = Some(Code::Digit9),

            // Letter keys (single character)
            _ if lower.len() == 1 => {
                let c = lower.chars().next().unwrap();
                key_code = match c {
                    'a' => Some(Code::KeyA),
                    'b' => Some(Code::KeyB),
                    'c' => Some(Code::KeyC),
                    'd' => Some(Code::KeyD),
                    'e' => Some(Code::KeyE),
                    'f' => Some(Code::KeyF),
                    'g' => Some(Code::KeyG),
                    'h' => Some(Code::KeyH),
                    'i' => Some(Code::KeyI),
                    'j' => Some(Code::KeyJ),
                    'k' => Some(Code::KeyK),
                    'l' => Some(Code::KeyL),
                    'm' => Some(Code::KeyM),
                    'n' => Some(Code::KeyN),
                    'o' => Some(Code::KeyO),
                    'p' => Some(Code::KeyP),
                    'q' => Some(Code::KeyQ),
                    'r' => Some(Code::KeyR),
                    's' => Some(Code::KeyS),
                    't' => Some(Code::KeyT),
                    'u' => Some(Code::KeyU),
                    'v' => Some(Code::KeyV),
                    'w' => Some(Code::KeyW),
                    'x' => Some(Code::KeyX),
                    'y' => Some(Code::KeyY),
                    'z' => Some(Code::KeyZ),
                    _ => None,
                };
            }

            _ => {}
        }
    }

    key_code.map(|code| HotKey::new(Some(modifiers), code))
}

/// Register a global shortcut
/// Returns the callback ID if successful, or 0 if failed
#[napi]
pub fn register_shortcut(accelerator: String) -> u32 {
    let mut state = SHORTCUT_STATE.lock();

    // Check if already registered
    if state.registered.contains_key(&accelerator) {
        return 0;
    }

    let Some(manager) = &state.manager else {
        return 0;
    };

    let Some(hotkey) = parse_accelerator(&accelerator) else {
        return 0;
    };

    if manager.0.register(hotkey).is_err() {
        return 0;
    }

    let id = state.next_id;
    state.next_id += 1;
    state.registered.insert(accelerator, (hotkey, id));

    id
}

/// Unregister a global shortcut
#[napi]
pub fn unregister_shortcut(accelerator: String) -> bool {
    let mut state = SHORTCUT_STATE.lock();

    let Some((hotkey, _id)) = state.registered.remove(&accelerator) else {
        return false;
    };

    let Some(manager) = &state.manager else {
        return false;
    };

    manager.0.unregister(hotkey).is_ok()
}

/// Unregister all global shortcuts
#[napi]
pub fn unregister_all_shortcuts() {
    let mut state = SHORTCUT_STATE.lock();

    // Collect hotkeys first to avoid borrow conflict
    let hotkeys: Vec<HotKey> = state.registered.drain().map(|(_, (hk, _))| hk).collect();

    if let Some(manager) = &state.manager {
        for hotkey in hotkeys {
            let _ = manager.0.unregister(hotkey);
        }
    }
}

/// Check if a shortcut is registered
#[napi]
pub fn is_shortcut_registered(accelerator: String) -> bool {
    let state = SHORTCUT_STATE.lock();
    state.registered.contains_key(&accelerator)
}
