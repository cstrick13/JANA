import sys
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
OUTPUT_FILENAME = "cx_switch_output_log.txt" # File to store output
OUTPUT_FILE = False # Flag to indicate if output should be saved to a file
LOGOUT = True # Flag to indicate if logout is required after script execution
CURL = False # Flag to indicate if curl command should be printed
reboot_status = False


# Check if the IP address is valid
def is_valid_ip(ip):
    """
    Checks if the IP address is valid.

    :param ip: IP address to be checked
    :return: True if valid, False if invalid
    """
    try:
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False

# Save the session object to a file
def save_session(session: requests.Session):
    """
    Saves the session object to a file.
    
    :param session: Session object to be saved
    :return: None
    """
    with open(SESSION_FILE, "wb") as file:
        pickle.dump(session, file)
    print("Session saved successfully.")

# Load the session object from a file
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

# Delete the session file
def delete_session():
    """
    Deletes the saved session file.

    :return: None
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

    # Redirect output to a file
    if OUTPUT_FILE == True:
        sys.stdout = open(OUTPUT_FILENAME, "w", encoding="utf-8")

    # List of CLI commands to execute
    cli_commands = [
        "show interface",
        "show ip dns",
        "show ip helper-address",
        "show ip igmp",
        "show ip mroute",
        "show ip multicast summary",
        "show ip ospf all-vrfs",
        "show ip ospf border-routers all-vrfs",
        "show ip ospf interface all-vrfs",
        "show ip pim",
        "show ip route all-vrfs"
        "show ipv6 helper-address",
        "show ipv6 mld",
        "show ipv6 mroute",
        "show ipv6 neighbors all-vrfs",
        "show ipv6 neighbors",
        "show ipv6 ospfv3 all-vrfs",
        "show ipv6 ospfv3 border-routers all-vrfs",
        "show ipv6 ospfv3 interface all-vrfs",
        "show ipv6 pim6",
        "show lacp aggregates",
        "show lacp interfaces",
        "show lldp local",
        "show lldp neighbor",
        "show loop-protect",
        "show mac-address-table",
        "show module",
        "show nd-snooping binding",
        "show nd-snooping prefix-list",
        "show nd-snooping statistics",
        "show nd-snooping",
        "show ntp associations",
        "show ntp servers",
        "show ntp status",
        "show port-access clients onboarding-method device-profile",
        "show port-access clients onboarding-method dot1x",
        "show port-access clients onboarding-method mac-auth",
        "show port-access clients onboarding-method port-security",
        "show port-access clients",
        "show port-access gbp",
        "show port-access policy",
        "show port-access port-security interface all client-status",
        "show port-access port-security interface all port-statistics",
        "show port-access role local",
        "show port-access role radius",
        "show port-access port-security violation client-limit-exceeded interface all",
        "show power-over-ethernet",
        "show qos dscp-map",
        "show qos queue-profile",
        "show qos schedule-profile",
        "show qos trust",
        "show radius dyn-authorization",
        "show radius-server",
        "show resources",
        "show spanning-tree detail",
        "show spanning-tree mst detail",
        "show system inventory",
        "show system resource-utilization",
        "show tacacs-server",
        "show ubt brief",
        "show ubt information",
        "show uptime",
        "show version",
        "show vlan",
        "show vrf",
        "show vsf detail",
        "show vsf link detail",
        "show vsf link error-detail",
        "show vsf topology",
        "show vsf",
        "show vsx ip igmp",
        "show vsx ip route",
        "show vsx ipv6 route",
        "show vsx mac-address-table",
        "show vsx status",
        "show ztp information"
    ]

    # Loop through commands, call real RESTapi method, and print input/output
    for index, command in enumerate(cli_commands, start=1):
        print(f"INPUT {index}:\n{command}\n")
    
        try:
            output = RESTapi.cli_command(switch_ip, session, command)
        except Exception as e:
            output = f"Error executing command: {e}"

        print(f"OUTPUT {index}:\n{output}\n")

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
    #print(f"Switch IP: {switch_ip}")
    #print(f"Session ID: {session}")


    ### Useful CLI Commands ###
    #print(f"System Version CLI: {show_version_cli}")

    ### Usefule SSH Commands ###
    #print(f"System Version SSH: {show_version_ssh}")


    #print(f"Reboot Status: {reboot_status}")
    #if LOGOUT:
    #    print(f"Logout Status: {logout_status}")
    
    
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

    # Close the output file
    if OUTPUT_FILE == True:
        sys.stdout.close()