//! Power Monitor API for Bunlet
//!
//! Provides power management information and events.

use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

/// Power state callback
static POWER_CALLBACK: Lazy<Mutex<Option<ThreadsafeFunction<PowerEvent, ErrorStrategy::Fatal>>>> =
    Lazy::new(|| Mutex::new(None));

/// Whether monitoring is active
static MONITORING: AtomicBool = AtomicBool::new(false);

/// Last known AC power state
static LAST_ON_AC: AtomicBool = AtomicBool::new(true);

/// Power event types
#[napi(object)]
pub struct PowerEvent {
    /// Event type: "suspend", "resume", "on-ac", "on-battery", "shutdown", "lock-screen"
    pub event_type: String,
}

/// Battery information
#[napi(object)]
pub struct BatteryInfo {
    /// Battery level percentage (0-100)
    pub level: f64,
    /// Whether the device is charging
    pub charging: bool,
    /// Whether the device is on AC power
    pub on_ac: bool,
    /// Estimated time remaining in seconds (-1 if unknown)
    pub time_remaining: i64,
}

/// System idle state
#[napi(object)]
pub struct IdleState {
    /// Idle state: "active", "idle", "locked", "unknown"
    pub state: String,
    /// Idle time in seconds
    pub idle_time: i64,
}

/// Initialize power monitoring
#[napi]
pub fn init_power_monitor() {
    // Start monitoring thread if not already running
    if MONITORING.swap(true, Ordering::SeqCst) {
        return; // Already monitoring
    }

    thread::spawn(|| {
        let mut last_on_ac = is_on_ac_power();
        LAST_ON_AC.store(last_on_ac, Ordering::SeqCst);

        while MONITORING.load(Ordering::SeqCst) {
            // Poll for AC power changes
            let current_on_ac = is_on_ac_power();
            if current_on_ac != last_on_ac {
                last_on_ac = current_on_ac;
                LAST_ON_AC.store(current_on_ac, Ordering::SeqCst);

                let event_type = if current_on_ac {
                    "on-ac".to_string()
                } else {
                    "on-battery".to_string()
                };

                if let Some(callback) = POWER_CALLBACK.lock().as_ref() {
                    callback.call(PowerEvent { event_type }, ThreadsafeFunctionCallMode::Blocking);
                }
            }

            thread::sleep(Duration::from_secs(5));
        }
    });
}

/// Stop power monitoring
#[napi]
pub fn stop_power_monitor() {
    MONITORING.store(false, Ordering::SeqCst);
}

/// Set the power event callback
#[napi]
pub fn set_power_callback(callback: ThreadsafeFunction<PowerEvent, ErrorStrategy::Fatal>) {
    *POWER_CALLBACK.lock() = Some(callback);
}

/// Get battery information
#[napi]
pub fn get_battery_info() -> BatteryInfo {
    #[cfg(target_os = "linux")]
    {
        get_battery_info_linux()
    }

    #[cfg(target_os = "macos")]
    {
        get_battery_info_macos()
    }

    #[cfg(target_os = "windows")]
    {
        get_battery_info_windows()
    }
}

/// Check if on battery power
#[napi]
pub fn is_on_battery_power() -> bool {
    !is_on_ac_power()
}

/// Get system idle state
#[napi]
pub fn get_system_idle_state(idle_threshold: u32) -> IdleState {
    let idle_time = get_system_idle_time();
    let state = if idle_time >= idle_threshold as i64 {
        "idle"
    } else {
        "active"
    };

    IdleState {
        state: state.to_string(),
        idle_time,
    }
}

/// Get system idle time in seconds
#[napi]
pub fn get_system_idle_time() -> i64 {
    #[cfg(target_os = "linux")]
    {
        get_idle_time_linux()
    }

    #[cfg(target_os = "macos")]
    {
        get_idle_time_macos()
    }

    #[cfg(target_os = "windows")]
    {
        get_idle_time_windows()
    }
}

// ============================================================================
// Linux implementation
// ============================================================================

#[cfg(target_os = "linux")]
fn is_on_ac_power() -> bool {
    // Check /sys/class/power_supply/*/online for AC adapters
    if let Ok(entries) = std::fs::read_dir("/sys/class/power_supply") {
        for entry in entries.flatten() {
            let path = entry.path();
            let type_path = path.join("type");

            // Check if this is an AC adapter (Mains)
            if let Ok(ptype) = std::fs::read_to_string(&type_path) {
                if ptype.trim() == "Mains" {
                    let online_path = path.join("online");
                    if let Ok(online) = std::fs::read_to_string(&online_path) {
                        if online.trim() == "1" {
                            return true;
                        }
                    }
                }
            }
        }
    }
    // Default to on AC if we can't determine (desktop without battery)
    true
}

#[cfg(target_os = "linux")]
fn get_battery_info_linux() -> BatteryInfo {
    let mut level = 100.0;
    let mut charging = false;
    let mut on_ac = is_on_ac_power();
    let mut time_remaining: i64 = -1;

    // Find battery in /sys/class/power_supply
    if let Ok(entries) = std::fs::read_dir("/sys/class/power_supply") {
        for entry in entries.flatten() {
            let path = entry.path();
            let type_path = path.join("type");

            // Check if this is a battery
            if let Ok(ptype) = std::fs::read_to_string(&type_path) {
                if ptype.trim() == "Battery" {
                    // Read capacity
                    let capacity_path = path.join("capacity");
                    if let Ok(cap) = std::fs::read_to_string(&capacity_path) {
                        if let Ok(val) = cap.trim().parse::<f64>() {
                            level = val;
                        }
                    }

                    // Read status
                    let status_path = path.join("status");
                    if let Ok(status) = std::fs::read_to_string(&status_path) {
                        let status = status.trim();
                        charging = status == "Charging";
                        on_ac = status == "Charging" || status == "Full";
                    }

                    // Try to calculate time remaining
                    let energy_now_path = path.join("energy_now");
                    let power_now_path = path.join("power_now");
                    if let (Ok(energy_now), Ok(power_now)) = (
                        std::fs::read_to_string(&energy_now_path),
                        std::fs::read_to_string(&power_now_path),
                    ) {
                        if let (Ok(energy), Ok(power)) = (
                            energy_now.trim().parse::<i64>(),
                            power_now.trim().parse::<i64>(),
                        ) {
                            if power > 0 {
                                // Time in seconds = (energy in µWh / power in µW) * 3600
                                time_remaining = (energy * 3600) / power;
                            }
                        }
                    }

                    break;
                }
            }
        }
    }

    BatteryInfo {
        level,
        charging,
        on_ac,
        time_remaining,
    }
}

#[cfg(target_os = "linux")]
fn get_idle_time_linux() -> i64 {
    // Try using libxdo to get X11 idle time
    // Fallback: use /proc/uptime - not really user idle time but process uptime
    // Real implementation would use XScreenSaverQueryInfo or D-Bus idle inhibitor
    0
}

// ============================================================================
// macOS implementation (stubs)
// ============================================================================

#[cfg(target_os = "macos")]
fn is_on_ac_power() -> bool {
    // Would use IOKit to get power source information
    true
}

#[cfg(target_os = "macos")]
fn get_battery_info_macos() -> BatteryInfo {
    // Would use IOKit IOPSCopyPowerSourcesInfo
    BatteryInfo {
        level: 100.0,
        charging: false,
        on_ac: true,
        time_remaining: -1,
    }
}

#[cfg(target_os = "macos")]
fn get_idle_time_macos() -> i64 {
    // Would use IOKit HIDIdleTime
    0
}

// ============================================================================
// Windows implementation (stubs)
// ============================================================================

#[cfg(target_os = "windows")]
fn is_on_ac_power() -> bool {
    // Would use GetSystemPowerStatus
    true
}

#[cfg(target_os = "windows")]
fn get_battery_info_windows() -> BatteryInfo {
    // Would use GetSystemPowerStatus
    BatteryInfo {
        level: 100.0,
        charging: false,
        on_ac: true,
        time_remaining: -1,
    }
}

#[cfg(target_os = "windows")]
fn get_idle_time_windows() -> i64 {
    // Would use GetLastInputInfo
    0
}
