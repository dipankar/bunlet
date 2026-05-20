//! CEF App handler for Bunlet
//!
//! Implements the CefApp and CefBrowserProcessHandler interfaces
//! to control CEF lifecycle and browser creation.

use cef::*;
use std::cell::RefCell;
use std::sync::{Arc, Mutex};

use crate::state;

wrap_app! {
    pub struct BunletCefApp;

    impl App {
        fn browser_process_handler(&self) -> Option<BrowserProcessHandler> {
            Some(BunletBrowserProcessHandler::new(RefCell::new(None)))
        }
    }
}

wrap_browser_process_handler! {
    struct BunletBrowserProcessHandler {
        client: RefCell<Option<Client>>,
    }

    impl BrowserProcessHandler {
        fn on_context_initialized(&self) {
            state::process_pending_windows();

            let inner = Arc::new(Mutex::new(BunletClientInner { _is_closing: false }));
            let client = BunletClient::new(inner);
            *self.client.borrow_mut() = Some(client);
        }

        fn default_client(&self) -> Option<Client> {
            self.client.borrow().clone()
        }
    }
}

// ============================================================================
// Main CEF Client handler
// ============================================================================

pub(crate) struct BunletClientInner {
    pub _is_closing: bool,
}

wrap_client! {
    pub struct BunletClient {
        inner: Arc<Mutex<BunletClientInner>>,
    }

    impl Client {
        fn display_handler(&self) -> Option<DisplayHandler> {
            Some(BunletDisplayHandler::new(self.inner.clone()))
        }

        fn life_span_handler(&self) -> Option<LifeSpanHandler> {
            Some(BunletLifeSpanHandler::new(self.inner.clone()))
        }

        fn load_handler(&self) -> Option<LoadHandler> {
            Some(BunletLoadHandler::new(self.inner.clone()))
        }

        fn keyboard_handler(&self) -> Option<KeyboardHandler> {
            Some(BunletKeyboardHandler::new(self.inner.clone()))
        }

        fn focus_handler(&self) -> Option<FocusHandler> {
            Some(BunletFocusHandler::new(self.inner.clone()))
        }
    }
}

// ============================================================================
// Display handler - title changes, URL changes, favicon
// ============================================================================

wrap_display_handler! {
    struct BunletDisplayHandler {
        inner: Arc<Mutex<BunletClientInner>>,
    }

    impl DisplayHandler {
        fn on_title_change(&self, browser: Option<&mut Browser>, title: Option<&CefString>) {
            let Some(browser) = browser else { return };
            let identifier = browser.identifier() as u32;
            let state = state::CEF_STATE.lock();
            if let Some(window_id) = state.browser_to_window.get(&identifier) {
                let window_id = *window_id;
                drop(state);
                let title_str = title.map(|t| t.to_string()).unwrap_or_default();
                state::dispatch_title_event("web-contents-title-updated", window_id, &title_str);

                let views = crate::browser::get_browser_view(window_id);
                if let Some(bv) = views {
                    if let Some(window) = bv.window() {
                        let cef_title = CefString::from(title_str.as_str());
                        window.set_title(Some(&cef_title));
                    }
                }
            }
        }

        fn on_address_change(&self, browser: Option<&mut Browser>, _frame: Option<&mut Frame>, url: Option<&CefString>) {
            let Some(browser) = browser else { return };
            let identifier = browser.identifier() as u32;
            let state = state::CEF_STATE.lock();
            if let Some(window_id) = state.browser_to_window.get(&identifier) {
                let window_id = *window_id;
                drop(state);
                let url_str = url.map(|u| u.to_string());
                state::dispatch_navigation_event("web-contents-navigation", window_id, url_str.as_deref());
            }
        }

        fn on_favicon_urlchange(&self, _browser: Option<&mut Browser>, _icon_urls: Option<&mut CefStringList>) {
            // Future: emit favicon change event
        }
    }
}

// ============================================================================
// Life span handler - browser creation, closure
// ============================================================================

wrap_life_span_handler! {
    struct BunletLifeSpanHandler {
        inner: Arc<Mutex<BunletClientInner>>,
    }

    impl LifeSpanHandler {
        fn on_after_created(&self, browser: Option<&mut Browser>) {
            let Some(browser) = browser else { return };
            let identifier = browser.identifier() as u32;

            crate::browser::register_browser(identifier, browser.clone());

            let open_devtools = state::CEF_STATE.lock().open_devtools_by_default;
            if open_devtools {
                if let Some(host) = browser.host() {
                    host.show_dev_tools(None, None, None, None);
                }
            }
        }

        fn do_close(&self, browser: Option<&mut Browser>) -> i32 {
            let Some(browser) = browser else { return 0 };
            let identifier = browser.identifier() as u32;
            let state = state::CEF_STATE.lock();
            if let Some(window_id) = state.browser_to_window.get(&identifier) {
                let window_id = *window_id;
                drop(state);
                state::dispatch_window_event("window-close-requested", window_id);
            }
            0
        }

        fn on_before_close(&self, browser: Option<&mut Browser>) {
            let Some(browser) = browser else { return };
            let identifier = browser.identifier() as u32;

            crate::browser::unregister_browser(identifier);

            let mut state = state::CEF_STATE.lock();
            if let Some(window_id) = state.browser_to_window.remove(&identifier) {
                state.window_to_browser.remove(&window_id);
                state.preload_scripts.remove(&window_id);
                state.devtools_open.remove(&window_id);
                crate::browser::unregister_browser_view(window_id);
                crate::browser::unregister_window(window_id);
                drop(state);
                state::dispatch_window_event("window-closed", window_id);
                state::dispatch_window_event("window-destroyed", window_id);
            }

            let state = state::CEF_STATE.lock();
            if state.window_to_browser.is_empty() {
                drop(state);
                state::dispatch_app_event("window-all-closed");
            }
        }
    }
}

// ============================================================================
// Load handler - load start, end, error
// ============================================================================

wrap_load_handler! {
    struct BunletLoadHandler {
        inner: Arc<Mutex<BunletClientInner>>,
    }

    impl LoadHandler {
        fn on_load_start(&self, browser: Option<&mut Browser>, _frame: Option<&mut Frame>, transition_type: TransitionType) {
            let Some(browser) = browser else { return };
            let identifier = browser.identifier() as u32;
            let state = state::CEF_STATE.lock();
            if let Some(window_id) = state.browser_to_window.get(&identifier) {
                let window_id = *window_id;
                drop(state);
                state::dispatch_window_event("did-start-loading", window_id);
            }
        }

        fn on_load_end(&self, browser: Option<&mut Browser>, _frame: Option<&mut Frame>, http_code: i32) {
            let Some(browser) = browser else { return };
            let identifier = browser.identifier() as u32;
            let state = state::CEF_STATE.lock();

            if let Some(window_id) = state.browser_to_window.get(&identifier) {
                let window_id = *window_id;
                let preload = state.preload_scripts.get(&window_id).cloned();
                drop(state);

                state::dispatch_window_event("did-stop-loading", window_id);

                if let Some(preload_script) = preload {
                    if let Some(frame) = browser.main_frame() {
                        let cef_script = CefString::from(preload_script.as_str());
                        frame.execute_java_script(Some(&cef_script), None, 0);
                    }
                }

                let bridge = crate::browser::build_bunlet_bridge_script();
                if let Some(frame) = browser.main_frame() {
                    let cef_script = CefString::from(bridge.as_str());
                    frame.execute_java_script(Some(&cef_script), None, 0);
                }
            }
        }

        fn on_load_error(
            &self,
            _browser: Option<&mut Browser>,
            _frame: Option<&mut Frame>,
            error_code: Errorcode,
            error_text: Option<&CefString>,
            failed_url: Option<&CefString>,
        ) {
            if error_code == Errorcode::ABORTED { return; }
            let error_msg = error_text.map(|t| t.to_string()).unwrap_or_default();
            let url = failed_url.map(|u| u.to_string()).unwrap_or_default();
            log::warn!("Load error for {}: {} ({:?})", url, error_msg, error_code);
        }
    }
}

// ============================================================================
// Keyboard handler - DevTools toggle via keyboard shortcut
// ============================================================================

wrap_keyboard_handler! {
    struct BunletKeyboardHandler {
        inner: Arc<Mutex<BunletClientInner>>,
    }

    impl KeyboardHandler {
        // The cef trait's `os_event` type varies by platform — *mut u8 on
        // macOS, Option<&mut _XEvent> on Linux, Option<&mut tagMSG> on
        // Windows. Use cfg to keep all three buildable.
        #[cfg(target_os = "macos")]
        fn on_pre_key_event(
            &self,
            _browser: Option<&mut Browser>,
            _event: Option<&KeyEvent>,
            _os_event: *mut u8,
            _is_keyboard_shortcut: Option<&mut std::os::raw::c_int>,
        ) -> std::os::raw::c_int {
            0
        }

        #[cfg(target_os = "linux")]
        fn on_pre_key_event(
            &self,
            _browser: Option<&mut Browser>,
            _event: Option<&KeyEvent>,
            _os_event: Option<&mut cef_dll_sys::_XEvent>,
            _is_keyboard_shortcut: Option<&mut std::os::raw::c_int>,
        ) -> std::os::raw::c_int {
            0
        }

        #[cfg(target_os = "windows")]
        fn on_pre_key_event(
            &self,
            _browser: Option<&mut Browser>,
            _event: Option<&KeyEvent>,
            _os_event: Option<&mut cef_dll_sys::tagMSG>,
            _is_keyboard_shortcut: Option<&mut std::os::raw::c_int>,
        ) -> std::os::raw::c_int {
            0
        }
    }
}

// ============================================================================
// Focus handler
// ============================================================================

wrap_focus_handler! {
    struct BunletFocusHandler {
        inner: Arc<Mutex<BunletClientInner>>,
    }

    impl FocusHandler {
        fn on_take_focus(&self, _browser: Option<&mut Browser>, _next: i32) {}

        fn on_set_focus(&self, _browser: Option<&mut Browser>, _source: FocusSource) -> i32 {
            1
        }

        fn on_got_focus(&self, browser: Option<&mut Browser>) {
            let Some(browser) = browser else { return };
            let identifier = browser.identifier() as u32;
            let state = state::CEF_STATE.lock();
            if let Some(window_id) = state.browser_to_window.get(&identifier) {
                let window_id = *window_id;
                drop(state);
                state::dispatch_window_event("window-focus", window_id);
            }
        }
    }
}

// ============================================================================
// BrowserView delegate - handles popup windows and view events
// ============================================================================

wrap_browser_view_delegate! {
    pub struct BunletBrowserViewDelegate {
        window_id: u32,
    }

    impl ViewDelegate {}

    impl BrowserViewDelegate {
        fn on_popup_browser_view_created(
            &self,
            _browser_view: Option<&mut BrowserView>,
            popup_browser_view: Option<&mut BrowserView>,
            _is_devtools: i32,
        ) -> i32 {
            let popup_window_id = crate::state::next_window_id();

            let popup_bv_clone = popup_browser_view.as_ref().map(|bv| (**bv).clone());
            let mut window_delegate = BunletWindowDelegate::new(
                RefCell::new(popup_bv_clone),
                popup_window_id,
                ShowState::NORMAL,
                RuntimeStyle::ALLOY,
            );
            window_create_top_level(Some(&mut window_delegate));

            if let Some(popup_browser_view) = popup_browser_view {
                if let Some(browser) = popup_browser_view.browser() {
                    let browser_id = browser.identifier() as u32;
                    let mut state = state::CEF_STATE.lock();
                    state.window_to_browser.insert(popup_window_id, browser_id);
                    state.browser_to_window.insert(browser_id, popup_window_id);
                    crate::browser::register_browser(browser_id, browser.clone());
                    crate::browser::register_browser_view(popup_window_id, popup_browser_view.clone());
                }
            }

            1
        }

        fn browser_runtime_style(&self) -> RuntimeStyle {
            RuntimeStyle::ALLOY
        }
    }
}

// ============================================================================
// Window delegate - handles window lifecycle for Views framework
// ============================================================================

wrap_window_delegate! {
    pub struct BunletWindowDelegate {
        browser_view: RefCell<Option<BrowserView>>,
        window_id: u32,
        initial_show_state: ShowState,
        runtime_style: RuntimeStyle,
    }

    impl ViewDelegate {
        fn preferred_size(&self, _view: Option<&mut View>) -> Size {
            Size {
                width: 800,
                height: 600,
            }
        }
    }

    impl PanelDelegate {}

    impl WindowDelegate {
        fn on_window_created(&self, window: Option<&mut Window>) {
            let browser_view = self.browser_view.borrow();
            let (Some(window), Some(browser_view)) = (window, browser_view.as_ref()) else {
                return;
            };

            crate::browser::register_window(self.window_id, window.clone());

            let mut view = View::from(browser_view);
            window.add_child_view(Some(&mut view));

            if self.initial_show_state != ShowState::HIDDEN {
                window.show();
            }

            let open_devtools = state::CEF_STATE.lock().open_devtools_by_default;
            if open_devtools {
                if let Some(browser) = browser_view.browser() {
                    if let Some(host) = browser.host() {
                        host.show_dev_tools(None, None, None, None);
                        state::CEF_STATE.lock().devtools_open.insert(self.window_id, true);
                    }
                }
            }
        }

        fn on_window_destroyed(&self, _window: Option<&mut Window>) {
            let mut browser_view = self.browser_view.borrow_mut();
            *browser_view = None;
        }

        fn can_close(&self, _window: Option<&mut Window>) -> i32 {
            let browser_view = self.browser_view.borrow();
            let browser_view = match browser_view.as_ref() {
                Some(bv) => bv,
                None => return 1,
            };
            if let Some(browser) = browser_view.browser() {
                if let Some(host) = browser.host() {
                    return host.try_close_browser();
                }
            }
            1
        }

        fn initial_show_state(&self, _window: Option<&mut Window>) -> ShowState {
            self.initial_show_state
        }

        fn window_runtime_style(&self) -> RuntimeStyle {
            self.runtime_style
        }
    }
}
