use napi::bindgen_prelude::*;
use napi_derive::napi;
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use send_wrapper::SendWrapper;
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoopBuilder};

use crate::{
    create_window_in_loop, dispatch_app_event, dispatch_window_bounds_event, dispatch_window_event,
    IpcMessage, PENDING_IPC, PENDING_WINDOWS, WindowBounds, WINDOWS,
};

// Global event loop stored for run_return usage
static EVENT_LOOP: Lazy<Mutex<Option<SendWrapper<tao::event_loop::EventLoop<()>>>>> =
    Lazy::new(|| Mutex::new(None));

fn find_window_id_by_tao_id(window_id: tao::window::WindowId) -> Option<u32> {
    let windows = WINDOWS.lock();
    windows.iter().find_map(|(id, state)| {
        if state.tao_window_id == window_id {
            Some(*id)
        } else {
            None
        }
    })
}

/// Result of pumping events
#[napi(object)]
pub struct PumpResult {
    pub should_quit: bool,
    pub messages: Vec<IpcMessage>,
}

/// Initialize the event loop and create windows
#[napi]
pub fn init_event_loop() -> Result<()> {
    #[cfg(target_os = "linux")]
    let event_loop = {
        use tao::platform::unix::EventLoopBuilderExtUnix;
        EventLoopBuilder::new()
            .with_app_id("com.bunlet.app")
            .build()
    };

    #[cfg(not(target_os = "linux"))]
    let event_loop = EventLoopBuilder::new().build();

    // Create any windows queued before the event loop was initialized.
    {
        let pending = PENDING_WINDOWS.lock().drain(..).collect::<Vec<_>>();
        for pending_window in pending {
            match create_window_in_loop(pending_window.id, &pending_window.options, &event_loop) {
                Ok(state) => {
                    if let Some(url) = &pending_window.url {
                        let _ = state.webview.load_url(url);
                    }
                    if let Some(html) = &pending_window.html {
                        let encoded = urlencoding::encode(html);
                        let _ = state.webview.load_url(&format!("data:text/html,{}", encoded));
                    }
                    WINDOWS.lock().insert(pending_window.id, SendWrapper::new(state));
                }
                Err(e) => {
                    eprintln!("Failed to create window {}: {}", pending_window.id, e);
                }
            }
        }
    }

    *EVENT_LOOP.lock() = Some(SendWrapper::new(event_loop));
    Ok(())
}

/// Pump events (non-blocking) - returns pending IPC messages
#[napi]
#[cfg(target_os = "linux")]
pub fn pump_events() -> Result<PumpResult> {
    let messages = PENDING_IPC.lock().drain(..).collect::<Vec<_>>();

    // Process GTK events without blocking
    while gtk::events_pending() {
        gtk::main_iteration();
    }

    // Creating windows here is not supported yet because tao requires the active loop context.
    if EVENT_LOOP.lock().as_ref().is_some() && !PENDING_WINDOWS.lock().is_empty() {
        eprintln!("Warning: Cannot create window after event loop started in pump mode");
    }

    Ok(PumpResult {
        should_quit: WINDOWS.lock().is_empty(),
        messages,
    })
}

#[napi]
#[cfg(not(target_os = "linux"))]
pub fn pump_events() -> Result<PumpResult> {
    let messages = PENDING_IPC.lock().drain(..).collect::<Vec<_>>();
    Ok(PumpResult {
        should_quit: WINDOWS.lock().is_empty(),
        messages,
    })
}

/// Run the event loop (blocking) - legacy API
/// This creates windows and runs the main loop
#[napi]
pub fn run_event_loop() -> Result<()> {
    #[cfg(target_os = "linux")]
    let event_loop = {
        use tao::platform::unix::EventLoopBuilderExtUnix;
        EventLoopBuilder::new()
            .with_app_id("com.bunlet.app")
            .build()
    };

    #[cfg(not(target_os = "linux"))]
    let event_loop = EventLoopBuilder::new().build();

    let mut window_all_closed_emitted = false;

    // Create windows queued before the blocking loop starts.
    {
        let pending = PENDING_WINDOWS.lock().drain(..).collect::<Vec<_>>();
        for pending_window in pending {
            match create_window_in_loop(pending_window.id, &pending_window.options, &event_loop) {
                Ok(state) => {
                    if let Some(url) = &pending_window.url {
                        let _ = state.webview.load_url(url);
                    }
                    if let Some(html) = &pending_window.html {
                        let encoded = urlencoding::encode(html);
                        let _ = state.webview.load_url(&format!("data:text/html,{}", encoded));
                    }
                    WINDOWS.lock().insert(pending_window.id, SendWrapper::new(state));
                    window_all_closed_emitted = false;
                }
                Err(e) => {
                    eprintln!("Failed to create window {}: {}", pending_window.id, e);
                }
            }
        }
    }

    event_loop.run(move |event, event_loop, control_flow| {
        *control_flow = ControlFlow::Wait;

        // Create windows requested while the loop is already running.
        {
            let pending = PENDING_WINDOWS.lock().drain(..).collect::<Vec<_>>();
            for pending_window in pending {
                match create_window_in_loop(pending_window.id, &pending_window.options, event_loop) {
                    Ok(state) => {
                        if let Some(url) = &pending_window.url {
                            let _ = state.webview.load_url(url);
                        }
                        if let Some(html) = &pending_window.html {
                            let encoded = urlencoding::encode(html);
                            let _ = state.webview.load_url(&format!("data:text/html,{}", encoded));
                        }
                        WINDOWS.lock().insert(pending_window.id, SendWrapper::new(state));
                        window_all_closed_emitted = false;
                    }
                    Err(e) => {
                        eprintln!("Failed to create window {}: {}", pending_window.id, e);
                    }
                }
            }
        }

        match event {
            Event::WindowEvent {
                event: WindowEvent::Focused(focused),
                window_id,
                ..
            } => {
                if let Some(id) = find_window_id_by_tao_id(window_id) {
                    dispatch_window_event(
                        if focused { "window-focus" } else { "window-blur" },
                        id,
                    );
                }
            }
            Event::WindowEvent {
                event: WindowEvent::Resized(size),
                window_id,
                ..
            } => {
                if let Some(id) = find_window_id_by_tao_id(window_id) {
                    let position = WINDOWS
                        .lock()
                        .get(&id)
                        .and_then(|state| state.window.outer_position().ok())
                        .unwrap_or_default();
                    dispatch_window_bounds_event(
                        "window-resize",
                        id,
                        WindowBounds {
                            x: position.x,
                            y: position.y,
                            width: size.width,
                            height: size.height,
                        },
                    );
                }
            }
            Event::WindowEvent {
                event: WindowEvent::Moved(position),
                window_id,
                ..
            } => {
                if let Some(id) = find_window_id_by_tao_id(window_id) {
                    let size = WINDOWS
                        .lock()
                        .get(&id)
                        .map(|state| state.window.inner_size())
                        .unwrap_or_default();
                    dispatch_window_bounds_event(
                        "window-move",
                        id,
                        WindowBounds {
                            x: position.x,
                            y: position.y,
                            width: size.width,
                            height: size.height,
                        },
                    );
                }
            }
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                window_id,
                ..
            } => {
                if let Some(id) = find_window_id_by_tao_id(window_id) {
                    dispatch_window_event("window-close-requested", id);
                }
            }
            Event::WindowEvent {
                event: WindowEvent::Destroyed,
                window_id,
                ..
            } => {
                let mut windows = WINDOWS.lock();
                let id_to_remove = windows.iter().find_map(|(id, state)| {
                    if state.tao_window_id == window_id {
                        Some(*id)
                    } else {
                        None
                    }
                });

                if let Some(id) = id_to_remove {
                    windows.remove(&id);
                    dispatch_window_event("window-closed", id);
                    dispatch_window_event("window-destroyed", id);
                }

                if windows.is_empty() {
                    if !window_all_closed_emitted {
                        dispatch_app_event("window-all-closed");
                        window_all_closed_emitted = true;
                    }
                    *control_flow = ControlFlow::Exit;
                }
            }
            _ => {}
        }
    });
}
