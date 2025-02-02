import os
import tempfile
import random

from autogen_core import CancellationToken
from autogen_core.tools import FunctionTool
from typing_extensions import Annotated

from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_agentchat.agents import AssistantAgent, UserProxyAgent
from autogen_agentchat.ui import Console
from autogen_ext.code_executors.local import LocalCommandLineCodeExecutor   
from autogen_ext.tools.code_execution import PythonCodeExecutionTool

from autogen_agentchat.conditions import TextMentionTermination, MaxMessageTermination
from autogen_agentchat.teams import RoundRobinGroupChat, SelectorGroupChat




import requests
import json
import base64

SWITCH_IP = '192.168.1.1'
USERNAME = 'admin'
PASSWORD = 'admin'

# Default switch base url information
BASE_URL = "http://{switch_ip}"

# Timeout value in seconds
TIMEOUT = 5

session_id = None

# Login function
def login_to_switch():
    print("\n\n====== LOGGING IN TO SWITCH ======\n\n")
    base_url = BASE_URL.format(switch_ip=SWITCH_IP)
    login_url = f"{base_url}/rest/v1/login-sessions"
    payload = {"userName": USERNAME, "password": PASSWORD}
    try:
        response = requests.post(login_url, json=payload, timeout=TIMEOUT)
        response.raise_for_status()
        session_cookie = response.json().get("cookie")
        global session_id
        session_id = session_cookie
        return session_cookie
    except requests.exceptions.RequestException as e:
        print(f"Login failed: {e}")
        return None
    except requests.exceptions.Timeout as e:
        print(f"Request timed out: {e}")
        return None
    
def logout_from_switch():
    print("\n\n====== LOGGING OUT FROM SWITCH ======\n\n")
    base_url = BASE_URL.format(switch_ip=SWITCH_IP)
    logout_url = f"{base_url}/rest/v1/login-sessions"
    headers = {"Cookie": 'session_id=' + session_id}
    try:
        response = requests.delete(logout_url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:
        print(f"Logout failed: {e}")
        return "Logout failed {e}"
    except requests.exceptions.Timeout as e:
        print(f"Request timed out: {e}")
        return "Request timed out {e}"

# System information function
def get_system_info():
    base_url = BASE_URL.format(switch_ip=SWITCH_IP)
    system_url = f"{base_url}/rest/v1/system"
    headers = {"Cookie": 'session_id=' + session_id}
    try:
        response = requests.get(system_url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Failed to fetch system info: {e}")
        return None
    except requests.exceptions.Timeout as e:
        print(f"Request timed out: {e}")
        return None

def execute_command(sessiont_id, command):
    base_url = BASE_URL.format(switch_ip=SWITCH_IP)
    execute_url = f"{base_url}/rest/v3/cli"
    headers = {
        "Cookie": 'session_id=' + session_id,
        "Content-Type": "application/json"
    }
    
    data = json.dumps({"cmd": command})

    response = requests.post(execute_url, headers=headers, data=data, verify=False, timeout=TIMEOUT)

    if response.status_code == 200:
        try:
            result = response.json()
            base64_encoded_result = result.get("result_base64_encoded")
            if base64_encoded_result:
                decoded_result = base64.b64decode(base64_encoded_result).decode('utf-8')
                return decoded_result
            else:
                print("Error: 'result_base64_encoded' key not found in response.")
        except json.JSONDecodeError:
            print("Error: Failed to parse the JSON response.")
    else:
        print(f"HTTP Error: {response.status_code} - {response.text}")
    
    return None

def get_switch_version(session_id: Annotated[str, "The session ID to execute the command on."]):
    command = "show version"
    return execute_command(session_id, command)


async def test_tool(param: Annotated[str, "The parameter to test the tool with."]) -> str:
    # This is a test tool to test the tool.
    return "Hello, world!"


# Create a function tool.
login_to_switch_tool = FunctionTool(login_to_switch, description="Login to the switch. This should be done before any other commands are executed on the switch.")
get_switch_version_tool = FunctionTool(get_switch_version, description="Get the version of the switch.")
logout_from_switch_tool = FunctionTool(logout_from_switch, description="Logout from the switch. This should be used when you are done with the task and need to logout from the switch.")

async def main():
    # Run the tool.
    model_client = OpenAIChatCompletionClient(
        model="gpt-4o-mini",
        api_key=openai_api_key,
    )

    # Make a temporary directory for the code to be written in.
    temp_dir = tempfile.mkdtemp()
    code_executor = LocalCommandLineCodeExecutor(work_dir=temp_dir)
    python_code_executor_tool = PythonCodeExecutionTool(code_executor)

    code_writer_agent = AssistantAgent(
        name="Code_Writer_Agent",
        model_client=model_client,
        system_message="""
        You are an expert python developer. 
        You only write code. You do not answer questions, or provide any other information.
        You write clean, readable, and industry standard python code.
        If you are given a task that requires code, you will write the code and give it to the reviewer_agent to review and test.
        """
    )

    code_review_agent = AssistantAgent(
        name="Reviewer_Agent",
        model_client=model_client,
        tools=[python_code_executor_tool],
        system_message="""
        You are a senior python developer whose job is to review the code written by the Code_Writer_Agent.
        Any problem that requires a code solution will be given to the Code_Writer_Agent to write the code.
        Any code that is written must be reviewed by you to ensure it is correct and works as expected.
        If the code is correct, you will execute the code and return the output and an explanation of the results.
        """
    )

    aruba_switch_admin_agent = AssistantAgent(
        name="Aruba_Switch_Admin_Agent",
        model_client=model_client,
        tools=[get_switch_version_tool, login_to_switch_tool, logout_from_switch_tool],
        system_message="""
        You are a network administrator that helps the user with network related tasks. You have access to a single aruba switch.
        This switch has a limited number of commands available to you.
        Before you use any of these commands, you MUST login to the aruba switch.
        If you have already logged in, you can use the get_aruba_switch_session_tool to get a session ID.
        These commands are listed in your tools:
            - login_to_switch_tool: Login to the switch and get a session ID.
            - get_switch_version_tool: Get the version of the switch.
            - logout_from_switch_tool: Logout from the switch ONLY when all tasks are complete and you are done.

        You will only use these commands and the outputs of these commands to answer the user's question.
        You will not use any other commands, or any other information to answer the user's question.

        """
    )

    planning_agent = AssistantAgent(
        name="Planning_Agent",
        description="An assistant that plans out tasks before any other agents. This MUST be the first agent to engage in tasks in the team, no exceptions.",
        model_client=model_client,
        system_message="""
        You are an expert planner and task manager.
        You should be the first agent to engage in tasks in the team so that you can plan out the tasks that need to be done in the order they should be done.
        You will break down the main task into smaller subtasks, and assign each subtask to the appropriate agent.
        The members of your team and their tools are:
            - Aruba_Switch_Admin_Agent: Asks the switch for information.
                - login_to_switch_tool: Login to the switch and get a session ID before any other commands are executed on the switch.
                - get_switch_version_tool: Get the version of the switch.
                - logout_from_switch_tool: Logout from the switch after all tasks are complete and you are done.
        When assigning tasks, use this format:
        1. <agent> : <task>

        You only have the ability to assign tasks to the agents, you do NOT have the ability to perform any other tasks.
        Once all the tasks have been finished, summarize the results and output the following:
        'exit'
        """
    )
    
    text_termination = TextMentionTermination('exit')
    max_messages_termination = MaxMessageTermination(max_messages=25)
    termination = text_termination | max_messages_termination

    team = SelectorGroupChat(
        [planning_agent, aruba_switch_admin_agent, code_writer_agent, code_review_agent],
        termination_condition=termination,
        model_client=model_client
    )

    task = ""
    await Console(
        team.run_stream(task=task)
    )


# Run the async main function
if __name__ == "__main__":
    import asyncio
    from dotenv import load_dotenv

    # Load the env variables from the .env file
    load_dotenv()
    openai_api_key = os.getenv("OPENAI_API_KEY")    
    asyncio.run(main())