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
                    callback.call(
                        PowerEvent { event_type },
                        ThreadsafeFunctionCallMode::Blocking,
                    );
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
    // Try xprintidle (X11 idle time via XScreenSaver extension)
    let output = std::process::Command::new("xprintidle").output();

    if let Ok(output) = output {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Ok(ms) = stdout.trim().parse::<i64>() {
                return ms / 1000;
            }
        }
    }

    // Fallback: try xdg-screensaver reset or check for X11 via xdpyinfo
    // If none available, return 0 as a safe default
    0
}

// ============================================================================
// macOS implementation (stubs)
// ============================================================================

#[cfg(target_os = "macos")]
fn is_on_ac_power() -> bool {
    // Use pmset to check AC power status
    std::process::Command::new("pmset")
        .arg("ac")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(true)
}

#[cfg(target_os = "macos")]
fn get_battery_info_macos() -> BatteryInfo {
    // Use pmset -g batt to get battery info on macOS
    let output = std::process::Command::new("pmset")
        .args(["-g", "batt"])
        .output();

    let mut level = 100.0;
    let mut charging = false;
    let mut on_ac = true;
    let mut time_remaining: i64 = -1;

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);

        // Example output:
        // -InternalBattery-0 (id=4811597)	42%; discharging; (3:14 remaining)
        // -InternalBattery-0 (id=4811597)	100%; charged; 0:00 remaining
        // -InternalBattery-0 (id=4811597)	85%; charging; (1:23 remaining)
        // No batteries available

        if stdout.contains("No batteries available") {
            return BatteryInfo {
                level: 100.0,
                charging: false,
                on_ac: true,
                time_remaining: -1,
            };
        }

        // Parse percentage
        if let Some(pct_str) = stdout.split('%').next() {
            if let Some(num_part) = pct_str.rsplit(|c: char| !c.is_ascii_digit()).next() {
                if let Ok(pct) = num_part.parse::<f64>() {
                    level = pct;
                }
            }
        }

        // Parse charging status
        if stdout.contains("charging") && !stdout.contains("discharging") {
            charging = true;
            on_ac = true;
        } else if stdout.contains("charged") {
            charging = false;
            on_ac = true;
        } else if stdout.contains("discharging") {
            charging = false;
            on_ac = false;
        } else if stdout.contains("AC Power") {
            charging = false;
            on_ac = true;
        }

        // Parse time remaining: "(3:14 remaining)" or "0:00 remaining"
        if let Some(time_part) = stdout.split("remaining").next() {
            // Find the last '(' before "remaining"
            if let Some(paren_start) = time_part.rfind('(') {
                let time_str = &time_part[paren_start + 1..];
                // Parse H:MM format
                let parts: Vec<&str> = time_str.split(':').collect();
                if parts.len() == 2 {
                    if let (Ok(h), Ok(m)) = (
                        parts[0].trim().parse::<i64>(),
                        parts[1].trim().parse::<i64>(),
                    ) {
                        time_remaining = h * 3600 + m * 60;
                    }
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

#[cfg(target_os = "macos")]
fn get_idle_time_macos() -> i64 {
    // Use ioreg to read HIDIdleTime from IOKit
    // HIDIdleTime is in nanoseconds
    let output = std::process::Command::new("ioreg")
        .args(["-c", "IOHIDSystem"])
        .output();

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        // Look for "HIDIdleTime" = <number>
        for line in stdout.lines() {
            if line.contains("HIDIdleTime") {
                // Parse the value - format: "HIDIdleTime" = <number>
                if let Some(eq_idx) = line.find('=') {
                    let value_str = line[eq_idx + 1..].trim();
                    // Strip angle brackets if present: <number>
                    let cleaned = value_str.trim_start_matches('<').trim_end_matches('>');
                    if let Ok(ns) = cleaned.parse::<i64>() {
                        // Convert nanoseconds to seconds
                        return ns / 1_000_000_000;
                    }
                    // Also try plain number
                    if let Ok(ns) = value_str.trim().parse::<i64>() {
                        return ns / 1_000_000_000;
                    }
                }
            }
        }
    }

    // Fallback: use IOKit power assertions idle time via pmset
    let output = std::process::Command::new("python3")
        .args([
            "-c",
            "import subprocess; r=subprocess.run(['ioreg','-c','IOHIDSystem'],capture_output=True,text=True); \
             lines=r.stdout.split('\\n'); \
             [print(int(l.split('=')[-1].strip().strip('<>').strip())/1e9) for l in lines if 'HIDIdleTime' in l]",
        ])
        .output();

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Ok(secs) = stdout.trim().parse::<i64>() {
            return secs;
        }
    }

    0
}

// ============================================================================
// Windows implementation (stubs)
// ============================================================================

#[cfg(target_os = "windows")]
fn is_on_ac_power() -> bool {
    // Use PowerShell to check AC power status
    let output = std::process::Command::new("powershell")
        .args([
            "-Command",
            "([System.Windows.Forms.SystemInformation]::PowerStatus.PowerLineStatus -eq 1)",
        ])
        .output();

    match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).trim().to_lowercase() == "true",
        Err(_) => true,
    }
}

#[cfg(target_os = "windows")]
fn get_battery_info_windows() -> BatteryInfo {
    // Use PowerShell to get battery information
    let output = std::process::Command::new("powershell")
        .args([
            "-Command",
            "$b = [System.Windows.Forms.SystemInformation]::PowerStatus; \
             \"{0}|{1}|{2}\" -f $b.BatteryLifePercent, $b.BatteryChargeStatus, $b.PowerLineStatus",
        ])
        .output();

    let mut level = 100.0;
    let mut charging = false;
    let mut on_ac = true;
    let mut time_remaining: i64 = -1;

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let parts: Vec<&str> = stdout.trim().split('|').collect();
        if parts.len() >= 3 {
            if let Ok(pct) = parts[0].parse::<f64>() {
                level = pct * 100.0; // BatteryLifePercent is 0.0-1.0
            }
            // PowerLineStatus: 0=Offline, 1=Online, 2=Unknown
            on_ac = parts[2].trim() != "0";
            charging = on_ac && level < 100.0;
        }
    }

    BatteryInfo {
        level,
        charging,
        on_ac,
        time_remaining,
    }
}

/// Best-effort thermal-state probe.
///
/// Returns one of `nominal | fair | serious | critical`. Implementations
/// shell out to OS tools instead of binding IOKit/WMI directly — fewer
/// deps, easier to keep building across all 3 OS. When parsing fails or
/// the OS gives no usable signal, returns `nominal`.
#[napi]
pub fn get_thermal_state() -> String {
    #[cfg(target_os = "linux")]
    {
        thermal_state_linux()
    }
    #[cfg(target_os = "macos")]
    {
        thermal_state_macos()
    }
    #[cfg(target_os = "windows")]
    {
        thermal_state_windows()
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        "nominal".to_string()
    }
}

#[cfg(target_os = "linux")]
fn thermal_state_linux() -> String {
    use std::fs;
    let mut hottest_milli_c: Option<i64> = None;
    for zone in 0..8 {
        let path = format!("/sys/class/thermal/thermal_zone{}/temp", zone);
        if let Ok(s) = fs::read_to_string(&path) {
            if let Ok(v) = s.trim().parse::<i64>() {
                hottest_milli_c = Some(hottest_milli_c.map(|prev| prev.max(v)).unwrap_or(v));
            }
        }
    }
    let milli = hottest_milli_c.unwrap_or(0);
    let c = milli / 1000;
    match c {
        c if c < 60 => "nominal",
        c if c < 75 => "fair",
        c if c < 90 => "serious",
        _ => "critical",
    }
    .to_string()
}

#[cfg(target_os = "macos")]
fn thermal_state_macos() -> String {
    // `pmset -g therm` prints e.g. CPU_Speed_Limit = 100. Drops below 100
    // indicate thermal pressure; map deeper drops to worse states.
    let output = std::process::Command::new("pmset")
        .args(["-g", "therm"])
        .output();
    let Ok(out) = output else {
        return "nominal".to_string();
    };
    let s = String::from_utf8_lossy(&out.stdout);
    let mut speed: i64 = 100;
    for line in s.lines() {
        if line.contains("CPU_Speed_Limit") {
            if let Some(eq) = line.split('=').nth(1) {
                if let Ok(v) = eq.trim().parse::<i64>() {
                    speed = v;
                }
            }
        }
    }
    match speed {
        s if s >= 100 => "nominal",
        s if s >= 80 => "fair",
        s if s >= 50 => "serious",
        _ => "critical",
    }
    .to_string()
}

#[cfg(target_os = "windows")]
fn thermal_state_windows() -> String {
    // WMI MSAcpi_ThermalZoneTemperature reports kelvin * 10. Many systems
    // refuse without admin or expose no zones at all; return nominal
    // rather than throw in that case.
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "(Get-WmiObject -Namespace 'root\\WMI' -Class 'MSAcpi_ThermalZoneTemperature' -ErrorAction SilentlyContinue | Measure-Object -Property CurrentTemperature -Maximum).Maximum",
        ])
        .output();
    let Ok(out) = output else {
        return "nominal".to_string();
    };
    let raw = String::from_utf8_lossy(&out.stdout);
    let Some(kelvin_x10) = raw.trim().parse::<f64>().ok() else {
        return "nominal".to_string();
    };
    let c = kelvin_x10 / 10.0 - 273.15;
    match c {
        c if c < 60.0 => "nominal",
        c if c < 75.0 => "fair",
        c if c < 90.0 => "serious",
        _ => "critical",
    }
    .to_string()
}

#[cfg(target_os = "windows")]
fn get_idle_time_windows() -> i64 {
    // Use PowerShell with user32.dll GetLastInputInfo
    let output = std::process::Command::new("powershell")
        .args([
            "-Command",
            "Add-Type @'\\nusing System;\\nusing System.Runtime.InteropServices;\\npublic class Idle { [DllImport(\\\"user32.dll\\\")] static extern bool GetLastInputInfo(ref LASTINPUTINFO plii); [StructLayout(LayoutKind.Sequential)] struct LASTINPUTINFO { public uint cbSize; public uint dwTime; } public static int GetIdleSeconds() { LASTINPUTINFO lii = new LASTINPUTINFO(); lii.cbSize = (uint)Marshal.SizeOf(typeof(LASTINPUTINFO)); GetLastInputInfo(ref lii); return (Environment.TickCount - (int)lii.dwTime) / 1000; } }\\n'@; [Idle]::GetIdleSeconds()",
        ])
        .output();

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Ok(secs) = stdout.trim().parse::<i64>() {
            return secs.max(0);
        }
    }

    0
}
