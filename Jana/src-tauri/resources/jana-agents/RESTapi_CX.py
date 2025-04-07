from typing_extensions import Annotated
import requests
import json
import paramiko


# Used to disable SSL warnings
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


# Switch information (will be removed in the final version)
SWITCH_IP = '10.0.150.150'
USERNAME = 'admin'
PASSWORD = ''


# Constants
API_VERSION = "v10.12"
BASE_URL = "https://{switch_ip}/rest/{api_version}"
VERIFY_SSL = False
TIMEOUT = 10
DEBUG = False


# Login function
def login_to_switch(switch_ip: Annotated[str, "The IP address of the switch"],
                    username: Annotated[str, "The username to login with"],
                    password: Annotated[str, "The password to login with"]):
    """
    Logs in to an ArubaOS-CX switch and returns a session object.

    :param switch_ip: IP address of the switch
    :param username: Username for login
    :param password: Password for login
    :return: Session object if login successful, None otherwise
    """

    # Construct the login URL
    base_url = BASE_URL.format(switch_ip=switch_ip, api_version=API_VERSION)
    login_url = f"{base_url}/login"

    # Construct the login payload
    login_data = {
        "username": username,
        "password": password
    }

    try:
        # Create a session object to persist cookies
        session = requests.Session()

        # Send the login request
        response = session.post(login_url, data=login_data, verify=VERIFY_SSL, timeout=TIMEOUT)

        # Raise an exception for bad responses (4xx or 5xx)
        response.raise_for_status()

        # Check for successful login
        if response.status_code == 200:
            if DEBUG:
                print(f"Login successful with status code: {response.status_code}")
                print(response.text)
            # print("Login successful!")
            return session

        else:
            print(f"Login failed with status code: {response.status_code}")
            print(response.text)  # Print the response text for debugging
            return None
        
    except requests.exceptions.RequestException as e:
        print(f"An error occurred at login: {e}")
        return None
    
    except requests.exceptions.Timeout as e:
        print(f"Request timed out at login: {e}")
        return None


# Logout function
def logout_from_switch(switch_ip: Annotated[str, "The IP address of the switch"],
                       session: Annotated[requests.Session, "The session object with active login"]):
    """
    Logs out from an ArubaOS-CX switch.

    :param switch_ip: IP address of the switch
    :param session: Session object with active login
    :return: True if logout successful, False otherwise
    """

    # Construct the logout URL
    base_url = BASE_URL.format(switch_ip=switch_ip, api_version=API_VERSION)
    logout_url = f"{base_url}/logout"

    try:
        # Send the logout request
        response = session.post(logout_url, verify=VERIFY_SSL, timeout=TIMEOUT)

        # Raise an exception for bad responses (4xx or 5xx)
        response.raise_for_status()

        # Check for successful logout
        if response.status_code == 200:
            if DEBUG:
                print(f"Logout successful with status code: {response.status_code}")
                print(response.text)
            # print("Logout successful!")
            return True
        
        else:
            print(f"Logout failed with status code: {response.status_code}")
            print(response.text)  # Print the response text for debugging
            return False
    
    except requests.exceptions.RequestException as e:
        print(f"An error occurred at logout: {e}")
        return False
    
    except requests.exceptions.Timeout as e:
        print(f"Request timed out at logout: {e}")
        return False


# CLI command function (refer to bottom of the file for list of commands)
def cli_command(switch_ip: Annotated[str, "The IP address of the switch"],
                session: Annotated[requests.Session, "The session object with active login"],
                command: Annotated[str, "The CLI command to execute"]):
    """
    Executes a CLI command on an ArubaOS-CX switch.

    :param switch_ip: IP address of the switch
    :param session: Session object with active login
    :param command: CLI command to execute
    :return: Command output as a string, or None if failed
    """
    
    # Construct the CLI command URL
    base_url = BASE_URL.format(switch_ip=switch_ip, api_version=API_VERSION)
    cli_url = f"{base_url}/cli"

    # Set the CLI command payload
    cli_data = json.dumps({
        "cmd": command
    })

    # Set the headers
    headers={"Content-Type": "application/json"}

    try:
        # Send the POST request to execute the CLI command
        response = session.post(cli_url, data=cli_data, headers=headers, verify=VERIFY_SSL, timeout=TIMEOUT)

        # Raise an exception for bad responses (4xx or 5xx)
        response.raise_for_status()

        # Check for successful cli command execution
        if response.status_code == 200:
            if DEBUG:
                print(f"CLI command {command} executed successfully with status code: {response.status_code}")
            # print(f"CLI command {command} executed successfully.")
            return response.text
        
        else:
            print(f"Failed to execute CLI command {command}, failed with status code: {response.status_code}")
            print(response.text)  # Print the response text for debugging
            return None
    
    except requests.exceptions.RequestException as e:
        print(f"An error occurred at CLI command {command}: {e}")
        return None
    
    except requests.exceptions.Timeout as e:
        print(f"Request timed out at CLI command {command}: {e}")
        return None

# SSH command function
def ssh_command(switch_ip, username, password, command):
    """
    Connects to an ArubaOS-CX switch via SSH and runs a command.
    
    :param switch_ip: IP address of the switch
    :param username: SSH username
    :param password: SSH password
    :param command: CLI command to execute
    :return: Command output as a string
    """

    try:
        # Initialize SSH client
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())  # Auto-accept unknown keys

        # Connect to the switch
        ssh.connect(hostname=switch_ip, username=username, password=password, timeout=TIMEOUT)

        # Execute the command
        stdin, stdout, stderr = ssh.exec_command(command)

        # Read command output
        output = stdout.read().decode().strip()
        error = stderr.read().decode().strip()

        # Close the connection
        ssh.close()

        if error:
            return f"Error: {error}"
        
        return output

    except Exception as e:
        print(f"An error occurred at SSH command {command}: {e}")
        return None
    


# List of supported CLI commands
"""
{
  "commands": [
    "show aaa accounting",
    "show aaa authentication port-access interface all client-status",
    "show aaa authentication",
    "show aaa authorization",
    "show aaa server-groups",
    "show active-gateway",
    "show arp all-vrfs",
    "show arp",
    "show bgp all",
    "show bgp all community",
    "show bgp all extcommunity",
    "show bgp all flap-statistics",
    "show bgp all neighbors",
    "show bgp all paths",
    "show bgp all summary",
    "show bgp all-vrf all",
    "show bgp all-vrf all neighbors",
    "show bgp all-vrf all paths",
    "show bgp all-vrf all summary",
    "show bgp ipv4 unicast",
    "show bgp ipv4 unicast community",
    "show bgp ipv4 unicast extcommunity",
    "show bgp ipv4 unicast flap-statistics",
    "show bgp ipv4 unicast neighbors",
    "show bgp ipv4 unicast paths",
    "show bgp ipv4 unicast summary",
    "show bgp l2vpn evpn",
    "show bgp l2vpn evpn extcommunity",
    "show bgp l2vpn evpn neighbors",
    "show bgp l2vpn evpn paths",
    "show bgp l2vpn evpn summary",
    "show boot-history",
    "show capacities",
    "show capacities-status",
    "show class ip",
    "show class ipv6",
    "show clock",
    "show copp-policy statistics",
    "show dhcp-relay",
    "show dhcp-server",
    "show dhcpv4-snooping binding",
    "show dhcpv4-snooping",
    "show dhcpv6-relay",
    "show dhcpv6-server",
    "show dhcpv6-snooping binding",
    "show dhcpv6-snooping",
    "show environment",
    "show evpn evi detail",
    "show evpn evi",
    "show evpn mac-ip",
    "show evpn vtep-neighbor all-vrfs",
    "show gbp role-mapping",
    "show interface brief",
    "show interface error-statistics",
    "show interface lag",
    "show interface physical",
    "show interface qos",
    "show interface queues",
    "show interface statistics",
    "show interface tunnel",
    "show interface utilization",
    "show interface vxlan vni vteps",
    "show interface vxlan vni",
    "show interface vxlan vteps detail",
    "show interface vxlan vteps",
    "show interface vxlan",
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
    "show ip route all-vrfs",
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
}

Useful commands:
- boot history
- show clock
- show environment
- show interface brief
- show interface error-statistics
- show interface lag
- show interface physical
- show interface statistics
- show interface utilization
- show interface (ALOT OF TOKENS)
- show ip dns
- show lldp local
- show lldp neighbor
- show mac-address-table
- show resources
- show system resource-utilization (ALOT OF TOKENS)
- show uptime
- show version
- show vlan
- show vrf
- show vsf detail
- show vsf link detail
- show vsf link error-detail
- show vsf topology


Maybe useful commands:
- show capacities
- show capacities-status
- show class ip
- show class ipv6
- show copp-policy statistics
- show dhcp-server
- show dhcpv4-snooping binding
- show dhcpv4-snooping
- show dhcpv6-server
- show dhcpv6-snooping binding
- show dhcpv6-snooping
- show interface qos
- show interface queues
- show ip helper-address
- show ipv6 neighbors all-vrfs
- show ipv6 neighbors
- show lacp aggregates
- show lacp interfaces
- show ntp associations
- show ntp servers
- show ntp status
- show power-over-ethernet
- show spanning-tree detail (ALOT OF TOKENS)
- show spanning-tree mst detail (ALOT OF TOKENS)
- show tacacs-server


Non useful commands:
- show aaa accounting
- show aaa authentication port-access interface all client-status
- show aaa authentication
- show aaa authorization
- show aaa server-groups

- show bgp all
- show bgp all community
- show bgp all extcommunity
- show bgp all flap-statistics
- show bgp all neighbors
- show bgp all paths
- show bgp all summary
- show bgp all-vrf all
- show bgp all-vrf all neighbors
- show bgp all-vrf all paths
- show bgp all-vrf all summary
- show bgp ipv4 unicast
- show bgp ipv4 unicast community
- show bgp ipv4 unicast extcommunity
- show bgp ipv4 unicast flap-statistics
- show bgp ipv4 unicast neighbors
- show bgp ipv4 unicast paths
- show bgp ipv4 unicast summary
- show bgp l2vpn evpn
- show bgp l2vpn evpn extcommunity
- show bgp l2vpn evpn neighbors
- show bgp l2vpn evpn paths
- show bgp l2vpn evpn summary

- show dhcp-relay
- show dhcpv6-relay

- show evpn evi detail
- show evpn evi
- show evpn mac-ip
- show evpn vtep-neighbor all-vrfs

- show gbp role-mapping

- show interface tunnel

- show interface vxlan vni vteps
- show interface vxlan vni
- show interface vxlan vteps detail
- show interface vxlan vteps
- show interface vxlan

- show ip igmp
- show ip mroute
- show ip multicast summary
- show ip ospf all-vrfs
- show ip ospf border-routers all-vrfs
- show ip ospf interface all-vrfs
- show ip pim
- show ip route all-vrfsshow ipv6 helper-address
- show ipv6 mld
- show ipv6 mroute
- show ipv6 ospfv3 all-vrfs
- show ipv6 ospfv3 border-routers all-vrfs
- show ipv6 ospfv3 interface all-vrfs
- show ipv6 pim6
- show loop-protect
- show module
- show nd-snooping binding
- show nd-snooping prefix-list
- show nd-snooping statistics
- show nd-snooping
- show port-access clients onboarding-method device-profile
- show port-access clients onboarding-method dot1x
- show port-access clients onboarding-method mac-auth
- show port-access clients onboarding-method port-security
- show port-access clients
- show port-access gbp
- show port-access policy
- show port-access port-security interface all client-status
- show port-access port-security interface all port-statistics
- show port-access role local
- show port-access role radius
- show port-access port-security violation client-limit-exceeded interface all
- show qos dscp-map
- show qos queue-profile
- show qos schedule-profile
- show qos trust
- show radius dyn-authorization
- show radius-server
- show system inventory
- show ubt brief
- show ubt information
"""