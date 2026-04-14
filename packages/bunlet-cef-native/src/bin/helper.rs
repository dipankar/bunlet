//! CEF Helper Process Entry Point
//!
//! This is the subprocess executable that CEF spawns for renderer, GPU,
//! and other secondary processes. It loads the CEF framework, determines
//! the process type from command-line args, and calls cef_execute_process().

fn main() {
    // On macOS, load the CEF framework. Helper processes use a different
    // relative path than the main process (../../.. vs ../Frameworks).
    #[cfg(target_os = "macos")]
    {
        use std::ffi::CString;
        use std::os::unix::ffi::OsStrExt;

        let cef_dir = cef::sys::get_cef_dir().expect("CEF not found in helper process");
        let framework_path = cef_dir
            .join(cef::sys::FRAMEWORK_PATH)
            .canonicalize()
            .expect("Failed to resolve CEF framework path in helper");
        let framework_cstr =
            CString::new(framework_path.as_os_str().as_bytes()).expect("Invalid framework path");

        let loaded = unsafe { cef::load_library(Some(&*framework_cstr.as_ptr())) };
        if loaded != 1 {
            log::error!(
                "FATAL: Failed to load CEF framework from {}",
                framework_path.display()
            );
            std::process::exit(1);
        }
    }

    let args = cef::args::Args::new();
    let main_args = args.as_main_args();
    let code = cef::execute_process(Some(main_args), None, std::ptr::null_mut());
    if code >= 0 {
        std::process::exit(code);
    }
}
