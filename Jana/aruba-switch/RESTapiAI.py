from typing_extensions import Annotated
import requests
import json
import base64

# Default switch information
SWITCH_IP = '192.168.1.1'
USERNAME = 'admin'
PASSWORD = 'admin'
BASE_URL = "http://{switch_ip}"

# Constants
TIMEOUT = 5
session_id = None

# Login function - stores session id
def login_to_switch():

    # Debug message
    print("\n\n====== LOGGING IN TO SWITCH ======\n\n")

    # Construct the login URL
    base_url = BASE_URL.format(switch_ip=SWITCH_IP)
    login_url = f"{base_url}/rest/v1/login-sessions"

    # Set the login payload
    payload = {"userName": USERNAME, "password": PASSWORD}

    # Send the POST request to get the session cookie to authenticate
    try:
        response = requests.post(login_url, json=payload, timeout=TIMEOUT) 
        response.raise_for_status()
        session_id = response.json().get("cookie")

        # Debug message
        print(f"\n\n====== Login successful, session_id: {session_id} ======\n\n")

        return session_id

    # Handle exceptions
    except requests.exceptions.RequestException as e:
        print(f"Login failed: {e}")
        return f"Login failed: {e}"
    except requests.exceptions.Timeout as e:
        print(f"Request timed out: {e}")
        return f"Request timed out: {e}"

# Logout function
def logout_from_switch():

    # Debug message
    print("\n\n====== LOGGING OUT FROM SWITCH ======\n\n")

    # Construct the logout URL
    base_url = BASE_URL.format(switch_ip=SWITCH_IP)
    logout_url = f"{base_url}/rest/v1/login-sessions"

    # Set the headers
    headers = {"Cookie": 'sessionId=' + session_id}

    # Send the DELETE request to logout
    try:
        response = requests.delete(logout_url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()

        # Debug message
        print(f"\n\n====== Logout successful, session_id: {session_id} ======\n\n")

        return True

    # Handle exceptions
    except requests.exceptions.RequestException as e:
        print(f"Logout failed: {e}")
        return f"Logout failed: {e}"
    except requests.exceptions.Timeout as e:
        print(f"Request timed out: {e}")
        return f"Request timed out: {e}"

# System information function
def get_system_info():

    # Debug message
    print("\n\n====== FETCHING SYSTEM INFO ======\n\n")

    # Construct the system URL
    base_url = BASE_URL.format(switch_ip=SWITCH_IP)
    system_url = f"{base_url}/rest/v1/system"

    # Set the headers
    headers = {"Cookie": 'sessionId' + session_id}

    # Send the GET request to fetch system information
    try:
        response = requests.get(system_url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()

        # Debug message
        print(f"\n\n====== Fetch system info successful, session_id: {session_id} ======\n\n")

        return response.json()

    # Handle exceptions
    except requests.exceptions.RequestException as e:
        print(f"Failed to fetch system info: {e}")
        return f"Failed to fetch system info: {e}"
    except requests.exceptions.Timeout as e:
        print(f"Request timed out: {e}")
        return f"Request timed out: {e}"

# Execute command function
def execute_command(session_id: Annotated[str, "The token used to authenticate to switch"], command: Annotated[str, "The command to execute"]):

    # Debug message
    print(f"\n\n====== EXECUTING COMMAND '{command}' ======\n\n")

    # Construct the execute URL
    base_url = BASE_URL.format(switch_ip=SWITCH_IP)
    execute_url = f"{base_url}/rest/v3/cli"

    # Set the headers
    headers = {
        "Cookie": 'sessionId=' + session_id,
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

            # Debug message
            print(f"\n\n====== Executing command '{command}' sucessful, session_id: {session_id} ======\n\n")

            return decoded_result
        else:
            print("Error: 'result_base64_encoded' key not found in response.")
            return "Error: 'result_base64_encoded' key not found in response."

    # Handle exceptions
    except requests.exceptions.RequestException as e:
        print(f"Failed to execute command: {e}")
        return f"Failed to execute command: {e}"
    except requests.exceptions.Timeout as e:

        # Check if the command is a reboot command
        if command == "reload":

            # Debug message
            print(f"\n\n====== Executing command '{command}' sucessful, session_id: {session_id} ======\n\n")

            print("Switch is rebooting...")
            return "Switch is rebooting..."

        print(f"Request timed out: {e}")
        return f"Request timed out: {e}"
    except json.JSONDecodeError:
        print("Error: Failed to parse the JSON response.")
        return "Error: Failed to parse the JSON response."

## Subset of the execute_command function ##
# Reboot switch function
def reboot_switch(session_id: Annotated[str, "The session ID to execute the command on."]):
    command = "reload"
    return execute_command(session_id, command)

# Get switch version function
def get_switch_version(session_id: Annotated[str, "The session ID to execute the command on."]):
    command = "show version"
    return execute_command(session_id, command)

# Get switch logs function
def get_switch_logs(session_id: Annotated[str, "The session ID to execute the command on."]):
    command = "show log"
    return execute_command(session_id, command)

# Get switch time function
def get_switch_time(session_id: Annotated[str, "The session ID to execute the command on."]):
    command = "clock"
    return execute_command(session_id, command)
