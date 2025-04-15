from autogen_core.tools import FunctionTool
import RESTapi_CX as SwitchApi
from tavily import TavilyClient
from dotenv import load_dotenv
import os

load_dotenv()
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
DEFAULT_SWITCH_IP = "10.0.150.150"
DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = ""

SESSION_COOKIE: any = None


# Function Tools
def log_into_switch():
    global SESSION_COOKIE
    result = SwitchApi.login_to_switch(
        switch_ip=DEFAULT_SWITCH_IP,
        username=DEFAULT_USERNAME,
        password=DEFAULT_PASSWORD,
    )
    SESSION_COOKIE = result
    return result


log_into_switch_tool = FunctionTool(
    log_into_switch,
    description="Logs into the switch and saves the session cookie. MUST be called before any other switch action.",
)


def log_out_switch():
    result = SwitchApi.logout_from_switch(
        switch_ip=DEFAULT_SWITCH_IP, session=SESSION_COOKIE
    )
    return result


log_out_switch_tool = FunctionTool(
    log_out_switch,
    description="Logs out of the switch. MUST be called after all switch actions are finished.",
)


def execute_http_command(command: str):
    if SESSION_COOKIE is None:
        return "Not logged into switch"
    result = SwitchApi.cli_command(
        switch_ip=DEFAULT_SWITCH_IP, session=SESSION_COOKIE, command=command
    )
    return result


execute_http_command_tool = FunctionTool(
    execute_http_command,
    description="Write a custom command for the switch to be executed via http. Use given command reference to write commands.",
)


def execute_ssh_command(command: str):
    result = SwitchApi.ssh_command(
        switch_ip=DEFAULT_SWITCH_IP,
        username=DEFAULT_USERNAME,
        password=DEFAULT_PASSWORD,
        command=command,
    )
    return result


execute_ssh_command_tool = FunctionTool(
    execute_ssh_command,
    description="Write a custom command for the switch to be executed via ssh. use prior knowledge to write commands.",
)


def search_google(query: str):
    tavily_client = TavilyClient(api_key=TAVILY_API_KEY)
    return tavily_client.search(query)


search_google_tool = FunctionTool(
    search_google,
    description="Searches Google using Tavily. Provide a query string to get search results.",
)


def mac_address_lookup(mac_address: str):
    import requests

    url = f"https://www.macvendorlookup.com/api/v2/{mac_address}"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        return data
    return "No information found for given address"


mac_address_lookup_tool = FunctionTool(
    mac_address_lookup, description="A tool to find the manufacturer of a mac address."
)
