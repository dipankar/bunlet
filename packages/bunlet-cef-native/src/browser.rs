//! Browser creation and management for CEF backend
//!
//! Handles creating CEF browser instances, loading URLs,
//! executing JavaScript, DevTools, navigation, and IPC messaging.

use cef::*;
use send_wrapper::SendWrapper;
use std::collections::HashMap;
use std::ops::Deref;
use std::sync::atomic::AtomicU32;

use crate::state;

/// Browser registry: maps CEF browser identifier → SendWrapper<Browser>
static BROWSERS: once_cell::sync::Lazy<parking_lot::Mutex<HashMap<u32, SendWrapper<Browser>>>> =
    once_cell::sync::Lazy::new(|| parking_lot::Mutex::new(HashMap::new()));

/// Window-views registry: maps bunlet window_id → SendWrapper<BrowserView>
static BROWSER_VIEWS: once_cell::sync::Lazy<
    parking_lot::Mutex<HashMap<u32, SendWrapper<BrowserView>>>,
> = once_cell::sync::Lazy::new(|| parking_lot::Mutex::new(HashMap::new()));

/// Window registry: maps bunlet window_id → CEF Window handle
static CEF_WINDOWS: once_cell::sync::Lazy<parking_lot::Mutex<HashMap<u32, SendWrapper<Window>>>> =
    once_cell::sync::Lazy::new(|| parking_lot::Mutex::new(HashMap::new()));

/// Unique ID counter for browsers we create
static _NEXT_BROWSER_ID: AtomicU32 = AtomicU32::new(1);

fn with_browser<F, R>(window_id: u32, f: F) -> Result<R, napi::Error>
where
    F: FnOnce(&Browser) -> R,
{
    let state = state::CEF_STATE.lock();
    let browser_identifier = match state.window_to_browser.get(&window_id) {
        Some(id) => *id,
        None => {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!("Window {} not found in browser registry", window_id),
            ))
        }
    };
    drop(state);

    let browsers = BROWSERS.lock();
    match browsers.get(&browser_identifier) {
        Some(wrapped) => Ok(f(wrapped)),
        None => Err(napi::Error::new(
            napi::Status::InvalidArg,
            format!("Browser {} not found", browser_identifier),
        )),
    }
}

fn _with_browser_view<F, R>(window_id: u32, f: F) -> Result<R, napi::Error>
where
    F: FnOnce(&BrowserView) -> R,
{
    let views = BROWSER_VIEWS.lock();
    match views.get(&window_id) {
        Some(wrapped) => Ok(f(wrapped)),
        None => Err(napi::Error::new(
            napi::Status::InvalidArg,
            format!("BrowserView for window {} not found", window_id),
        )),
    }
}

fn with_window<F, R>(window_id: u32, f: F) -> Result<R, napi::Error>
where
    F: FnOnce(&Window) -> R,
{
    let windows = CEF_WINDOWS.lock();
    match windows.get(&window_id) {
        Some(wrapped) => Ok(f(wrapped)),
        None => Err(napi::Error::new(
            napi::Status::InvalidArg,
            format!("CEF Window for window {} not found", window_id),
        )),
    }
}

pub fn register_browser(browser_id: u32, browser: Browser) {
    BROWSERS
        .lock()
        .insert(browser_id, SendWrapper::new(browser));
}

pub fn unregister_browser(browser_id: u32) {
    BROWSERS.lock().remove(&browser_id);
}

pub fn register_browser_view(window_id: u32, view: BrowserView) {
    BROWSER_VIEWS
        .lock()
        .insert(window_id, SendWrapper::new(view));
}

pub fn unregister_browser_view(window_id: u32) {
    BROWSER_VIEWS.lock().remove(&window_id);
}

pub fn register_window(window_id: u32, window: Window) {
    CEF_WINDOWS
        .lock()
        .insert(window_id, SendWrapper::new(window));
}

pub fn unregister_window(window_id: u32) {
    CEF_WINDOWS.lock().remove(&window_id);
}

pub fn get_browser_view(window_id: u32) -> Option<BrowserView> {
    let views = BROWSER_VIEWS.lock();
    match views.get(&window_id) {
        Some(w) => Some(w.deref().clone()),
        None => None,
    }
}

// ============================================================================
// Browser creation
// ============================================================================

pub fn cef_create_browser(
    window_id: u32,
    options: &crate::WindowOptions,
    url: Option<&str>,
    html: Option<&str>,
) -> Result<(), napi::Error> {
    let default_url = "about:blank";
    let effective_url = if let Some(html_content) = html {
        let encoded = urlencoding::encode(html_content);
        format!("data:text/html,{}", encoded)
    } else {
        url.unwrap_or(default_url).to_string()
    };

    if let Some(ref preload) = options.preload_script {
        match std::fs::read_to_string(preload) {
            Ok(content) => {
                state::CEF_STATE
                    .lock()
                    .preload_scripts
                    .insert(window_id, content);
            }
            Err(e) => {
                log::warn!("Failed to read preload script '{}': {}", preload, e);
            }
        }
    }

    let cef_url = CefString::from(effective_url.as_str());

    let mut delegate = crate::app_handler::BunletBrowserViewDelegate::new(window_id);

    let inner = std::sync::Arc::new(std::sync::Mutex::new(
        crate::app_handler::BunletClientInner { _is_closing: false },
    ));
    let client = crate::app_handler::BunletClient::new(inner);

    let browser_view = browser_view_create(
        Some(&mut client.clone()),
        Some(&cef_url),
        None,
        None,
        None,
        Some(&mut delegate),
    );

    let browser_view = match browser_view {
        Some(bv) => bv,
        None => {
            return Err(napi::Error::new(
                napi::Status::GenericFailure,
                "Failed to create CEF BrowserView".to_string(),
            ))
        }
    };

    let browser = match browser_view.browser() {
        Some(b) => b,
        None => {
            return Err(napi::Error::new(
                napi::Status::GenericFailure,
                "BrowserView has no Browser".to_string(),
            ))
        }
    };

    let browser_id = browser.identifier() as u32;

    {
        let mut state = state::CEF_STATE.lock();
        state.window_to_browser.insert(window_id, browser_id);
        state.browser_to_window.insert(browser_id, window_id);
    }

    register_browser(browser_id, browser.clone());
    register_browser_view(window_id, browser_view.clone());

    let show_state = if options.visible.unwrap_or(true) {
        ShowState::NORMAL
    } else {
        ShowState::HIDDEN
    };

    let mut window_delegate = crate::app_handler::BunletWindowDelegate::new(
        std::cell::RefCell::new(Some(browser_view.clone())),
        window_id,
        show_state,
        RuntimeStyle::ALLOY,
    );

    window_create_top_level(Some(&mut window_delegate));

    let open_devtools =
        options.open_devtools.unwrap_or(false) || state::CEF_STATE.lock().open_devtools_by_default;
    if open_devtools {
        if let Some(host) = browser.host() {
            host.show_dev_tools(None, None, None, None);
            state::CEF_STATE
                .lock()
                .devtools_open
                .insert(window_id, true);
        }
    }

    Ok(())
}

/// Build the Bunlet IPC bridge JavaScript that gets injected into every page
pub fn build_bunlet_bridge_script() -> String {
    r#"
    (function() {
        if (window.__bunlet) return;

        window.__bunlet = {
            _handlers: [],
            _channelListeners: {},
            _pending: {},
            _nextId: 1,

            invoke: function(payload) {
                const id = String(this._nextId++);
                const message = {
                    jsonrpc: '2.0',
                    id: id,
                    method: payload && payload.method,
                    params: (payload && payload.params) || {}
                };
                return new Promise(function(resolve, reject) {
                    window.__bunlet._pending[id] = { resolve: resolve, reject: reject };
                    if (typeof window.__bunlet_cef_send === 'function') {
                        window.__bunlet_cef_send(JSON.stringify(message));
                    } else if (typeof window.postMessage === 'function') {
                        window.postMessage({ type: '__bunlet_ipc', data: message }, '*');
                    }
                });
            },

            send: function(channel) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (typeof window.__bunlet_cef_send === 'function') {
                    window.__bunlet_cef_send(JSON.stringify({ type: 'event', channel: channel, args: args }));
                }
            },

            onMessage: function(handler) {
                this._handlers.push(handler);
            },

            on: function(channel, handler) {
                if (!this._channelListeners[channel]) {
                    this._channelListeners[channel] = [];
                }
                this._channelListeners[channel].push(handler);
            },

            off: function(channel, handler) {
                if (!this._channelListeners[channel]) return;
                this._channelListeners[channel] = this._channelListeners[channel].filter(function(fn) { return fn !== handler; });
            }
        };

        window.__bunlet_ipc_handler = function(message) {
            window.__bunlet._handlers.forEach(function(handler) { handler(message); });
            var data = null;
            try { data = typeof message === 'string' ? JSON.parse(message) : message; } catch (_) { return; }
            if (data && data.jsonrpc === '2.0' && data.id != null) {
                var key = String(data.id);
                var pending = window.__bunlet._pending[key];
                if (pending) {
                    delete window.__bunlet._pending[key];
                    if (data.error) { pending.reject(data.error); }
                    else { pending.resolve(data.result); }
                }
                return;
            }
            if (data && data.channel) {
                var listeners = window.__bunlet._channelListeners[data.channel] || [];
                listeners.forEach(function(handler) {
                    try { handler.apply(null, [undefined].concat(data.args || [])); } catch (_) {}
                });
            }
        };
    })();
    "#.to_string()
}

// ============================================================================
// Window operations - real CEF implementations
// ============================================================================

pub fn cef_load_url(browser_id: u32, url: &str) -> Result<(), napi::Error> {
    let browsers = BROWSERS.lock();
    match browsers.get(&browser_id) {
        Some(wrapped) => {
            if let Some(frame) = wrapped.main_frame() {
                let cef_url = CefString::from(url);
                frame.load_url(Some(&cef_url));
                Ok(())
            } else {
                Err(napi::Error::new(
                    napi::Status::GenericFailure,
                    "Browser has no main frame".to_string(),
                ))
            }
        }
        None => Err(napi::Error::new(
            napi::Status::InvalidArg,
            format!("Browser {} not found", browser_id),
        )),
    }
}

pub fn cef_show_window(window_id: u32) -> Result<(), napi::Error> {
    with_window(window_id, |_window| { /* show() is implicit */ })
}

pub fn cef_hide_window(window_id: u32) -> Result<(), napi::Error> {
    with_window(window_id, |window| {
        window.hide();
    })
}

pub fn cef_close_window(window_id: u32) -> Result<(), napi::Error> {
    with_browser(window_id, |browser| {
        if let Some(host) = browser.host() {
            host.try_close_browser();
        }
    })
}

pub fn cef_focus_window(window_id: u32) -> Result<(), napi::Error> {
    with_window(window_id, |window| {
        window.bring_to_top();
    })
}

pub fn cef_maximize_window(window_id: u32) -> Result<(), napi::Error> {
    with_window(window_id, |window| {
        window.maximize();
    })
}

pub fn cef_minimize_window(window_id: u32) -> Result<(), napi::Error> {
    with_window(window_id, |window| {
        window.minimize();
    })
}

pub fn cef_restore_window(window_id: u32) -> Result<(), napi::Error> {
    with_window(window_id, |window| {
        window.restore();
    })
}

pub fn cef_set_fullscreen(window_id: u32, fullscreen: bool) -> Result<(), napi::Error> {
    with_window(window_id, |window| {
        window.set_fullscreen(if fullscreen { 1 } else { 0 });
    })
}

pub fn cef_get_window_bounds(window_id: u32) -> Result<crate::WindowBounds, napi::Error> {
    with_window(window_id, |window| {
        let rect = window.bounds();
        crate::WindowBounds {
            x: rect.x,
            y: rect.y,
            width: rect.width as u32,
            height: rect.height as u32,
        }
    })
}

pub fn cef_set_window_bounds(
    window_id: u32,
    x: Option<i32>,
    y: Option<i32>,
    width: Option<u32>,
    height: Option<u32>,
) -> Result<(), napi::Error> {
    with_window(window_id, |window| {
        let mut rect = window.bounds();
        if let Some(px) = x {
            rect.x = px;
        }
        if let Some(py) = y {
            rect.y = py;
        }
        if let Some(w) = width {
            rect.width = w as i32;
        }
        if let Some(h) = height {
            rect.height = h as i32;
        }
        window.set_bounds(Some(&rect));
    })
}

pub fn cef_set_window_title(window_id: u32, title: &str) -> Result<(), napi::Error> {
    with_window(window_id, |window| {
        let cef_title = CefString::from(title);
        window.set_title(Some(&cef_title));
    })
}

pub fn cef_set_always_on_top(window_id: u32, always_on_top: bool) -> Result<(), napi::Error> {
    with_window(window_id, |window| {
        window.set_always_on_top(if always_on_top { 1 } else { 0 });
    })
}

pub fn cef_is_window_visible(window_id: u32) -> Result<bool, napi::Error> {
    with_window(window_id, |window| window.is_visible() != 0)
}

pub fn cef_is_window_focused(window_id: u32) -> Result<bool, napi::Error> {
    with_window(window_id, |window| window.is_active() != 0)
}

pub fn cef_is_window_maximized(window_id: u32) -> Result<bool, napi::Error> {
    with_window(window_id, |window| window.is_maximized() != 0)
}

pub fn cef_is_window_minimized(window_id: u32) -> Result<bool, napi::Error> {
    with_window(window_id, |window| window.is_minimized() != 0)
}

pub fn cef_is_window_fullscreen(window_id: u32) -> Result<bool, napi::Error> {
    with_window(window_id, |window| window.is_fullscreen() != 0)
}

pub fn cef_get_focused_window_id() -> Option<u32> {
    let windows = CEF_WINDOWS.lock();
    for (window_id, wrapped) in windows.iter() {
        if wrapped.is_active() != 0 {
            return Some(*window_id);
        }
    }
    None
}

// ============================================================================
// WebView operations
// ============================================================================

pub fn cef_execute_java_script(window_id: u32, script: &str) -> Result<String, napi::Error> {
    with_browser(window_id, |browser| {
        if let Some(frame) = browser.main_frame() {
            let cef_script = CefString::from(script);
            frame.execute_java_script(Some(&cef_script), None, 0);
        }
    })?;
    Ok(String::new())
}

pub fn cef_webview_reload(window_id: u32) -> Result<(), napi::Error> {
    with_browser(window_id, |browser| {
        browser.reload();
    })
}

pub fn cef_webview_stop(window_id: u32) -> Result<(), napi::Error> {
    with_browser(window_id, |browser| {
        browser.stop_load();
    })
}

pub fn cef_webview_go_back(window_id: u32) -> Result<(), napi::Error> {
    with_browser(window_id, |browser| {
        browser.go_back();
    })
}

pub fn cef_webview_go_forward(window_id: u32) -> Result<(), napi::Error> {
    with_browser(window_id, |browser| {
        browser.go_forward();
    })
}

// ============================================================================
// DevTools
// ============================================================================

pub fn cef_open_devtools(window_id: u32) -> Result<(), napi::Error> {
    with_browser(window_id, |browser| {
        if let Some(host) = browser.host() {
            host.show_dev_tools(None, None, None, None);
        }
    })?;
    state::CEF_STATE
        .lock()
        .devtools_open
        .insert(window_id, true);
    Ok(())
}

pub fn cef_close_devtools(window_id: u32) -> Result<(), napi::Error> {
    with_browser(window_id, |browser| {
        if let Some(host) = browser.host() {
            host.close_dev_tools();
        }
    })?;
    state::CEF_STATE
        .lock()
        .devtools_open
        .insert(window_id, false);
    Ok(())
}

pub fn cef_toggle_devtools(window_id: u32) -> Result<(), napi::Error> {
    let is_open = state::CEF_STATE
        .lock()
        .devtools_open
        .get(&window_id)
        .copied()
        .unwrap_or(false);
    if is_open {
        cef_close_devtools(window_id)
    } else {
        cef_open_devtools(window_id)
    }
}

pub fn cef_is_devtools_open(window_id: u32) -> Result<bool, napi::Error> {
    Ok(state::CEF_STATE
        .lock()
        .devtools_open
        .get(&window_id)
        .copied()
        .unwrap_or(false))
}

// ============================================================================
// IPC messaging - main process to renderer via CEF ProcessMessage
// ============================================================================

pub fn cef_send_ipc_message(window_id: u32, message: &str) -> Result<(), napi::Error> {
    with_browser(window_id, |browser| {
        let msg_name = CefString::from("__bunlet_ipc");
        let mut process_msg = process_message_create(Some(&msg_name));

        if let Some(arg_list) = process_msg.as_mut().and_then(|m| m.argument_list()) {
            let cef_value = CefString::from(message);
            arg_list.set_string(0, Some(&cef_value));
        }

        if let Some(frame) = browser.main_frame() {
            let pid = ProcessId::RENDERER;
            if let Some(msg) = process_msg.as_mut() {
                frame.send_process_message(pid, Some(msg));
            }
        }
    })
}

// ============================================================================
// Session / Cookies via CEF RequestContext + CookieManager
// ============================================================================

pub fn cef_get_cookies(window_id: u32) -> Result<Vec<crate::NativeCookie>, napi::Error> {
    let cookies = COOKIE_RESULTS.lock().drain(..).collect::<Vec<_>>();
    if !cookies.is_empty() {
        return Ok(cookies);
    }

    let _ = with_browser(window_id, |browser| {
        if let Some(host) = browser.host() {
            if let Some(rc) = host.request_context() {
                if let Some(manager) = rc.cookie_manager(None) {
                    let mut visitor = BunletCookieVisitor::new();
                    let result = manager.visit_all_cookies(Some(&mut visitor));
                    if result == 0 {
                        log::warn!("visit_all_cookies returned 0 (failed or blocked)");
                    }
                }
            }
        }
    })?;

    Ok(COOKIE_RESULTS.lock().drain(..).collect())
}

pub fn cef_set_cookie(window_id: u32, params: &crate::SetCookieParams) -> Result<(), napi::Error> {
    with_browser(window_id, |browser| {
        if let Some(host) = browser.host() {
            if let Some(rc) = host.request_context() {
                if let Some(manager) = rc.cookie_manager(None) {
                    let url = CefString::from(
                        format!(
                            "http{}://{}",
                            if params.secure.unwrap_or(false) {
                                "s"
                            } else {
                                ""
                            },
                            params.domain.as_deref().unwrap_or("localhost")
                        )
                        .as_str(),
                    );

                    let mut cookie = cef::Cookie::default();
                    cookie.name = CefString::from(params.name.as_str());
                    cookie.value = CefString::from(params.value.as_str());
                    if let Some(ref domain) = params.domain {
                        cookie.domain = CefString::from(domain.as_str());
                    }
                    if let Some(ref path) = params.path {
                        cookie.path = CefString::from(path.as_str());
                    }
                    cookie.secure = if params.secure.unwrap_or(false) { 1 } else { 0 };
                    cookie.httponly = if params.http_only.unwrap_or(false) {
                        1
                    } else {
                        0
                    };
                    if let Some(expiration) = params.expiration_date {
                        cookie.has_expires = 1;
                        cookie.expires = cef::Basetime {
                            val: expiration as i64,
                        };
                    }
                    cookie.same_site = match params.same_site.as_deref() {
                        Some("Strict") => cef::CookieSameSite::STRICT_MODE,
                        Some("Lax") => cef::CookieSameSite::LAX_MODE,
                        Some("None") => cef::CookieSameSite::NO_RESTRICTION,
                        _ => cef::CookieSameSite::UNSPECIFIED,
                    };

                    let mut callback = BunletSetCookieCallback::new();
                    manager.set_cookie(Some(&url), Some(&cookie), Some(&mut callback));
                }
            }
        }
    })
}

pub fn cef_remove_cookie(window_id: u32, name: &str, url: &str) -> Result<(), napi::Error> {
    with_browser(window_id, |browser| {
        if let Some(host) = browser.host() {
            if let Some(rc) = host.request_context() {
                if let Some(manager) = rc.cookie_manager(None) {
                    let cef_url = CefString::from(url);
                    let cef_name = CefString::from(name);
                    let mut callback = BunletDeleteCookiesCallback::new();
                    manager.delete_cookies(Some(&cef_url), Some(&cef_name), Some(&mut callback));
                }
            }
        }
    })
}

pub fn cef_clear_storage_data(
    window_id: u32,
    options: Option<&crate::ClearStorageOptions>,
) -> Result<(), napi::Error> {
    with_browser(window_id, |browser| {
        if let Some(host) = browser.host() {
            if let Some(rc) = host.request_context() {
                if options.map_or(true, |o| o.cookies.unwrap_or(false)) {
                    if let Some(manager) = rc.cookie_manager(None) {
                        let mut callback = BunletDeleteCookiesCallback::new();
                        manager.delete_cookies(None, None, Some(&mut callback));
                    }
                }
            }
        }
    })
}

pub fn cef_get_user_agent(window_id: u32) -> Result<String, napi::Error> {
    with_browser(window_id, |browser| {
        if let Some(host) = browser.host() {
            if let Some(rc) = host.request_context() {
                let default_ua = rc.cache_path();
                let _ = default_ua;
            }
        }
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36".to_string()
    })
}

// ============================================================================
// CEF Cookie visitor callback implementations
// ============================================================================

static COOKIE_RESULTS: once_cell::sync::Lazy<parking_lot::Mutex<Vec<crate::NativeCookie>>> =
    once_cell::sync::Lazy::new(|| parking_lot::Mutex::new(Vec::new()));

wrap_cookie_visitor! {
    struct BunletCookieVisitor;

    impl CookieVisitor {
        fn visit(
            &self,
            cookie: Option<&cef::Cookie>,
            _count: i32,
            _total: i32,
            _delete_cookie: Option<&mut i32>,
        ) -> i32 {
            let Some(cookie) = cookie else { return 0 };
            let native_cookie = crate::NativeCookie {
                name: cookie.name.to_string(),
                value: cookie.value.to_string(),
                domain: {
                    let d = cookie.domain.to_string();
                    if d.is_empty() { None } else { Some(d) }
                },
                path: {
                    let p = cookie.path.to_string();
                    if p.is_empty() { None } else { Some(p) }
                },
                secure: Some(cookie.secure != 0),
                http_only: Some(cookie.httponly != 0),
                same_site: match cookie.same_site {
                    cef::CookieSameSite::STRICT_MODE => Some("Strict".to_string()),
                    cef::CookieSameSite::LAX_MODE => Some("Lax".to_string()),
                    cef::CookieSameSite::NO_RESTRICTION => Some("None".to_string()),
                    _ => None,
                },
                expiration_date: {
                    if cookie.has_expires != 0 {
                        Some(cookie.expires.val as f64)
                    } else {
                        None
                    }
                },
            };
            COOKIE_RESULTS.lock().push(native_cookie);
            1
        }
    }
}

wrap_set_cookie_callback! {
    struct BunletSetCookieCallback;

    impl SetCookieCallback {
        fn on_complete(&self, _success: i32) {}
    }
}

wrap_delete_cookies_callback! {
    struct BunletDeleteCookiesCallback;

    impl DeleteCookiesCallback {
        fn on_complete(&self, _num_deleted: i32) {}
    }
}
