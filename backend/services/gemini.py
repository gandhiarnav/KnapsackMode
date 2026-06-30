"""
Gemini API service wrapper using the new google-genai SDK (v2.0+).
Provides structured JSON extraction for topic scoring, study card generation, and quiz questions.
Supports context_type ('exam' | 'interview') to tune all LLM prompts accordingly.
Includes exponential backoff retry on 429 RESOURCE_EXHAUSTED errors.
"""

import os
import time
import re
import logging
from typing import Literal
from google import genai
from google.genai import types
from pydantic import BaseModel

logger = logging.getLogger(__name__)

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

# ── Client & model setup ───────────────────────────────────────────────────────

def _get_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set in environment")
    return genai.Client(api_key=api_key)

# Model: configurable via GEMINI_MODEL env var.
# Default: gemini-1.5-flash — reliable free tier (15 RPM, 1M TPM, 1500 req/day).
MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

# ── Retry helper (exponential backoff on 429) ─────────────────────────────────

def _extract_retry_delay(error_str: str) -> float:
    """Parse retryDelay from Gemini 429 error message, e.g. 'retryDelay': '23s'"""
    match = re.search(r"retryDelay['\"]:\s*['\"](\d+(?:\.\d+)?)", error_str)
    if match:
        return float(match.group(1))
    return 30.0  # conservative fallback


def _call_with_retry(client, model, contents, config, max_retries: int = 3):
    """Wrap a generate_content call with exponential backoff on 429 errors."""
    last_err = None
    for attempt in range(max_retries + 1):
        try:
            return client.models.generate_content(
                model=model,
                contents=contents,
                config=config,
            )
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                if attempt >= max_retries:
                    raise
                delay = _extract_retry_delay(err_str)
                # Cap max wait at 60s to avoid hanging forever
                delay = min(delay, 60.0)
                logger.warning(f"Gemini 429 rate limit hit, retrying in {delay:.0f}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(delay)
                last_err = e
            else:
                raise
    raise last_err  # unreachable but satisfies linter


# ── Context-aware prompt snippets ─────────────────────────────────────────────

CONTEXT_HINTS = {
    "exam": {
        "extraction": (
            "This is EXAM material. Weight importance by: how often the topic appears, "
            "whether it's marked as 'required', in bold/headers, or called out by the instructor. "
            "Assume the student is preparing for a closed-book written exam."
        ),
        "card": (
            "Frame this card for EXAM recall: prioritize definitions, formulas, facts, "
            "mnemonics, and comparison tables. Avoid conversational tone. Be precise."
        ),
        "quiz": (
            "Generate EXAM-STYLE questions: definitions, application problems, comparisons, "
            "and 'explain the mechanism' style questions. Avoid behavioral or opinion questions."
        ),
    },
    "interview": {
        "extraction": (
            "This is INTERVIEW prep material (likely a job description or technical topic list). "
            "Weight importance by: 'required' vs 'nice to have', listed first, repeated, "
            "or explicitly called 'core'. Prioritize skills that interviewers test hands-on."
        ),
        "card": (
            "Frame this card for INTERVIEW preparation: include how-to-explain-it answers, "
            "real-world use cases, common follow-up questions, and concise talking points. "
            "Think: 'how would I explain this to an interviewer in 90 seconds?'"
        ),
        "quiz": (
            "Generate INTERVIEW-STYLE questions: 'Walk me through...', 'How would you approach...', "
            "'Compare X vs Y', 'What tradeoffs would you consider?', and one behavioral/scenario question. "
            "Avoid pure definition questions; probe understanding and application."
        ),
    },
}


# ── LLM Call #1: Topic Extraction & Scoring ───────────────────────────────────

EXTRACT_SYSTEM_PROMPT_BASE = """You are a study expert. Given raw study material (notes, syllabus, or job description),
extract a list of distinct topics/concepts. For each topic, provide:
- importance (1-10): how likely it is to be tested or asked about.
- difficulty (1-10): how complex or unfamiliar this topic likely is to a typical student.
- time_needed_minutes: realistic estimate of minutes an average student needs to understand this topic.

{context_hint}

Return ONLY a valid JSON array. No prose, no markdown, no explanation. Example:
[{{"topic": "Binary Search Trees", "importance": 9, "difficulty": 7, "time_needed_minutes": 20}}]"""


async def extract_topics(
    raw_text: str,
    time_budget: int,
    context_type: Literal["exam", "interview"] = "exam",
) -> list[TopicScore]:
    """Call Gemini to extract and score topics from raw study material."""
    client = _get_client()

    hint = CONTEXT_HINTS.get(context_type, CONTEXT_HINTS["exam"])["extraction"]
    system_prompt = EXTRACT_SYSTEM_PROMPT_BASE.format(context_hint=hint)

    prompt = (
        f"The student has {time_budget} minutes total to study. "
        f"Extract and score ALL important topics from this material:\n\n{raw_text}"
    )

    response = _call_with_retry(
        client, MODEL, prompt,
        types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=list[TopicScore],
            temperature=0.2,
        ),
    )

    parsed = response.parsed
    if parsed is None:
        raise ValueError("Gemini returned no structured response for topic extraction")
    return parsed


# ── LLM Call #2: Study Card Generation ────────────────────────────────────────

CARD_SYSTEM_PROMPT_BASE = """You are an expert study coach generating a detailed study card for a student.

{context_hint}

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

DEPTH_BULLET_REQUIREMENTS = {
    "skim":     "4-5 bullets",
    "standard": "7-9 bullets",
    "deep":     "12-15 bullets",
}


async def generate_study_card(
    topic: str,
    depth_level: str,
    allocated_minutes: int,
    context_type: Literal["exam", "interview"] = "exam",
) -> str:
    """Call Gemini to generate a focused study card for a single topic."""
    client = _get_client()

    hint = CONTEXT_HINTS.get(context_type, CONTEXT_HINTS["exam"])["card"]
    system_prompt = CARD_SYSTEM_PROMPT_BASE.format(context_hint=hint)

    bullet_req = DEPTH_BULLET_REQUIREMENTS.get(depth_level, "7-9 bullets")

    prompt = (
        f"Topic: {topic}\n"
        f"Depth level: {depth_level}\n"
        f"Required: {bullet_req} — you MUST generate at least the minimum number of bullets.\n\n"
        f"Generate the {depth_level} study card for '{topic}' now. "
        f"Start immediately with the first bullet point."
    )

    response = _call_with_retry(
        client, MODEL, prompt,
        types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.3,
            max_output_tokens=2048,
        ),
    )

    return response.text or ""


# ── LLM Call #3: Quiz / Practice Questions ────────────────────────────────────

QUIZ_SYSTEM_PROMPT_BASE = """You are an expert quiz generator for exam and interview prep.

{context_hint}

For EVERY question you generate:
- question: A clear, specific question. NOT vague. Probe understanding, not just recall.
- hint: A one-sentence nudge that guides thinking without giving the answer.
- answer: A complete, 2-4 sentence explanation of the correct answer with key points.

Make questions progressively harder: start with recall/definition, then understanding, then application/scenario.

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
    context_type: Literal["exam", "interview"] = "exam",
) -> list[QuizQuestion]:
    """Generate practice questions for a topic, tuned to context type."""
    client = _get_client()

    hint = CONTEXT_HINTS.get(context_type, CONTEXT_HINTS["exam"])["quiz"]
    system_prompt = QUIZ_SYSTEM_PROMPT_BASE.format(context_hint=hint)

    count = DEPTH_QUESTION_COUNTS.get(depth_level, 5)

    prompt = (
        f"Topic: {topic}\n"
        f"Importance level: {importance}/10\n"
        f"Generate exactly {count} practice questions for this topic. "
        f"Each question must have a complete hint and answer."
    )

    response = _call_with_retry(
        client, MODEL, prompt,
        types.GenerateContentConfig(
            system_instruction=system_prompt,
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
