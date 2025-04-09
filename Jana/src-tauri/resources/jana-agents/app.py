import RESTapi_CX as SwitchApi
from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_agentchat.conditions import TextMentionTermination, StopMessageTermination
from autogen_agentchat.messages import TextMessage
from autogen_agentchat.ui import Console
from autogen_agentchat.base import Response, TaskResult
from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_core import CancellationToken
from command_reference import command_reference
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import traceback
import os

# Load environment variables from .env
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))

DEFAULT_SWITCH_IP = "10.0.150.150"
DEFAULT_USERNAME = "jana"
DEFAULT_PASSWORD = "password"

SESSION_COOKIE: any

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

def log_out_switch():
    result = SwitchApi.logout_from_switch(
        switch_ip=DEFAULT_SWITCH_IP, session=SESSION_COOKIE
    )
    return result

def execute_http_command(command: str):
    result = SwitchApi.cli_command(
        switch_ip=DEFAULT_SWITCH_IP, session=SESSION_COOKIE, command=command
    )
    return result


def execute_ssh_command(command: str):
    result = SwitchApi.ssh_command(
        switch_ip=DEFAULT_SWITCH_IP, username=DEFAULT_USERNAME, password=DEFAULT_PASSWORD, command=command
    )
    return result

# Define System prompts
switch_admin_prompt = f"""
    You are a network administrator for an Aruba 6300X switch. You can interact with the switch using either HTTP API commands or SSH commands.

    You have access to three tools:
    • `log_into_switch` — Logs into the switch (required before any command execution)
    • `log_out_switch` — Logs out of the switch (required after all command execution)
    • `execute_http_command` — Sends an HTTP-based CLI command to the switch
    • `execute_ssh_command` - Sends a command to the switch using ssh

    ====================
    🔧 Command Guidelines:
    ====================

    1. **Authentication**
    • You MUST call `log_into_switch` before running any of the http commands
    • You MUST call `log_out_switch` after all http commands are complete
    • You MUST use the `config` command before making and changes to the switch via ssh

    2. **Command Type Decision**
    • Use **HTTP CLI commands** (via `execute_http_command`) if:
        – You only need to *retrieve information*
        – No configuration or persistent change is required
        – They are available in the provided command reference below

    • Use **SSH commands** if:
        – You need to *modify* switch settings or make configuration changes
        – The required operation is not supported via HTTP
        – You are restoring settings, enabling/disabling ports, updating VLANs, etc.

    3. **Command Reference**
    • The following CLI commands are available over HTTP only:
    {command_reference}

    • These HTTP commands are *read-only*. They cannot modify switch configuration.
    • SSH commands are *NOT* included in the commands reference, you will need to use prior knowledge to write them.
    • For the ssh commands, write the ssh commands as bash in a single line as follows:
        `
        config\\n {{command}}
        `
        (Note: For changes to be made, you MUST be in config mode)
        - Commands must be acceptable for an Aruba 6300CX switch, or they will fail

    4. **Blacklisted ssh commands**
    • The following ssh commands are NOT to be exucuted no matter what.
        - 'ip address'
        
    5. **Accepted ssh commands**
    • The following ssh commands are example commands that are accepted by the switch
        - 'ip dns server-address 8.8.8.8' (Change dns server to google.com)

    5. **Fallback to SSH**
    • If a task cannot be completed with the available HTTP commands, fall back to SSH using your networking expertise.

    ====================
    🏁 Goal:
    ====================
    • Safely and efficiently complete the user's task by choosing the correct method (HTTP or SSH) based on whether the task requires retrieving information or modifying the switch.
    • After making a change to the switch, ensure that the change works and solves the problem you are tying to solve
    • Your final response should include the answer to the user's question, or what you found, with a 'brief' description of what you did, followed by 'FINISHED'. Do this after logging out of the switch and all tasks have finished.
        - Make sure that the output is in plain text without any sort of format. The final response will be shown in a plain text file.
"""
model_client = OpenAIChatCompletionClient(
    model="gpt-4o-mini", api_key=OPENAI_API_KEY
)

switch_admin = AssistantAgent(
    name="SwitchAdmin",
    model_client=model_client,
    tools=[log_into_switch, log_out_switch, execute_http_command, execute_ssh_command],
    system_message=switch_admin_prompt,
    reflect_on_tool_use=True
)

termination_condition = TextMentionTermination("FINISHED")

team = RoundRobinGroupChat(
    [switch_admin],
    termination_condition=termination_condition,
)

# Create the FastAPI app
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins, or specify your frontend's domain
    allow_methods=["GET", "POST", "OPTIONS"],  # Allow these HTTP methods
    allow_headers=["Content-Type", "Accept"],  # Allow these headers
)


@app.get("/")
async def index():
    return {"message": "Jana is running"}


# Define a Pydantic model for the incoming request
class TaskRequest(BaseModel):
    task: str

async def process_streamed_messages(task: str) -> str:
    final_content = None
    # Run the team with a task and print the messages to the console.
    async for message in team.run_stream(task=task):
        if isinstance(message, TaskResult):
            return message.messages[-1].content.replace("FINISHED", "")
        print(f"{'-'*20}{type(message).__name__}{'-'*20}\n{message.content}\n")
        final_content=message
    
    return final_content

@app.post("/run_task")
async def run_task_route(task_request: TaskRequest):

    task = task_request.task
    print(f"Running task: {task}")

    if not task:
        raise HTTPException(status_code=400, detail="No task provided")
    
    final_content = await process_streamed_messages(task)
    return final_content


if __name__ == "__main__":
    import uvicorn

    print("Starting Jana...")
    uvicorn.run(app, host=HOST, port=PORT)
