from typing_extensions import Annotated
import requests
import json
import base64
import time




# TEMPORARY FLUFF FOR NEW SWITCH


"""

# Default switch base url information
#SWITCH_IP = '10.0.150.150'  # Redact, will be removed in the final version
#USERNAME = 'admin'          # Redact, will be removed in the final version
#PASSWORD = ''               # Redact, will be removed in the final version
#BASE_URL = "https://{switch_ip}"

import requests
import json

# Switch IP address and API version
switch_ip = "10.0.150.150" # Replace with your switch IP
api_version = "v10.12"  # Replace with your switch API version

# Login credentials
username = "admin"
password = "" # Replace with the admin password

# Disable SSL verification (if needed, for self-signed certificates)
verify_ssl = False # Change to True if you have valid certificates

# Login URL
login_url = f"https://{switch_ip}/rest/{api_version}/login"

# Data for the login request
login_data = {
    "username": username,
    "password": password
}

# Headers for JSON content
headers = {'Content-Type': 'application/json'}

def format_json(data):
    # Formats JSON data for better readability.
    try:
        return json.dumps(data, indent=4)
    except:
        return str(data)  # Return as string if not JSON serializable


try:
    # Create a session object to persist cookies
    session = requests.Session()

    # Send the login request
    response = session.post(login_url, data=login_data, verify=verify_ssl)

    # Check for successful login
    if response.status_code == 200:
        print("Login successful!")

        # Example: Get system information (replace with your desired API call)
        system_url = f"https://{switch_ip}/rest/{api_version}/system"
        system_response = session.get(system_url, verify=verify_ssl)
        system_response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)
        print("System information:\n", format_json(system_response.json()))

        # Logout (replace with your actual logout URL)
        logout_url = f"https://{switch_ip}/rest/{api_version}/logout"
        logout_response = session.post(logout_url, verify=verify_ssl)
        if logout_response.status_code == 200:
            print("Logout successful!")
        else:
            print(f"Logout failed with status code: {logout_response.status_code}")

    else:
        print(f"Login failed with status code: {response.status_code}")
        print(response.text) # Print the response text for debugging

except requests.exceptions.RequestException as e:
    print(f"An error occurred: {e}")

"""


def get_mac_addresses(switch_ip, api_version, username, password, verify_ssl=False):

    def format_json(data):
        """Formats JSON data for better readability."""
        try:
            return json.dumps(data, indent=4)
        except:
            return str(data)  # Return as string if not JSON serializable

    # Login URL
    login_url = f"https://{switch_ip}/rest/{api_version}/login"

    # Data for the login request (JSON format)
    login_data = {
        "username": username,
        "password": password
    }

    # Headers for JSON content
    headers = {'Content-Type': 'application/json'}

    try:
        # Create a session object to persist cookies
        session = requests.Session()

        # Send the login request
        response = session.post(login_url, data=login_data, verify=verify_ssl)

        # Check for successful login
        if response.status_code == 200:
            print("Login successful!")

            # Attempt to retrieve MAC address table.  The actual endpoint may vary.
            mac_table_url = f"https://{switch_ip}/rest/{api_version}/system/vlans/1/macs"
            mac_response = session.get(mac_table_url, headers=headers, verify=verify_ssl)
            mac_response.raise_for_status()

            mac_data = mac_response.json()
            print("MAC Address Table data:\n", format_json(mac_data)) # Print the mac_data in readable JSON format
            return mac_data

        else:
            print(f"Login failed with status code: {response.status_code}")
            print(response.text)  # Print the response text for debugging
            return None

    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")
        return None

# Example usage (replace with your actual credentials and switch IP)
switch_ip = "10.0.150.150"  # Replace with your switch IP
api_version = "v10.12"  # Replace with your switch API version
username = "admin"
password = ""  # Replace with the admin password

mac_info = get_mac_addresses("10.0.150.150", "v10.12", "admin", "")

if mac_info:
    print("Successfully retrieved MAC address information.")
else:
    print("Failed to retrieve MAC address information.")