mod node_detect;

use std::ffi::OsString;
use std::path::PathBuf;
use tauri_plugin_dialog;
use tauri_plugin_fs;
use tauri_plugin_opener;

#[tauri::command]
fn startup_image_path() -> Option<String> {
    std::env::args_os().skip(1).find_map(startup_image_arg)
}

fn startup_image_arg(arg: OsString) -> Option<String> {
    let path = PathBuf::from(arg);
    if path.to_string_lossy().starts_with("--") {
        return None;
    }

    let ext = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())?;
    let is_image = matches!(
        ext.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "bmp" | "webp" | "tif" | "tiff"
    );
    if !is_image || !path.is_file() {
        return None;
    }

    Some(
        path.canonicalize()
            .unwrap_or(path)
            .to_string_lossy()
            .into_owned(),
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            startup_image_path,
            node_detect::predict_internal_nodes
        ])
        .setup(|_app| {
            println!("✅ setup() is running");
            Ok(())
        })
        .on_page_load(|_, _| {
            println!("✅ page loaded: plugins ready");
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
