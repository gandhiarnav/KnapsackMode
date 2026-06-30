import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { allocate, getStudyCard, getQuiz } from '../services/api'

// ── Constants ─────────────────────────────────────────────────────────────────
const DEPTH_LABELS = {
  deep:     { label: 'Deep Dive',   icon: '🔬' },
  standard: { label: 'Core Review', icon: '📖' },
  skim:     { label: 'Quick Pass',  icon: '👀' },
}
const EXTEND_MINUTES = 5

// ── Countdown Ring ────────────────────────────────────────────────────────────
function CountdownRing({ totalSeconds, remainingSeconds }) {
  const SIZE = 160
  const STROKE = 10
  const R = (SIZE - STROKE) / 2
  const CIRC = 2 * Math.PI * R
  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0
  const offset = CIRC * (1 - progress)

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const urgency = progress < 0.25 ? 'urgent' : progress < 0.5 ? 'warning' : ''

  return (
    <div className={`countdown-ring ${urgency}`} style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE}>
        <circle className="ring-bg" cx={SIZE / 2} cy={SIZE / 2} r={R} strokeWidth={STROKE} />
        <circle
          className="ring-fill"
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          strokeWidth={STROKE}
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ring-text" style={{ fontSize: '1.5rem', lineHeight: 1 }}>
        <div style={{ color: urgency === 'urgent' ? 'var(--red)' : urgency === 'warning' ? 'var(--amber)' : 'var(--accent-light)' }}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          remaining
        </div>
      </div>
    </div>
  )
}

// ── Study Card Renderer ───────────────────────────────────────────────────────
function StudyCard({ content, loading }) {
  if (loading) {
    return (
      <div className="gap-sm">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton" style={{ height: 40, animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    )
  }

  return (
    <div className="study-card-content">
      <ReactMarkdown
        components={{
          // Render unordered lists with our card styling
          ul: ({ children }) => <ul>{children}</ul>,
          ol: ({ children }) => <ol style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          // Bold → accent colour
          strong: ({ children }) => (
            <strong style={{ color: 'var(--accent-light)', fontWeight: 700 }}>{children}</strong>
          ),
          // Inline code → monospace pill
          code: ({ children }) => (
            <code style={{
              background: 'rgba(99,102,241,0.15)',
              color: 'var(--accent-light)',
              padding: '0.1em 0.4em',
              borderRadius: '4px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.85em',
            }}>{children}</code>
          ),
          // Paragraphs as normal text
          p: ({ children }) => (
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', lineHeight: 1.7 }}>{children}</p>
          ),
          // H3 headers (Gemini sometimes uses these for sections)
          h3: ({ children }) => (
            <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 700, margin: '0.75rem 0 0.35rem' }}>{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, margin: '0.75rem 0 0.35rem' }}>{children}</h3>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

// ── Sidebar: Live remaining plan ──────────────────────────────────────────────
function PlanSidebar({ plan, currentIdx, completedTopics }) {
  const timeLeft = plan.reduce((s, t) => s + t.allocated_minutes, 0)

  return (
    <div className="plan-sidebar">
      <div className="card gap-md">
        <div className="row-between">
          <h3 style={{ fontSize: '0.9rem' }}>Remaining Plan</h3>
          <span className="badge badge-amber">{timeLeft}m left</span>
        </div>
        <div className="plan-sidebar-list">
          {plan.map((topic, i) => {
            const depthInfo = DEPTH_LABELS[topic.depth_level] || DEPTH_LABELS.standard
            const isCurrent = i === 0
            return (
              <div key={topic.topic} className={`sidebar-topic ${isCurrent ? 'current-topic' : ''}`}>
                <span style={{ fontSize: '0.85rem' }}>{depthInfo.icon}</span>
                <span className="sidebar-topic-name">{topic.topic}</span>
                <span className="sidebar-topic-time">{topic.allocated_minutes}m</span>
              </div>
            )
          })}
          {plan.length === 0 && (
            <p className="text-muted text-sm" style={{ textAlign: 'center', padding: '1rem' }}>
              All topics complete!
            </p>
          )}
        </div>

        {completedTopics.length > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
              ✅ Completed ({completedTopics.length})
            </p>
            {completedTopics.map(t => (
              <div key={t.topic} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.2rem 0' }}>
                {t.topic}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Quiz Tab: Question Cards with Reveal ──────────────────────────────────
function QuizCard({ q, index }) {
  const [revealed, setRevealed] = useState(false)
  const [hintShown, setHintShown] = useState(false)

  return (
    <div
      style={{
        background: revealed ? 'rgba(16,185,129,0.06)' : 'var(--bg-card)',
        border: `1px solid ${revealed ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '1rem 1.25rem',
        transition: 'all 0.3s ease',
        animation: `slideIn 0.3s ease ${index * 0.06}s both`,
      }}
    >
      {/* Question number + text */}
      <div className="row" style={{ alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <span style={{
          minWidth: 26, height: 26,
          background: revealed ? 'var(--green)' : 'var(--accent)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.75rem', fontWeight: 800, color: 'white', flexShrink: 0,
          transition: 'background 0.3s',
        }}>
          {revealed ? '✓' : index + 1}
        </span>
        <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
          {q.question}
        </p>
      </div>

      {/* Hint */}
      {!revealed && (
        <div style={{ marginLeft: '2.1rem', marginBottom: '0.75rem' }}>
          {!hintShown ? (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setHintShown(true)}
              style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }}
            >
              💡 Show Hint
            </button>
          ) : (
            <div style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.5rem 0.75rem',
              fontSize: '0.84rem',
              color: 'var(--amber-light)',
              fontStyle: 'italic',
            }}>
              💡 {q.hint}
            </div>
          )}
        </div>
      )}

      {/* Answer (revealed) */}
      {revealed ? (
        <div
          style={{
            marginLeft: '2.1rem',
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.65rem 0.9rem',
            fontSize: '0.88rem',
            color: 'var(--text-primary)',
            lineHeight: 1.65,
            animation: 'fadeIn 0.25s ease',
          }}
        >
          <span style={{ color: 'var(--green)', fontWeight: 700, marginRight: '0.4rem' }}>Answer:</span>
          {q.answer}
        </div>
      ) : (
        <div style={{ marginLeft: '2.1rem' }}>
          <button
            id={`reveal-${index}`}
            className="btn btn-green btn-sm"
            onClick={() => setRevealed(true)}
          >
            Reveal Answer
          </button>
        </div>
      )}
    </div>
  )
}

function QuizTab({ topic, depthLevel, importance, contextType = 'exam' }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setQuestions([])
    setLoading(true)
    setError(null)
    getQuiz(topic, depthLevel, importance, contextType)
      .then(qs => { setQuestions(qs); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [topic, depthLevel, contextType])

  if (loading) {
    return (
      <div className="gap-sm">
        <p className="text-muted text-sm" style={{ marginBottom: '0.5rem' }}>
          <span className="loading-spinner" style={{ marginRight: '0.5rem' }} />
          Generating practice questions…
        </p>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 80, animationDelay: `${i * 0.1}s`, borderRadius: 'var(--radius-md)' }} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="toast-error" style={{ borderRadius: 'var(--radius-md)', padding: '0.75rem', position: 'static' }}>
        ⚠️ {error}
      </div>
    )
  }

  return (
    <div className="gap-sm">
      <p className="text-muted text-sm" style={{ marginBottom: '0.25rem' }}>
        Try answering before revealing. {questions.length} questions, progressively harder.
      </p>
      {questions.map((q, i) => (
        <QuizCard key={i} q={q} index={i} />
      ))}
    </div>
  )
}

// ── Confetti ──────────────────────────────────────────────────────────────
function Confetti() {
  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#a78bfa', '#fcd34d', '#34d399']
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    duration: `${2 + Math.random() * 2}s`,
    delay: `${Math.random() * 1.5}s`,
    size: `${6 + Math.random() * 8}px`,
  }))

  return (
    <div className="confetti-container">
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            top: '-20px',
            background: p.color,
            width: p.size,
            height: p.size,
            animationDuration: p.duration,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  )
}

// ── Completion Screen (v2 — Analytics Dashboard) ───────────────────────────
function CompletionScreen({ completed, skipped, analytics, totalBudget, onRestart }) {
  // Compute efficiency: importance points covered vs total
  const allTopics = [...completed, ...skipped]
  const totalImportance = allTopics.reduce((s, t) => s + (t.importance || 0), 0)
  const coveredImportance = completed.reduce((s, t) => s + (t.importance || 0), 0)
  const efficiencyPct = totalImportance > 0 ? Math.round((coveredImportance / totalImportance) * 100) : 0

  // Topics that need review (skipped or took longer than allocated)
  const reviewList = [
    ...skipped.map(t => t.topic),
    ...analytics.filter(a => a.outcome === 'got_it' && a.timeSpent > a.allocated + 2).map(a => a.topic),
  ]

  const outcomeIcon = { got_it: '✅', skipped: '⏭', extended: '⏱' }

  return (
    <>
      <Confetti />
      <div className="page" style={{ paddingTop: '2.5rem' }}>
        <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Hero */}
          <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🎉</div>
            <h2 style={{ marginBottom: '0.25rem' }}>Sprint Complete!</h2>
            <p className="text-muted">Here's how you did.</p>
          </div>

          {/* Key stats */}
          <div className="card">
            <div className="stat-grid">
              <div className="stat-item">
                <div className="stat-value" style={{ color: 'var(--green)' }}>{efficiencyPct}%</div>
                <div className="stat-label">Importance covered</div>
              </div>
              <div className="stat-item">
                <div className="stat-value" style={{ color: 'var(--accent-light)' }}>{completed.length}</div>
                <div className="stat-label">Topics done</div>
              </div>
              <div className="stat-item">
                <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{skipped.length}</div>
                <div className="stat-label">Skipped</div>
              </div>
              <div className="stat-item">
                <div className="stat-value" style={{ color: 'var(--amber-light)' }}>{totalBudget}</div>
                <div className="stat-label">Min budget</div>
              </div>
            </div>
          </div>

          {/* Per-topic outcome table */}
          {analytics.length > 0 && (
            <div className="card gap-sm">
              <h3 style={{ marginBottom: '0.5rem' }}>Topic Breakdown</h3>
              {analytics.map((a, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  background: a.outcome === 'got_it' ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.04)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.88rem',
                }}>
                  <span style={{ fontSize: '1rem' }}>{outcomeIcon[a.outcome] || '✅'}</span>
                  <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 500 }}>{a.topic}</span>
                  <span className="badge badge-ghost" style={{ fontSize: '0.7rem' }}>★{a.importance}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                    {a.timeSpent}m / {a.allocated}m
                  </span>
                </div>
              ))}
              {skipped.map((t, i) => (
                <div key={`skip-${i}`} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(148,163,184,0.06)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.88rem',
                }}>
                  <span>⏭</span>
                  <span style={{ flex: 1, color: 'var(--text-muted)' }}>{t.topic}</span>
                  <span className="badge badge-ghost" style={{ fontSize: '0.7rem' }}>★{t.importance}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>skipped</span>
                </div>
              ))}
            </div>
          )}

          {/* Review list */}
          {reviewList.length > 0 && (
            <div className="card-glass" style={{ padding: '1rem 1.25rem' }}>
              <div className="row-between" style={{ marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '0.9rem' }}>📋 Review Tomorrow</h3>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => navigator.clipboard?.writeText(reviewList.join('\n'))}
                >
                  📋 Copy
                </button>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {reviewList.map((topic, i) => (
                  <li key={i} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--amber)' }}>→</span> {topic}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button id="restart-btn" className="btn btn-primary btn-lg" onClick={onRestart} style={{ width: '100%', justifyContent: 'center' }}>
            ⚡ New Sprint
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main SprintScreen ─────────────────────────────────────────────────────────
export default function SprintScreen({ topics, initialPlan, totalBudget, contextType = 'exam', onRestart }) {
  const [plan, setPlan] = useState(initialPlan) // remaining plan (shrinks as topics complete)
  const [completedTopics, setCompletedTopics] = useState([])
  const [skippedTopics, setSkippedTopics] = useState([])
  const [done, setDone] = useState(false)

  // Per-topic state
  const [studyCard, setStudyCard] = useState('')
  const [cardLoading, setCardLoading] = useState(true)
  const [cardError, setCardError] = useState(null)
  const [activeTab, setActiveTab] = useState('card') // 'card' | 'quiz'

  // Analytics: track time spent and outcome per topic
  const [topicAnalytics, setTopicAnalytics] = useState([]) // {topic, outcome, timeSpent, allocated}
  const topicStartTimeRef = useRef(Date.now())

  // Timer state
  const currentTopic = plan[0]
  const totalSeconds = currentTopic ? currentTopic.allocated_minutes * 60 : 0
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds)
  const [timerActive, setTimerActive] = useState(true)
  const timerRef = useRef(null)

  // Track elapsed budget for re-allocation
  const [budgetUsed, setBudgetUsed] = useState(0)

  // Load study card when topic changes; also reset tab to 'card'
  useEffect(() => {
    if (!currentTopic) return
    setStudyCard('')
    setCardLoading(true)
    setCardError(null)
    setActiveTab('card')           // reset to card view on each new topic
    setRemainingSeconds(currentTopic.allocated_minutes * 60)
    setTimerActive(true)
    topicStartTimeRef.current = Date.now()

    getStudyCard(currentTopic.topic, currentTopic.depth_level, currentTopic.allocated_minutes, contextType)
      .then(card => { setStudyCard(card); setCardLoading(false) })
      .catch(err => { setCardError(err.message); setCardLoading(false) })
  }, [currentTopic?.topic, currentTopic?.depth_level, currentTopic?.allocated_minutes])

  // Countdown timer
  useEffect(() => {
    if (!timerActive || remainingSeconds <= 0) {
      if (remainingSeconds <= 0 && timerActive) {
        // Time's up — auto-advance
        handleGotIt()
      }
      return
    }
    timerRef.current = setInterval(() => {
      setRemainingSeconds(s => s - 1)
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [timerActive, remainingSeconds])

  // Re-run allocation on remaining topics + remaining budget
  const reAllocate = useCallback(async (remainingTopics, remainingBudget) => {
    if (remainingTopics.length === 0 || remainingBudget <= 0) {
      setPlan([])
      return []
    }
    try {
      const newPlan = await allocate(remainingTopics, remainingBudget, contextType)
      setPlan(newPlan)
      return newPlan
    } catch {
      // Fallback: just use remaining topics as-is
      setPlan(remainingTopics)
      return remainingTopics
    }
  }, [contextType])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'g' || e.key === 'G') handleGotIt()
      if (e.key === 'm' || e.key === 'M') handleNeedMoreTime()
      if (e.key === 's' || e.key === 'S') handleSkip()
      if (e.key === '1') setActiveTab('card')
      if (e.key === '2') setActiveTab('quiz')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleGotIt, handleNeedMoreTime, handleSkip])

  // ── Controls ──────────────────────────────────────────────────────────────
  const handleGotIt = useCallback(async () => {
    clearInterval(timerRef.current)
    setTimerActive(false)

    const savedTime = Math.floor(remainingSeconds / 60)
    const topicUsed = currentTopic.allocated_minutes - savedTime
    const newBudgetUsed = budgetUsed + topicUsed
    setBudgetUsed(newBudgetUsed)

    // Record analytics
    const timeSpentSec = Math.round((Date.now() - topicStartTimeRef.current) / 1000)
    setTopicAnalytics(prev => [...prev, {
      topic: currentTopic.topic, outcome: 'got_it',
      timeSpent: Math.round(timeSpentSec / 60), allocated: currentTopic.allocated_minutes,
      importance: currentTopic.importance,
    }])

    setCompletedTopics(prev => [...prev, currentTopic])

    const remainingTopics = plan.slice(1).map(t => ({
      topic: t.topic,
      importance: t.importance,
      difficulty: t.difficulty,
      time_needed_minutes: t.allocated_minutes,
    }))
    const remainingBudget = Math.max(0, totalBudget - newBudgetUsed + savedTime)

    if (remainingTopics.length === 0) {
      setPlan([])
      setDone(true)
      return
    }

    await reAllocate(remainingTopics, remainingBudget)
  }, [remainingSeconds, currentTopic, plan, budgetUsed, totalBudget, reAllocate])

  const handleNeedMoreTime = useCallback(async () => {
    clearInterval(timerRef.current)
    setTimerActive(false)

    // Extend current topic by EXTEND_MINUTES (deducted from remaining budget)
    const extended = { ...currentTopic, allocated_minutes: currentTopic.allocated_minutes + EXTEND_MINUTES }
    const newBudgetUsed = budgetUsed + EXTEND_MINUTES
    setBudgetUsed(newBudgetUsed)

    // Re-allocate remaining (not current) topics with reduced budget
    const remainingTopics = plan.slice(1).map(t => ({
      topic: t.topic,
      importance: t.importance,
      difficulty: t.difficulty,
      time_needed_minutes: t.allocated_minutes,
    }))
    const remainingBudget = Math.max(0, totalBudget - newBudgetUsed)
    const newTail = await reAllocate(remainingTopics, remainingBudget)

    setPlan([extended, ...newTail])
    setRemainingSeconds((extended.allocated_minutes) * 60)
    setTimerActive(true)
  }, [currentTopic, plan, budgetUsed, totalBudget, reAllocate])

  const handleSkip = useCallback(async () => {
    clearInterval(timerRef.current)
    setTimerActive(false)

    // Record analytics for skip
    const timeSpentSec = Math.round((Date.now() - topicStartTimeRef.current) / 1000)
    setTopicAnalytics(prev => [...prev, {
      topic: currentTopic.topic, outcome: 'skipped',
      timeSpent: Math.round(timeSpentSec / 60), allocated: currentTopic.allocated_minutes,
      importance: currentTopic.importance,
    }])

    setSkippedTopics(prev => [...prev, currentTopic])
    const savedTime = currentTopic.allocated_minutes

    const remainingTopics = plan.slice(1).map(t => ({
      topic: t.topic,
      importance: t.importance,
      difficulty: t.difficulty,
      time_needed_minutes: t.allocated_minutes,
    }))
    const remainingBudget = Math.max(0, totalBudget - budgetUsed + savedTime)

    if (remainingTopics.length === 0) {
      setPlan([])
      setDone(true)
      return
    }

    await reAllocate(remainingTopics, remainingBudget)
  }, [currentTopic, plan, budgetUsed, totalBudget, reAllocate])

  // ── Completion ────────────────────────────────────────────────────────────
  if (done || (!currentTopic && completedTopics.length > 0)) {
    return (
      <CompletionScreen
        completed={completedTopics}
        skipped={skippedTopics}
        analytics={topicAnalytics}
        totalBudget={totalBudget}
        onRestart={onRestart}
      />
    )
  }

  if (!currentTopic) {
    return (
      <div className="page center">
        <div className="card" style={{ textAlign: 'center' }}>
          <p>No topics to study. <button className="btn btn-ghost btn-sm" onClick={onRestart}>Start over</button></p>
        </div>
      </div>
    )
  }

  const depthInfo = DEPTH_LABELS[currentTopic.depth_level] || DEPTH_LABELS.standard

  return (
    <div className="page-wide">
      {/* Sprint header */}
      <div className="row-between" style={{ marginBottom: '1.5rem' }}>
        <div className="row">
          <span style={{ fontSize: '1.5rem' }}>⚡</span>
          <div>
            <h2 style={{ fontSize: '1.1rem' }}>Sprint Mode</h2>
            <p className="text-muted text-sm">
              Topic {completedTopics.length + 1} of {completedTopics.length + plan.length}
            </p>
          </div>
        </div>
        <div className="row">
          <span className={`badge depth-${currentTopic.depth_level}`}>
            {depthInfo.icon} {depthInfo.label}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onRestart}>✕ End</button>
        </div>
      </div>

      <div className="sprint-layout">
        {/* ── Main study area ── */}
        <div className="gap-lg">
          {/* Topic + timer */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
              <CountdownRing totalSeconds={totalSeconds} remainingSeconds={remainingSeconds} />
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: 'clamp(1.25rem, 3vw, 2rem)', marginBottom: '0.5rem' }}>
                  {currentTopic.topic}
                </h1>
                <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <span className="badge badge-amber">★ Importance: {currentTopic.importance}/10</span>
                  <span className="badge badge-accent">⚡ Difficulty: {currentTopic.difficulty}/10</span>
                  <span className="badge badge-ghost">{currentTopic.allocated_minutes} min allocated</span>
                </div>

                {/* Controls */}
                <div className="btn-group">
                  <button id="got-it-btn" className="btn btn-green" onClick={handleGotIt}>
                    ✅ Got it
                  </button>
                  <button id="more-time-btn" className="btn btn-amber" onClick={handleNeedMoreTime}>
                    ⏱ Need +{EXTEND_MINUTES} min
                  </button>
                  <button id="skip-btn" className="btn btn-danger btn-sm" onClick={handleSkip}>
                    ⏭ Skip
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Study Card + Quiz Tab panel */}
          <div className="card gap-md">
            {/* Tab switcher */}
            <div className="row-between">
              <div className="row" style={{ gap: 0, background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', padding: 3, border: '1px solid var(--border)' }}>
                <button
                  id="tab-card"
                  onClick={() => setActiveTab('card')}
                  style={{
                    padding: '0.35rem 0.9rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                    background: activeTab === 'card' ? 'var(--accent)' : 'transparent',
                    color: activeTab === 'card' ? 'white' : 'var(--text-muted)',
                  }}
                >
                  {depthInfo.icon} Study Card
                </button>
                <button
                  id="tab-quiz"
                  onClick={() => setActiveTab('quiz')}
                  style={{
                    padding: '0.35rem 0.9rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                    background: activeTab === 'quiz' ? 'var(--accent)' : 'transparent',
                    color: activeTab === 'quiz' ? 'white' : 'var(--text-muted)',
                  }}
                >
                  ❓ Practice Questions
                </button>
              </div>
              <span className={`badge depth-${currentTopic.depth_level}`}>{currentTopic.depth_level}</span>
            </div>

            {/* Tab content */}
            {activeTab === 'card' ? (
              cardError ? (
                <div className="toast-error" style={{ borderRadius: 'var(--radius-md)', padding: '0.75rem', position: 'static' }}>
                  ⚠️ {cardError}
                </div>
              ) : (
                <StudyCard content={studyCard} loading={cardLoading} />
              )
            ) : (
              <QuizTab
                topic={currentTopic.topic}
                depthLevel={currentTopic.depth_level}
                importance={currentTopic.importance}
                contextType={contextType}
              />
            )}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <PlanSidebar
          plan={plan}
          currentIdx={0}
          completedTopics={completedTopics}
        />
      </div>
    </div>
  )
}
