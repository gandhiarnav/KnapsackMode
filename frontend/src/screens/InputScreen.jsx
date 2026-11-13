import { useState } from 'react'
import { extractTopics, allocate } from '../services/api'
import {
  IconBolt,
  IconBook,
  IconBriefcase,
  IconClock,
  IconSparkles,
  IconLayers,
  IconFileText,
  IconRotateCcw,
  IconArrowRight,
  IconX,
  IconAlertCircle,
} from '../components/Icons'

// ── Pre-loaded demo examples ──────────────────────────────────────────────────
const EXAMPLES = [
  {
    id: 'cs-algorithms',
    label: 'CS Algorithms Syllabus',
    contextType: 'exam',
    timeBudget: 45,
    text: `COMP 3000 — Data Structures & Algorithms Final Exam Topics

CHAPTER 1: Arrays and Strings
- Time/space complexity analysis (Big-O notation)
- Two-pointer and sliding window techniques
- String manipulation: anagrams, palindromes

CHAPTER 2: Linked Lists
- Singly and doubly linked lists
- Fast & slow pointer pattern (cycle detection - Floyd's algorithm)
- Reversing a linked list, merging sorted lists

CHAPTER 3: Trees (HEAVILY TESTED)
- Binary trees: traversals (in/pre/post-order, BFS, DFS)
- Binary Search Trees: insert, delete, search
- Balanced BSTs: AVL trees, rotation logic
- Lowest Common Ancestor (LCA) problems

CHAPTER 4: Graph Algorithms (REQUIRED for exam)
- BFS and DFS on adjacency list/matrix
- Dijkstra's shortest path (must know implementation)
- Union-Find / Disjoint Set Union (DSU)
- Topological sort (Kahn's algorithm + DFS approach)

CHAPTER 5: Dynamic Programming
- Memoization vs tabulation
- Classic problems: Fibonacci, Coin Change, 0/1 Knapsack
- 2D DP: Longest Common Subsequence, Edit Distance
- DP on strings and intervals

CHAPTER 6: Sorting (Nice-to-have)
- Merge sort, Quick sort implementation
- Counting sort, Radix sort for integers
- When to use which sort

CHAPTER 7: Heaps & Priority Queues
- Min-heap and max-heap
- Heapify operation
- Top-K elements pattern

NOTE: Professor mentioned graphs and DP will be 60% of the exam. Trees are always tested. Sorting is rarely tested directly.`,
  },
  {
    id: 'senior-frontend',
    label: 'Senior Frontend Engineer JD',
    contextType: 'interview',
    timeBudget: 60,
    text: `Job: Senior Frontend Engineer — TechCorp Platform Team
Interview in: Today

REQUIRED SKILLS (Must demonstrate in interview):
- React (hooks, context, performance optimization — useMemo, useCallback, React.memo)
- TypeScript: generics, utility types, strict mode, discriminated unions
- State management: Redux Toolkit or Zustand, async thunks, selectors
- Testing: Jest + React Testing Library, unit and integration tests

STRONGLY PREFERRED (Will be asked about):
- Next.js: SSR vs SSG vs ISR, App Router, Server Components
- Web performance: Core Web Vitals (LCP, CLS, INP), lazy loading, code splitting
- CSS: Flexbox, Grid, CSS Modules, styled-components or Tailwind
- RESTful API integration and GraphQL basics
- Accessibility (WCAG 2.1 AA, ARIA)

NICE TO HAVE (Bonus points):
- Micro-frontend architecture
- WebSockets and real-time features
- CI/CD pipelines (GitHub Actions)
- Docker basics
- Node.js / Express for BFF patterns

SYSTEM DESIGN (Final interview round):
The team expects candidates to design a scalable frontend system for a dashboard with real-time data, role-based access control, and offline support. Know component architecture patterns.`,
  },
]

const QUICK_DURATIONS = [15, 30, 45, 60, 90, 120]

// ── Main InputScreen Component ────────────────────────────────────────────────
export default function InputScreen({
  rawText, setRawText,
  timeBudget, setTimeBudget,
  contextType, setContextType,
  onPlanReady,
  resumeSession, onResume, onDismissResume,
}) {
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState('') // 'extracting' | 'allocating'
  const [error, setError] = useState(null)

  const handleExample = (ex) => {
    setRawText(ex.text)
    setTimeBudget(ex.timeBudget)
    setContextType(ex.contextType)
    setError(null)
  }

  const handleAnalyze = async () => {
    if (!rawText.trim()) {
      setError('Please paste study notes, a syllabus, or a job description first.')
      return
    }
    if (!timeBudget || timeBudget < 1) {
      setError('Please choose a valid time budget.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      setLoadingStage('extracting')
      const topics = await extractTopics(rawText, timeBudget, contextType)

      if (!topics || topics.length === 0) {
        throw new Error('No distinct topics could be extracted. Try pasting more detailed material.')
      }

      setLoadingStage('allocating')
      const plan = await allocate(topics, timeBudget)

      onPlanReady(topics, plan)
    } catch (err) {
      setError(err.message || 'Unable to reach the optimization server. Check that the backend is running.')
    } finally {
      setLoading(false)
      setLoadingStage('')
    }
  }

  const charCount = rawText.length
  const wordCount = rawText.trim() ? rawText.trim().split(/\s+/).length : 0

  return (
    <div className="workspace-container">
      {/* ── Resume Banner ── */}
      {resumeSession && (
        <div className="resume-banner" role="region" aria-label="Saved study session">
          <div className="row">
            <span className="panel-icon">
              <IconRotateCcw />
            </span>
            <div className="gap-xs">
              <p className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                Unfinished study sprint detected
              </p>
              <p className="text-muted">
                {resumeSession.topics?.length || 0} extracted topics · {resumeSession.timeBudget} min budget ·{' '}
                {resumeSession.contextType === 'interview' ? 'Interview Prep' : 'Exam Prep'}
              </p>
            </div>
          </div>
          <div className="row">
            <button type="button" className="btn btn-primary btn-sm" onClick={onResume}>
              <span>Resume Session</span>
              <IconArrowRight />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onDismissResume}
              aria-label="Discard saved session"
            >
              <IconX />
              <span>Dismiss</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Hero Section ── */}
      <div className="hero-header">
        <div className="eyebrow-badge">
          <IconLayers />
          <span>Bounded 0/1 Knapsack Study Planner</span>
        </div>
        <h1 className="hero-title">
          Optimize your study time,{' '}
          <span className="hero-accent">not just your notes.</span>
        </h1>
        <p className="hero-lead">
          Paste any syllabus, lecture notes, or job description. Gemini scores each topic by exam weight and complexity, and our dynamic programming engine allocates your exact minute budget across optimal depth levels.
        </p>
      </div>

      {/* ── Main Two-Column Workspace ── */}
      <div className="input-grid">
        {/* Left Column: Study Material Input */}
        <section className="card gap-md" aria-labelledby="material-heading">
          <div className="panel-header" style={{ marginBlockEnd: '0.25rem' }}>
            <div className="panel-title-group">
              <span className="panel-icon">
                <IconFileText />
              </span>
              <div>
                <h2 id="material-heading" style={{ fontSize: '1.05rem' }}>Source Material</h2>
                <p className="text-muted">Syllabus, raw lecture notes, or technical job description</p>
              </div>
            </div>
            <div className="row">
              <span className="badge badge-ghost tabular">
                {wordCount} words · {charCount} chars
              </span>
              {rawText && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setRawText(''); setError(null) }}
                  disabled={loading}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Preset Loaders */}
          <div className="preset-bar">
            <span className="text-muted" style={{ fontWeight: 500 }}>
              Load sample dataset:
            </span>
            <div className="btn-group">
              {EXAMPLES.map((ex) => (
                <button
                  type="button"
                  key={ex.id}
                  id={`example-${ex.id}`}
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleExample(ex)}
                  disabled={loading}
                >
                  {ex.contextType === 'interview' ? <IconBriefcase /> : <IconBook />}
                  <span>{ex.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div className="form-field">
            <label htmlFor="study-material" className="field-label">
              <span>Raw Text Content</span>
              <span className="text-muted">Minimum 10 characters</span>
            </label>
            <textarea
              id="study-material"
              rows={13}
              placeholder="Paste your course syllabus, chapter outline, study guide, or job description here..."
              value={rawText}
              onChange={(e) => { setRawText(e.target.value); setError(null) }}
              disabled={loading}
            />
          </div>
        </section>

        {/* Right Column: Constraints & Optimization Controls */}
        <aside className="card gap-lg" aria-labelledby="config-heading">
          <div className="panel-header" style={{ marginBlockEnd: 0 }}>
            <div className="panel-title-group">
              <span className="panel-icon">
                <IconSparkles />
              </span>
              <div>
                <h2 id="config-heading" style={{ fontSize: '1.05rem' }}>Sprint Parameters</h2>
                <p className="text-muted">Configure objective function &amp; time constraint</p>
              </div>
            </div>
          </div>

          {/* Preparation Context Selector */}
          <div className="form-field">
            <span className="field-label">Preparation Context</span>
            <div className="mode-selector-grid" role="group" aria-label="Preparation context">
              <button
                type="button"
                id="context-exam"
                className={`mode-option-card ${contextType === 'exam' ? 'selected' : ''}`}
                onClick={() => setContextType('exam')}
                disabled={loading}
                aria-pressed={contextType === 'exam'}
              >
                <div className="mode-option-title">
                  <IconBook />
                  <span>Exam Prep</span>
                </div>
                <p className="mode-option-desc">
                  Prioritizes definitions, mechanisms, formulas, and closed-book recall.
                </p>
              </button>

              <button
                type="button"
                id="context-interview"
                className={`mode-option-card ${contextType === 'interview' ? 'selected' : ''}`}
                onClick={() => setContextType('interview')}
                disabled={loading}
                aria-pressed={contextType === 'interview'}
              >
                <div className="mode-option-title">
                  <IconBriefcase />
                  <span>Interview Prep</span>
                </div>
                <p className="mode-option-desc">
                  Prioritizes system trade-offs, talking points, and applied scenarios.
                </p>
              </button>
            </div>
          </div>

          {/* Time Budget Slider + Presets */}
          <div className="form-field">
            <label htmlFor="time-budget" className="field-label">
              <span>Available Time Budget</span>
              <span className="badge badge-amber tabular" style={{ fontSize: '0.85rem' }}>
                <IconClock />
                <span>{timeBudget} min</span>
              </span>
            </label>

            <input
              type="range"
              id="time-budget"
              min={5}
              max={180}
              step={5}
              value={timeBudget}
              onChange={(e) => setTimeBudget(Number(e.target.value))}
              disabled={loading}
            />

            <div className="duration-pills" role="group" aria-label="Quick time budget presets">
              {QUICK_DURATIONS.map((mins) => (
                <button
                  type="button"
                  key={mins}
                  className={`duration-pill ${timeBudget === mins ? 'active' : ''}`}
                  onClick={() => setTimeBudget(mins)}
                  disabled={loading}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          {/* Algorithmic Explainer Box */}
          <div className="card-subtle gap-xs">
            <div className="row-between">
              <span className="text-sm" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                Multi-Choice Knapsack Allocation
              </span>
              <span className="badge badge-ghost">O(N · W) DP</span>
            </div>
            <p className="text-muted" style={{ lineHeight: 1.5 }}>
              Each topic is evaluated across 3 depth tiers—<strong>Deep Dive</strong> (100% value),{' '}
              <strong>Core Review</strong> (60% value), and <strong>Quick Pass</strong> (25% value)—to maximize total importance covered within your {timeBudget}-minute cap.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="alert-banner alert-error" role="alert">
              <IconAlertCircle style={{ flexShrink: 0, marginTop: '0.15rem' }} />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Action Button */}
          <div className="gap-xs">
            <button
              type="button"
              id="analyze-btn"
              className="btn btn-primary btn-lg btn-block"
              onClick={handleAnalyze}
              disabled={loading || !rawText.trim()}
            >
              {loading ? (
                <>
                  <span className="loading-spinner" />
                  <span>
                    {loadingStage === 'extracting'
                      ? 'Extracting & scoring topics…'
                      : 'Solving knapsack allocation…'}
                  </span>
                </>
              ) : (
                <>
                  <IconBolt />
                  <span>Analyze &amp; Build Sprint Plan</span>
                </>
              )}
            </button>

            {loading && (
              <p className="text-muted" style={{ textAlign: 'center' }}>
                {loadingStage === 'extracting'
                  ? 'Step 1 of 2: Gemini AI is identifying topics and estimating study times…'
                  : 'Step 2 of 2: Running dynamic programming solver over topic depth tiers…'}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
