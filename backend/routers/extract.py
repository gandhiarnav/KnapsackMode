"""POST /api/extract-topics — Gemini call #1: topic extraction & scoring"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from services.gemini import extract_topics, TopicScore

router = APIRouter()


class ExtractRequest(BaseModel):
    raw_text: str = Field(..., min_length=10, description="Raw study material to analyze")
    time_budget: int = Field(..., ge=1, le=480, description="Total available time in minutes")


class ExtractResponse(BaseModel):
    topics: list[TopicScore]


@router.post("/extract-topics", response_model=ExtractResponse)
async def extract_topics_endpoint(req: ExtractRequest):
    try:
        topics = await extract_topics(req.raw_text, req.time_budget)
        return ExtractResponse(topics=topics)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")
