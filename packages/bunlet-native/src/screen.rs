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

    let display = gdk::Display::default()
        .ok_or_else(|| Error::new(Status::GenericFailure, "No display found. Make sure init_app() was called."))?;

    let primary = display.primary_monitor()
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

    let display = gdk::Display::default()
        .ok_or_else(|| Error::new(Status::GenericFailure, "No display found. Make sure init_app() was called."))?;

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

            let is_primary = primary.as_ref().map(|p| {
                p.geometry() == geometry
            }).unwrap_or(i == 0);

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

    let display = gdk::Display::default()
        .ok_or_else(|| Error::new(Status::GenericFailure, "No display found. Make sure init_app() was called."))?;

    let primary = display.primary_monitor();

    // GDK can directly give us the monitor at a point
    let monitor = display.monitor_at_point(x, y)
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

    let is_primary = primary.as_ref().map(|p| {
        p.geometry() == geometry
    }).unwrap_or(idx == 0);

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
// Non-Linux implementation using TAO (creates temporary event loop)
// =============================================================================

#[cfg(not(target_os = "linux"))]
fn get_primary_display_tao() -> Result<DisplayInfo> {
    use tao::event_loop::EventLoopBuilder;

    let event_loop = EventLoopBuilder::new().build();

    let primary = event_loop.primary_monitor()
        .or_else(|| event_loop.available_monitors().next())
        .ok_or_else(|| Error::new(Status::GenericFailure, "No display found"))?;

    let position = primary.position();
    let size = primary.size();
    let scale_factor = primary.scale_factor();
    let name = primary.name().unwrap_or_default();

    Ok(DisplayInfo {
        id: 0,
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
        is_primary: true,
    })
}

#[cfg(not(target_os = "linux"))]
fn get_all_displays_tao() -> Result<Vec<DisplayInfo>> {
    use tao::event_loop::EventLoopBuilder;

    let event_loop = EventLoopBuilder::new().build();

    let primary_name = event_loop.primary_monitor()
        .and_then(|m| m.name());

    let displays: Vec<DisplayInfo> = event_loop
        .available_monitors()
        .enumerate()
        .map(|(idx, monitor)| {
            let position = monitor.position();
            let size = monitor.size();
            let scale_factor = monitor.scale_factor();
            let name = monitor.name().unwrap_or_default();
            let is_primary = primary_name.as_ref() == Some(&name);

            DisplayInfo {
                id: idx as u32,
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
        })
        .collect();

    if displays.is_empty() {
        return Err(Error::new(Status::GenericFailure, "No displays found"));
    }

    Ok(displays)
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
    let mut best_display = displays.first()
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
        // TAO doesn't directly expose cursor position
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
