import { useState } from 'react'
import { extractTopics, allocate } from '../services/api'

// ── Pre-loaded demo examples ──────────────────────────────────────────────────
const EXAMPLES = [
  {
    label: '📚 CS Algorithms Syllabus',
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
    label: '💼 Senior Frontend Engineer JD',
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

// ── Importance/Difficulty dot display ────────────────────────────────────────
function RatingDots({ value, max = 10, color = '#6366f1' }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: i < value ? color : 'var(--border)',
            display: 'inline-block',
          }}
        />
      ))}
    </span>
  )
}

// ── Main InputScreen Component ────────────────────────────────────────────────
export default function InputScreen({ rawText, setRawText, timeBudget, setTimeBudget, onPlanReady }) {
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState('') // 'extracting' | 'allocating'
  const [error, setError] = useState(null)

  const handleExample = (ex) => {
    setRawText(ex.text)
    setTimeBudget(ex.timeBudget)
    setError(null)
  }

  const handleAnalyze = async () => {
    if (!rawText.trim()) { setError('Paste some study material first.'); return }
    if (!timeBudget || timeBudget < 1) { setError('Set a time budget.'); return }

    setError(null)
    setLoading(true)

    try {
      // Step 1: Extract topics via Gemini
      setLoadingStage('extracting')
      const topics = await extractTopics(rawText, timeBudget)

      if (!topics || topics.length === 0) {
        throw new Error('No topics found. Try pasting more detailed content.')
      }

      // Step 2: Run knapsack allocation (pure Python, near-instant)
      setLoadingStage('allocating')
      const plan = await allocate(topics, timeBudget)

      onPlanReady(topics, plan)
    } catch (err) {
      setError(err.message || 'Something went wrong. Is the backend running?')
    } finally {
      setLoading(false)
      setLoadingStage('')
    }
  }

  const charCount = rawText.length
  const wordCount = rawText.trim() ? rawText.trim().split(/\s+/).length : 0

  return (
    <div className="page" style={{ justifyContent: 'center', paddingTop: '3rem' }}>
      {/* ── Hero ── */}
      <div className="gap-sm" style={{ marginBottom: '2.5rem', textAlign: 'center', alignItems: 'center' }}>
        <div className="hero-logo">⚡ KnapsackMode</div>
        <p className="hero-subtitle" style={{ textAlign: 'center' }}>
          Paste your notes, set your time. Get a{' '}
          <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>knapsack-optimized</span>{' '}
          study sprint — not a summary.
        </p>
      </div>

      {/* ── Main Card ── */}
      <div className="card gap-lg">
        {/* Example buttons */}
        <div>
          <label style={{ marginBottom: '0.5rem', display: 'block' }}>Quick Load Example</label>
          <div className="btn-group">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                className="btn btn-ghost btn-sm"
                onClick={() => handleExample(ex)}
                disabled={loading}
                id={`example-${ex.label.replace(/\W+/g, '-')}`}
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divider" style={{ margin: 0 }} />

        {/* Study material input */}
        <div className="form-field">
          <div className="row-between">
            <label>Study Material</label>
            <span className="text-muted">{wordCount} words · {charCount} chars</span>
          </div>
          <textarea
            id="study-material"
            rows={12}
            placeholder="Paste your notes, syllabus, job description, or any study content here…"
            value={rawText}
            onChange={(e) => { setRawText(e.target.value); setError(null) }}
            disabled={loading}
          />
        </div>

        {/* Time budget */}
        <div className="form-field">
          <div className="row-between">
            <label>Time Budget</label>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--amber-light)' }}>
              {timeBudget} min
            </span>
          </div>
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
          <div className="row-between text-muted" style={{ fontSize: '0.75rem' }}>
            <span>5 min</span>
            <span>Quick cram</span>
            <span>Deep session</span>
            <span>3 hrs</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="toast-error" style={{ borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', position: 'static' }}>
            ⚠️ {error}
          </div>
        )}

        {/* CTA */}
        <button
          id="analyze-btn"
          className="btn btn-primary btn-lg"
          onClick={handleAnalyze}
          disabled={loading || !rawText.trim()}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {loading ? (
            <>
              <span className="loading-spinner" />
              {loadingStage === 'extracting' ? 'Extracting topics…' : 'Optimizing sprint…'}
            </>
          ) : (
            '⚡ Analyze & Build Sprint Plan'
          )}
        </button>

        {loading && (
          <div style={{ textAlign: 'center' }}>
            <p className="text-muted text-sm">
              {loadingStage === 'extracting'
                ? '🧠 Gemini is reading your material and scoring topics…'
                : '🎯 Running knapsack optimization over all topics…'}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-muted" style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.8rem' }}>
        AI-powered topic extraction · DP knapsack optimization · No data stored
      </p>
    </div>
  )
}
