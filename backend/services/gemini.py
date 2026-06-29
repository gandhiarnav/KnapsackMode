"""
Gemini API service wrapper using the new google-genai SDK (v2.0+).
Provides structured JSON extraction for topic scoring and study card generation.
"""

import os
from google import genai
from google.genai import types
from pydantic import BaseModel

# ── Pydantic models for structured output ──────────────────────────────────────

class TopicScore(BaseModel):
    topic: str
    importance: int        # 1–10: how likely to be tested / matter
    difficulty: int        # 1–10: how hard/unfamiliar
    time_needed_minutes: int

class QuizQuestion(BaseModel):
    question: str          # The question to answer
    hint: str              # One-line nudge without giving it away
    answer: str            # Full answer explanation

class StudyCardResponse(BaseModel):
    card: str              # Markdown bullet points

# ── Client setup ───────────────────────────────────────────────────────────────

def _get_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set in environment")
    return genai.Client(api_key=api_key)

# Model: configurable via GEMINI_MODEL env var.
# Default: gemini-1.5-flash — reliable free tier (15 RPM, 1M TPM, 1500 req/day).
# gemini-2.0-flash and gemini-2.5-flash are also supported if you have paid quota.
MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

# ── LLM Call #1: Topic Extraction & Scoring ───────────────────────────────────

EXTRACT_SYSTEM_PROMPT = """You are a study expert. Given raw study material (notes, syllabus, or job description),
extract a list of distinct topics/concepts. For each topic, provide:
- importance (1-10): how likely it is to be tested or asked about. Infer from repetition, 
  emphasis, headers, bold text, or "required" vs "nice to have" language (for job descriptions).
- difficulty (1-10): how complex or unfamiliar this topic likely is to a typical student.
- time_needed_minutes: realistic estimate of how many minutes an average student needs to 
  adequately understand this topic from scratch.

Return ONLY a valid JSON array. No prose, no markdown, no explanation. Example:
[{"topic": "Binary Search Trees", "importance": 9, "difficulty": 7, "time_needed_minutes": 20}]"""

async def extract_topics(raw_text: str, time_budget: int) -> list[TopicScore]:
    """Call Gemini to extract and score topics from raw study material."""
    client = _get_client()

    prompt = (
        f"The student has {time_budget} minutes total to study. "
        f"Extract and score ALL important topics from this material:\n\n{raw_text}"
    )

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=EXTRACT_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=list[TopicScore],
            temperature=0.2,
        ),
    )

    # With response_schema set, the SDK automatically parses into the Pydantic model
    parsed = response.parsed
    if parsed is None:
        raise ValueError("Gemini returned no structured response for topic extraction")
    return parsed


# ── LLM Call #2: Study Card Generation ────────────────────────────────────────

CARD_SYSTEM_PROMPT = """You are an expert study coach generating a detailed study card for a student.

CRITICAL RULES — follow these exactly:
1. Output ONLY markdown bullet points. No intro sentence, no title, no summary at the end.
2. Every bullet must contain a complete, self-contained fact, definition, or explanation — not a vague one-liner.
3. Use **bold** for key terms, formulas, or critical concepts within bullets.
4. Use `code` for any technical syntax, commands, or notation.
5. Do NOT pad with filler. Every bullet must be worth studying.

REQUIRED BULLET COUNTS by depth — you MUST meet these minimums:
- skim:     Generate exactly 4–5 bullets. Cover ONLY the most essential definitions and one-line facts.
- standard: Generate exactly 7–9 bullets. Cover definitions, key relationships, common use cases, and one example.
- deep:     Generate exactly 12–15 bullets. Cover definitions, mechanisms, examples, edge cases, gotchas, comparisons, and memory aids.

Start your response immediately with the first bullet point (-)."""

# Depth → required bullet count range (for the user prompt)
DEPTH_BULLET_REQUIREMENTS = {
    "skim":     "4-5 bullets",
    "standard": "7-9 bullets",
    "deep":     "12-15 bullets",
}

async def generate_study_card(topic: str, depth_level: str, allocated_minutes: int) -> str:
    """Call Gemini to generate a focused study card for a single topic."""
    client = _get_client()

    bullet_req = DEPTH_BULLET_REQUIREMENTS.get(depth_level, "7-9 bullets")

    prompt = (
        f"Topic: {topic}\n"
        f"Depth level: {depth_level}\n"
        f"Required: {bullet_req} — you MUST generate at least the minimum number of bullets.\n\n"
        f"Generate the {depth_level} study card for '{topic}' now. "
        f"Start immediately with the first bullet point."
    )

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=CARD_SYSTEM_PROMPT,
            temperature=0.3,
            max_output_tokens=2048,
        ),
    )

    return response.text or ""


# ── LLM Call #3: Quiz / Practice Questions ──────────────────────────────────

QUIZ_SYSTEM_PROMPT = """You are an expert quiz generator for exam and interview prep.

Auto-detect context from the topic:
- If the topic sounds like a TECHNICAL SKILL, JOB ROLE, or INTERVIEW CONCEPT
  (e.g. React Hooks, System Design, Behavioral Interview, TypeScript Generics, REST APIs):
  → Generate INTERVIEW-STYLE questions: "Explain X", "What would you do if...",
    "Compare A vs B", "Walk me through...", "What are the tradeoffs of..."

- If the topic sounds like an ACADEMIC/EXAM topic
  (e.g. Binary Trees, Photosynthesis, French Revolution, Thermodynamics):
  → Generate EXAM-STYLE questions: definition questions, application questions,
    comparison questions, and one scenario/problem question.

For EVERY question you generate:
- question: A clear, specific question. NOT vague. NOT "What is X?" alone — probe understanding.
- hint: A one-sentence nudge that guides thinking without giving the answer.
- answer: A complete, 2-4 sentence explanation of the correct answer with key points.

Return ONLY a valid JSON array. No prose, no markdown wrapper."""

DEPTH_QUESTION_COUNTS = {
    "skim":     3,
    "standard": 5,
    "deep":     7,
}

async def generate_quiz(
    topic: str,
    depth_level: str,
    importance: int,
) -> list[QuizQuestion]:
    """Generate practice questions for a topic. Auto-detects interview vs study context."""
    client = _get_client()

    count = DEPTH_QUESTION_COUNTS.get(depth_level, 5)

    prompt = (
        f"Topic: {topic}\n"
        f"Importance level: {importance}/10\n"
        f"Generate exactly {count} practice questions for this topic. "
        f"Make them progressively harder: start with a definition/recall question, "
        f"then understanding questions, then application or scenario questions. "
        f"Each question must have a complete hint and answer."
    )

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=QUIZ_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=list[QuizQuestion],
            temperature=0.5,
            max_output_tokens=2048,
        ),
    )

    parsed = response.parsed
    if parsed is None:
        raise ValueError("Gemini returned no structured response for quiz generation")
    return parsed
