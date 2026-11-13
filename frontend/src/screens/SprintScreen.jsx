import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { allocate, getStudyCard, getQuiz } from '../services/api'
import {
  IconCheck,
  IconCheckCircle,
  IconClock,
  IconSkipForward,
  IconPlay,
  IconPause,
  IconBook,
  IconHelpCircle,
  IconLightbulb,
  IconAward,
  IconCopy,
  IconRotateCcw,
  IconTarget,
  IconEye,
  IconAlertCircle,
  IconLayers,
  IconArrowLeft,
} from '../components/Icons'

// ── Constants ─────────────────────────────────────────────────────────────────
const DEPTH_LABELS = {
  deep:     { label: 'Deep Dive',   cls: 'depth-deep',     Icon: IconTarget },
  standard: { label: 'Core Review', cls: 'depth-standard', Icon: IconBook },
  skim:     { label: 'Quick Pass',  cls: 'depth-skim',     Icon: IconEye },
}
const EXTEND_MINUTES = 5

// ── Countdown Ring ────────────────────────────────────────────────────────────
function CountdownRing({ totalSeconds, remainingSeconds, paused, onTogglePause }) {
  const SIZE = 148
  const STROKE = 8
  const R = (SIZE - STROKE) / 2
  const CIRC = 2 * Math.PI * R
  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0
  const offset = CIRC * (1 - progress)

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const urgency = progress < 0.25 ? 'urgent' : progress < 0.5 ? 'warning' : ''

  return (
    <div className="gap-xs" style={{ alignItems: 'center' }}>
      <div className={`countdown-ring ${urgency}`} style={{ inlineSize: SIZE, blockSize: SIZE }}>
        <svg width={SIZE} height={SIZE} aria-hidden="true">
          <circle className="ring-bg" cx={SIZE / 2} cy={SIZE / 2} r={R} strokeWidth={STROKE} />
          <circle
            className="ring-fill"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            strokeWidth={STROKE}
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="ring-text">
          <div
            className="mono tabular"
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              lineHeight: 1.1,
              color:
                urgency === 'urgent'
                  ? 'var(--rose-light)'
                  : urgency === 'warning'
                  ? 'var(--amber-light)'
                  : 'var(--text-primary)',
            }}
          >
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
          <div className="text-muted" style={{ fontSize: '0.7rem', marginTop: '0.15rem' }}>
            {paused ? 'Paused' : 'Remaining'}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={onTogglePause}
        style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
      >
        {paused ? <IconPlay /> : <IconPause />}
        <span>{paused ? 'Resume' : 'Pause'}</span>
      </button>
    </div>
  )
}

// ── Study Card Renderer ───────────────────────────────────────────────────────
function StudyCard({ content, loading }) {
  if (loading) {
    return (
      <div className="gap-sm" aria-busy="true" aria-label="Generating study card">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="skeleton"
            style={{ minBlockSize: '3.25rem', animationDelay: `${i * 0.08}s` }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="study-card-content">
      <ReactMarkdown
        components={{
          ul: ({ children }) => <ul>{children}</ul>,
          ol: ({ children }) => (
            <ol style={{ paddingInlineStart: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {children}
            </ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong>{children}</strong>,
          code: ({ children }) => <code>{children}</code>,
          p: ({ children }) => (
            <p style={{ color: 'var(--text-secondary)', marginBlockEnd: '0.5rem', lineHeight: 1.65 }}>
              {children}
            </p>
          ),
          h3: ({ children }) => (
            <h3 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBlock: '0.75rem 0.35rem' }}>
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h3 style={{ color: 'var(--text-primary)', fontSize: '1rem', marginBlock: '0.75rem 0.35rem' }}>
              {children}
            </h3>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

// ── Sidebar: Live Remaining Plan ──────────────────────────────────────────────
function PlanSidebar({ plan, completedTopics, reallocatedCount }) {
  const timeLeft = plan.reduce((s, t) => s + t.allocated_minutes, 0)

  return (
    <aside className="plan-sidebar" aria-label="Sprint queue">
      <div className="card gap-md">
        <div className="row-between">
          <div className="row">
            <IconLayers />
            <h3 style={{ fontSize: '0.925rem' }}>Sprint Queue</h3>
          </div>
          <span className="badge badge-amber tabular">
            <IconClock />
            <span>{timeLeft}m left</span>
          </span>
        </div>

        {reallocatedCount > 0 && (
          <div className="badge badge-accent" style={{ alignSelf: 'flex-start' }}>
            <span>DP Re-optimized ({reallocatedCount}x)</span>
          </div>
        )}

        <div className="plan-sidebar-list">
          {plan.map((topic, i) => {
            const depthInfo = DEPTH_LABELS[topic.depth_level] || DEPTH_LABELS.standard
            const DepthIcon = depthInfo.Icon
            const isCurrent = i === 0
            return (
              <div key={topic.topic} className={`sidebar-topic ${isCurrent ? 'current-topic' : ''}`}>
                <span style={{ color: isCurrent ? 'var(--accent-light)' : 'var(--text-muted)', display: 'inline-flex' }}>
                  <DepthIcon />
                </span>
                <span className="sidebar-topic-name">{topic.topic}</span>
                <span className="sidebar-topic-time">{topic.allocated_minutes}m</span>
              </div>
            )
          })}
          {plan.length === 0 && (
            <p className="text-muted text-sm" style={{ textAlign: 'center', padding: '1rem' }}>
              All scheduled topics complete!
            </p>
          )}
        </div>

        {completedTopics.length > 0 && (
          <div className="gap-xs" style={{ paddingBlockStart: '0.75rem', borderBlockStart: '1px solid var(--border-subtle)' }}>
            <span className="text-muted" style={{ fontWeight: 600 }}>
              Completed ({completedTopics.length})
            </span>
            {completedTopics.map((t) => (
              <div key={t.topic} className="row" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--emerald-light)', display: 'inline-flex' }}>
                  <IconCheck />
                </span>
                <span>{t.topic}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

// ── Quiz Tab: Question Cards with Reveal ──────────────────────────────────────
function QuizCard({ q, index }) {
  const [revealed, setRevealed] = useState(false)
  const [hintShown, setHintShown] = useState(false)

  return (
    <div className={`quiz-card ${revealed ? 'revealed' : ''} gap-sm`}>
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <span className="quiz-num">
          {revealed ? <IconCheck /> : String(index + 1).padStart(2, '0')}
        </span>
        <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.55, fontWeight: 500 }}>
          {q.question}
        </p>
      </div>

      {!revealed && (
        <div style={{ paddingInlineStart: '2.25rem' }} className="gap-sm">
          {!hintShown ? (
            <div className="row">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setHintShown(true)}
              >
                <IconLightbulb />
                <span>Show Hint</span>
              </button>
              <button
                type="button"
                id={`reveal-${index}`}
                className="btn btn-emerald btn-sm"
                onClick={() => setRevealed(true)}
              >
                <IconCheck />
                <span>Reveal Answer</span>
              </button>
            </div>
          ) : (
            <>
              <div className="card-subtle" style={{ borderColor: 'var(--amber-border)', background: 'var(--amber-subtle)' }}>
                <p style={{ color: 'var(--amber-light)', fontSize: '0.85rem' }}>
                  <strong>Hint:</strong> {q.hint}
                </p>
              </div>
              <div>
                <button
                  type="button"
                  id={`reveal-${index}`}
                  className="btn btn-emerald btn-sm"
                  onClick={() => setRevealed(true)}
                >
                  <IconCheck />
                  <span>Reveal Answer</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {revealed && (
        <div
          style={{
            marginInlineStart: '2.25rem',
            padding: '0.75rem 1rem',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid var(--emerald-border)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <p style={{ color: 'var(--text-primary)', fontSize: '0.88rem', lineHeight: 1.65 }}>
            <strong style={{ color: 'var(--emerald-light)', marginInlineEnd: '0.4rem' }}>Answer:</strong>
            {q.answer}
          </p>
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
      .then((qs) => { setQuestions(qs); setLoading(false) })
      .catch((err) => { setError(err.message); setLoading(false) })
  }, [topic, depthLevel, importance, contextType])

  if (loading) {
    return (
      <div className="gap-sm">
        <div className="row text-muted">
          <span className="loading-spinner" />
          <span>Generating practice questions for {topic}…</span>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ minBlockSize: '5rem' }} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert-banner alert-error" role="alert">
        <IconAlertCircle />
        <span>{error}</span>
      </div>
    )
  }

  return (
    <div className="gap-sm">
      <p className="text-muted">
        Formulate your response before revealing the answer. {questions.length} progressive questions generated.
      </p>
      {questions.map((q, i) => (
        <QuizCard key={i} q={q} index={i} />
      ))}
    </div>
  )
}

// ── Confetti (Motion-safe via CSS) ────────────────────────────────────────────
function Confetti() {
  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#a78bfa', '#fcd34d', '#34d399']
  const pieces = Array.from({ length: 48 }, (_, i) => ({
    id: i,
    left: `${(i * 2.1) % 100}%`,
    color: COLORS[i % COLORS.length],
    duration: `${2.2 + (i % 5) * 0.4}s`,
    delay: `${(i % 7) * 0.15}s`,
    size: `${6 + (i % 4) * 2}px`,
  }))

  return (
    <div className="confetti-container" aria-hidden="true">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            insetInlineStart: p.left,
            insetBlockStart: '-20px',
            background: p.color,
            inlineSize: p.size,
            blockSize: p.size,
            animationDuration: p.duration,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  )
}

// ── Completion Screen (Analytics Dashboard) ───────────────────────────────────
function CompletionScreen({ completed, skipped, analytics, totalBudget, onRestart }) {
  const [copied, setCopied] = useState(false)

  const allTopics = [...completed, ...skipped]
  const totalImportance = allTopics.reduce((s, t) => s + (t.importance || 0), 0)
  const coveredImportance = completed.reduce((s, t) => s + (t.importance || 0), 0)
  const efficiencyPct = totalImportance > 0 ? Math.round((coveredImportance / totalImportance) * 100) : 0

  const reviewList = [
    ...skipped.map((t) => t.topic),
    ...analytics
      .filter((a) => a.outcome === 'got_it' && a.timeSpent > a.allocated + 2)
      .map((a) => a.topic),
  ]

  const handleCopyReview = () => {
    navigator.clipboard?.writeText(reviewList.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <Confetti />
      <div className="workspace-narrow">
        <div className="gap-lg" style={{ maxInlineSize: '44rem', marginInline: 'auto' }}>
          {/* Hero Summary */}
          <div className="card gap-sm" style={{ textAlign: 'center', alignItems: 'center', padding: '2.25rem 1.5rem' }}>
            <span
              className="panel-icon"
              style={{
                inlineSize: '3rem',
                blockSize: '3rem',
                fontSize: '1.5rem',
                background: 'var(--emerald-subtle)',
                borderColor: 'var(--emerald-border)',
                color: 'var(--emerald-light)',
              }}
            >
              <IconAward />
            </span>
            <h1>Sprint Complete</h1>
            <p className="text-muted">
              You captured <strong>{efficiencyPct}%</strong> of the total exam/interview importance score within your {totalBudget}-minute budget.
            </p>
          </div>

          {/* KPI Grid */}
          <div className="metrics-grid" style={{ marginBlockEnd: 0 }}>
            <div className="metric-card">
              <div className="metric-label">
                <span>Importance Captured</span>
                <IconTarget />
              </div>
              <div className="metric-value" style={{ color: 'var(--emerald-light)' }}>
                {efficiencyPct}%
              </div>
              <div className="metric-sub">Weighted value coverage</div>
            </div>

            <div className="metric-card">
              <div className="metric-label">
                <span>Topics Completed</span>
                <IconCheckCircle />
              </div>
              <div className="metric-value" style={{ color: 'var(--accent-light)' }}>
                {completed.length}
              </div>
              <div className="metric-sub">Mastered in sprint</div>
            </div>

            <div className="metric-card">
              <div className="metric-label">
                <span>Skipped</span>
                <IconSkipForward />
              </div>
              <div className="metric-value" style={{ color: 'var(--text-muted)' }}>
                {skipped.length}
              </div>
              <div className="metric-sub">Reallocated dynamically</div>
            </div>

            <div className="metric-card">
              <div className="metric-label">
                <span>Time Budget</span>
                <IconClock />
              </div>
              <div className="metric-value" style={{ color: 'var(--amber-light)' }}>
                {totalBudget}m
              </div>
              <div className="metric-sub">Sprint constraint</div>
            </div>
          </div>

          {/* Per-topic outcome list */}
          {analytics.length > 0 && (
            <div className="card gap-sm">
              <div className="panel-header" style={{ marginBlockEnd: '0.25rem' }}>
                <h3>Session Breakdown</h3>
                <span className="badge badge-ghost">{analytics.length} topics logged</span>
              </div>

              {analytics.map((a, i) => (
                <div
                  key={i}
                  className="sidebar-topic"
                  style={{
                    borderColor: a.outcome === 'got_it' ? 'var(--emerald-border)' : 'var(--border-subtle)',
                    background: a.outcome === 'got_it' ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-elevated)',
                  }}
                >
                  <span style={{ color: a.outcome === 'got_it' ? 'var(--emerald-light)' : 'var(--text-muted)', display: 'inline-flex' }}>
                    {a.outcome === 'got_it' ? <IconCheckCircle /> : <IconSkipForward />}
                  </span>
                  <span className="sidebar-topic-name">{a.topic}</span>
                  <span className="badge badge-ghost tabular">★ {a.importance}/10</span>
                  <span className="sidebar-topic-time">
                    {a.outcome === 'skipped' ? 'Skipped' : `${a.timeSpent}m / ${a.allocated}m`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Follow-up Review List */}
          {reviewList.length > 0 && (
            <div className="card-glass gap-sm">
              <div className="row-between">
                <h3>Recommended Follow-Up Review</h3>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopyReview}
                >
                  {copied ? <IconCheck /> : <IconCopy />}
                  <span>{copied ? 'Copied!' : 'Copy List'}</span>
                </button>
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {reviewList.map((topic, i) => (
                  <li key={i} className="row text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span className="badge badge-amber">Review</span>
                    <span>{topic}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            id="restart-btn"
            className="btn btn-primary btn-lg btn-block"
            onClick={onRestart}
          >
            <IconRotateCcw />
            <span>Start a New Sprint</span>
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main SprintScreen ─────────────────────────────────────────────────────────
export default function SprintScreen({
  topics,
  initialPlan,
  totalBudget,
  contextType = 'exam',
  onBackToPlan,
  onRestart,
}) {
  const [plan, setPlan] = useState(initialPlan)
  const [completedTopics, setCompletedTopics] = useState([])
  const [skippedTopics, setSkippedTopics] = useState([])
  const [done, setDone] = useState(false)
  const [reallocatedCount, setReallocatedCount] = useState(0)

  // Per-topic state
  const [studyCard, setStudyCard] = useState('')
  const [cardLoading, setCardLoading] = useState(true)
  const [cardError, setCardError] = useState(null)
  const [activeTab, setActiveTab] = useState('card') // 'card' | 'quiz'

  // Analytics
  const [topicAnalytics, setTopicAnalytics] = useState([])
  const topicStartTimeRef = useRef(Date.now())

  // Timer state
  const currentTopic = plan[0]
  const totalSeconds = currentTopic ? currentTopic.allocated_minutes * 60 : 0
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds)
  const [timerActive, setTimerActive] = useState(true)
  const timerRef = useRef(null)

  const [budgetUsed, setBudgetUsed] = useState(0)

  // Load study card when topic changes
  useEffect(() => {
    if (!currentTopic) return
    setStudyCard('')
    setCardLoading(true)
    setCardError(null)
    setActiveTab('card')
    setRemainingSeconds(currentTopic.allocated_minutes * 60)
    setTimerActive(true)
    topicStartTimeRef.current = Date.now()

    getStudyCard(currentTopic.topic, currentTopic.depth_level, currentTopic.allocated_minutes, contextType)
      .then((card) => { setStudyCard(card); setCardLoading(false) })
      .catch((err) => { setCardError(err.message); setCardLoading(false) })
  }, [currentTopic?.topic, currentTopic?.depth_level, currentTopic?.allocated_minutes, contextType])

  // Re-run allocation on remaining topics + remaining budget
  const reAllocate = useCallback(async (remainingTopics, remainingBudget) => {
    if (remainingTopics.length === 0 || remainingBudget <= 0) {
      setPlan([])
      return []
    }
    try {
      const newPlan = await allocate(remainingTopics, remainingBudget, contextType)
      setPlan(newPlan)
      setReallocatedCount((c) => c + 1)
      return newPlan
    } catch {
      setPlan(remainingTopics)
      return remainingTopics
    }
  }, [contextType])

  // ── Controls ──────────────────────────────────────────────────────────────
  const handleGotIt = useCallback(async () => {
    if (!currentTopic) return
    clearInterval(timerRef.current)
    setTimerActive(false)

    const savedTime = Math.floor(remainingSeconds / 60)
    const topicUsed = currentTopic.allocated_minutes - savedTime
    const newBudgetUsed = budgetUsed + topicUsed
    setBudgetUsed(newBudgetUsed)

    const timeSpentSec = Math.round((Date.now() - topicStartTimeRef.current) / 1000)
    setTopicAnalytics((prev) => [
      ...prev,
      {
        topic: currentTopic.topic,
        outcome: 'got_it',
        timeSpent: Math.round(timeSpentSec / 60),
        allocated: currentTopic.allocated_minutes,
        importance: currentTopic.importance,
      },
    ])

    setCompletedTopics((prev) => [...prev, currentTopic])

    const remainingTopics = plan.slice(1).map((t) => ({
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
    if (!currentTopic) return
    clearInterval(timerRef.current)
    setTimerActive(false)

    const extended = {
      ...currentTopic,
      allocated_minutes: currentTopic.allocated_minutes + EXTEND_MINUTES,
    }
    const newBudgetUsed = budgetUsed + EXTEND_MINUTES
    setBudgetUsed(newBudgetUsed)

    const remainingTopics = plan.slice(1).map((t) => ({
      topic: t.topic,
      importance: t.importance,
      difficulty: t.difficulty,
      time_needed_minutes: t.allocated_minutes,
    }))
    const remainingBudget = Math.max(0, totalBudget - newBudgetUsed)
    const newTail = await reAllocate(remainingTopics, remainingBudget)

    setPlan([extended, ...newTail])
    setRemainingSeconds(extended.allocated_minutes * 60)
    setTimerActive(true)
  }, [currentTopic, plan, budgetUsed, totalBudget, reAllocate])

  const handleSkip = useCallback(async () => {
    if (!currentTopic) return
    clearInterval(timerRef.current)
    setTimerActive(false)

    const timeSpentSec = Math.round((Date.now() - topicStartTimeRef.current) / 1000)
    setTopicAnalytics((prev) => [
      ...prev,
      {
        topic: currentTopic.topic,
        outcome: 'skipped',
        timeSpent: Math.round(timeSpentSec / 60),
        allocated: currentTopic.allocated_minutes,
        importance: currentTopic.importance,
      },
    ])

    setSkippedTopics((prev) => [...prev, currentTopic])
    const savedTime = currentTopic.allocated_minutes

    const remainingTopics = plan.slice(1).map((t) => ({
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

  // Countdown timer effect
  useEffect(() => {
    if (!timerActive || remainingSeconds <= 0) {
      if (remainingSeconds <= 0 && timerActive) {
        handleGotIt()
      }
      return
    }
    timerRef.current = setInterval(() => {
      setRemainingSeconds((s) => s - 1)
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [timerActive, remainingSeconds, handleGotIt])

  // Keyboard shortcuts
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

  // ── Completion View ───────────────────────────────────────────────────────
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
      <div className="workspace-narrow center">
        <div className="card gap-md" style={{ textAlign: 'center' }}>
          <p>No topics remain in the active sprint queue.</p>
          <button type="button" className="btn btn-primary" onClick={onRestart}>
            Start Over
          </button>
        </div>
      </div>
    )
  }

  const depthInfo = DEPTH_LABELS[currentTopic.depth_level] || DEPTH_LABELS.standard
  const DepthIcon = depthInfo.Icon
  const totalSprintTopics = completedTopics.length + plan.length
  const currentSprintNumber = completedTopics.length + 1
  const overallProgressPct = Math.round((completedTopics.length / Math.max(1, totalSprintTopics)) * 100)

  return (
    <div className="workspace-container">
      {/* ── Sprint Subheader & Progress Bar ── */}
      <div className="card-subtle gap-xs" style={{ marginBlockEnd: '1.5rem' }}>
        <div className="row-between">
          <div className="row">
            <span className="badge badge-accent tabular">
              Topic {currentSprintNumber} of {totalSprintTopics}
            </span>
            <span className={`badge ${depthInfo.cls}`}>
              <DepthIcon />
              <span>{depthInfo.label}</span>
            </span>
          </div>

          <div className="row">
            {onBackToPlan && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onBackToPlan}>
                <IconArrowLeft />
                <span>View Plan</span>
              </button>
            )}
            <button type="button" className="btn btn-danger btn-sm" onClick={onRestart}>
              <span>End Sprint</span>
            </button>
          </div>
        </div>

        <div className="progress-track" role="progressbar" aria-valuenow={overallProgressPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill" style={{ inlineSize: `${overallProgressPct}%` }} />
        </div>
      </div>

      <div className="sprint-layout">
        {/* ── Main Study Column ── */}
        <div className="gap-lg">
          {/* Active Topic Control Deck */}
          <section className="card" aria-label="Current topic control deck">
            <div className="row" style={{ alignItems: 'center', gap: '1.75rem' }}>
              <CountdownRing
                totalSeconds={totalSeconds}
                remainingSeconds={remainingSeconds}
                paused={!timerActive}
                onTogglePause={() => setTimerActive((a) => !a)}
              />

              <div className="gap-md" style={{ flex: '1 1 20rem', minInlineSize: 0 }}>
                <div className="gap-xs">
                  <h1 style={{ fontSize: 'clamp(1.35rem, 1.1rem + 1.2vw, 1.85rem)' }}>
                    {currentTopic.topic}
                  </h1>
                  <div className="row">
                    <span className="badge badge-amber tabular">
                      Importance {currentTopic.importance}/10
                    </span>
                    <span className="badge badge-ghost tabular">
                      Difficulty {currentTopic.difficulty}/10
                    </span>
                    <span className="badge badge-accent tabular">
                      <IconClock />
                      <span>{currentTopic.allocated_minutes}m allocated</span>
                    </span>
                  </div>
                </div>

                {/* Action Controls */}
                <div className="btn-group">
                  <button
                    type="button"
                    id="got-it-btn"
                    className="btn btn-emerald"
                    onClick={handleGotIt}
                  >
                    <IconCheck />
                    <span>Mark Complete</span>
                    <span className="kbd-pill">G</span>
                  </button>

                  <button
                    type="button"
                    id="more-time-btn"
                    className="btn btn-amber"
                    onClick={handleNeedMoreTime}
                  >
                    <IconClock />
                    <span>Extend +{EXTEND_MINUTES}m</span>
                    <span className="kbd-pill">M</span>
                  </button>

                  <button
                    type="button"
                    id="skip-btn"
                    className="btn btn-ghost"
                    onClick={handleSkip}
                  >
                    <IconSkipForward />
                    <span>Skip Topic</span>
                    <span className="kbd-pill">S</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Study Notes & Practice Quiz Panel */}
          <section className="card gap-md" aria-label="Study material and practice questions">
            <div className="panel-header" style={{ marginBlockEnd: '0.25rem' }}>
              <div className="segmented-tabs" role="tablist" aria-label="Study mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'card'}
                  id="tab-card"
                  className={`seg-tab ${activeTab === 'card' ? 'active' : ''}`}
                  onClick={() => setActiveTab('card')}
                >
                  <IconBook />
                  <span>Study Card</span>
                  <span className="kbd-pill">1</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'quiz'}
                  id="tab-quiz"
                  className={`seg-tab ${activeTab === 'quiz' ? 'active' : ''}`}
                  onClick={() => setActiveTab('quiz')}
                >
                  <IconHelpCircle />
                  <span>Practice Quiz</span>
                  <span className="kbd-pill">2</span>
                </button>
              </div>

              <span className={`badge ${depthInfo.cls}`}>
                <DepthIcon />
                <span>{depthInfo.label} Depth</span>
              </span>
            </div>

            {activeTab === 'card' ? (
              cardError ? (
                <div className="alert-banner alert-error" role="alert">
                  <IconAlertCircle />
                  <span>{cardError}</span>
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
          </section>
        </div>

        {/* ── Live Queue Sidebar ── */}
        <PlanSidebar
          plan={plan}
          completedTopics={completedTopics}
          reallocatedCount={reallocatedCount}
        />
      </div>
    </div>
  )
}
