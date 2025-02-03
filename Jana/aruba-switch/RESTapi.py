from typing_extensions import Annotated
import requests
import json
import base64

# Default switch base url information
SWITCH_IP = '192.168.1.1'
USERNAME = 'admin'
PASSWORD = 'admin'
BASE_URL = "http://{switch_ip}"

# Constants
TIMEOUT = 5
session_id = None

# Login function - stores session id
def login_to_switch(switch_ip: Annotated[str, "The IP address of the switch"], 
                    username: Annotated[str, "The username to login with"], 
                    password: Annotated[str, "The password to login with"]):

    # Construct the login URL
    base_url = BASE_URL.format(switch_ip=switch_ip)
    login_url = f"{base_url}/rest/v1/login-sessions"

    # Set the login payload
    payload = {"userName": username, "password": password}

    # Send the POST request to get the session cookie to authenticate
    try:
        response = requests.post(login_url, json=payload, timeout=TIMEOUT)
        response.raise_for_status()
        session_id = response.json().get("cookie")
        return session_id
    
    # Handle exceptions
    except requests.exceptions.RequestException as e:
        print(f"Login failed: {e}")
        return None
    except requests.exceptions.Timeout as e:
        print(f"Request timed out: {e}")
        return None

# Logout function
def logout_from_switch(switch_ip: Annotated[str, "The IP address of the switch"], 
                       session_id: Annotated[str, "The session ID to use for authentication, obtained from login"]):

    # Construct the logout URL
    base_url = BASE_URL.format(switch_ip=switch_ip)
    logout_url = f"{base_url}/rest/v1/login-sessions"

    # Set the headers
    headers = {"Cookie": session_id}

    # Send the DELETE request to logout
    try:
        response = requests.delete(logout_url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        return True
    
    # Handle exceptions
    except requests.exceptions.RequestException as e:
        print(f"Logout failed: {e}")
        return False
    except requests.exceptions.Timeout as e:
        print(f"Request timed out: {e}")
        return False

# System information function
def get_system_info(switch_ip: Annotated[str, "The IP address of the switch"], 
                    session_id: Annotated[str, "The session ID to use for authentication, obtained from login"]):

    # Construct the system URL
    base_url = BASE_URL.format(switch_ip=switch_ip)
    system_url = f"{base_url}/rest/v1/system"

    # Set the headers
    headers = {"Cookie": session_id}

    # Send the GET request to fetch system information
    try:
        response = requests.get(system_url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        return response.json()
    
    # Handle exceptions
    except requests.exceptions.RequestException as e:
        print(f"Failed to fetch system info: {e}")
        return None
    except requests.exceptions.Timeout as e:
        print(f"Request timed out: {e}")
        return None

# Execute command function
def execute_command(switch_ip: Annotated[str, "The IP address of the switch"], 
                    session_id: Annotated[str, "The session ID to use for authentication, obtained from login"],
                    command: Annotated[str, "The commands, should be a supported command"]):

    # Construct the command execution URL
    base_url = BASE_URL.format(switch_ip=switch_ip)
    execute_url = f"{base_url}/rest/v3/cli"

    # Set the headers
    headers = {
        "Cookie": session_id,
        "Content-Type": "application/json"
    }

    # Set the command payload
    data = json.dumps({"cmd": command})

    # Send the POST request to execute the command
    try:
        response = requests.post(execute_url, headers=headers, data=data, verify=False, timeout=TIMEOUT)
        response.raise_for_status()

        # Parse the JSON response
        base64_encoded_result = response.json().get("result_base64_encoded")
        if base64_encoded_result:
            decoded_result = base64.b64decode(base64_encoded_result).decode('utf-8')
            return decoded_result
        else:
            print("Error: 'result_base64_encoded' key not found in response.")
            return False
    
    # Handle exceptions
    except requests.exceptions.RequestException as e:
        print(f"Failed to execute command: {e}")
        return False
    except requests.exceptions.Timeout as e:

        # Check if the command is a reboot command
        if command == "reload":
            print("Switch is rebooting. Please wait for a few minutes.")
            return True

        print(f"Request timed out: {e}")
        return False
    except json.JSONDecodeError:
        print("Failed to parse the JSON response.")
        return False

## Subset of the execute_command function ##
# Reboot switch function
def reboot_switch(switch_ip: Annotated[str, "The IP address of the switch"], 
                  session_id: Annotated[str, "The session ID to use for authentication, obtained from login"]):
    command = "reload"
    return execute_command(switch_ip, session_id, command)

# Get switch version function
def get_switch_version(switch_ip: Annotated[str, "The IP address of the switch"], 
                       session_id: Annotated[str, "The session ID to use for authentication, obtained from login"]):
    command = "show version"
    return execute_command(switch_ip, session_id, command)

# Get switch time function
def get_switch_time(switch_ip: Annotated[str, "The IP address of the switch"], 
                    session_id: Annotated[str, "The session ID to use for authentication, obtained from login"]):
    command = "clock"
    return execute_command(switch_ip, session_id, command)

# Get switch logs function
def get_switch_logs(switch_ip: Annotated[str, "The IP address of the switch"],
                    session_id: Annotated[str, "The session ID to use for authentication, obtained from login"]):
    command = "show log"
    return execute_command(switch_ip, session_id, command)
