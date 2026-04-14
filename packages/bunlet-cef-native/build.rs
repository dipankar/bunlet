extern crate napi_build;

fn main() {
    napi_build::setup();

    // CEF requires platform-specific library search paths.
    // The CEF_PATH environment variable should point to the directory
    // containing the CEF binary distribution.
    if let Ok(cef_path) = std::env::var("CEF_PATH") {
        println!("cargo:rustc-link-search=native={}", cef_path);

        #[cfg(target_os = "macos")]
        {
            let framework_path = format!(
                "{}/Chromium Embedded Framework.framework/Libraries",
                cef_path
            );
            println!("cargo:rustc-link-search=native={}", framework_path);
            // Helper app path
            let helper_path = format!("{}/cef_sandbox.lib", cef_path);
            println!("cargo:rustc-link-search=native={}", helper_path);
        }

        #[cfg(target_os = "linux")]
        {
            println!("cargo:rustc-link-search=native={}", cef_path);
        }

        #[cfg(target_os = "windows")]
        {
            println!("cargo:rustc-link-search=native={}", cef_path);
        }
    }
}
