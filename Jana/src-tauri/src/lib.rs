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
use serde_json::Value;


use tokio::sync::Mutex;
use lazy_static::lazy_static;

lazy_static! {
    static ref SESSION_CLIENT: Mutex<Option<Client>> = Mutex::new(None);
}

#[derive(Serialize, Deserialize, Debug)]
struct FilteredUtilization {
    cpu: u32,
    memory: u32,
}

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
         // 👈 this will rebuild images
        .arg("-d")
        .spawn()
}


#[tauri::command]
async fn login_switch(username: String, password: String, ip: String) -> Result<String, String> {
    // Check if a session already exists and early return if it does.
    {
        let session = SESSION_CLIENT.lock().await;
        if session.is_some() {
            return Ok("Already logged in".to_string());
        }
    }

    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true) // 👈 Accept invalid certs (DEV ONLY!)
        .cookie_store(true) // Enable cookie storage
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("https://{}/rest/v10.12/login", ip); // Adjust endpoint if needed

    let params = [
        ("username", username),
        ("password", password),
    ];

    let res = client
        .post(&url)
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = res.status();
    let body = res.text().await.map_err(|e| e.to_string())?;

    if status.is_success() {
        let mut session = SESSION_CLIENT.lock().await;
        *session = Some(client);
        Ok(body)
    } else {
        Err(format!("HTTP {}: {}", status, body))
    }
}

#[tauri::command]
async fn logout_switch(ip: String) -> Result<String, String> {
    let client = {
        let session = SESSION_CLIENT.lock().await;
        session.clone().ok_or("No active session found")?
    };

    let url = format!("https://{}/rest/v10.12/logout", ip); // Adjust endpoint if needed

    let res = client
        .post(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;

    if status.is_success() {
        let mut session = SESSION_CLIENT.lock().await;
        *session = None;
        Ok(text)
    } else {
        Err(format!("HTTP {}: {}", status, text))
    }
}


macro_rules! interface_link_state_cmd {
    ($fn_name:ident, $path:expr) => {
        #[tauri::command]
        async fn $fn_name(ip: String) -> Result<String, String> {
            let client = {
                let session = SESSION_CLIENT.lock().await;
                session.clone().ok_or("Not logged in")?
            };
            let url = format!("https://{}{}", ip, $path);
            let res = client
                .get(&url)
                .header("Accept", "application/json")
                .send().await
                .map_err(|e| e.to_string())?;
            let status = res.status();
            let body = res.text().await.map_err(|e| e.to_string())?;
            if !status.is_success() {
                return Err(format!("HTTP {}: {}", status, body));
            }
            let json: serde_json::Value = serde_json::from_str(&body)
                .map_err(|e| format!("JSON parse error: {}", e))?;

            // extract a handful of useful fields:
            let link_state    = json.get("link_state").and_then(|v| v.as_str()).unwrap_or("unknown");
            let admin_state   = json.get("admin_state").and_then(|v| v.as_str()).unwrap_or("unknown");
            let duplex        = json.get("duplex").and_then(|v| v.as_str()).unwrap_or("unknown");
            let speed         = json.get("link_speed").and_then(|v| v.as_i64()).unwrap_or(0);
            let mac           = json.get("mac_in_use").and_then(|v| v.as_str()).unwrap_or("");
            let flaps         = json.get("flaps_performed").and_then(|v| v.as_i64()).unwrap_or(0);
            let idx           = json.get("ifindex").and_then(|v| v.as_i64()).unwrap_or(0);

            // build a small JSON object:
            let overview = serde_json::json!({
                "ifindex":          idx,
                "admin_state":      admin_state,
                "link_state":       link_state,
                "duplex":           duplex,
                "link_speed_bps":   speed,
                "mac_in_use":       mac,
                "flaps_performed":  flaps
            });

            Ok(overview.to_string())
        }
    };
}

// Define commands for each interface path
interface_link_state_cmd!(get_interface_1_1_1,  "/rest/v10.12/system/interfaces/1%2F1%2F1");
interface_link_state_cmd!(get_interface_1_1_2,  "/rest/v10.12/system/interfaces/1%2F1%2F2");
interface_link_state_cmd!(get_interface_1_1_3,  "/rest/v10.12/system/interfaces/1%2F1%2F3");
interface_link_state_cmd!(get_interface_1_1_4,  "/rest/v10.12/system/interfaces/1%2F1%2F4");
interface_link_state_cmd!(get_interface_1_1_5,  "/rest/v10.12/system/interfaces/1%2F1%2F5");
interface_link_state_cmd!(get_interface_1_1_6,  "/rest/v10.12/system/interfaces/1%2F1%2F6");
interface_link_state_cmd!(get_interface_1_1_7,  "/rest/v10.12/system/interfaces/1%2F1%2F7");
interface_link_state_cmd!(get_interface_1_1_8,  "/rest/v10.12/system/interfaces/1%2F1%2F8");
interface_link_state_cmd!(get_interface_1_1_9,  "/rest/v10.12/system/interfaces/1%2F1%2F9");
interface_link_state_cmd!(get_interface_1_1_10, "/rest/v10.12/system/interfaces/1%2F1%2F10");
interface_link_state_cmd!(get_interface_1_1_11, "/rest/v10.12/system/interfaces/1%2F1%2F11");
interface_link_state_cmd!(get_interface_1_1_12, "/rest/v10.12/system/interfaces/1%2F1%2F12");
interface_link_state_cmd!(get_interface_1_1_13, "/rest/v10.12/system/interfaces/1%2F1%2F13");
interface_link_state_cmd!(get_interface_1_1_14, "/rest/v10.12/system/interfaces/1%2F1%2F14");
interface_link_state_cmd!(get_interface_1_1_15, "/rest/v10.12/system/interfaces/1%2F1%2F15");
interface_link_state_cmd!(get_interface_1_1_16, "/rest/v10.12/system/interfaces/1%2F1%2F16");
interface_link_state_cmd!(get_interface_1_1_17, "/rest/v10.12/system/interfaces/1%2F1%2F17");
interface_link_state_cmd!(get_interface_1_1_18, "/rest/v10.12/system/interfaces/1%2F1%2F18");
interface_link_state_cmd!(get_interface_1_1_19, "/rest/v10.12/system/interfaces/1%2F1%2F19");
interface_link_state_cmd!(get_interface_1_1_20, "/rest/v10.12/system/interfaces/1%2F1%2F20");
interface_link_state_cmd!(get_interface_1_1_21, "/rest/v10.12/system/interfaces/1%2F1%2F21");
interface_link_state_cmd!(get_interface_1_1_22, "/rest/v10.12/system/interfaces/1%2F1%2F22");
interface_link_state_cmd!(get_interface_1_1_23, "/rest/v10.12/system/interfaces/1%2F1%2F23");
interface_link_state_cmd!(get_interface_1_1_24, "/rest/v10.12/system/interfaces/1%2F1%2F24");
interface_link_state_cmd!(get_interface_1_1_25, "/rest/v10.12/system/interfaces/1%2F1%2F25");
interface_link_state_cmd!(get_interface_1_1_26, "/rest/v10.12/system/interfaces/1%2F1%2F26");
interface_link_state_cmd!(get_interface_1_1_27, "/rest/v10.12/system/interfaces/1%2F1%2F27");
interface_link_state_cmd!(get_interface_1_1_28, "/rest/v10.12/system/interfaces/1%2F1%2F28");




#[tauri::command]
async fn get_utilization(ip: String) -> Result<String, String> {
    // Get the existing session client with cookies already stored.
    let client = {
        let session = SESSION_CLIENT.lock().await;
        session.clone().ok_or("Not logged in")?
    };

    // Construct the URL (adjust if needed)
    let url = format!(
        "https://{}/rest/v10.12/system/subsystems/management_module,1%2F1",
        ip
    );

    // Make the GET request with the appropriate Accept header.
    let res = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status, text));
    }

    // Parse the response text as JSON.
    let json_value: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("JSON parse error: {}", e))?;

    // Navigate to the nested "resource_utilization" object.
    let ru = json_value
        .get("resource_utilization")
        .ok_or("Missing resource_utilization field")?;

    // Extract the "cpu" and "memory" fields.
    let cpu = ru.get("cpu")
        .and_then(|v| v.as_u64())
        .ok_or("Missing or invalid 'cpu' field")? as u32;
    let memory = ru.get("memory")
        .and_then(|v| v.as_u64())
        .ok_or("Missing or invalid 'memory' field")? as u32;

    // Create the filtered struct.
    let filtered = FilteredUtilization { cpu, memory };

    // Return as JSON
    serde_json::to_string(&filtered).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_event_logs(ip: String) -> Result<String, String> {
    // Retrieve the already logged-in session client.
    let client = {
        let session = SESSION_CLIENT.lock().await;
        session.clone().ok_or("Not logged in")?
    };

    // Build the request URL.
    let url = format!("https://{}/rest/v10.12/logs/event", ip);

    // Define query parameters (curl encoded parameters will be set here as plain strings).
    let query_params = [
        ("priority", "7"),
        ("since", "10 hours ago"),
        ("until", "now"),
        ("limit", "20"),
    ];

    // Send the GET request with the required headers.
    let res = client
        .get(&url)
        .query(&query_params)
        .header("Accept", "*/*")
        .header("x-csrf-token", "CW7WOLEAp4Dj_tgSbU-zow==")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    // Check the status code.
    let status = res.status();
    if !status.is_success() {
        let error_text = res.text().await.map_err(|e| e.to_string())?;
        return Err(format!("HTTP {}: {}", status, error_text));
    }

    // Read the response as text.
    let text = res.text().await.map_err(|e| e.to_string())?;
    // Parse the response as JSON.
    let json_value: Value = serde_json::from_str(&text)
        .map_err(|e| format!("JSON parse error: {}", e))?;

    // Extract the "entities" array.
    let entities = json_value
        .get("entities")
        .and_then(|v| v.as_array())
        .ok_or("Missing or invalid 'entities' field")?;
    
    // Map each entity to extract its "MESSAGE" field.
    let messages: Vec<String> = entities.iter().filter_map(|entity| {
        entity.get("MESSAGE")?.as_str().map(|s| s.to_string())
    }).collect();

    // Return the messages as a JSON string.
    serde_json::to_string(&messages).map_err(|e| e.to_string())
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
            generate_custom_token,
            login_switch,
            logout_switch,
            get_utilization,
            get_event_logs,
            get_interface_1_1_1,
            get_interface_1_1_2,
            get_interface_1_1_3,
            get_interface_1_1_4,
            get_interface_1_1_5,
            get_interface_1_1_6,
            get_interface_1_1_7,
            get_interface_1_1_8,
            get_interface_1_1_9,
            get_interface_1_1_10,
            get_interface_1_1_11,
            get_interface_1_1_12,
            get_interface_1_1_13,
            get_interface_1_1_14,
            get_interface_1_1_15,
            get_interface_1_1_16,
            get_interface_1_1_17,
            get_interface_1_1_18,
            get_interface_1_1_19,
            get_interface_1_1_20,
            get_interface_1_1_21,
            get_interface_1_1_22,
            get_interface_1_1_23,
            get_interface_1_1_24,
            get_interface_1_1_25,
            get_interface_1_1_26,
            get_interface_1_1_27,
            get_interface_1_1_28
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri app");
}