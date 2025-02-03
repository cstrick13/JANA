import json
import ipaddress
import RESTapi

# Debug mode
DEBUG = False

# Default switch information
DEFAULT_SWITCH_IP = "192.168.1.1"
DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "admin"

def is_valid_ip(ip):
    try:
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False

"""
def main_login_to_switch(switch_ip, username, password):
    # Login to the switch
    session_cookie = RESTapi.login_to_switch(switch_ip, username, password)
    if session_cookie:
        if DEBUG:
            print("Login successful.")
            print(f"Session Cookie: {session_cookie}")
        return session_cookie
    else:
        print("Failed to log in to the switch.")

def main_get_system_info(switch_ip, session):
    # Get system information
    system_info = RESTapi.get_system_info(switch_ip, session)
    if system_info:
        if DEBUG:
            print("System Information:")
            print(json.dumps(system_info, indent=4))
        return system_info
    else:
        print("Failed to retrieve system information.")

def main_logout_from_switch(switch_ip, session):
    # Logout from the switch
    logout_status = RESTapi.logout_from_switch(switch_ip, session)
    if logout_status:
        if DEBUG:
            print("Logout successful.")
    else:
        print("Failed to log out from the switch.")
"""

if __name__ == "__main__":
    switch_ip = DEFAULT_SWITCH_IP
    username = DEFAULT_USERNAME
    password = DEFAULT_PASSWORD
    
    # Ask user if they want to use the default switch IP, username, and password
    default_cred = input("Do you want to use the default switch IP, username, and password? (Y/N): ")
    if default_cred.lower() != "y":
        while True:
            switch_ip = input("Input the switch's IP address (xxx.xxx.xxx.xxx): ")
            if is_valid_ip(switch_ip):
                break
            else:
                print("Invalid IP address. Please try again.")
        username = input("Admin username: ")
        password = input("Admin password: ")
    else:
        pass

    # Testing
    session_id = RESTapi.login_to_switch(switch_ip, username, password)
    system_info = RESTapi.get_system_info(switch_ip, session_id)
    system_version = RESTapi.get_switch_version(switch_ip, session_id)
    switch_time = RESTapi.get_switch_time(switch_ip, session_id)
    switch_logs = RESTapi.get_switch_logs(switch_ip, session_id)
    logout_status = RESTapi.logout_from_switch(switch_ip, session_id)
    #reboot_status = RESTapi.reboot_switch(switch_ip, session_id)

    print(f"Session Id: {session_id}")
    print(f"System Information: {system_info}")
    print(f"System Version: {system_version}")
    print(f"Switch Time: {switch_time}")
    print(f"Switch Logs: {switch_logs}")
    print(f"Logout Status: {logout_status}")
    #print(f"Reboot Status: {reboot_status}")