use std::{collections::HashMap, fs, path::PathBuf, env};
use serde_json;
use tauri::{AppHandle, Manager};

// For token generation
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::{Deserialize, Serialize};

// Load environment variables from the .env file
fn init_dotenv() {
    dotenv::dotenv().ok();
}

// Storage command: get the file path for localstorage.json
#[tauri::command]
fn get_storage_file_path(app_handle: AppHandle) -> Result<PathBuf, String> {
    let mut dir = app_handle
        .path()
        .data_dir()
        .map_err(|e| format!("Failed to resolve data directory: {}", e))?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create data directory {:?}: {}", dir, e))?;
    dir.push("localstorage.json");
    Ok(dir)
}

// Storage command: set a key-value pair
#[tauri::command]
fn set_local_storage(app_handle: AppHandle, key: String, value: String) -> Result<String, String> {
    let path = get_storage_file_path(app_handle)?;
    let mut store: HashMap<String, String> = if let Ok(json) = fs::read_to_string(&path) {
        serde_json::from_str(&json).unwrap_or_default()
    } else {
        HashMap::new()
    };

    store.insert(key, value);
    let payload = serde_json::to_string_pretty(&store)
        .map_err(|e| format!("Serialization error: {}", e))?;
    fs::write(&path, payload)
        .map_err(|e| format!("Failed writing file {:?}: {}", path, e))?;

    Ok("saved".to_string())
}

// Storage command: get a value for a given key
#[tauri::command]
fn get_local_storage(app_handle: AppHandle, key: String) -> Result<Option<String>, String> {
    let path = get_storage_file_path(app_handle)?;
    if !path.exists() {
        return Ok(None);
    }
    let store: HashMap<String, String> =
        serde_json::from_str(&fs::read_to_string(&path).map_err(|e| format!("{}", e))?)
            .unwrap_or_default();
    Ok(store.get(&key).cloned())
}

// -------------------------
// Custom token generation
// -------------------------

// Define the JWT claims for a Firebase custom token.
#[derive(Debug, Serialize, Deserialize)]
struct CustomTokenClaims {
    iss: String,  // Service account email
    sub: String,  // Same as issuer
    aud: String,  // Firebase audience
    iat: i64,     // Issued at timestamp
    exp: i64,     // Expiration timestamp
    uid: String,  // UID for which this token is generated
}

// Helper function to load your private key from the PEM file
fn load_private_key() -> Result<String, String> {
    // Try to load the private key from a file path first.
    if let Ok(key_path) = env::var("PRIVATE_KEY_PATH") {
        let path = PathBuf::from(key_path);
        return fs::read_to_string(&path).map_err(|e| format!("Failed to read private key from file: {}", e));
    }
    // Otherwise, try to load the key directly from the environment variable.
    if let Ok(private_key) = env::var("FIREBASE_PRIVATE_KEY") {
        return Ok(private_key);
    }
    Err("No private key provided in environment.".to_string())
}


// Tauri command: generate a Firebase custom token for a given UID.
#[tauri::command]
fn generate_custom_token(uid: String) -> Result<String, String> {
    // Ensure .env is loaded
    init_dotenv();

    // Get service account email from the environment
    let service_account_email = env::var("FIREBASE_CLIENT_EMAIL")
        .map_err(|e| format!("FIREBASE_CLIENT_EMAIL not set: {}", e))?;
    
    // The audience for custom tokens per Firebase documentation
    let audience = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit".to_string();
    
    let now = Utc::now();
    let iat = now.timestamp();
    let exp = (now + Duration::hours(1)).timestamp();

    let claims = CustomTokenClaims {
        iss: service_account_email.clone(),
        sub: service_account_email.clone(),
        aud: audience,
        iat,
        exp,
        uid, // The UID for which the token is generated
    };

    let mut header = Header::new(Algorithm::RS256);
    header.typ = Some("JWT".to_owned());

    // Load the private key from file
    let private_key = load_private_key()?;
    let encoding_key = EncodingKey::from_rsa_pem(private_key.as_bytes())
        .map_err(|e| format!("Failed to create encoding key: {:?}", e))?;

    let token = encode(&header, &claims, &encoding_key)
        .map_err(|e| format!("Token generation error: {:?}", e))?;
    Ok(token)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env variables at startup
    init_dotenv();
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            set_local_storage,
            get_local_storage,
            generate_custom_token
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri app");
}
