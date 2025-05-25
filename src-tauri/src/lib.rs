use tauri_plugin_fs;
use tauri_plugin_dialog;
use tauri_plugin_opener;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
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