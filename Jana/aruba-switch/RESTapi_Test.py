import json
import os
import ipaddress
import RESTapi

# Debug mode
DEBUG = False

# Default switch information
# Aruba (AOS-S)
AOS_SWITCH_IP = "10.0.150.100"
AOS_USERNAME = "admin"
AOS_PASSWORD = "admin"

# Aruba 6300 (AOS-CX)
CX_SWITCH_IP = "10.0.150.150"
CX_USERNAME = "admin"
CX_PASSWORD = ""

# Constants
SESSION_FILE = "session.json" # File to store session information
LOGOUT = False # Flag to indicate if logout is required
CURL = True # Flag to indicate if curl command should be printed
reboot_status = False

# Check if the IP address is valid
def is_valid_ip(ip):
    try:
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False

# Save the session ID to a file
def save_session(session_id):
    with open(SESSION_FILE, 'w') as file:
        json.dump({"session_id": session_id}, file)

        if DEBUG:
            print(f"Session saved to {SESSION_FILE}.")

# Load the session ID from a file
def load_session():
    if os.path.exists(SESSION_FILE):
        with open(SESSION_FILE, 'r') as file:

            if DEBUG:
                print(f"Loading session from {SESSION_FILE}.")

            data = json.load(file)
            return data.get("session_id")
    return None

# Delete the session file
def delete_session():
    if os.path.exists(SESSION_FILE):
        os.remove(SESSION_FILE)

        if DEBUG:
            print(f"Session file {SESSION_FILE} deleted.")

if __name__ == "__main__":
    #switch_ip = DEFAULT_SWITCH_IP
    #username = DEFAULT_USERNAME
    #password = DEFAULT_PASSWORD

    # Ask if user is connected to the VPN, if so, use the VPN IP
    vpn_cred = input("Are you connected to the VPN? (Y/N): ")
    if vpn_cred.lower() != "n":
        vpn_switch = input("Aruba (AOS-S) / Aruba 6300 (AOS-CX), are you connecting to AOS-S or AOS-CX? (S/C): ")
        if vpn_switch.lower() == "s":
            switch_ip = AOS_SWITCH_IP
            username = AOS_USERNAME
            password = AOS_PASSWORD
        else:
            switch_ip = CX_SWITCH_IP
            username = CX_USERNAME
            password = CX_PASSWORD
    else:
        # If user is not connected to the VPN, ask if they want to use the default switch IP
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
    session_id = load_session()
    if session_id:
        print(f"Using existing session ID: {session_id}")
    else:
        # Login to the switch
        session_id = RESTapi.login_to_switch(switch_ip, username, password)
        if session_id:
            save_session(session_id)
        else:
            print("Failed to login to the switch.")
            exit(1)

    # Testing Commands after login
    system_info = RESTapi.get_system_info(switch_ip, session_id)

    # Testing Execute Commands after login
    system_version = RESTapi.get_switch_version(switch_ip, session_id)
    switch_time = RESTapi.get_switch_time(switch_ip, session_id)
    switch_logs = RESTapi.get_switch_logs(switch_ip, session_id)
    recent_switch_logs = RESTapi.get_recent_switch_logs(switch_ip, session_id)
    mac_address = RESTapi.get_mac_address_table(switch_ip, session_id)
    lldp_info = RESTapi.get_lldp_info_remote_device(switch_ip, session_id)
    system_info_excute = RESTapi.get_system_info_execute(switch_ip, session_id)
    #reboot_status = RESTapi.reboot_switch(switch_ip, session_id) # It is bugged 

    # Testing Custom Execute Command after login
    #execute_command = RESTapi.execute_command(switch_ip, session_id, "show log r") # Shows recent logs
    #execute_command1 = RESTapi.execute_command(switch_ip, session_id, "show lldp info local") # ?
    #execute_command2 = RESTapi.execute_command(switch_ip, session_id, "show lldp info remote-device") # Shows the leaf nodes and their remote port
    #execute_command3 = RESTapi.execute_command(switch_ip, session_id, "show system")

    # Testing Logout
    if LOGOUT:
        logout_status = RESTapi.logout_from_switch(switch_ip, session_id)
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
    print(f"Session ID: {session_id}")
    print(f"System Information: {system_info}")
    print(f"System Version: {system_version}")
    print(f"Switch Time: {switch_time}")
    print(f"Switch Logs: {switch_logs}")
    print(f"Recent Switch Logs: {recent_switch_logs}")
    print(f"MAC Address: {mac_address}")
    print(f"LLDP Information: {lldp_info}")
    print(f"System Information Execute: {system_info_excute}")
    print(f"Reboot Status: {reboot_status}")
    if LOGOUT:
        print(f"Logout Status: {logout_status}")

    # Print the curl command (DEBUGGING)
    if CURL:
        curl_command = "clock"
        curl_command = f"""
        curl -k --noproxy "{switch_ip}" -b {session_id} \\
        -X POST "http://{switch_ip}/rest/v3/cli" \\
        -H "content-type: application/json" \\
        -d '{{"cmd":"{curl_command}"}}'
        """
        print("\nIf you haven't logged out or rebooted, run the following command in your terminal:")
        print(curl_command)