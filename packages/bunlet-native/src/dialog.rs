//! Dialog API for Bunlet
//!
//! Provides cross-platform file dialogs and message boxes using the `rfd` crate.

use napi_derive::napi;
use rfd::{FileDialog, MessageButtons, MessageDialog, MessageDialogResult, MessageLevel};

/// File filter for dialogs
#[napi(object)]
#[derive(Clone, Default)]
pub struct DialogFileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

/// Options for open dialog
#[napi(object)]
#[derive(Clone, Default)]
pub struct OpenDialogOptions {
    pub title: Option<String>,
    pub default_path: Option<String>,
    pub button_label: Option<String>,
    pub filters: Option<Vec<DialogFileFilter>>,
    pub open_file: Option<bool>,
    pub open_directory: Option<bool>,
    pub multi_selections: Option<bool>,
}

/// Result from open dialog
#[napi(object)]
pub struct OpenDialogResult {
    pub canceled: bool,
    pub file_paths: Vec<String>,
}

/// Options for save dialog
#[napi(object)]
#[derive(Clone, Default)]
pub struct SaveDialogOptions {
    pub title: Option<String>,
    pub default_path: Option<String>,
    pub button_label: Option<String>,
    pub filters: Option<Vec<DialogFileFilter>>,
}

/// Result from save dialog
#[napi(object)]
pub struct SaveDialogResult {
    pub canceled: bool,
    pub file_path: Option<String>,
}

/// Options for message box
#[napi(object)]
#[derive(Clone, Default)]
pub struct MessageBoxOptions {
    /// Type: 'none' | 'info' | 'warning' | 'error' | 'question'
    pub message_type: Option<String>,
    pub title: Option<String>,
    pub message: String,
    pub detail: Option<String>,
    /// Button labels (e.g., ["OK", "Cancel"])
    pub buttons: Option<Vec<String>>,
    /// Index of the default button
    pub default_id: Option<i32>,
    /// Index of the cancel button
    pub cancel_id: Option<i32>,
}

/// Result from message box
#[napi(object)]
pub struct MessageBoxResult {
    pub response: i32,
}

/// Show an open file dialog
#[napi]
pub async fn show_open_dialog(options: OpenDialogOptions) -> OpenDialogResult {
    let mut dialog = FileDialog::new();

    if let Some(title) = &options.title {
        dialog = dialog.set_title(title);
    }

    if let Some(default_path) = &options.default_path {
        dialog = dialog.set_directory(default_path);
    }

    if let Some(filters) = &options.filters {
        for filter in filters {
            let extensions: Vec<&str> = filter.extensions.iter().map(|s| s.as_str()).collect();
            dialog = dialog.add_filter(&filter.name, &extensions);
        }
    }

    let open_directory = options.open_directory.unwrap_or(false);
    let multi_selections = options.multi_selections.unwrap_or(false);

    let result = if open_directory {
        if multi_selections {
            dialog.pick_folders()
        } else {
            dialog.pick_folder().map(|p| vec![p])
        }
    } else if multi_selections {
        dialog.pick_files()
    } else {
        dialog.pick_file().map(|p| vec![p])
    };

    match result {
        Some(paths) => OpenDialogResult {
            canceled: false,
            file_paths: paths.into_iter().map(|p| p.to_string_lossy().to_string()).collect(),
        },
        None => OpenDialogResult {
            canceled: true,
            file_paths: vec![],
        },
    }
}

/// Show a save file dialog
#[napi]
pub async fn show_save_dialog(options: SaveDialogOptions) -> SaveDialogResult {
    let mut dialog = FileDialog::new();

    if let Some(title) = &options.title {
        dialog = dialog.set_title(title);
    }

    if let Some(default_path) = &options.default_path {
        // Try to split into directory and filename
        let path = std::path::Path::new(default_path);
        if let Some(parent) = path.parent() {
            dialog = dialog.set_directory(parent);
        }
        if let Some(file_name) = path.file_name() {
            dialog = dialog.set_file_name(file_name.to_string_lossy().as_ref());
        }
    }

    if let Some(filters) = &options.filters {
        for filter in filters {
            let extensions: Vec<&str> = filter.extensions.iter().map(|s| s.as_str()).collect();
            dialog = dialog.add_filter(&filter.name, &extensions);
        }
    }

    match dialog.save_file() {
        Some(path) => SaveDialogResult {
            canceled: false,
            file_path: Some(path.to_string_lossy().to_string()),
        },
        None => SaveDialogResult {
            canceled: true,
            file_path: None,
        },
    }
}

/// Show a message box
#[napi]
pub async fn show_message_box(options: MessageBoxOptions) -> MessageBoxResult {
    let level = match options.message_type.as_deref() {
        Some("info") => MessageLevel::Info,
        Some("warning") => MessageLevel::Warning,
        Some("error") => MessageLevel::Error,
        _ => MessageLevel::Info,
    };

    let buttons = if let Some(btn_labels) = &options.buttons {
        if btn_labels.len() == 1 {
            MessageButtons::Ok
        } else if btn_labels.len() == 2 {
            MessageButtons::OkCancel
        } else {
            MessageButtons::OkCancel
        }
    } else {
        MessageButtons::Ok
    };

    let mut dialog = MessageDialog::new()
        .set_level(level)
        .set_buttons(buttons)
        .set_description(&options.message);

    if let Some(title) = &options.title {
        dialog = dialog.set_title(title);
    }

    let result = dialog.show();

    let response = match result {
        MessageDialogResult::Ok => 0,
        MessageDialogResult::Cancel => 1,
        MessageDialogResult::Yes => 0,
        MessageDialogResult::No => 1,
        MessageDialogResult::Custom(s) => {
            // Try to find the button index
            if let Some(buttons) = &options.buttons {
                buttons.iter().position(|b| b == &s).unwrap_or(0) as i32
            } else {
                0
            }
        }
    };

    MessageBoxResult { response }
}

/// Show an error box (synchronous)
#[napi]
pub fn show_error_box(title: String, content: String) {
    MessageDialog::new()
        .set_level(MessageLevel::Error)
        .set_title(&title)
        .set_description(&content)
        .set_buttons(MessageButtons::Ok)
        .show();
}
