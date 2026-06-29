"""POST /api/allocate — Pure DP knapsack: no LLM, instant response"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from utils.knapsack import allocate, TopicInput, AllocatedTopic

router = APIRouter()


class TopicInputModel(BaseModel):
    topic: str
    importance: int = Field(..., ge=1, le=10)
    difficulty: int = Field(..., ge=1, le=10)
    time_needed_minutes: int = Field(..., ge=1)


class AllocateRequest(BaseModel):
    topics: list[TopicInputModel]
    time_budget: int = Field(..., ge=1, le=480)


class AllocatedTopicModel(BaseModel):
    topic: str
    depth_level: str
    allocated_minutes: int
    importance: int
    difficulty: int


class AllocateResponse(BaseModel):
    plan: list[AllocatedTopicModel]


@router.post("/allocate", response_model=AllocateResponse)
def allocate_endpoint(req: AllocateRequest):
    """
    Runs the knapsack DP algorithm synchronously — no LLM call.
    Completes in <5ms even for large topic lists.
    Called both on initial plan generation and on every re-allocation
    (Got it / Need more time / Skip).
    """
    try:
        topic_inputs = [
            TopicInput(
                topic=t.topic,
                importance=t.importance,
                difficulty=t.difficulty,
                time_needed_minutes=t.time_needed_minutes,
            )
            for t in req.topics
        ]
        plan: list[AllocatedTopic] = allocate(topic_inputs, req.time_budget)
        return AllocateResponse(
            plan=[
                AllocatedTopicModel(
                    topic=p.topic,
                    depth_level=p.depth_level,
                    allocated_minutes=p.allocated_minutes,
                    importance=p.importance,
                    difficulty=p.difficulty,
                )
                for p in plan
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Allocation error: {str(e)}")
