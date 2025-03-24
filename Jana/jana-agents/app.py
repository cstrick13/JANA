import json
import uuid
import time
from typing import List, Tuple
import tempfile
import re

<<<<<<< HEAD
import RESTapi as SwitchApi
=======
from dotenv import load_dotenv
import RESTapiAI as RESTapi
>>>>>>> switch-interface

from autogen_core import (
    FunctionCall,
    MessageContext,
    RoutedAgent,
    SingleThreadedAgentRuntime,
    TopicId,
    TypeSubscription,
    message_handler,
    CancellationToken,
)
from autogen_core.models import (
    AssistantMessage,
    ChatCompletionClient,
    FunctionExecutionResult,
    FunctionExecutionResultMessage,
    LLMMessage,
    SystemMessage,
    UserMessage,
)
from autogen_core.tools import FunctionTool, Tool
from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_core.code_executor import CodeBlock, CodeExecutor
from autogen_ext.code_executors.local import LocalCommandLineCodeExecutor

from pydantic import BaseModel

<<<<<<< HEAD
FINAL_RESULT = ""

class UserTask(BaseModel):
    context: List[LLMMessage]

class AgentResponse(BaseModel):
    reply_to_topic: str
    context: List[LLMMessage]

class AIAgent(RoutedAgent):
    def __init__(
        self,
        description: str,
        system_message: SystemMessage,
        model_client: ChatCompletionClient,
        tools: List[Tool],
        delegate_tools: List[Tool],
        agent_topic_type: str,
        user_topic_type: str
    ) -> None:
        super().__init__(description)
        self._system_message = system_message
        self._model_client = model_client
        self._tools = dict([(tool.name, tool) for tool in tools])
        self._tool_schema = [tool.schema for tool in tools]
        self._delegate_tools = dict([(tool.name, tool) for tool in delegate_tools])
        self._delegate_tool_schema = [tool.schema for tool in delegate_tools]
        self._agent_topic_type = agent_topic_type
        self._user_topic_type = user_topic_type
=======
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
>>>>>>> switch-interface
    
    @message_handler
    async def handle_task(self, message: UserTask, ctx: MessageContext) -> None:
        # Send the user's message to the llm
        llm_result = await self._model_client.create(
            messages=[self._system_message] + message.context,
            tools=self._tool_schema + self._delegate_tool_schema,
            cancellation_token=ctx.cancellation_token,
        )
        print(f"{'-'*80}\n{self.id.type}:\n{llm_result.content}", flush=True)
        
        # Process the llm's result
        while isinstance(llm_result.content, list) and all(isinstance(m, FunctionCall) for m in llm_result.content):
            tool_call_results: List[FunctionExecutionResult] = [] 
            delegate_targets: List[Tuple[str, UserTask]] = []
            # Process each function call
            for call in llm_result.content:
                arguments = json.loads(call.arguments) # Load the tool's args
                if call.name in self._tools:
                    # Execute the tool directly
                    result = await self._tools[call.name].run_json(arguments, ctx.cancellation_token)
                    result_as_str = self._tools[call.name].return_value_as_string(result)
                    tool_call_results.append(
                        FunctionExecutionResult(call_id=call.id, content=result_as_str, is_error=False)
                    )
                elif call.name in self._delegate_tools:
                    # Execute the tool to get the delegate agent's topic type
                    result = await self._delegate_tools[call.name].run_json(arguments, ctx.cancellation_token)
                    topic_type = self._delegate_tools[call.name].return_value_as_string(result)
                    
                    # Create the context for the delegate agent, including the function call and the result.
                    delegate_messages = list(message.context) + [
                        AssistantMessage(content=[call], source=self.id.type),
                        FunctionExecutionResultMessage(
                            content=[
                                FunctionExecutionResult(
                                    call_id=call.id,
                                    content=f"transferred to {topic_type}. Adopt persona immediately.",
                                    is_error=False
                                )
                            ]
                        )
                    ]
                    delegate_targets.append((topic_type, UserTask(context=delegate_messages)))
                else:
                    raise ValueError(f"Unknown tool: {call.name}")
            if len(delegate_targets) > 0:
                # Delegate the task to other agents by publishing the messages to the topics
                for topic_type, task in delegate_targets:
                    print(f"{'-'*80}\n{self.id.type}:\nDelegating to {topic_type}", flush=True)
                    await self.publish_message(task, topic_id=TopicId(topic_type, self.id.key))
            if len(tool_call_results) > 0:
                print(f"{'-'*80}\n{self.id.type}:\n{tool_call_results}", flush=True)
                # Make another LLM call with the results.
                message.context.extend(
                    [
                        AssistantMessage(content=llm_result.content, source=self.id.type),
                        FunctionExecutionResultMessage(content=tool_call_results),
                    ]
                )
                llm_result = await self._model_client.create(
                    messages=[self._system_message] + message.context,
                    tools=self._tool_schema + self._delegate_tool_schema,
                    cancellation_token=ctx.cancellation_token,
                )
                print(f"{'-'*80}\n{self.id.type}(llm call with results):\n{llm_result.content}", flush=True)
            else:
                return
        # The tasks have been completed, publish the final result
        assert isinstance(llm_result.content, str)
        message.context.append(AssistantMessage(content=llm_result.content, source=self.id.type))
        global FINAL_RESULT
        FINAL_RESULT = llm_result.content
        
        # await self.publish_message(
        #     AgentResponse(context=message.context, reply_to_topic=self._agent_topic_type),
        #     topic_id=TopicId(self._user_topic_type, source=self.id.key)
        # )
        

        
class UserAgent(RoutedAgent):
    def __init__(self, description: str, user_topic_type: str, agent_topic_type: str):
        super().__init__(description)
        self._user_topic_type = user_topic_type
        self._agent_topic_type = agent_topic_type
        
    @message_handler
    async def handle_task_result(self, message: AgentResponse, ctx: MessageContext) -> None:
        # user_input = input(f"{"-"*80}\nUser (Type 'exit' to exit the session): ")
        
        # if user_input.strip().lower() == "exit":
        #     print(f"{'-'*80}\nThe user has ended the session")
        #     return
        # message.context.append(UserMessage(content=user_input, source="User"))
        await self.publish_message(
            UserTask(context=message.context),
            topic_id=TopicId(self._agent_topic_type, source=self.id.key)
        )

class CodeExecutor(RoutedAgent):
    def __init__(self, code_executor: CodeExecutor, agent_topic_type, writer_topic_type) -> None:
        super().__init__("An executor agent.")
        self._code_executor = code_executor
        self._agent_topic_type = agent_topic_type
        self._writer_topic_type = writer_topic_type
        
    def extract_markdown_code_blocks(self, markdown_text: str) -> List[CodeBlock]:
        pattern = re.compile(r"```(?:\s*([\w\+\-]+))?\n([\s\S]*?)```")
        matches = pattern.findall(markdown_text)
        code_blocks: List[CodeBlock] = []
        for match in matches:
            language = match[0].strip() if match[0] else ""
            code_content = match[1]
            code_blocks.append(CodeBlock(code=code_content, language=language))
        return code_blocks

    @message_handler
    async def handle_message(self, message: UserTask, ctx: MessageContext) -> None:
        code_blocks = self.extract_markdown_code_blocks(message.context)
        if code_blocks:
            result = await self._code_executor.execute_code_blocks(
                code_blocks, cancellation_token=ctx.cancellation_token
            )
            print(f"\n{'-'*80}\nExecutor:\n{result.output}")
            await self.publish_message(AgentResponse(content=result.output, reply_to_topic=self._agent_topic_type), topic_id=TopicId(self._writer_topic_type, self.id.key))



DEFAULT_SWITCH_IP = "10.0.150.100"
DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "admin"

SESSION_COOKIE = ""  


# Function Tools     
def get_switch_info():
    if SESSION_COOKIE == "":
        return "Not logged into switch. Invalid session cookie."
    info = SwitchApi.get_system_info(switch_ip=DEFAULT_SWITCH_IP, session_cookie=SESSION_COOKIE)
    return info
get_switch_info_tool = FunctionTool(
    get_switch_info,
    description="Gets the current version of the connected switch"
)       


def get_switch_logs():
    result = SwitchApi.execute_command(DEFAULT_SWITCH_IP, SESSION_COOKIE, "show log r") # Shows recent logs
    return result
get_switch_logs_tool = FunctionTool(
    get_switch_logs,
    description="Get the recent network logs from the switch."
)

def get_switch_leaf_nodes():
    result = SwitchApi.execute_command(DEFAULT_SWITCH_IP, SESSION_COOKIE, "show lldp info remote-device")
    return result
get_switch_leaf_nodes_tool = FunctionTool(
    get_switch_leaf_nodes,
    description="Retrieves information about directly connected devices (leaf nodes) on the switch using LLDP (Link Layer Discovery Protocol)"
)

def switch_ping_address(ip_address: str):
    result = SwitchApi.execute_command(DEFAULT_SWITCH_IP, SESSION_COOKIE, f"ping {ip_address}") # Pings address
    return result
switch_ping_address_tool = FunctionTool(
    switch_ping_address,
    description="Sends a ping from the switch to the provided address."
)
    

def log_into_switch():
    global SESSION_COOKIE
    result = SwitchApi.login_to_switch(switch_ip=DEFAULT_SWITCH_IP, username=DEFAULT_USERNAME, password=DEFAULT_PASSWORD)
    SESSION_COOKIE = result
    return result
log_into_switch_tool = FunctionTool(
    log_into_switch,
    description="Logs into the switch and saves the session cookie. MUST be called before any other switch action."
)

"""


<<<<<<< HEAD
def log_out_switch():
    result = SwitchApi.logout_from_switch(switch_ip=DEFAULT_SWITCH_IP, session_cookie=SESSION_COOKIE)
    return result
log_out_switch_tool = FunctionTool(
    log_out_switch,
    description="Logs out of the switch. MUST be called after all switch actions are finished."
)

=======
# Create a function tool.
login_to_switch_tool = FunctionTool(RESTapi.login_to_switch, description="Login to the switch. This should be done before any other commands are executed on the switch.")
logout_from_switch_tool = FunctionTool(RESTapi.logout_from_switch, description="Logout from the switch. This should be used when you are done with the task and need to logout from the switch.")
get_system_info_tool = FunctionTool(RESTapi.get_system_info, description="Get the system information of the switch.")
reboot_switch_tool = FunctionTool(RESTapi.reboot_switch, description="Reboot the switch.")
get_switch_version_tool = FunctionTool(RESTapi.get_switch_version, description="Get the version of the switch.")
get_switch_logs_tool = FunctionTool(RESTapi.get_switch_logs, description="Get the logs of the switch.")
get_switch_time_tool = FunctionTool(RESTapi.get_switch_time, description="Get the time of the switch.")
>>>>>>> switch-interface

def reboot_switch():
    if SESSION_COOKIE == "":
        return "Not logged into the switch. Session cookie invalid."
    time.sleep(4)
    return "Success!"
reboot_switch_tool = FunctionTool(
    reboot_switch,
    description="Reboots the switch. ONLY call if the user directly asks."
)



async def execute_code(language: str, code_block: str):
    work_dir = tempfile.mkdtemp()
    executor = LocalCommandLineCodeExecutor(work_dir=work_dir)
    result = await executor.execute_code_blocks(
        code_blocks=[CodeBlock(language=language, code=code_block)],
        cancellation_token=CancellationToken()
    )
    return result
execute_code_tool = FunctionTool(
    execute_code,
    description="Executes a single code block at a time."
)


user_agent_topic_type = "UserAgent"
manager_agent_topic_type = "ManagerAgent"
switch_admin_agent_topic_type = "SwitchAdminAgent"
code_writer_agent_topic_type = "CodeWriterAgent"
code_executor_agent_topic_type = "CodeExecutorAgent"
user_topic_type = "User"
        
# Delegate Tool   
def delegate_to_switch_admin():
    return switch_admin_agent_topic_type

delegate_to_switch_admin_tool = FunctionTool(
    delegate_to_switch_admin,
    description="Use for anything related to a switch"
)

def delegate_to_code_writer():
    return code_writer_agent_topic_type
delegate_to_code_writer_tool = FunctionTool(
    delegate_to_code_writer,
    description="An agent that can write code. Use anytime the user asks for code to be written."
)

def delegate_to_code_executor():
    return code_executor_agent_topic_type
delegate_to_code_executor_tool = FunctionTool(
    delegate_to_code_executor,
    description="An agent to execute the code you write. You must write code before you can use it."
)

async def create_runtime():
    runtime = SingleThreadedAgentRuntime()
    
    model_client = OpenAIChatCompletionClient(
        model="gpt-4o-mini",
<<<<<<< HEAD
        api_key=OPENAI_API_KEY
=======
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
>>>>>>> switch-interface
    )
    
    user_agent = await UserAgent.register(
        runtime,
        type=user_agent_topic_type,
        factory=lambda: UserAgent(
            description="Agent to handle the interaction with the user",
            user_topic_type=user_topic_type,
            agent_topic_type=manager_agent_topic_type
        )
    )

    manager_agent = await AIAgent.register(
        runtime,
        type=manager_agent_topic_type,
        factory=lambda: AIAgent(
            "The manager of a team of agents.",
            system_message=SystemMessage(content="""
                You are the manager of a networking team.
                Your main job is to delegate each task to only one team member based on the best fit. Do NOT assign a task to multiple members.

                Your team members are:
                    •	Switch admin: Handles ALL tasks related to networking with a switch.
                    •	Code writer: Handles tasks that can be solved through code but NOT related to the switch.

                Rules:
                    1.	Assign exactly one team member per task. Do not delegate the same task to both members.
                    2.	If a task involves both switching and coding, prioritize the most relevant aspect and assign it to the best fit.
                    3.	Once the selected member completes their task, summarize their results in a short and concise manner, ensuring it is relevant to the user’s request.
            """),
            model_client=model_client,
            tools=[],
            delegate_tools=[delegate_to_switch_admin_tool, delegate_to_code_writer_tool],
            agent_topic_type=manager_agent_topic_type,
            user_topic_type=user_topic_type,
        ),
    )
    
    switch_agent = await AIAgent.register(
        runtime,
        type=switch_admin_agent_topic_type,
        factory=lambda: AIAgent(
            "The switch admin that manages a physical switch",
            system_message=SystemMessage(
                content="""
                    You are a switch network admin. You have control over a physical switch.
                    The switch has the following capabilities:
                        - Log in to switch (Must always be called first)
                        - Log out of switch (Must alwyas be called last)
                        - switch version
                        - getting switch logs
                        - reboot switch (Only if the user asks) (Does NOT require logging out as the switch session is reset)
                    You are to use the available tools to complete the given task.
                    Before any actions can me made regarding the switch, you MUST use the log in tool.
                    After all switch actions are finished, you MUST log out of the switch (UNLESS switch is rebooted).
                    If the switch tools give an error, there is NOTHING you can do so stop and inform the user of the error.
                """),
            model_client=model_client,
            tools=[
                get_switch_info_tool,
                reboot_switch_tool,
                log_into_switch_tool,
                log_out_switch_tool,
                get_switch_logs_tool,
                get_switch_leaf_nodes_tool,
                switch_ping_address_tool
            ],
            delegate_tools=[],
            agent_topic_type=switch_admin_agent_topic_type,
            user_topic_type=user_topic_type,
        )
    )
    
    code_writer = await AIAgent.register(
        runtime,
        type=code_writer_agent_topic_type,
        factory=lambda: AIAgent(
            description="Writes code to be executed.",
            system_message=SystemMessage(
                content="""
                    Write python scripts in markdown code blocks. The code you write will be executed, but there is no way to display the results of the 
                    code you write except to print the results or to save any images to a file in the current directory.
                    All code written MUST be within the same response. This means any functions you write must be in the same response for the tool call.
                    Example python code:
                    '''
                        def main():
                            return "Hello World"
                        
                        print(main())
                    '''
                    You MUST write the code before delegating to the executor.
                """),
            model_client=model_client,
            tools=[execute_code_tool],
            delegate_tools=[],
            agent_topic_type=code_writer_agent_topic_type,
            user_topic_type=user_topic_type
        )
    )


    # code_executor = await CodeExecutor.register(
    #     runtime,
    #     type=code_executor_agent_topic_type,
    #     factory=lambda: CodeExecutor(
    #         code_executor=executor,
    #         agent_topic_type=code_executor_agent_topic_type,
    #         writer_topic_type=code_writer_agent_topic_type,
    #     )
    # )
    
    # The user agent will recieve messages to its type only
    await runtime.add_subscription(TypeSubscription(user_topic_type, user_agent.type))
    
    # The manager agent will recieve messages to its type only
    await runtime.add_subscription(TypeSubscription(manager_agent_topic_type, manager_agent.type))
    
    # The switch agent will recieve messages to its type only
    await runtime.add_subscription(TypeSubscription(switch_admin_agent_topic_type, switch_agent.type))
    
    await runtime.add_subscription(TypeSubscription(code_writer_agent_topic_type, code_writer.type))
    
    # await runtime.add_subscription(TypeSubscription(code_executor_agent_topic_type, code_executor.type))
    return runtime

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
OPENAI_API_KEY= os.getenv("OPENAI_API_KEY")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))

# Assume create_team() is defined/imported from your project
# For example:
# from your_team_module import create_team

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
    agent_runtime = await create_runtime()

    task = task_request.task
    print(f"Running task: {task}")
    
    if not task:
        raise HTTPException(status_code=400, detail="No task provided")
    print(agent_runtime)
    agent_runtime.start()
    ssid = str(uuid.uuid4())
    user_input = task
    await agent_runtime.publish_message(AgentResponse(context=[(UserMessage(content=user_input, source="User"))], reply_to_topic=user_topic_type), topic_id=TopicId(user_topic_type, ssid))

    await agent_runtime.stop_when_idle()
    print(FINAL_RESULT)
    return FINAL_RESULT

if __name__ == "__main__":
    import uvicorn
    print("Starting Jana...")
    uvicorn.run(app, host=HOST, port=PORT)