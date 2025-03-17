import json
import os
import ipaddress
import RESTapi_CX as RESTapi
import requests
import pickle


# Debug mode
DEBUG = False


# Default switch information
# Aruba 6300 (AOS-CX)
CX_SWITCH_IP = "10.0.150.150"
CX_USERNAME = "admin"
CX_PASSWORD = ""


# Constants
SESSION_FILE = "session.pkl" # File to store session information
LOGOUT = True # Flag to indicate if logout is required
CURL = True # Flag to indicate if curl command should be printed
reboot_status = False


# Check if the IP address is valid
def is_valid_ip(ip):
    try:
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False


def save_session(session: requests.Session):
    """
    Saves the session object to a file.
    
    :param session: Session object to be saved
    """
    with open(SESSION_FILE, "wb") as file:
        pickle.dump(session, file)
    print("Session saved successfully.")


def load_session():
    """
    Loads the session object from a file.
    
    :return: Loaded session object or None if not found
    """
    if os.path.exists(SESSION_FILE):
        with open(SESSION_FILE, "rb") as file:
            session = pickle.load(file)
        print("Session loaded successfully.")
        return session
    else:
        print("No saved session found.")
        return None


def delete_session():
    """
    Deletes the saved session file.
    """
    if os.path.exists(SESSION_FILE):
        os.remove(SESSION_FILE)
        print("Session deleted successfully.")
    else:
        print("No saved session to delete.")


if __name__ == "__main__":
    # Ask if user is connected to the VPN, if so, use the VPN IP
    vpn_cred = input("Are you connected to the VPN? (Y/N): ")
    if vpn_cred.lower() != "n":
        switch_ip = CX_SWITCH_IP
        username = CX_USERNAME
        password = CX_PASSWORD
    else:
        print("Sorry, you are not connected to the VPN. Manual input of IP addresses is also not supported. Please connect to the VPN to access the switch.")
        exit(1)
    
    # Ask if user wants to use the default username and password
    default_cred = input(f"Do you want to use the default username: ({username}) and password: ({password}) (Y/N): ")
    if default_cred.lower() != "y":
        username = input("Admin username: ")
        password = input("Admin password: ")
    else:
        pass

    # Check if session exists
    session = load_session()
    if session:
        print(f"Using existing session ID: {session}")
    else:
        # Login to the switch
        session = RESTapi.login_to_switch(switch_ip, username, password)
        if session:
            save_session(session)
        else:
            print("Failed to login to the switch.")
            exit(1)

    # Testing Commands after login
    show_version_cli = RESTapi.cli_command(switch_ip, session, "show version")
    show_version_ssh = RESTapi.ssh_command(switch_ip, username, password, "show version")
    #reboot_status = RESTapi.reboot_switch(switch_ip, session_id) # It is bugged 

    # Testing Logout
    if LOGOUT:
        logout_status = RESTapi.logout_from_switch(switch_ip, session)
        if logout_status:
            if DEBUG:
                print("Logout successful.")
        else:
            print("Failed to log out from the switch.")
    
    if LOGOUT or reboot_status:
        delete_session()

    
    # Print results/status
    print("==========================================================")
    print(f"Switch IP: {switch_ip}")
    print(f"Session ID: {session}")
    print(f"System Version CLI: {show_version_cli}")
    print(f"System Version SSH: {show_version_ssh}")
    print(f"Reboot Status: {reboot_status}")
    if LOGOUT:
        print(f"Logout Status: {logout_status}")
    
    
    # Print the curl command (DEBUGGING)
    # NOT FOR THIS SWITCH
    if CURL:
        curl_command = "clock"
        curl_command = f"""
        curl -k --noproxy "{switch_ip}" -b {session} \\
        -X POST "http://{switch_ip}/rest/v3/cli" \\
        -H "content-type: application/json" \\
        -d '{{"cmd":"{curl_command}"}}'
        """
        print("\nIf you haven't logged out or rebooted, run the following command in your terminal:")
        print(curl_command)