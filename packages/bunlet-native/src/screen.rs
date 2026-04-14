use napi::bindgen_prelude::*;
use napi_derive::napi;

/// Display/monitor information
#[napi(object)]
#[derive(Clone)]
pub struct DisplayInfo {
    /// Unique display identifier
    pub id: u32,
    /// Display name (may be empty on some platforms)
    pub name: String,
    /// X position of the display in virtual screen coordinates
    pub x: i32,
    /// Y position of the display in virtual screen coordinates
    pub y: i32,
    /// Display width in pixels
    pub width: u32,
    /// Display height in pixels
    pub height: u32,
    /// Work area X (excludes taskbar/dock)
    pub work_area_x: i32,
    /// Work area Y (excludes taskbar/dock)
    pub work_area_y: i32,
    /// Work area width (excludes taskbar/dock)
    pub work_area_width: u32,
    /// Work area height (excludes taskbar/dock)
    pub work_area_height: u32,
    /// Display scale factor (DPI scaling)
    pub scale_factor: f64,
    /// Whether this is the primary display
    pub is_primary: bool,
}

/// Get the primary display
#[napi]
pub fn get_primary_display() -> Result<DisplayInfo> {
    #[cfg(target_os = "linux")]
    {
        get_primary_display_gdk()
    }

    #[cfg(not(target_os = "linux"))]
    {
        get_primary_display_tao()
    }
}

/// Get all available displays
#[napi]
pub fn get_all_displays() -> Result<Vec<DisplayInfo>> {
    #[cfg(target_os = "linux")]
    {
        get_all_displays_gdk()
    }

    #[cfg(not(target_os = "linux"))]
    {
        get_all_displays_tao()
    }
}

/// Get display nearest to a point
#[napi]
pub fn get_display_nearest_point(x: i32, y: i32) -> Result<DisplayInfo> {
    #[cfg(target_os = "linux")]
    {
        get_display_nearest_point_gdk(x, y)
    }

    #[cfg(not(target_os = "linux"))]
    {
        get_display_nearest_point_tao(x, y)
    }
}

// =============================================================================
// Linux implementation using GDK (requires GTK to be initialized via init_app)
// =============================================================================

#[cfg(target_os = "linux")]
fn get_primary_display_gdk() -> Result<DisplayInfo> {
    use gtk::gdk;
    use gtk::prelude::*;

    // GTK should already be initialized by init_app() or by TAO's event loop
    // Do NOT call gtk::init() here - it can cause conflicts when called from within the event loop

    let display = gdk::Display::default().ok_or_else(|| {
        Error::new(
            Status::GenericFailure,
            "No display found. Make sure init_app() was called.",
        )
    })?;

    let primary = display
        .primary_monitor()
        .or_else(|| display.monitor(0))
        .ok_or_else(|| Error::new(Status::GenericFailure, "No monitor found"))?;

    let geometry = primary.geometry();
    let workarea = primary.workarea();
    let scale_factor = primary.scale_factor() as f64;
    let name = primary.model().map(|s| s.to_string()).unwrap_or_default();

    Ok(DisplayInfo {
        id: 0,
        name,
        x: geometry.x(),
        y: geometry.y(),
        width: geometry.width() as u32,
        height: geometry.height() as u32,
        work_area_x: workarea.x(),
        work_area_y: workarea.y(),
        work_area_width: workarea.width() as u32,
        work_area_height: workarea.height() as u32,
        scale_factor,
        is_primary: true,
    })
}

#[cfg(target_os = "linux")]
fn get_all_displays_gdk() -> Result<Vec<DisplayInfo>> {
    use gtk::gdk;
    use gtk::prelude::*;

    // GTK should already be initialized by init_app()
    let _ = gtk::init();

    let display = gdk::Display::default().ok_or_else(|| {
        Error::new(
            Status::GenericFailure,
            "No display found. Make sure init_app() was called.",
        )
    })?;

    let primary = display.primary_monitor();
    let n_monitors = display.n_monitors();

    if n_monitors == 0 {
        return Err(Error::new(Status::GenericFailure, "No monitors found"));
    }

    let mut displays = Vec::new();

    for i in 0..n_monitors {
        if let Some(monitor) = display.monitor(i) {
            let geometry = monitor.geometry();
            let workarea = monitor.workarea();
            let scale_factor = monitor.scale_factor() as f64;
            let name = monitor.model().map(|s| s.to_string()).unwrap_or_default();

            let is_primary = primary
                .as_ref()
                .map(|p| p.geometry() == geometry)
                .unwrap_or(i == 0);

            displays.push(DisplayInfo {
                id: i as u32,
                name,
                x: geometry.x(),
                y: geometry.y(),
                width: geometry.width() as u32,
                height: geometry.height() as u32,
                work_area_x: workarea.x(),
                work_area_y: workarea.y(),
                work_area_width: workarea.width() as u32,
                work_area_height: workarea.height() as u32,
                scale_factor,
                is_primary,
            });
        }
    }

    Ok(displays)
}

#[cfg(target_os = "linux")]
fn get_display_nearest_point_gdk(x: i32, y: i32) -> Result<DisplayInfo> {
    use gtk::gdk;
    use gtk::prelude::*;

    // GTK should already be initialized by init_app()
    let _ = gtk::init();

    let display = gdk::Display::default().ok_or_else(|| {
        Error::new(
            Status::GenericFailure,
            "No display found. Make sure init_app() was called.",
        )
    })?;

    let primary = display.primary_monitor();

    // GDK can directly give us the monitor at a point
    let monitor = display
        .monitor_at_point(x, y)
        .or_else(|| display.primary_monitor())
        .or_else(|| display.monitor(0))
        .ok_or_else(|| Error::new(Status::GenericFailure, "No monitor found"))?;

    let geometry = monitor.geometry();
    let workarea = monitor.workarea();
    let scale_factor = monitor.scale_factor() as f64;
    let name = monitor.model().map(|s| s.to_string()).unwrap_or_default();

    // Determine the monitor index
    let n_monitors = display.n_monitors();
    let mut idx = 0u32;
    for i in 0..n_monitors {
        if let Some(m) = display.monitor(i) {
            if m.geometry() == geometry {
                idx = i as u32;
                break;
            }
        }
    }

    let is_primary = primary
        .as_ref()
        .map(|p| p.geometry() == geometry)
        .unwrap_or(idx == 0);

    Ok(DisplayInfo {
        id: idx,
        name,
        x: geometry.x(),
        y: geometry.y(),
        width: geometry.width() as u32,
        height: geometry.height() as u32,
        work_area_x: workarea.x(),
        work_area_y: workarea.y(),
        work_area_width: workarea.width() as u32,
        work_area_height: workarea.height() as u32,
        scale_factor,
        is_primary,
    })
}

// =============================================================================
// Non-Linux implementation
// =============================================================================

/// On macOS/Windows we must NOT create a second EventLoop (it can steal the
/// main run-loop and crash or deadlock). Instead we delegate to system
/// commands that return display info without needing TAO.
///
/// For now the TAO implementations are kept behind a feature flag so they
/// can still be used in contexts where no event loop is running (e.g. tests).

#[cfg(not(target_os = "linux"))]
fn get_primary_display_tao() -> Result<DisplayInfo> {
    // First try to use an existing window's monitor, if any exist.
    // This avoids creating a temporary event loop which can crash on macOS.
    {
        use crate::WINDOWS;
        let windows = WINDOWS.lock();
        for (_, state) in windows.iter() {
            if let Some(monitor) = state.window.primary_monitor() {
                return Ok(monitor_to_display_info(&monitor, 0, true));
            }
            if let Some(monitor) = state.window.current_monitor() {
                return Ok(monitor_to_display_info(&monitor, 0, true));
            }
        }
    }

    // No windows exist yet — fall back to a temporary event loop.
    // This is safe only during app startup before the real loop starts.
    #[cfg(feature = "screen-tao-fallback")]
    {
        use tao::event_loop::EventLoopBuilder;
        let event_loop = EventLoopBuilder::new().build();
        let primary = event_loop
            .primary_monitor()
            .or_else(|| event_loop.available_monitors().next())
            .ok_or_else(|| Error::new(Status::GenericFailure, "No display found"))?;
        Ok(monitor_to_display_info_with_workarea(
            &primary,
            0,
            true,
            &event_loop,
        ))
    }

    #[cfg(not(feature = "screen-tao-fallback"))]
    {
        // Without the fallback feature, return a reasonable default based on
        // system commands on macOS.
        #[cfg(target_os = "macos")]
        {
            get_primary_display_macos()
        }
        #[cfg(target_os = "windows")]
        {
            get_primary_display_windows()
        }
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        {
            Err(Error::new(
                Status::GenericFailure,
                "No display info available",
            ))
        }
    }
}

#[cfg(not(target_os = "linux"))]
fn get_all_displays_tao() -> Result<Vec<DisplayInfo>> {
    // Try to get displays from an existing window's event loop proxy
    {
        use crate::WINDOWS;
        let windows = WINDOWS.lock();
        for (_, state) in windows.iter() {
            let monitors: Vec<DisplayInfo> = state
                .window
                .available_monitors()
                .enumerate()
                .map(|(idx, monitor)| {
                    let is_primary = idx == 0; // approximate
                    monitor_to_display_info(&monitor, idx as u32, is_primary)
                })
                .collect();
            if !monitors.is_empty() {
                return Ok(monitors);
            }
        }
    }

    // No windows — fallback approach
    #[cfg(feature = "screen-tao-fallback")]
    {
        use tao::event_loop::EventLoopBuilder;
        let event_loop = EventLoopBuilder::new().build();
        let primary_name = event_loop.primary_monitor().and_then(|m| m.name());
        let displays: Vec<DisplayInfo> = event_loop
            .available_monitors()
            .enumerate()
            .map(|(idx, monitor)| {
                let name = monitor.name().unwrap_or_default();
                let is_primary = primary_name.as_ref() == Some(&name);
                monitor_to_display_info_with_workarea(&monitor, idx as u32, is_primary, &event_loop)
            })
            .collect();

        if displays.is_empty() {
            return Err(Error::new(Status::GenericFailure, "No displays found"));
        }
        Ok(displays)
    }

    #[cfg(not(feature = "screen-tao-fallback"))]
    {
        // Approximate: just return the primary display
        Ok(vec![get_primary_display_tao()?])
    }
}

/// Convert a TAO monitor handle to DisplayInfo using only monitor geometry.
/// The work area is approximated from the monitor bounds since TAO doesn't
/// expose the work-area rect on all platforms.
#[cfg(not(target_os = "linux"))]
fn monitor_to_display_info(
    monitor: &tao::monitor::MonitorHandle,
    id: u32,
    is_primary: bool,
) -> DisplayInfo {
    let position = monitor.position();
    let size = monitor.size();
    let scale_factor = monitor.scale_factor();
    let name = monitor.name().unwrap_or_default();

    // TAO doesn't expose work-area rects on macOS/Windows.
    // Use the full bounds as a conservative approximation.
    // The TS layer can refine this if needed.
    DisplayInfo {
        id,
        name,
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        work_area_x: position.x,
        work_area_y: position.y,
        work_area_width: size.width,
        work_area_height: size.height,
        scale_factor,
        is_primary,
    }
}

#[cfg(all(not(target_os = "linux"), feature = "screen-tao-fallback"))]
fn monitor_to_display_info_with_workarea(
    monitor: &tao::monitor::MonitorHandle,
    id: u32,
    is_primary: bool,
    _event_loop: &tao::event_loop::EventLoop<()>,
) -> DisplayInfo {
    monitor_to_display_info(monitor, id, is_primary)
}

/// Get display info on macOS using system_profiler defaults
#[cfg(target_os = "macos")]
fn get_primary_display_macos() -> Result<DisplayInfo> {
    // Use system preferences to get screen dimensions
    // Fall back to a reasonable default
    let output = std::process::Command::new("osascript")
        .args([
            "-e",
            "tell application \"Finder\" to get bounds of window of desktop",
        ])
        .output();

    // Parse bounds: {0, 25, 1920, 1175} (x, y, width-end, height-end)
    let mut x = 0;
    let mut y = 25; // approximate menu bar height
    let mut width: u32 = 1920;
    let mut height: u32 = 1175;

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        // Parse AppleScript list output
        let nums: Vec<i32> = stdout
            .trim()
            .trim_start_matches('{')
            .trim_end_matches('}')
            .split(',')
            .filter_map(|s| s.trim().parse::<i32>().ok())
            .collect();
        if nums.len() >= 4 {
            x = nums[0];
            y = nums[1];
            width = (nums[2] - nums[0]) as u32;
            height = (nums[3] - nums[1]) as u32;
        }
    }

    Ok(DisplayInfo {
        id: 0,
        name: String::new(),
        x,
        y: 0,
        width,
        height: height + y as u32,
        work_area_x: x,
        work_area_y: y,
        work_area_width: width,
        work_area_height: height,
        scale_factor: 1.0,
        is_primary: true,
    })
}

/// Get display info on Windows using PowerShell
#[cfg(target_os = "windows")]
fn get_primary_display_windows() -> Result<DisplayInfo> {
    let output = std::process::Command::new("powershell")
        .args([
            "-Command",
            "Add-Type -AssemblyName System.Windows.Forms; \
             $s = [System.Windows.Forms.Screen]::PrimaryScreen; \
             \"{0},{1},{2},{3},{4},{5},{6},{7}\" -f \
             $s.Bounds.X, $s.Bounds.Y, $s.Bounds.Width, $s.Bounds.Height, \
             $s.WorkingArea.X, $s.WorkingArea.Y, $s.WorkingArea.Width, $s.WorkingArea.Height",
        ])
        .output();

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let parts: Vec<&str> = stdout.trim().split(',').collect();
        if parts.len() >= 8 {
            if let (Ok(bx), Ok(by), Ok(bw), Ok(bh), Ok(wx), Ok(wy), Ok(ww), Ok(wh)) = (
                parts[0].parse::<i32>(),
                parts[1].parse::<i32>(),
                parts[2].parse::<u32>(),
                parts[3].parse::<u32>(),
                parts[4].parse::<i32>(),
                parts[5].parse::<i32>(),
                parts[6].parse::<u32>(),
                parts[7].parse::<u32>(),
            ) {
                return Ok(DisplayInfo {
                    id: 0,
                    name: String::new(),
                    x: bx,
                    y: by,
                    width: bw,
                    height: bh,
                    work_area_x: wx,
                    work_area_y: wy,
                    work_area_width: ww,
                    work_area_height: wh,
                    scale_factor: 1.0,
                    is_primary: true,
                });
            }
        }
    }

    // Fallback
    Ok(DisplayInfo {
        id: 0,
        name: String::new(),
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        work_area_x: 0,
        work_area_y: 0,
        work_area_width: 1920,
        work_area_height: 1040,
        scale_factor: 1.0,
        is_primary: true,
    })
}

#[cfg(not(target_os = "linux"))]
fn get_display_nearest_point_tao(x: i32, y: i32) -> Result<DisplayInfo> {
    // Get all displays and find the nearest one
    let displays = get_all_displays_tao()?;

    // First check if point is inside any monitor
    for display in &displays {
        if x >= display.x
            && x < display.x + display.width as i32
            && y >= display.y
            && y < display.y + display.height as i32
        {
            return Ok(display.clone());
        }
    }

    // Find nearest by distance to center
    let mut best_display = displays
        .first()
        .ok_or_else(|| Error::new(Status::GenericFailure, "No displays found"))?
        .clone();
    let mut best_distance = i64::MAX;

    for display in &displays {
        let center_x = display.x + (display.width as i32 / 2);
        let center_y = display.y + (display.height as i32 / 2);
        let dx = (x - center_x) as i64;
        let dy = (y - center_y) as i64;
        let distance = dx * dx + dy * dy;

        if distance < best_distance {
            best_distance = distance;
            best_display = display.clone();
        }
    }

    Ok(best_display)
}

/// Get cursor screen point
#[napi]
pub fn get_cursor_screen_point() -> Result<CursorPoint> {
    #[cfg(target_os = "linux")]
    {
        use gtk::gdk;
        use gtk::prelude::*;

        // GTK should already be initialized by init_app() or by TAO's event loop
        // Do NOT call gtk::init() here

        if let Some(display) = gdk::Display::default() {
            if let Some(seat) = display.default_seat() {
                if let Some(pointer) = seat.pointer() {
                    let (_, x, y) = pointer.position();
                    return Ok(CursorPoint { x, y });
                }
            }
        }

        Ok(CursorPoint { x: 0, y: 0 })
    }

    #[cfg(not(target_os = "linux"))]
    {
        // On macOS, use CoreGraphics via system command to get cursor position
        #[cfg(target_os = "macos")]
        {
            let output = std::process::Command::new("osascript")
                .args([
                    "-e",
                    "tell application \"System Events\" to get {mouseX, mouseY}",
                ])
                .output();

            if let Ok(output) = output {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let parts: Vec<&str> = stdout.trim().split(',').collect();
                if parts.len() >= 2 {
                    if let (Ok(x), Ok(y)) = (
                        parts[0].trim().parse::<i32>(),
                        parts[1].trim().parse::<i32>(),
                    ) {
                        return Ok(CursorPoint { x, y });
                    }
                }
            }
        }

        // On Windows, use PowerShell
        #[cfg(target_os = "windows")]
        {
            let output = std::process::Command::new("powershell")
                .args(["-Command", "[System.Windows.Forms.Cursor]::Position | ForEach-Object { \"{0},{1}\" -f $_.X, $_.Y }"])
                .output();

            if let Ok(output) = output {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let parts: Vec<&str> = stdout.trim().split(',').collect();
                if parts.len() >= 2 {
                    if let (Ok(x), Ok(y)) = (
                        parts[0].trim().parse::<i32>(),
                        parts[1].trim().parse::<i32>(),
                    ) {
                        return Ok(CursorPoint { x, y });
                    }
                }
            }
        }

        // Fallback: try to get from existing window
        {
            use crate::WINDOWS;
            let windows = WINDOWS.lock();
            for (_, state) in windows.iter() {
                if let Ok(pos) = state.window.cursor_position() {
                    return Ok(CursorPoint {
                        x: pos.x as i32,
                        y: pos.y as i32,
                    });
                }
            }
        }

        Ok(CursorPoint { x: 0, y: 0 })
    }
}

/// Cursor position on screen
#[napi(object)]
#[derive(Clone)]
pub struct CursorPoint {
    pub x: i32,
    pub y: i32,
}
