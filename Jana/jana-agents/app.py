from autogen_ext.code_executors.local import LocalCommandLineCodeExecutor  
from autogen_ext.tools.code_execution import PythonCodeExecutionTool
from autogen_ext.models.openai import OpenAIChatCompletionClient

from autogen_agentchat.conditions import TextMentionTermination, MaxMessageTermination
from autogen_agentchat.teams import RoundRobinGroupChat, SelectorGroupChat
from autogen_agentchat.messages import TextMessage, ToolCallRequestEvent, ToolCallExecutionEvent, ToolCallSummaryMessage

from autogen_agentchat.agents import AssistantAgent, UserProxyAgent
from autogen_agentchat.ui import Console

from autogen_core.tools import FunctionTool
from autogen_core import CancellationToken

from typing_extensions import Annotated
import requests
import tempfile
import base64
import asyncio
import json
import random
import os

from dotenv import load_dotenv
import RESTapiAI as RESTapi

SWITCH_IP = '192.168.1.1'
USERNAME = 'admin'
PASSWORD = 'admin'

# Default switch base url information
BASE_URL = "http://{switch_ip}"

# Constants
TIMEOUT = 5
session_id = None

"""
########################################################
# Login and logout functions
########################################################

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

# Logout function
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

# Execute switch command function
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

# Get switch version function
def get_switch_version(session_id: Annotated[str, "The session ID to execute the command on."]):
    command = "show version"
    return execute_command(session_id, command)

"""


# Create a function tool.
login_to_switch_tool = FunctionTool(RESTapi.login_to_switch, description="Login to the switch. This should be done before any other commands are executed on the switch.")
logout_from_switch_tool = FunctionTool(RESTapi.logout_from_switch, description="Logout from the switch. This should be used when you are done with the task and need to logout from the switch.")
get_system_info_tool = FunctionTool(RESTapi.get_system_info, description="Get the system information of the switch.")
reboot_switch_tool = FunctionTool(RESTapi.reboot_switch, description="Reboot the switch.")
get_switch_version_tool = FunctionTool(RESTapi.get_switch_version, description="Get the version of the switch.")
get_switch_logs_tool = FunctionTool(RESTapi.get_switch_logs, description="Get the logs of the switch.")
get_switch_time_tool = FunctionTool(RESTapi.get_switch_time, description="Get the time of the switch.")

def create_team():
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
        description="An assistant that writes code to solve tasks created by the planning agent.",
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
        description="An assistant that reviews code written by the Code_Writer_Agent and executes the code.",
        model_client=model_client,
        tools=[python_code_executor_tool],
        system_message="""
        You are a senior python developer whose job is to review the code written by the Code_Writer_Agent.
        If the code_writer_agent has written code, you will review the code to ensure it is correct and works as expected before it is given to the user.
        If the code is correct, you will execute the code and return the output and an explanation of the results.
        Any problem that requires a code solution will be given to the Code_Writer_Agent to write the code.
        Any code that is written must be reviewed by you to ensure it is correct and works as expected.
        If the code is correct, you will execute the code and return the output and an explanation of the results.
        """
    )

    aruba_switch_admin_agent = AssistantAgent(
        name="Aruba_Switch_Admin_Agent",
        description="An assistant that helps the user exclusively with network related tasks. Given by the planning agent.",
        model_client=model_client,
        tools=[login_to_switch_tool, logout_from_switch_tool, get_system_info_tool, reboot_switch_tool, get_switch_version_tool, get_switch_logs_tool, get_switch_time_tool],
        system_message="""
        You are a network administrator that helps the user with network related tasks. You have access to a single aruba switch.
        This switch has a limited number of commands available to you.
        Before you use any of these commands, you MUST login to the aruba switch.
        If you have already logged in, you can use the get_aruba_switch_session_tool to get a session ID.
        These commands are listed in your tools:
            - login_to_switch_tool: Login to the switch and get a session ID.
            - logout_from_switch_tool: Logout from the switch ONLY when all tasks are complete and you are done.
            - get_system_info_tool: Get the system information of the switch.
            - reboot_switch_tool: Reboot the switch.
            - get_switch_version_tool: Get the version of the switch.
            - get_switch_logs_tool: Get the logs of the switch.
            - get_switch_time_tool: Get the time of the switch.
            

        You will only use these commands and the outputs of these commands to answer the user's question.
        You will not use any other commands, or any other information to answer the user's question.

        """
    )

    planning_agent = AssistantAgent(
        name="Planning_Agent",
        description="An assistant that plans out tasks BEFORE any other agents. This MUST be the first agent to engage in tasks in the team, there are no exceptions.",
        model_client=model_client,
        system_message="""
        You are an expert planner and task manager.
        You should be the first agent to engage in tasks in the team so that you can plan out the tasks that need to be done in the order they should be done.
        Before all else, you will first break down the main task into smaller subtasks, and assign each subtask to the appropriate agent.
        You will NOT help the user directly. Any sub task that you create will be assigned to the appropriate agent to solve.

        The members of your team and their tools are:
            - Aruba_Switch_Admin_Agent: Asks the switch for information.
                - login_to_switch_tool: Login to the switch and get a session ID.
                - logout_from_switch_tool: Logout from the switch ONLY when all tasks are complete and you are done.
                - get_system_info_tool: Get the system information of the switch.
                - reboot_switch_tool: Reboot the switch.
                - get_switch_version_tool: Get the version of the switch.
                - get_switch_logs_tool: Get the logs of the switch.
                - get_switch_time_tool: Get the time of the switch.

            - Code_Writer_Agent: Writes code to solve the task.
            - Reviewer_Agent: Reviews the code written by the Code_Writer_Agent.
                - The direct output of the code executed by the Reviewer_Agent must be given to the user.
        When assigning tasks, use this format:
        1. <agent> : <task>

        Your messages should not include and non alphanumeric characters.

        Once all tasks are complete and the main task is solved, you summarize the results and say one of the following:
        "Here's what I found. <results> 'exit'"
        "I thought about it and here's what I found. <results> 'exit'"
        "This's what I found after looking into it. <results> 'exit'"
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

    return team

import os
import json
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from pydantic import BaseModel

# Load environment variables from .env
load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))

# Assume create_team() is defined/imported from your project
# For example:
# from your_team_module import create_team
team = create_team()

# Create the FastAPI app
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],                # Allow all origins, or specify your frontend's domain
    allow_methods=["GET", "POST", "OPTIONS"],  # Allow these HTTP methods
    allow_headers=["Content-Type", "Accept"],  # Allow these headers
)

@app.get("/")
async def index():
    return {"message": "Jana is running"}

# Define a Pydantic model for the incoming request
class TaskRequest(BaseModel):
    task: str

@app.post("/run_task")
async def run_task_route(task_request: TaskRequest):
    task = task_request.task
    print(f"Running task: {task}")
    
    if not task:
        raise HTTPException(status_code=400, detail="No task provided")

    async def generate():
        try:
            # Get the async stream directly from the team
            stream = team.run_stream(task=task)
            async for message in stream:

                print("message: ", message)
                print("type: ", type(message))
                if isinstance(message, TextMessage):
                    message_data = {
                        "type": "text",
                        "message": str(message.content)
                    }
                elif isinstance(message, ToolCallRequestEvent) or isinstance(message, ToolCallExecutionEvent) or isinstance(message, ToolCallSummaryMessage):
                    message_data = {
                        "type": "tool_call",
                        "message": str(message.content)
                    }
                else:
                    message_data = {
                        "type": "Result",
                        "message": str(message.messages[-1].content)
                    }
                # Format each message as an SSE (Server-Sent Event) line
                yield f"data: {json.dumps(message_data)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            yield "data: {\"status\": \"completed\"}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

if __name__ == "__main__":
    import uvicorn
    print("Starting Jana...")
    uvicorn.run(app, host=HOST, port=PORT)