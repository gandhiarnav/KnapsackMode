"""POST /api/quiz — LLM call #3: practice question generation"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from services.gemini import generate_quiz, QuizQuestion

router = APIRouter()

VALID_DEPTHS = {"skim", "standard", "deep"}


class QuizRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    depth_level: str = Field(..., description="skim | standard | deep")
    importance: int = Field(5, ge=1, le=10)


class QuizResponse(BaseModel):
    questions: list[QuizQuestion]


@router.post("/quiz", response_model=QuizResponse)
async def quiz_endpoint(req: QuizRequest):
    if req.depth_level not in VALID_DEPTHS:
        raise HTTPException(
            status_code=422,
            detail=f"depth_level must be one of: {', '.join(VALID_DEPTHS)}"
        )
    try:
        questions = await generate_quiz(req.topic, req.depth_level, req.importance)
        return QuizResponse(questions=questions)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")
