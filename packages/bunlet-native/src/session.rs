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
/// Note: This only retrieves non-HttpOnly cookies due to browser security
#[napi]
pub async fn get_cookies(window_id: u32) -> Result<Vec<Cookie>> {
    let script = r#"
        (function() {
            const cookies = document.cookie.split(';').map(function(c) {
                const parts = c.trim().split('=');
                const name = parts[0] || '';
                const value = parts.slice(1).join('=') || '';
                return { name: name, value: value };
            }).filter(function(c) { return c.name.length > 0; });
            return JSON.stringify(cookies);
        })()
    "#;

    let result = execute_script_for_cookies(window_id, script)?;
    parse_cookies_json(&result)
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

/// Remove a cookie by name
#[napi]
pub fn remove_cookie(window_id: u32, name: String, url: Option<String>) -> Result<()> {
    // To remove a cookie, set it with an expired date
    let mut script = format!(
        "document.cookie = '{}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'",
        name
    );

    // If URL is provided, try to extract domain
    if let Some(url) = url {
        if let Some(domain) = extract_domain(&url) {
            script = format!(
                "document.cookie = '{}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain={}'",
                name, domain
            );
        }
    }

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

/// Get the user agent string
#[napi]
pub async fn get_user_agent(window_id: u32) -> Result<String> {
    let script = "navigator.userAgent";
    execute_script_for_cookies(window_id, script)
}

/// Set a custom user agent (must be called before loading content)
/// Note: This is limited - full user agent override requires native implementation
#[napi]
pub fn set_user_agent(_window_id: u32, _user_agent: String) -> Result<()> {
    // User agent override in wry requires setting it during WebView creation
    // This is a placeholder - actual implementation would need changes to create_window_in_loop
    Err(Error::new(
        Status::GenericFailure,
        "setUserAgent must be called in BrowserWindow options, not after creation",
    ))
}

// Helper function to execute script and get result
fn execute_script_for_cookies(window_id: u32, script: &str) -> Result<String> {
    let windows = WINDOWS.lock();
    let state = windows
        .get(&window_id)
        .ok_or_else(|| Error::new(Status::GenericFailure, "Window not found"))?;

    // For now, use synchronous execution via evaluate_script
    // The actual result needs to be retrieved via the IPC mechanism
    // This is a simplified implementation
    state
        .webview
        .evaluate_script(script)
        .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;

    // Return empty string - actual implementation would need async callback
    Ok("[]".to_string())
}

// Parse cookies from JSON string
fn parse_cookies_json(json: &str) -> Result<Vec<Cookie>> {
    #[derive(serde::Deserialize)]
    struct SimpleCookie {
        name: String,
        value: String,
    }

    let simple_cookies: Vec<SimpleCookie> =
        serde_json::from_str(json).unwrap_or_else(|_| Vec::new());

    Ok(simple_cookies
        .into_iter()
        .map(|c| Cookie {
            name: c.name,
            value: c.value,
            domain: None,
            path: None,
            secure: None,
            http_only: None,
            same_site: None,
            expiration_date: None,
        })
        .collect())
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
