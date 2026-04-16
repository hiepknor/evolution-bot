use keyring::Entry;

const KEYRING_SERVICE: &str = "com.evo.broadcast.control";
const KEYRING_API_KEY_ACCOUNT: &str = "evolution_api_key";

#[tauri::command]
fn save_api_key(value: String) -> Result<(), String> {
  let entry = Entry::new(KEYRING_SERVICE, KEYRING_API_KEY_ACCOUNT).map_err(|error| error.to_string())?;
  entry.set_password(&value).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_api_key() -> Result<Option<String>, String> {
  let entry = Entry::new(KEYRING_SERVICE, KEYRING_API_KEY_ACCOUNT).map_err(|error| error.to_string())?;
  match entry.get_password() {
    Ok(value) => Ok(Some(value)),
    Err(keyring::Error::NoEntry) => Ok(None),
    Err(error) => Err(error.to_string()),
  }
}

#[tauri::command]
fn clear_api_key() -> Result<(), String> {
  let entry = Entry::new(KEYRING_SERVICE, KEYRING_API_KEY_ACCOUNT).map_err(|error| error.to_string())?;
  match entry.delete_password() {
    Ok(()) => Ok(()),
    Err(keyring::Error::NoEntry) => Ok(()),
    Err(error) => Err(error.to_string()),
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_sql::Builder::default().build())
    .invoke_handler(tauri::generate_handler![save_api_key, load_api_key, clear_api_key])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
