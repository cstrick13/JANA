import requests
import json
import base64

# Default switch base url information
BASE_URL = "http://{switch_ip}"

# Timeout value in seconds
TIMEOUT = 5

# Login function
def login_to_switch(switch_ip, username, password):
    base_url = BASE_URL.format(switch_ip=switch_ip)
    login_url = f"{base_url}/rest/v1/login-sessions"
    payload = {"userName": username, "password": password}
    try:
        response = requests.post(login_url, json=payload, timeout=TIMEOUT)
        response.raise_for_status()
        session_cookie = response.json().get("cookie")
        return session_cookie
    except requests.exceptions.RequestException as e:
        print(f"Login failed: {e}")
        return None
    except requests.exceptions.Timeout as e:
        print(f"Request timed out: {e}")
        return None
    
def logout_from_switch(switch_ip, session_cookie):
    base_url = BASE_URL.format(switch_ip=switch_ip)
    logout_url = f"{base_url}/rest/v1/login-sessions"
    headers = {"Cookie": session_cookie}
    try:
        response = requests.delete(logout_url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:
        print(f"Logout failed: {e}")
        return False
    except requests.exceptions.Timeout as e:
        print(f"Request timed out: {e}")
        return False

# System information function
def get_system_info(switch_ip, session_cookie):
    base_url = BASE_URL.format(switch_ip=switch_ip)
    system_url = f"{base_url}/rest/v1/system"
    headers = {"Cookie": session_cookie}
    try:
        response = requests.get(system_url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Failed to fetch system info: {e}")
        return None
    except requests.exceptions.Timeout as e:
        print(f"Request timed out: {e}")
        return None

def execute_command(switch_ip, session_cookie, command):
    base_url = BASE_URL.format(switch_ip=switch_ip)
    execute_url = f"{base_url}/rest/v3/cli"
    headers = {
        "Cookie": session_cookie,
        "Content-Type": "application/json"
    }
    
    data = json.dumps({"cmd": command})

    response = requests.post(execute_url, headers=headers, data=data, verify=False, timeout=TIMEOUT)

    if response.status_code == 200:
        try:
            result = response.json()
            base64_encoded_result = result.get("result_base64_encoded")
            if base64_encoded_result:
                decoded_result = base64.b64decode(base64_encoded_result).decode('utf-8')
                return decoded_result
            else:
                print("Error: 'result_base64_encoded' key not found in response.")
        except json.JSONDecodeError:
            print("Error: Failed to parse the JSON response.")
    else:
        print(f"HTTP Error: {response.status_code} - {response.text}")
    
    return None

def execute_command_version(switch_ip, session_cookie):
    command = "show version"
    return execute_command(switch_ip, session_cookie, command)