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
    task: str


@app.post("/run_task")
async def run_task_route(task_request: TaskRequest):
    global previous_response

    task = task_request.task
    print(f"Running task: {task}")

    if not task:
        raise HTTPException(status_code=400, detail="No task provided")

    response = await chat(task, history=previous_response)
    previous_response.append(UserMessage(content=task, source="User"))
    previous_response.append(
        AssistantMessage(content=response, source=switch_admin_agent_topic_type)
    )
    return response


if __name__ == "__main__":
    import uvicorn

    print("Starting Jana...")
    uvicorn.run(app, host=HOST, port=PORT)
