from typing_extensions import Annotated
import requests
import json
import base64
import time


# Switch information (will be removed in the final version)
SWITCH_IP = '10.0.150.100'
USERNAME = 'admin'
PASSWORD = 'admin'


# Constants
BASE_URL = "http://{switch_ip}/rest/{api_version}"
VERIFY_SSL = False
TIMEOUT = 20


# Login function - stores session id
def login_to_switch(switch_ip: Annotated[str, "The IP address of the switch"], 
                    username: Annotated[str, "The username to login with"], 
                    password: Annotated[str, "The password to login with"]):
    """
    Logs in to an ArubaOS switch and returns a session ID.

    :param switch_ip: IP address of the switch
    :param username: Username for login
    :param password: Password for login
    :return: Session ID if login successful, None otherwise
    """

    # Construct the login URL
    base_url = BASE_URL.format(switch_ip=switch_ip, api_version="v1")
    login_url = f"{base_url}/login-sessions"

    # Set the login payload
    login_data = {
        "userName": username,
        "password": password
    }

    try:
        # Send the login request
        response = requests.post(login_url, json=login_data, verify=VERIFY_SSL, timeout=TIMEOUT)

        # Raise an exception for bad responses (4xx or 5xx)
        response.raise_for_status()

        # Check for successful login
        if response.status_code == 201:
            print("Login successful.")
            session_id = response.json().get("cookie")
            return session_id
        
        else:
            print("Login failed with status code:", response.status_code)
            return None
    
    except requests.exceptions.RequestException as e:
        print(f"An error occurred at login: {e}")
        return None
    
    except requests.exceptions.Timeout as e:
        print(f"Request timed out at login: {e}")
        return None


# Logout function
def logout_from_switch(switch_ip: Annotated[str, "The IP address of the switch"], 
                       session_id: Annotated[str, "The session ID to use for authentication, obtained from login"]):
    """
    Logs out from an ArubaOS switch.

    :param switch_ip: IP address of the switch
    :param session_id: Session ID obtained from login
    :return: True if logout successful, False otherwise
    """

    # Construct the logout URL
    base_url = BASE_URL.format(switch_ip=switch_ip, api_version="v1")
    logout_url = f"{base_url}/login-sessions"

    # Set the headers
    headers = {"Cookie": session_id}

    try:
        # Send the logout request
        response = requests.delete(logout_url, headers=headers, verify=VERIFY_SSL, timeout=TIMEOUT)

        # Raise an exception for bad responses (4xx or 5xx)
        response.raise_for_status()

        # Check for successful logout
        if response.status_code == 204:
            print("Logout successful.")
            return True
        
        else:
            print("Logout failed with status code:", response.status_code)
            return False
    
    except requests.exceptions.RequestException as e:
        print(f"An error occurred at logout: {e}")
        return False
    
    except requests.exceptions.Timeout as e:
        print(f"Request timed out at logout: {e}")
        return False


# System information function
# Might be redundent
def get_system_info(switch_ip: Annotated[str, "The IP address of the switch"], 
                    session_id: Annotated[str, "The session ID to use for authentication, obtained from login"]):
    """
    Fetches system information from an ArubaOS switch.

    :param switch_ip: IP address of the switch
    :param session_id: Session ID obtained from login
    :return: System information if successful, None otherwise
    """

    # Construct the system URL
    base_url = BASE_URL.format(switch_ip=switch_ip, api_version="v1")
    system_url = f"{base_url}/system"

    # Set the headers
    headers = {"Cookie": session_id}

    try:
        # Send the GET request to fetch system information
        response = requests.get(system_url, headers=headers, verify=VERIFY_SSL, timeout=TIMEOUT)

        # Raise an exception for bad responses (4xx or 5xx)
        response.raise_for_status()

        # Check for successful response
        if response.status_code == 200:
            print("System information fetched successfully")
            return response.json()
        
        else:
            print("get_system_info failed with status code:", response.status_code)
            return None
    
    except requests.exceptions.RequestException as e:
        print(f"An error occurred at get_system_info: {e}")
        return None
    
    except requests.exceptions.Timeout as e:
        print(f"Request timed out at get_system_info: {e}")
        return None


# CLI command function
def cli_command(switch_ip: Annotated[str, "The IP address of the switch"],
                session_id: Annotated[str, "The session ID to use for authentication, obtained from login"],
                command: Annotated[str, "The commands, should be a supported command"]):
    """
    Executes a CLI command on an ArubaOS switch.

    :param switch_ip: IP address of the switch
    :param session_id: Session ID obtained from login
    :param command: The CLI command to execute
    :return: The output of the command if successful, None otherwise
    """

    # Construct the command execution URL
    base_url = BASE_URL.format(switch_ip=switch_ip, api_version="v3")
    execute_url = f"{base_url}/cli"

    # Set the headers
    headers = {
        "Cookie": session_id,
        "Content-Type": "application/json"
    }

    # Set the command payload
    data = json.dumps({"cmd": command})

    # Check if the command is a reboot command
    if command == "reload":
        print(f"Executing command: {command}")
        response = requests.post(execute_url, headers=headers, data=data, verify=VERIFY_SSL, timeout=TIMEOUT)
        print("Switch is rebooting. Please wait for a few minutes.")
        time.sleep(120)
        return True

    # Send the POST request to execute the command
    try:
        print(f"Executing command: {command}")
        
        response = requests.post(execute_url, headers=headers, data=data, verify=VERIFY_SSL, timeout=TIMEOUT)
        response.raise_for_status()

        # Parse the JSON response
        base64_encoded_result = response.json().get("result_base64_encoded")
        if base64_encoded_result:
            decoded_result = base64.b64decode(base64_encoded_result).decode('utf-8')
            return decoded_result
        else:
            print("Error: 'result_base64_encoded' key not found in response.")
            return False
    
    except requests.exceptions.RequestException as e:
        print(f"An error occurred at CLI command {command}: {e}")
        return False
    
    except requests.exceptions.Timeout as e:
        print(f"Request timed out at CLI command {command}: {e}")
        return False
    
    except json.JSONDecodeError:
        print("Failed to parse the JSON response.")
        return False


## Subset of the cli_command function ##
# Reboot switch function
def reboot_switch(switch_ip: Annotated[str, "The IP address of the switch"], 
                  session_id: Annotated[str, "The session ID to use for authentication, obtained from login"]):
    command = "reload"
    return cli_command(switch_ip, session_id, command)

# Get switch version function
def get_switch_version(switch_ip: Annotated[str, "The IP address of the switch"], 
                       session_id: Annotated[str, "The session ID to use for authentication, obtained from login"]):
    command = "show version"
    return cli_command(switch_ip, session_id, command)

# Get switch time function
def get_switch_time(switch_ip: Annotated[str, "The IP address of the switch"], 
                    session_id: Annotated[str, "The session ID to use for authentication, obtained from login"]):
    command = "clock"
    return cli_command(switch_ip, session_id, command)

# Get switch logs function
def get_switch_logs(switch_ip: Annotated[str, "The IP address of the switch"],
                    session_id: Annotated[str, "The session ID to use for authentication, obtained from login"]):
    command = "show log"
    return cli_command(switch_ip, session_id, command)

# Get recent switch logs function
def get_recent_switch_logs(switch_ip: Annotated[str, "The IP address of the switch"],
                           session_id: Annotated[str, "The session ID to use for authentication, obtained from login"]):
    command = "show log r"
    return cli_command(switch_ip, session_id, command)

# Get MAC address table function
def get_mac_address_table(switch_ip: Annotated[str, "The IP address of the switch"],
                          session_id: Annotated[str, "The session ID to use for authentication, obtained from login"]):
    command = "show mac-address"
    return cli_command(switch_ip, session_id, command)

# Get LLDP information function (discover information about their directly connected neighbors)
def get_lldp_info_remote_device(switch_ip: Annotated[str, "The IP address of the switch"],
                                session_id: Annotated[str, "The session ID to use for authentication, obtained from login"]):
    command = "show lldp info remote-device"
    return cli_command(switch_ip, session_id, command)

# Get System information function
# Might be redundent
def get_system_info_execute(switch_ip: Annotated[str, "The IP address of the switch"],
                    session_id: Annotated[str, "The session ID to use for authentication, obtained from login"]):
    command = "show system"
    return cli_command(switch_ip, session_id, command)