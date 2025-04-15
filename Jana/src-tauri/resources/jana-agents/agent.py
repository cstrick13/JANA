import json
import os
import uuid
from typing import List, Tuple

from autogen_core import (
    FunctionCall,
    MessageContext,
    RoutedAgent,
    SingleThreadedAgentRuntime,
    TopicId,
    TypeSubscription,
    message_handler,
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
from autogen_core.tools import Tool
from autogen_ext.models.openai import OpenAIChatCompletionClient
from command_reference import http_command_reference, ssh_command_reference
from dotenv import load_dotenv
from jana_tools import (
    execute_http_command_tool,
    execute_ssh_command_tool,
    log_into_switch_tool,
    log_out_switch_tool,
    mac_address_lookup_tool,
    search_google_tool,
)
from pydantic import BaseModel

# Load environment variables from .env
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
FINAL_RESPONSE = ""


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
        user_topic_type: str,
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
        self._final_result = ""

    @message_handler
    async def handle_task(self, message: UserTask, ctx: MessageContext) -> None:
        # Send the user's message to the llm
        llm_result = await self._model_client.create(
            messages=[self._system_message] + message.context,
            tools=self._tool_schema + self._delegate_tool_schema,
            cancellation_token=ctx.cancellation_token,
        )
        print(f"{'-' * 80}\n{self.id.type}:\n{llm_result.content}", flush=True)

        # Process the llm's result
        while isinstance(llm_result.content, list) and all(
            isinstance(m, FunctionCall) for m in llm_result.content
        ):
            tool_call_results: List[FunctionExecutionResult] = []
            delegate_targets: List[Tuple[str, UserTask]] = []
            # Process each function call
            for call in llm_result.content:
                arguments = json.loads(call.arguments)  # Load the tool's args
                if call.name in self._tools:
                    # Execute the tool directly
                    result = await self._tools[call.name].run_json(
                        arguments, ctx.cancellation_token
                    )
                    result_as_str = self._tools[call.name].return_value_as_string(
                        result
                    )
                    tool_call_results.append(
                        FunctionExecutionResult(
                            call_id=call.id,
                            content=result_as_str,
                            is_error=False,
                            name=call.name,
                        )
                    )
                elif call.name in self._delegate_tools:
                    # Execute the tool to get the delegate agent's topic type
                    result = await self._delegate_tools[call.name].run_json(
                        arguments, ctx.cancellation_token
                    )
                    topic_type = self._delegate_tools[call.name].return_value_as_string(
                        result
                    )

                    # Create the context for the delegate agent, including the function call and the result.
                    delegate_messages = list(message.context) + [
                        AssistantMessage(content=[call], source=self.id.type),
                        FunctionExecutionResultMessage(
                            content=[
                                FunctionExecutionResult(
                                    call_id=call.id,
                                    content=f"transferred to {topic_type}. Adopt persona immediately.",
                                    is_error=False,
                                    name=call.name,
                                )
                            ]
                        ),
                    ]
                    delegate_targets.append(
                        (topic_type, UserTask(context=delegate_messages))
                    )
                else:
                    raise ValueError(f"Unknown tool: {call.name}")
            if len(delegate_targets) > 0:
                # Delegate the task to other agents by publishing the messages to the topics
                for topic_type, task in delegate_targets:
                    print(
                        f"{'-' * 80}\n{self.id.type}:\nDelegating to {topic_type}",
                        flush=True,
                    )
                    await self.publish_message(
                        task, topic_id=TopicId(topic_type, self.id.key)
                    )
            if len(tool_call_results) > 0:
                print(f"{'-' * 80}\n{self.id.type}:\n{tool_call_results}", flush=True)
                # Make another LLM call with the results.
                message.context.extend(
                    [
                        AssistantMessage(
                            content=llm_result.content, source=self.id.type
                        ),
                        FunctionExecutionResultMessage(content=tool_call_results),
                    ]
                )
                llm_result = await self._model_client.create(
                    messages=[self._system_message] + message.context,
                    tools=self._tool_schema + self._delegate_tool_schema,
                    cancellation_token=ctx.cancellation_token,
                )
                print(
                    f"{'-' * 80}\n{self.id.type}(llm call with results):\n{llm_result.content}",
                    flush=True,
                )
            else:
                return

        # The tasks have been completed, publish the final result
        assert isinstance(llm_result.content, str)
        message.context.append(
            AssistantMessage(content=llm_result.content, source=self.id.type)
        )
        global FINAL_RESPONSE
        FINAL_RESPONSE = llm_result.content


class UserAgent(RoutedAgent):
    def __init__(self, description: str, user_topic_type: str, agent_topic_type: str):
        super().__init__(description)
        self._user_topic_type = user_topic_type
        self._agent_topic_type = agent_topic_type

    @message_handler
    async def handle_task_result(
        self, message: AgentResponse, ctx: MessageContext
    ) -> None:
        await self.publish_message(
            UserTask(context=message.context),
            topic_id=TopicId(self._agent_topic_type, source=self.id.key),
        )


user_agent_topic_type = "UserAgent"
manager_agent_topic_type = "ManagerAgent"
switch_admin_agent_topic_type = "SwitchAdminAgent"

user_topic_type = "User"


async def create_runtime():
    runtime = SingleThreadedAgentRuntime()

    model_client = OpenAIChatCompletionClient(
        model="gpt-4o-mini", api_key=OPENAI_API_KEY
    )

    user_agent = await UserAgent.register(
        runtime,
        type=user_agent_topic_type,
        factory=lambda: UserAgent(
            description="Agent to handle the interaction with the user",
            user_topic_type=user_topic_type,
            agent_topic_type=switch_admin_agent_topic_type,
        ),
    )

    switch_agent = await AIAgent.register(
        runtime,
        type=switch_admin_agent_topic_type,
        factory=lambda: AIAgent(
            "The switch admin that manages a physical switch",
            system_message=SystemMessage(
                content=f"""
                You are a network administrator for an Aruba 6300X switch. You can interact with the switch using either HTTP API commands or SSH commands.

                You have access to five tools:
                • `log_into_switch` — Logs into the switch (required before any command execution)
                • `log_out_switch` — Logs out of the switch (required after all command execution)
                • `execute_http_command` — Sends an HTTP-based CLI command to the switch
                • `execute_ssh_command` — Sends a command to the switch using ssh
                • `mac_address_lookup` - Finds the manufacturer of a given mac address
                These are the only tools you are allowed to call
                ====================
                🔧 Command Guidelines:
                ====================

                1. **Authentication**
                • You MUST call `log_into_switch` before running any of the http commands  
                • You MUST call `log_out_switch` after all http commands are complete  
                • You MUST use the `config` command before making any changes to the switch via ssh  

                2. **Command Type Decision**
                • Use **HTTP CLI commands** (via `execute_http_command`) if:  
                    – You only need to *retrieve information*  
                    – No configuration or persistent change is required  
                    – They are available in the provided command reference below  

                • Use **SSH commands** if:  
                    – You need to *modify* switch settings or make configuration changes  
                    – The required operation is not supported via HTTP  
                    – You are restoring settings, enabling/disabling ports, updating VLANs, etc.  
                • You may use `search_google` when you need external context or are unsure about a command or error.

                3. **Command Reference**
                • The following CLI commands are available over HTTP only:  
                {http_command_reference}  
                • These HTTP commands are *read-only*. They cannot modify switch configuration.  
                • If a command is not listed above, it is not supported via HTTP and should be executed using SSH instead.

                • For ssh commands, write them in bash-style format:  
                    `config\\n {{command}}`

                • Example ssh commands:  
                    {ssh_command_reference}
                    (Note: ping can only be executed via ssh)

                4. **Blacklisted ssh commands**
                • DO NOT execute the following commands:  
                    - 'ip address'

                ====================
                🧠 Troubleshooting Strategy:
                ====================

                When a user reports a networking issue (e.g., cannot access a specific website or service), follow this structured diagnostic process:

                1. **Clarify the Symptom**  
                - Identify exactly what is failing (e.g., ping, DNS, HTTP, site-specific access).
                - Determine if the issue is global or limited to a specific domain, device, or service.

                2. **Diagnose Broadly**  
                - Check general switch health (temperature, interfaces, CPU, power).
                - Gather interface status, port statistics, and error rates.
                - Check DNS configuration, time synchronization, routing tables, VLAN config, and access control lists.
                - Attempt relevant tests (e.g., `ping`, `traceroute`, DNS lookups, HTTP connectivity).

                3. **Validate Assumptions**  
                - Do not assume that a configuration is correct just because it exists.
                    - Example: A DNS server may resolve some domains but block others.
                    - Example: An interface may be “up” but experience high packet loss.
                - Cross-validate configurations by running live tests (ping specific domains, test DNS per server, verify interface counters over time).

                4. **Isolate the Problem**  
                - Narrow down whether the issue lies in:
                    - DNS resolution
                    - Routing / gateway
                    - Firewall or ACLs
                    - Interface misconfiguration or physical link issues
                    - External network (ISP or destination server)

                5. **Fix Strategically**  
                - Propose fixes based on confirmed issues (not assumptions).
                - Prefer minimal and reversible changes (e.g., remove a problematic DNS server rather than resetting all settings).
                - After applying a fix, **validate it** by re-running the original test.

                6. **Summarize**  
                - Clearly explain what was changed, why, and what the results were.
                - If no fix is possible within switch scope, suggest next steps (e.g., check router/firewall/ISP).

                ---

                ### ✅ Summary Goals:
                - Avoid shallow fixes. Always verify that the underlying cause is addressed.
                - Consider uncommon failure modes (e.g., partial DNS blocking, asymmetric routing, low MTU, or misconfigured VLANs).
                - Strive for precision and transparency. Always test, verify, and summarize results.

                ====================
                🏁 Goal:
                ====================

                Fix the user’s networking issue confidently and clearly, choosing the correct tool (HTTP or SSH) and validating every step. After the fix, clearly summarize the steps taken and results.
                """
            ),
            model_client=model_client,
            tools=[
                execute_http_command_tool,
                execute_ssh_command_tool,
                log_into_switch_tool,
                log_out_switch_tool,
                mac_address_lookup_tool,
            ],
            delegate_tools=[],
            agent_topic_type=switch_admin_agent_topic_type,
            user_topic_type=user_topic_type,
        ),
    )

    # The user agent will recieve messages to its type only
    await runtime.add_subscription(TypeSubscription(user_topic_type, user_agent.type))

    # The manager agent will recieve messages to its type only
    # await runtime.add_subscription(TypeSubscription(manager_agent_topic_type, manager_agent.type))

    # The switch agent will recieve messages to its type only
    await runtime.add_subscription(
        TypeSubscription(switch_admin_agent_topic_type, switch_agent.type)
    )

    return runtime


async def chat(task: str, history: List[LLMMessage]):
    agent_runtime = await create_runtime()

    agent_runtime.start()
    ssid = str(uuid.uuid4())
    user_input = task
    await agent_runtime.publish_message(
        AgentResponse(
            context=history + [UserMessage(content=user_input, source="User")],
            reply_to_topic=user_topic_type,
        ),
        topic_id=TopicId(user_topic_type, ssid),
    )

    await agent_runtime.stop_when_idle()

    return FINAL_RESPONSE
