use std::{collections::HashMap, env, fs, net::TcpStream, path::PathBuf, sync::Mutex, time::Duration, io::Read};

use chrono::{Duration, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use reqwest;
use serde::{Deserialize, Serialize};
use serde_json;
use ssh2::Session;
use tauri::{AppHandle, Manager, State};

/// Load environment variables from the .env file
fn init_dotenv() {
    dotenv::dotenv().ok();
}

// -------------------------
// Storage Commands
// -------------------------

/// Storage command: get the file path for localstorage.json
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

/// Storage command: set a key-value pair
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

/// Storage command: get a value for a given key
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
// Custom Token Generation
// -------------------------

/// Define the JWT claims for a Firebase custom token.
#[derive(Debug, Serialize, Deserialize)]
struct CustomTokenClaims {
    iss: String, // Service account email
    sub: String, // Same as issuer
    aud: String, // Firebase audience
    iat: i64,    // Issued at timestamp
    exp: i64,    // Expiration timestamp
    uid: String, // UID for which this token is generated
}

/// Helper function to load your private key from the PEM file
fn load_private_key() -> Result<String, String> {
    // Try to load the private key from a file path first.
    if let Ok(key_path) = env::var("PRIVATE_KEY_PATH") {
        let path = PathBuf::from(key_path);
        return fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read private key from file: {}", e));
    }
    // Otherwise, try to load the key directly from the environment variable.
    if let Ok(private_key) = env::var("FIREBASE_PRIVATE_KEY") {
        return Ok(private_key);
    }
    Err("No private key provided in environment.".to_string())
}

/// Tauri command: generate a Firebase custom token for a given UID.
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

// -------------------------
// Switch Interaction Commands
// -------------------------

// Constants for switch API
const API_VERSION: &str = "v10.12";
const BASE_URL_TEMPLATE: &str = "https://{switch_ip}/rest/{api_version}";
const VERIFY_SSL: bool = false; // Set to false to disable SSL certificate verification
const TIMEOUT: u64 = 10; // Timeout in seconds
const DEBUG: bool = false;

/// Structure to store the switch session (HTTP client and switch IP)
pub struct SwitchSession {
    pub client: reqwest::Client,
    pub switch_ip: String,
}

/// Shared application state for managing the switch session.
pub struct AppState {
    pub switch_session: Mutex<Option<SwitchSession>>,
}

/// Tauri command to log in to the switch.
#[tauri::command]
pub async fn login_to_switch(
    state: State<'_, AppState>,
    switch_ip: String,
    username: String,
    password: String,
) -> Result<String, String> {
    // Build the base URL and login URL.
    let base_url = BASE_URL_TEMPLATE
        .replace("{switch_ip}", &switch_ip)
        .replace("{api_version}", API_VERSION);
    let login_url = format!("{}/login", base_url);

    // Create a reqwest client with cookie store enabled.
    let client = reqwest::Client::builder()
        .cookie_store(true)
        .danger_accept_invalid_certs(!VERIFY_SSL)
        .timeout(Duration::from_secs(TIMEOUT))
        .build()
        .map_err(|e| format!("Failed to build client: {}", e))?;

    // Prepare the login form data.
    let login_data = [("username", username.as_str()), ("password", password.as_str())];

    // Send the login request.
    let response = client
        .post(&login_url)
        .form(&login_data)
        .send()
        .await
        .map_err(|e| format!("Login request failed: {}", e))?;

    if response.status().is_success() {
        if DEBUG {
            let text = response.text().await.unwrap_or_default();
            println!("Login successful: {}", text);
        }
        // Save the session (client and switch IP) in state.
        let switch_session = SwitchSession {
            client: client.clone(),
            switch_ip: switch_ip.clone(),
        };
        let mut session_lock = state.switch_session.lock().unwrap();
        *session_lock = Some(switch_session);
        Ok("Login successful".into())
    } else {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        Err(format!(
            "Login failed with status: {}. Response: {}",
            status, text
        ))
    }
}

/// Tauri command to log out from the switch.
#[tauri::command]
pub async fn logout_from_switch(state: State<'_, AppState>) -> Result<String, String> {
    let mut session_lock = state.switch_session.lock().unwrap();
    if let Some(switch_session) = session_lock.as_ref() {
        // Build the logout URL.
        let base_url = BASE_URL_TEMPLATE
            .replace("{switch_ip}", &switch_session.switch_ip)
            .replace("{api_version}", API_VERSION);
        let logout_url = format!("{}/logout", base_url);

        let response = switch_session
            .client
            .post(&logout_url)
            .send()
            .await
            .map_err(|e| format!("Logout request failed: {}", e))?;

        if response.status().is_success() {
            if DEBUG {
                let text = response.text().await.unwrap_or_default();
                println!("Logout successful: {}", text);
            }
            // Clear the session from state.
            *session_lock = None;
            Ok("Logout successful".into())
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(format!(
                "Logout failed with status: {}. Response: {}",
                status, text
            ))
        }
    } else {
        Err("No active session found".into())
    }
}

/// Tauri command to execute a CLI command on the switch.
#[tauri::command]
pub async fn cli_command(
    state: State<'_, AppState>,
    command: String,
) -> Result<String, String> {
    let session_lock = state.switch_session.lock().unwrap();
    if let Some(switch_session) = session_lock.as_ref() {
        // Build the CLI URL.
        let base_url = BASE_URL_TEMPLATE
            .replace("{switch_ip}", &switch_session.switch_ip)
            .replace("{api_version}", API_VERSION);
        let cli_url = format!("{}/cli", base_url);

        // Build the JSON payload.
        let cli_data = serde_json::json!({ "cmd": command });

        let response = switch_session
            .client
            .post(&cli_url)
            .json(&cli_data)
            .send()
            .await
            .map_err(|e| format!("CLI command request failed: {}", e))?;

        if response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            Ok(text)
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(format!(
                "CLI command failed with status: {}. Response: {}",
                status, text
            ))
        }
    } else {
        Err("No active session found".into())
    }
}

/// Tauri command to execute an SSH command on the switch.
#[tauri::command]
pub async fn ssh_command(
    switch_ip: String,
    username: String,
    password: String,
    command: String,
) -> Result<String, String> {
    // Since SSH operations block, wrap the work in a blocking task.
    let result = tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        // Connect to the SSH server on port 22.
        let tcp = TcpStream::connect(format!("{}:22", switch_ip))
            .map_err(|e| format!("TCP connection failed: {}", e))?;
        let mut sess = Session::new().map_err(|e| format!("Failed to create SSH session: {}", e))?;
        sess.set_tcp_stream(tcp);
        sess.handshake()
            .map_err(|e| format!("SSH handshake failed: {}", e))?;
        sess.userauth_password(&username, &password)
            .map_err(|e| format!("SSH authentication failed: {}", e))?;
        if !sess.authenticated() {
            return Err("SSH authentication failed".into());
        }
        let mut channel = sess
            .channel_session()
            .map_err(|e| format!("Failed to open SSH channel: {}", e))?;
        channel
            .exec(&command)
            .map_err(|e| format!("Failed to execute command: {}", e))?;
        let mut output = String::new();
        channel
            .read_to_string(&mut output)
            .map_err(|e| format!("Failed to read command output: {}", e))?;
        channel
            .wait_close()
            .map_err(|e| format!("Failed to close channel: {}", e))?;
        let exit_status = channel
            .exit_status()
            .map_err(|e| format!("Failed to get exit status: {}", e))?;
        if exit_status != 0 {
            return Err(format!("Command exited with status: {}", exit_status));
        }
        Ok(output)
    })
    .await
    .map_err(|e| format!("Spawn blocking error: {}", e))?;

    result
}

// -------------------------
// Tauri Application Entry Point
// -------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env variables at startup
    init_dotenv();
    tauri::Builder::default()
        // Manage shared state for switch session.
        .manage(AppState {
            switch_session: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            set_local_storage,
            get_local_storage,
            generate_custom_token,
            login_to_switch,
            logout_from_switch,
            cli_command,
            ssh_command
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri app");
}
