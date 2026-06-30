"""POST /api/study-card — Gemini call #2: per-topic study card generation"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from services.gemini import generate_study_card

router = APIRouter()

VALID_DEPTHS = {"skim", "standard", "deep"}


class StudyCardRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    depth_level: str = Field(..., description="skim | standard | deep")
    allocated_minutes: int = Field(..., ge=1)
    context_type: str = Field("exam", description="'exam' or 'interview'")


class StudyCardResponse(BaseModel):
    card: str


@router.post("/study-card", response_model=StudyCardResponse)
async def study_card_endpoint(req: StudyCardRequest):
    if req.depth_level not in VALID_DEPTHS:
        raise HTTPException(
            status_code=422,
            detail=f"depth_level must be one of: {', '.join(VALID_DEPTHS)}"
        )
    ctx = req.context_type if req.context_type in ("exam", "interview") else "exam"
    try:
        card = await generate_study_card(req.topic, req.depth_level, req.allocated_minutes, ctx)
        return StudyCardResponse(card=card)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")
