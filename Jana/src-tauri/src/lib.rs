use std::{collections::HashMap, fs, env, path::PathBuf};
use serde_json;
use tauri::{AppHandle, Manager};

// For token generation
use chrono::{Duration as ChronoDuration, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use std::process::{Command, Child};

// For Aruba APIs
use reqwest::{Client, Response};
use dotenv::dotenv;
use std::time::Duration;


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
    if let Ok(key_path) = env::var("PRIVATE_KEY_PATH") {
        let path = PathBuf::from(key_path);
        return fs::read_to_string(&path).map_err(|e| format!("Failed to read private key from file: {}", e));
    }
    if let Ok(private_key) = env::var("FIREBASE_PRIVATE_KEY") {
        return Ok(private_key);
    }
    Err("No private key provided in environment.".to_string())
}

// Tauri command: generate a Firebase custom token for a given UID.
#[tauri::command]
fn generate_custom_token(uid: String) -> Result<String, String> {
    init_dotenv();
    let service_account_email = env::var("FIREBASE_CLIENT_EMAIL")
        .map_err(|e| format!("FIREBASE_CLIENT_EMAIL not set: {}", e))?;
    
    let audience = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit".to_string();
    let now = Utc::now();
    let iat = now.timestamp();
    let exp = (now + ChronoDuration::hours(1)).timestamp();

    let claims = CustomTokenClaims {
        iss: service_account_email.clone(),
        sub: service_account_email.clone(),
        aud: audience,
        iat,
        exp,
        uid,
    };

    let mut header = Header::new(Algorithm::RS256);
    header.typ = Some("JWT".to_owned());

    let private_key = load_private_key()?;
    let encoding_key = EncodingKey::from_rsa_pem(private_key.as_bytes())
        .map_err(|e| format!("Failed to create encoding key: {:?}", e))?;
    let token = encode(&header, &claims, &encoding_key)
        .map_err(|e| format!("Token generation error: {:?}", e))?;
    Ok(token)
}

// Convert the Result returned by resource_dir() to an Option using .ok()
fn get_docker_compose_path(app_handle: &AppHandle) -> Option<PathBuf> {
    // Try the resource directory first.
    if let Ok(res_dir) = app_handle.path().resource_dir() {
        let candidate = res_dir.join("docker-compose.yml");
        if candidate.exists() {
            return Some(candidate);
        }
    }
    // Fallback: use a relative path from the project root.
    let fallback = PathBuf::from("resources/docker-compose.yml");
    if fallback.exists() {
        Some(fallback)
    } else {
        None
    }
}

fn start_docker_compose(app_handle: &AppHandle) -> std::io::Result<Child> {
    let compose_path = get_docker_compose_path(app_handle)
        .expect("Could not find the resource directory. Make sure the file is bundled.");

    println!("Starting Docker Compose with file: {:?}", compose_path);

    Command::new("docker")
        .arg("compose")
        .arg("-f")
        .arg(compose_path)
        .arg("up")
        .arg("-d")
        .spawn()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_dotenv();
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.app_handle();
            match start_docker_compose(&app_handle) {
                Ok(child) => println!("Docker Compose started with PID: {}", child.id()),
                Err(e) => eprintln!("Failed to start Docker services: {}", e),
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_local_storage,
            get_local_storage,
            generate_custom_token
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri app");
}

#[derive(Serialize)]
struct LoginData<'a> {
    username: &'a str,
    password: &'a str,
}

const API_VERSION: &str = "v10.04"; // Or whatever version you're targeting
const VERIFY_SSL: bool = false;
const TIMEOUT_SECONDS: u64 = 10;

pub async fn login_to_switch(switch_ip: &str) -> Result<Client, String> {
    dotenv().ok();

    let username = env::var("SWITCH_USERNAME").map_err(|e| format!("Missing username: {}", e))?;
    let password = env::var("SWITCH_PASSWORD").map_err(|e| format!("Missing password: {}", e))?;

    let base_url = format!("https://{}/rest/{}/", switch_ip, API_VERSION);
    let login_url = format!("{}login", base_url);

    let login_data = LoginData {
        username: &username,
        password: &password,
    };

    let client = Client::builder()
        .cookie_store(true)
        .danger_accept_invalid_certs(!VERIFY_SSL)
        .timeout(Duration::from_secs(TIMEOUT_SECONDS))
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let res: Response = client
        .post(&login_url)
        .json(&login_data)
        .send()
        .await
        .map_err(|e| format!("Login request failed: {}", e))?;

    if res.status().is_success() {
        Ok(client)
    } else {
        let status = res.status();
        let text = res.text().await.unwrap_or_else(|_| "No response body".to_string());
        Err(format!("Login failed with status {}: {}", status, text))
    }
}

pub async fn logout_from_switch(switch_ip: &str, client: &Client) -> Result<bool, String> {
    let base_url = format!("https://{}/rest/{}/", switch_ip, API_VERSION);
    let logout_url = format!("{}logout", base_url);

    let res = client
        .post(&logout_url)
        .send()
        .await
        .map_err(|e| format!("Logout request failed: {}", e))?;

    if res.status().is_success() {
        Ok(true)
    } else {
        let status = res.status();
        let text = res.text().await.unwrap_or_else(|_| "No response body".to_string());
        Err(format!("Logout failed with status {}: {}", status, text))
    }
}