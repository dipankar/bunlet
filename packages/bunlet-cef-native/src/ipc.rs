//! IPC message routing for CEF backend
//!
//! Handles bidirectional communication between the main Bun process
//! and the CEF renderer processes.

use cef::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction};

use crate::state;

wrap_render_process_handler! {
    struct BunletRenderProcessHandler;

    impl RenderProcessHandler {
        fn on_context_created(&self, _browser: Option<&mut Browser>, _frame: Option<&mut Frame>, _context: Option<&mut V8Context>) {
        }

        fn on_context_released(&self, _browser: Option<&mut Browser>, _frame: Option<&mut Frame>, _context: Option<&mut V8Context>) {
        }

        fn on_process_message_received(
            &self,
            browser: Option<&mut Browser>,
            _frame: Option<&mut Frame>,
            _source_process: ProcessId,
            message: Option<&mut ProcessMessage>,
        ) -> i32 {
            let Some(message) = message else { return 0 };
            let Some(browser) = browser else { return 0 };

            let name = message.name();
            let name_str: String = CefStringUtf16::from(&name).to_string();

            let browser_id = browser.identifier();
            let state = state::CEF_STATE.lock();
            let window_id = state.browser_to_window.get(&(browser_id as u32)).copied();
            drop(state);

            let Some(window_id) = window_id else { return 0 };

            if name_str == "__bunlet_ipc" {
                if let Some(arg_list) = message.argument_list() {
                    if arg_list.size() > 0 {
                        let cef_str = arg_list.string(0);
                        let msg_string = CefStringUtf16::from(&cef_str).to_string();
                        let ipc_msg = crate::IpcMessage {
                            window_id,
                            message: msg_string,
                        };
                        state::PENDING_IPC.lock().push(ipc_msg);

                        let callback: Option<ThreadsafeFunction<crate::IpcMessage, ErrorStrategy::Fatal>> =
                            state::IPC_CALLBACK.lock().clone();
                        if let Some(callback) = callback.as_ref() {
                            callback.call(
                                crate::IpcMessage {
                                    window_id,
                                    message: CefStringUtf16::from(&cef_str).to_string(),
                                },
                                napi::threadsafe_function::ThreadsafeFunctionCallMode::NonBlocking,
                            );
                        }
                    }
                }
                return 1;
            }

            0
        }
    }
}
