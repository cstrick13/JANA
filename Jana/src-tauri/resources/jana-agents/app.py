import os
from typing import List

from autogen_core.models import (
    AssistantMessage,
    LLMMessage,
    UserMessage,
)
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent import chat, switch_admin_agent_topic_type

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))

previous_response: List[LLMMessage] = []

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
    history: List[dict]
    task: str

@app.post("/run_task")
async def run_task_route(task_request: TaskRequest):
    if not task_request.task:
        print("No task provided")
        raise HTTPException(status_code=400, detail="No task provided")
    history: List[LLMMessage] = []
    context = task_request.history
    print(context)
    for message in context:
        print(f"Message: {message}")
        if message["sender"] == "user":
            history.append(UserMessage(content=message["content"], source="user"))
        else:
            history.append(AssistantMessage(content=message["content"], source=switch_admin_agent_topic_type))
    print(f"Running task: {context}")


    response = await chat(task=task_request.task, history=history)
    return response


if __name__ == "__main__":
    import uvicorn

    print("Starting Jana...")
    uvicorn.run(app, host=HOST, port=PORT)