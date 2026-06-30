import { useState } from 'react'
import TopicEditor from '../components/TopicEditor'
import { allocate } from '../services/api'

const DEPTH_LABELS = {
  deep:     { label: 'Deep Dive',   cls: 'depth-deep',     icon: '🔬' },
  standard: { label: 'Core Review', cls: 'depth-standard', icon: '📖' },
  skim:     { label: 'Quick Pass',  cls: 'depth-skim',     icon: '👀' },
}

// ── Summary bar ───────────────────────────────────────────────────────────────
function SummaryBar({ plan, timeBudget }) {
  const usedTime      = plan.reduce((s, t) => s + t.allocated_minutes, 0)
  const pct           = Math.min(100, Math.round((usedTime / timeBudget) * 100))
  const deepCount     = plan.filter(t => t.depth_level === 'deep').length
  const standardCount = plan.filter(t => t.depth_level === 'standard').length
  const skimCount     = plan.filter(t => t.depth_level === 'skim').length

  return (
    <div className="card gap-md" style={{ marginBottom: '1.5rem' }}>
      <div className="row-between">
        <h3>Sprint Plan</h3>
        <span className="badge badge-accent">{plan.length} topics</span>
      </div>

      <div className="stat-grid">
        <div className="stat-item">
          <div className="stat-value" style={{ color: 'var(--amber-light)' }}>{usedTime}</div>
          <div className="stat-label">of {timeBudget} min</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ color: 'var(--accent-light)' }}>{deepCount}</div>
          <div className="stat-label">Deep Dives</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ color: 'var(--amber)' }}>{standardCount}</div>
          <div className="stat-label">Core Reviews</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ color: 'var(--text-secondary)' }}>{skimCount}</div>
          <div className="stat-label">Quick Passes</div>
        </div>
      </div>

      <div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="row-between mt-sm">
          <span className="text-muted">{pct}% of budget allocated</span>
          <span className="text-muted">{timeBudget - usedTime} min buffer</span>
        </div>
      </div>
    </div>
  )
}

// ── Read-only plan topic card ─────────────────────────────────────────────────
function PlanTopicCard({ topic, idx }) {
  const depth = DEPTH_LABELS[topic.depth_level] || DEPTH_LABELS.standard
  const importanceColor = topic.importance >= 8 ? '#ef4444' : topic.importance >= 5 ? '#f59e0b' : '#94a3b8'

  return (
    <div className="topic-card">
      <div className="topic-card-rank">#{idx + 1}</div>
      <div className="topic-card-body">
        <div className="topic-card-title">{topic.topic}</div>
        <div className="topic-card-meta">
          <span className={`badge ${depth.cls}`}>{depth.icon} {depth.label}</span>
          <span className="badge" style={{ background: `${importanceColor}1a`, color: importanceColor, borderColor: `${importanceColor}4d`, fontSize: '0.7rem' }}>
            ★ {topic.importance}
          </span>
          <span className="badge badge-ghost" style={{ fontSize: '0.7rem' }}>⚡ {topic.difficulty}</span>
        </div>
      </div>
      <div className="topic-card-time">{topic.allocated_minutes}m</div>
    </div>
  )
}

// ── Main PlanScreen ───────────────────────────────────────────────────────────
export default function PlanScreen({
  topics, setTopics, plan, timeBudget, contextType,
  onPlanUpdated, onStartSprint, onBack,
}) {
  // 'edit' = topic editor shown first, 'plan' = read-only optimized plan
  const [subView, setSubView] = useState('edit')
  const [recalcLoading, setRecalcLoading] = useState(false)
  const [recalcError, setRecalcError] = useState(null)

  const handleRecalculate = async () => {
    if (topics.length === 0) return
    setRecalcLoading(true)
    setRecalcError(null)
    try {
      const newPlan = await allocate(topics, timeBudget)
      onPlanUpdated(newPlan)
      setSubView('plan')
    } catch (err) {
      setRecalcError(err.message)
    } finally {
      setRecalcLoading(false)
    }
  }

  const contextLabel = contextType === 'interview' ? '💼 Interview Prep' : '📚 Exam Prep'

  return (
    <div className="page">
      {/* Header */}
      <div className="row-between" style={{ marginBottom: '1.25rem' }}>
        <div>
          <div className="row" style={{ gap: '0.5rem', marginBottom: '0.2rem' }}>
            <span style={{ fontSize: '1.4rem' }}>🎯</span>
            <h2>{subView === 'edit' ? 'Review & Edit Topics' : 'Your Optimized Sprint Plan'}</h2>
          </div>
          <div className="row" style={{ gap: '0.5rem' }}>
            <p className="text-muted text-sm">
              {subView === 'edit'
                ? 'Remove topics you already know, adjust scores, then recalculate.'
                : 'Knapsack-optimized — not an even split.'}
            </p>
            <span className="badge badge-ghost" style={{ fontSize: '0.7rem' }}>{contextLabel}</span>
          </div>
        </div>
        <div className="row" style={{ gap: '0.5rem' }}>
          {subView === 'plan' && (
            <button className="btn btn-ghost btn-sm" onClick={() => setSubView('edit')}>
              ✏️ Edit Topics
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onBack} id="back-to-input">
            ← Material
          </button>
        </div>
      </div>

      {/* ── EDIT sub-view ── */}
      {subView === 'edit' && (
        <>
          <TopicEditor topics={topics} onTopicsChange={setTopics} />

          {recalcError && (
            <div className="toast-error" style={{ borderRadius: 'var(--radius-md)', padding: '0.75rem', position: 'static', marginTop: '1rem' }}>
              ⚠️ {recalcError}
            </div>
          )}

          <div className="row" style={{ gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              id="recalculate-btn"
              className="btn btn-primary"
              onClick={handleRecalculate}
              disabled={recalcLoading || topics.length === 0}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              {recalcLoading ? (
                <><span className="loading-spinner" /> Recalculating…</>
              ) : '⚡ Calculate Sprint Plan'}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSubView('plan')}
              disabled={plan.length === 0}
            >
              View Plan →
            </button>
          </div>
        </>
      )}

      {/* ── PLAN sub-view ── */}
      {subView === 'plan' && (
        <>
          <SummaryBar plan={plan} timeBudget={timeBudget} />

          {/* Algorithmic note */}
          <div className="card-glass" style={{ marginBottom: '1.5rem', padding: '0.875rem 1.25rem' }}>
            <p className="text-sm" style={{ color: 'var(--accent-light)' }}>
              <strong>How this was optimized:</strong>{' '}
              <span style={{ color: 'var(--text-secondary)' }}>
                Each topic was expanded into 3 depth levels (skim/standard/deep).
                A 0/1 DP knapsack selected the combination maximizing importance coverage within {timeBudget} min.
              </span>
            </p>
          </div>

          {/* Topic list */}
          <div className="gap-sm stagger-children" style={{ marginBottom: '2rem' }}>
            {plan.map((topic, idx) => (
              <PlanTopicCard key={topic.topic} topic={topic} idx={idx} />
            ))}
          </div>

          <button
            id="start-sprint-btn"
            className="btn btn-primary btn-lg"
            onClick={onStartSprint}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            🚀 Start Sprint
          </button>
        </>
      )}
    </div>
  )
}
