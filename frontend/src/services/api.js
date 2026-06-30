/**
 * KnapsackMode — Frontend API service
 * All fetch() calls go here. The frontend has no knowledge of Gemini or any LLM.
 */

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * LLM Call #1 — Extract and score topics from raw study material.
 * @param {string} contextType - 'exam' | 'interview'
 * @returns {Promise<Array<{topic, importance, difficulty, time_needed_minutes}>>}
 */
export async function extractTopics(rawText, timeBudget, contextType = "exam") {
  const data = await post("/extract-topics", {
    raw_text: rawText,
    time_budget: timeBudget,
    context_type: contextType,
  });
  return data.topics;
}

/**
 * Pure DP allocation — No LLM, instant response (<5ms on backend).
 * Called on initial plan AND on every re-allocation (Got it / Need more time / Skip).
 * @returns {Promise<Array<{topic, depth_level, allocated_minutes, importance, difficulty}>>}
 */
export async function allocate(topics, timeBudget) {
  const data = await post("/allocate", {
    topics,
    time_budget: timeBudget,
  });
  return data.plan;
}

/**
 * LLM Call #2 — Generate a focused study card for a single topic.
 * @param {string} contextType - 'exam' | 'interview'
 * @returns {Promise<string>} Markdown bullet-point card
 */
export async function getStudyCard(topic, depthLevel, allocatedMinutes, contextType = "exam") {
  const data = await post("/study-card", {
    topic,
    depth_level: depthLevel,
    allocated_minutes: allocatedMinutes,
    context_type: contextType,
  });
  return data.card;
}

/**
 * LLM Call #3 — Generate practice questions for a topic.
 * @param {string} contextType - 'exam' | 'interview' (overrides auto-detect)
 * @returns {Promise<Array<{question, hint, answer}>>}
 */
export async function getQuiz(topic, depthLevel, importance = 5, contextType = "exam") {
  const data = await post("/quiz", {
    topic,
    depth_level: depthLevel,
    importance,
    context_type: contextType,
  });
  return data.questions;
}

export async function checkHealth() {
  const res = await fetch(`${BASE}/health`);
  return res.ok;
}
