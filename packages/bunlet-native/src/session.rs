//! Session and Cookie Management API for Bunlet
//!
//! Provides cookie management and session handling for browser windows.

use crate::WINDOWS;
use napi::bindgen_prelude::*;
use napi_derive::napi;

/// Cookie information
#[napi(object)]
pub struct Cookie {
    /// Cookie name
    pub name: String,
    /// Cookie value
    pub value: String,
    /// Cookie domain
    pub domain: Option<String>,
    /// Cookie path
    pub path: Option<String>,
    /// Whether cookie is secure
    pub secure: Option<bool>,
    /// Whether cookie is HTTP-only
    pub http_only: Option<bool>,
    /// Whether cookie is for same-site only
    pub same_site: Option<String>,
    /// Expiration date in Unix timestamp (seconds)
    pub expiration_date: Option<f64>,
}

/// Get cookies for a window using JavaScript
///
/// **Limitation**: The system webview backend (wry) does not support returning
/// values from `evaluate_script`. This function fires the JS snippet but cannot
/// retrieve `document.cookie`, so it always returns an empty array. For real
/// cookie access, use the CEF backend which has native cookie APIs via
/// `RequestContext`.
#[napi]
pub async fn get_cookies(_window_id: u32) -> Result<Vec<Cookie>> {
    // evaluate_script is fire-and-forget in wry; we cannot read document.cookie
    // results back. Return an empty vec and log a warning once.
    static WARNED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
    if !WARNED.swap(true, std::sync::atomic::Ordering::Relaxed) {
        eprintln!("[bunlet] Warning: session.cookies.get() always returns [] with the system webview backend. Use the CEF backend for real cookie access.");
    }
    Ok(Vec::new())
}

/// Set a cookie for a window
#[napi]
pub fn set_cookie(window_id: u32, cookie: Cookie) -> Result<()> {
    let mut cookie_str = format!("{}={}", cookie.name, cookie.value);

    if let Some(domain) = &cookie.domain {
        cookie_str.push_str(&format!(";domain={}", domain));
    }
    if let Some(path) = &cookie.path {
        cookie_str.push_str(&format!(";path={}", path));
    } else {
        cookie_str.push_str(";path=/");
    }
    if cookie.secure.unwrap_or(false) {
        cookie_str.push_str(";secure");
    }
    if let Some(same_site) = &cookie.same_site {
        cookie_str.push_str(&format!(";samesite={}", same_site));
    }
    if let Some(exp) = cookie.expiration_date {
        // Convert Unix timestamp to UTC date string
        let date = chrono_lite_format(exp as i64);
        cookie_str.push_str(&format!(";expires={}", date));
    }

    let script = format!(
        "document.cookie = {};",
        serde_json::to_string(&cookie_str).unwrap_or_default()
    );

    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::GenericFailure, "Window not found"))?;

    state
        .webview
        .evaluate_script(&script)
        .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;

    Ok(())
}

/// Remove a cookie by name and URL
/// Sets an expired cookie to delete it, matching the domain and path from the URL.
#[napi]
pub fn remove_cookie(window_id: u32, name: String, url: Option<String>) -> Result<()> {
    let mut script_parts = vec![
        format!("{}=;expires=Thu, 01 Jan 1970 00:00:00 GMT", name),
    ];

    // Always set path=/ to cover the broadest scope
    script_parts.push("path=/".to_string());

    // If a URL is provided, extract and set the domain so cookies scoped to
    // that domain (including .example.com) are also removed.
    if let Some(url) = url {
        if let Some(domain) = extract_domain(&url) {
            script_parts.push(format!("domain={}", domain));
        }
    }

    let cookie_str = script_parts.join(";");
    let script = format!(
        "document.cookie = {};",
        serde_json::to_string(&cookie_str).unwrap_or_default()
    );

    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::GenericFailure, "Window not found"))?;

    state
        .webview
        .evaluate_script(&script)
        .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;

    Ok(())
}

/// Clear all storage data for a window (cookies, localStorage, sessionStorage)
#[napi]
pub fn clear_storage_data(window_id: u32, options: Option<ClearStorageOptions>) -> Result<()> {
    let opts = options.unwrap_or_default();
    let mut scripts = Vec::new();

    // Clear cookies
    if opts.cookies.unwrap_or(true) {
        scripts.push(
            r#"
            document.cookie.split(';').forEach(function(c) {
                var name = c.split('=')[0].trim();
                if (name) {
                    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
                }
            });
            "#
            .to_string(),
        );
    }

    // Clear localStorage
    if opts.local_storage.unwrap_or(true) {
        scripts.push("try { localStorage.clear(); } catch(e) {}".to_string());
    }

    // Clear sessionStorage
    if opts.session_storage.unwrap_or(true) {
        scripts.push("try { sessionStorage.clear(); } catch(e) {}".to_string());
    }

    // Clear indexedDB
    if opts.indexed_db.unwrap_or(true) {
        scripts.push(
            r#"
            try {
                indexedDB.databases().then(function(dbs) {
                    dbs.forEach(function(db) { indexedDB.deleteDatabase(db.name); });
                });
            } catch(e) {}
            "#
            .to_string(),
        );
    }

    // Clear cache storage
    if opts.cache_storage.unwrap_or(true) {
        scripts.push(
            r#"
            try {
                caches.keys().then(function(names) {
                    names.forEach(function(name) { caches.delete(name); });
                });
            } catch(e) {}
            "#
            .to_string(),
        );
    }

    let combined_script = scripts.join("\n");

    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::GenericFailure, "Window not found"))?;

    state
        .webview
        .evaluate_script(&combined_script)
        .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;

    Ok(())
}

/// Options for clearing storage data
#[napi(object)]
#[derive(Default)]
pub struct ClearStorageOptions {
    /// Clear cookies (default: true)
    pub cookies: Option<bool>,
    /// Clear localStorage (default: true)
    pub local_storage: Option<bool>,
    /// Clear sessionStorage (default: true)
    pub session_storage: Option<bool>,
    /// Clear indexedDB (default: true)
    pub indexed_db: Option<bool>,
    /// Clear cache storage (default: true)
    pub cache_storage: Option<bool>,
}

/// Get the user agent string for a window
///
/// **Limitation**: The system webview backend cannot return values from
/// `evaluate_script`. This always returns an empty string. Use the CEF backend
/// for real user agent access.
#[napi]
pub async fn get_user_agent(_window_id: u32) -> Result<String> {
    Ok(String::new())
}

/// Set a custom user agent (must be called before loading content)
/// Note: This is limited - full user agent override requires native implementation at WebView creation
#[napi]
pub fn set_user_agent(_window_id: u32, _user_agent: String) -> Result<()> {
    Err(Error::new(
        Status::GenericFailure,
        "setUserAgent must be called in BrowserWindow options, not after creation",
    ))
}

// Simple domain extraction from URL
fn extract_domain(url: &str) -> Option<String> {
    url.strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))
        .and_then(|s| s.split('/').next())
        .and_then(|s| s.split(':').next())
        .map(|s| s.to_string())
}

// Simple date formatting for cookie expiration (no chrono dependency)
fn chrono_lite_format(timestamp: i64) -> String {
    // Simple Unix timestamp to HTTP date format
    // This is a basic implementation - could be enhanced
    let days_since_epoch = timestamp / 86400;
    let secs_in_day = timestamp % 86400;
    let hours = secs_in_day / 3600;
    let mins = (secs_in_day % 3600) / 60;
    let secs = secs_in_day % 60;

    // Calculate year, month, day from days since epoch (Jan 1, 1970)
    let mut year = 1970i64;
    let mut remaining_days = days_since_epoch;

    loop {
        let days_in_year = if is_leap_year(year) { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        year += 1;
    }

    let days_in_months: [i64; 12] = if is_leap_year(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut month = 0;
    for (i, &days) in days_in_months.iter().enumerate() {
        if remaining_days < days {
            month = i;
            break;
        }
        remaining_days -= days;
    }

    let day = remaining_days + 1;
    let month_names = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    format!(
        "{:02} {} {} {:02}:{:02}:{:02} GMT",
        day, month_names[month], year, hours, mins, secs
    )
}

fn is_leap_year(year: i64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}
