# Project: KnapsackMode — Last-Minute Exam/Interview Prep Compressor

## Overview
KnapsackMode helps someone with very little time left before an exam, interview, or test
study as efficiently as possible. The user pastes in raw study material (notes, a
syllabus, a job description, slides, etc.) and tells the app how much time they have.
The app breaks the material into topics, scores each topic on importance and
difficulty, and then runs a **time-allocation algorithm** to generate a prioritized,
time-boxed "study sprint" — e.g. "spend 12 min on Topic A, 5 min on Topic B" — instead
of just summarizing everything evenly.

This is NOT just a summarizer. The core value is the **optimization layer**: deciding
what to study, in what order, and for how long, given a hard time constraint.

## Target track
"Last-Minute Life Saver" — urgent, time-pressured personal help. No location/maps
needed.

## Core technical components (build these in order)

### 1. Topic extraction & scoring (LLM call #1)
- Input: raw pasted text (notes/syllabus/job description) + optional user time budget
- Use an LLM call with a structured JSON output (no prose, just JSON) to extract a
  list of topics/concepts from the text.
- For each topic, the LLM should estimate:
  - `importance` (1-10): how likely this is to matter / be tested / be asked about.
    Infer from repetition, emphasis, position in the document, or for job
    descriptions, "required" vs "nice to have" language.
  - `difficulty` (1-10): how hard/unfamiliar this topic likely is, OR let the user
    self-rate this per topic in the UI (simpler, more reliable).
  - `time_needed_minutes`: LLM's estimate of how many minutes it would take to
    adequately learn this topic from scratch.
- Output format: a JSON array of objects like
  `{ "topic": string, "importance": number, "difficulty": number, "time_needed_minutes": number }`

### 2. Time allocation algorithm (write this yourself — plain code, NOT an LLM call)
This is the most important piece for demonstrating technical depth. Do not outsource
this logic to the LLM — write it as a real algorithm.

- Input: total available time `T` (minutes), list of topics with
  `(importance, difficulty, time_needed)`.
- Goal: maximize total "importance covered" within the time budget `T`.
- Make it a **knapsack-style allocation with partial coverage**, not a strict
  binary knapsack:
  - Each topic can be studied at different depths: e.g. "skim" (covers ~40% of the
    topic's value in ~25% of the full time_needed) vs "deep" (100% of value, 100% of
    time). Model this as 2-3 discrete depth levels per topic, each with its own
    (time_cost, value_gained) pair.
  - Run a dynamic programming knapsack over all (topic, depth) options to pick the
    combination that maximizes total value within time `T`.
  - Sort the resulting plan by a sensible study order (e.g. highest
    importance-per-minute first, or hardest-but-important topics earlier when focus
    is highest — pick one and justify it briefly in code comments).
- Output: an ordered list of `{ topic, allocated_minutes, depth_level }`.

### 3. Sprint mode UI
- A countdown-driven interface that walks the user through the allocated topics in
  order.
- For each topic, show condensed study content. This is LLM call #2: generate a
  tight "study card" per topic (key facts/points only, not a full explanation) sized
  to fit the allocated depth level and time.
- Per-topic controls: "Got it" (move on early) and "Need more time" (extend this
  topic).
- **Dynamic re-allocation**: when the user hits "Need more time" or "Got it" early,
  re-run the Step 2 allocation algorithm on the *remaining* topics with the
  *remaining* time budget. This live re-optimization is the standout technical/demo
  feature — make sure it's visibly working in the UI (e.g. show the plan update in
  real time).

## Suggested stack
Keep this lightweight — 2 days total.
- Frontend: React (or a single HTML file with vanilla JS if you want to move even
  faster). No need for a component library or heavy styling — clean and functional
  beats fancy.
- LLM calls: call the Claude API directly (use structured JSON output prompts for
  Step 1 and the study-card generation in Step 3).
- Allocation algorithm: plain JavaScript or Python function. No external library
  needed — a DP knapsack variant is roughly 30-50 lines of code.
- No database needed — everything can live in client-side state for the demo.
- No location/maps/geolocation APIs needed.

## Build order / timeline

**Day 1 — Core logic**
1. Input screen: textarea for pasted material + input for total time available
   (minutes).
2. Implement LLM call #1 (topic extraction + scoring), parse JSON response.
3. Implement the time allocation algorithm (Step 2) as a standalone, testable
   function — test it with a few hardcoded topic lists before wiring it to the UI.
4. Render the initial output: ordered list of topics with allocated time per topic.

**Day 2 — Sprint mode + dynamic re-allocation + polish**
1. Build the Sprint mode UI: countdown timer per topic, condensed study card display
   (LLM call #2).
2. Wire up "Got it" / "Need more time" buttons to trigger re-allocation of remaining
   time across remaining topics. Make the re-plan visibly update on screen.
3. Prepare 1-2 strong example inputs (e.g. a messy CS syllabus, a real job
   description) so the live demo doesn't depend on typing/uploading content live.
4. Polish: loading states for LLM calls, basic empty/error states, a clean visual
   pass on the input and sprint screens.

## Demo script (for presentation)
1. Paste in a pre-loaded example (messy syllabus or job description), set time to
   something tight (e.g. 45 minutes).
2. Show the generated topic list with importance/difficulty/time scores.
3. Show the allocated sprint plan (ordered topics + time per topic) — explain this is
   a knapsack-style optimization, not just an even split.
4. Start Sprint mode, click through a topic or two, hit "Need more time" on one and
   show the plan dynamically re-allocate remaining time across remaining topics.
5. Close on the core pitch: "It doesn't just summarize — it decides what's worth your
   time when you don't have much of it."

## What NOT to spend time on
- No location, maps, or geolocation — not needed for this idea.
- No user accounts/auth — not needed for a demo.
- No database persistence — client-side state is enough.
- No need for multiple LLM providers — one clean Claude API integration is enough.