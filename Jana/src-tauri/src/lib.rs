use std::{collections::HashMap, fs, path::PathBuf, env};
use serde_json;
use tauri::{AppHandle, Manager};

// For token generation
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use std::time::Duration as StdDuration;
use reqwest::Client;


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

// Constants for CLI command execution and HTTP settings
const API_VERSION: &str = "v1"; // Adjust as needed for CLI command endpoint
const VERIFY_SSL: bool = true;
const TIMEOUT: u64 = 10; // seconds

// Payload structure for CLI command request
#[derive(Deserialize)]
struct CliCommandPayload {
    switch_ip: String,
    command: String,
}

// Tauri command: execute a CLI command on an ArubaOS-CX switch.
// This function logs in to the switch, executes the CLI command using the obtained session cookie,
// and logs out after the command is executed.
#[tauri::command]
async fn execute_cli_with_login(payload: CliCommandPayload) -> Result<String, String> {
    // Log in to the switch to retrieve the session cookie
    let session_id = login_to_switch().await?;
    
    // Build the CLI command URL.
    // For CLI command, we assume a URL structure like:
    // https://{switch_ip}/api/{api_version}/cli
    let base_url = format!("https://{}/api/{}", payload.switch_ip, API_VERSION);
    let cli_url = format!("{}/cli", base_url);

    // Build the JSON payload for the CLI command
    let cli_data = serde_json::json!({
        "cmd": payload.command,
    });

    // Create a reqwest client with the specified timeout and SSL settings.
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(!VERIFY_SSL)
        .timeout(StdDuration::from_secs(TIMEOUT))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    // Send the POST request with the session cookie in the header.
    let response = client
        .post(&cli_url)
        .header("Cookie", format!("sessionId={}", session_id))
        .json(&cli_data)
        .send()
        .await
        .map_err(|e| format!("CLI command request error: {}", e))?;

    // Process the response.
    let output = if response.status().is_success() {
        response
            .text()
            .await
            .map_err(|e| format!("Failed to read CLI command response text: {}", e))?
    } else {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("CLI command failed with status {}: {}", status, error_text));
    };

    // Log out from the switch using the session cookie.
    logout_from_switch(&session_id).await?;

    // Return the CLI command output.
    Ok(output)
}

// Asynchronous helper function to log in to the switch.
// Reads SWITCH_IP, USERNAME, and PASSWORD from the environment.
async fn login_to_switch() -> Result<String, String> {
    // Read required environment variables.
    let switch_ip = env::var("SWITCH_IP").map_err(|_| "SWITCH_IP not set".to_string())?;
    let username = env::var("USERNAME").map_err(|_| "USERNAME not set".to_string())?;
    let password = env::var("PASSWORD").map_err(|_| "PASSWORD not set".to_string())?;

    // Build the login URL: https://{switch_ip}/rest/v1/login-sessions
    let login_base_url = format!("https://{}/rest/v1", switch_ip);
    let login_url = format!("{}/login-sessions", login_base_url);

    // Build the login payload.
    let payload = serde_json::json!({
        "userName": username,
        "password": password,
    });

    // Create a reqwest client.
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(!VERIFY_SSL)
        .timeout(StdDuration::from_secs(TIMEOUT))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    // Send the login request.
    let response = client
        .post(&login_url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Login request error: {}", e))?;

    // Check for a successful response.
    if response.status().is_success() {
        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse login response: {}", e))?;
        if let Some(cookie) = json.get("cookie").and_then(|c| c.as_str()) {
            Ok(cookie.to_string())
        } else {
            Err("Login response did not contain a session cookie.".to_string())
        }
    } else {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        Err(format!("Login failed with status {}: {}", status, error_text))
    }
}

// Asynchronous helper function to log out from the switch using the session cookie.
async fn logout_from_switch(session_id: &str) -> Result<(), String> {
    // Read the SWITCH_IP from the environment.
    let switch_ip = env::var("SWITCH_IP").map_err(|_| "SWITCH_IP not set".to_string())?;

    // Build the logout URL: https://{switch_ip}/rest/v1/login-sessions
    let login_base_url = format!("https://{}/rest/v1", switch_ip);
    let logout_url = format!("{}/login-sessions", login_base_url);

    // Create a reqwest client.
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(!VERIFY_SSL)
        .timeout(StdDuration::from_secs(TIMEOUT))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    // Send the logout request with the session cookie.
    let response = client
        .delete(&logout_url)
        .header("Cookie", format!("sessionId={}", session_id))
        .send()
        .await
        .map_err(|e| format!("Logout request error: {}", e))?;

    // Check for a successful logout.
    if response.status().is_success() {
        Ok(())
    } else {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        Err(format!("Logout failed with status {}: {}", status, error_text))
    }
}