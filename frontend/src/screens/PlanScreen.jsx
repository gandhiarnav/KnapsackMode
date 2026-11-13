import { useState } from 'react'
import TopicEditor from '../components/TopicEditor'
import { allocate } from '../services/api'
import {
  IconLayers,
  IconSliders,
  IconPlay,
  IconArrowLeft,
  IconBolt,
  IconClock,
  IconEye,
  IconBook,
  IconTarget,
  IconAlertCircle,
} from '../components/Icons'

const DEPTH_META = {
  deep: {
    label: 'Deep Dive',
    cls: 'depth-deep',
    Icon: IconTarget,
    desc: '100% value coverage',
  },
  standard: {
    label: 'Core Review',
    cls: 'depth-standard',
    Icon: IconBook,
    desc: '60% value coverage',
  },
  skim: {
    label: 'Quick Pass',
    cls: 'depth-skim',
    Icon: IconEye,
    desc: '25% value coverage',
  },
}

// ── Executive Summary Metrics ─────────────────────────────────────────────────
function SummaryDashboard({ plan, topics, timeBudget }) {
  const usedTime      = plan.reduce((s, t) => s + t.allocated_minutes, 0)
  const rawTotalTime  = topics.reduce((s, t) => s + (t.time_needed_minutes || 0), 0)
  const pct           = Math.min(100, Math.round((usedTime / timeBudget) * 100))
  const deepCount     = plan.filter((t) => t.depth_level === 'deep').length
  const standardCount = plan.filter((t) => t.depth_level === 'standard').length
  const skimCount     = plan.filter((t) => t.depth_level === 'skim').length

  return (
    <div className="gap-md" style={{ marginBlockEnd: '1.5rem' }}>
      <div className="metrics-grid" style={{ marginBlockEnd: 0 }}>
        <div className="metric-card">
          <div className="metric-label">
            <span>Budget Allocated</span>
            <IconClock />
          </div>
          <div className="metric-value">
            {usedTime} <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {timeBudget}m</span>
          </div>
          <div className="metric-sub">
            {pct}% utilized · {Math.max(0, timeBudget - usedTime)}m buffer
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            <span>Topics Scheduled</span>
            <IconLayers />
          </div>
          <div className="metric-value">
            {plan.length} <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-muted)' }}>of {topics.length}</span>
          </div>
          <div className="metric-sub">
            {rawTotalTime > 0 ? `Compressed from ${rawTotalTime}m raw estimate` : 'Ranked by value density'}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            <span>Deep Dives</span>
            <IconTarget />
          </div>
          <div className="metric-value" style={{ color: 'var(--accent-light)' }}>
            {deepCount}
          </div>
          <div className="metric-sub">
            Full mastery allocation
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            <span>Review &amp; Skim</span>
            <IconBook />
          </div>
          <div className="metric-value" style={{ color: 'var(--amber-light)' }}>
            {standardCount} <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-muted)' }}>core · {skimCount} skim</span>
          </div>
          <div className="metric-sub">
            High-efficiency compression
          </div>
        </div>
      </div>

      <div className="card-subtle gap-xs">
        <div className="row-between">
          <span className="text-sm" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            Time Budget Utilization ({usedTime}m / {timeBudget}m)
          </span>
          <span className="text-muted tabular">{pct}%</span>
        </div>
        <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill" style={{ inlineSize: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

// ── Read-only Plan Topic Card ─────────────────────────────────────────────────
function PlanTopicCard({ topic, idx }) {
  const depth = DEPTH_META[topic.depth_level] || DEPTH_META.standard
  const DepthIcon = depth.Icon
  const impBadge =
    topic.importance >= 8
      ? 'badge-red'
      : topic.importance >= 5
      ? 'badge-amber'
      : 'badge-ghost'

  return (
    <div className="topic-card">
      <div className="row" style={{ flex: '1 1 18rem', minInlineSize: 0 }}>
        <div className="topic-card-rank">{String(idx + 1).padStart(2, '0')}</div>
        <div className="topic-card-body">
          <div className="topic-card-title">{topic.topic}</div>
          <div className="topic-card-meta">
            <span className={`badge ${depth.cls}`}>
              <DepthIcon />
              <span>{depth.label}</span>
            </span>
            <span className={`badge ${impBadge} tabular`}>
              Importance {topic.importance}/10
            </span>
            <span className="badge badge-ghost tabular">
              Difficulty {topic.difficulty}/10
            </span>
          </div>
        </div>
      </div>

      <div className="topic-card-time">
        <span>{topic.allocated_minutes} min</span>
        <span className="text-muted" style={{ fontSize: '0.7rem', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
          allocated
        </span>
      </div>
    </div>
  )
}

// ── Main PlanScreen ───────────────────────────────────────────────────────────
export default function PlanScreen({
  topics, setTopics, plan, timeBudget, contextType,
  onPlanUpdated, onStartSprint, onBack,
}) {
  // Default to 'plan' so the user immediately sees the optimized schedule
  const [subView, setSubView] = useState('plan')
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

  // Topics omitted by knapsack due to tight budget
  const scheduledNames = new Set(plan.map((p) => p.topic))
  const omittedTopics = topics.filter((t) => !scheduledNames.has(t.topic))

  return (
    <div className="workspace-narrow">
      {/* ── Page Header ── */}
      <div className="row-between" style={{ marginBlockEnd: '1.5rem' }}>
        <div className="gap-xs">
          <div className="eyebrow-badge">
            <IconLayers />
            <span>0/1 Knapsack Optimization Result</span>
          </div>
          <h1>
            {subView === 'plan' ? 'Your Optimized Study Plan' : 'Customize Topic Weights'}
          </h1>
          <p className="text-muted">
            {subView === 'plan'
              ? 'Ordered by value-per-minute efficiency to maximize exam & interview recall within your time cap.'
              : 'Remove topics you already know or adjust importance scores, then re-run the solver.'}
          </p>
        </div>

        <div className="row">
          <div className="segmented-tabs" role="tablist" aria-label="Plan view mode">
            <button
              type="button"
              role="tab"
              aria-selected={subView === 'plan'}
              className={`seg-tab ${subView === 'plan' ? 'active' : ''}`}
              onClick={() => setSubView('plan')}
            >
              <IconLayers />
              <span>Sprint Plan ({plan.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subView === 'edit'}
              className={`seg-tab ${subView === 'edit' ? 'active' : ''}`}
              onClick={() => setSubView('edit')}
            >
              <IconSliders />
              <span>Edit Topics ({topics.length})</span>
            </button>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onBack}
            id="back-to-input"
          >
            <IconArrowLeft />
            <span>Change Material</span>
          </button>
        </div>
      </div>

      {/* ── EDIT SUB-VIEW ── */}
      {subView === 'edit' && (
        <div className="gap-lg">
          <TopicEditor topics={topics} onTopicsChange={setTopics} />

          {recalcError && (
            <div className="alert-banner alert-error" role="alert">
              <IconAlertCircle />
              <span>{recalcError}</span>
            </div>
          )}

          <div className="row-between">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSubView('plan')}
              disabled={plan.length === 0}
            >
              Cancel
            </button>
            <button
              type="button"
              id="recalculate-btn"
              className="btn btn-primary btn-lg"
              onClick={handleRecalculate}
              disabled={recalcLoading || topics.length === 0}
            >
              {recalcLoading ? (
                <>
                  <span className="loading-spinner" />
                  <span>Re-optimizing Knapsack Plan…</span>
                </>
              ) : (
                <>
                  <IconBolt />
                  <span>Recalculate Optimal Plan</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── PLAN SUB-VIEW ── */}
      {subView === 'plan' && (
        <div className="gap-lg">
          <SummaryDashboard plan={plan} topics={topics} timeBudget={timeBudget} />

          {/* Primary Launch Bar */}
          <div className="card-glass row-between">
            <div className="gap-xs">
              <h3 style={{ color: 'var(--text-primary)' }}>Ready to start your timed sprint?</h3>
              <p className="text-muted">
                AI study cards and practice quizzes will be generated on-demand for each topic’s allocated depth.
              </p>
            </div>
            <div className="row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSubView('edit')}
              >
                <IconSliders />
                <span>Tune Weights</span>
              </button>
              <button
                type="button"
                id="start-sprint-btn"
                className="btn btn-primary btn-lg"
                onClick={onStartSprint}
              >
                <IconPlay />
                <span>Start Focus Sprint</span>
              </button>
            </div>
          </div>

          {/* Ordered Topic Queue */}
          <div className="gap-sm stagger-children">
            {plan.map((topic, idx) => (
              <PlanTopicCard key={topic.topic} topic={topic} idx={idx} />
            ))}
          </div>

          {/* Omitted topics notice (if budget forced trade-offs) */}
          {omittedTopics.length > 0 && (
            <div className="card-subtle gap-xs">
              <span className="text-sm" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                Deprioritized due to {timeBudget}m budget constraint ({omittedTopics.length}):
              </span>
              <div className="row">
                {omittedTopics.map((t) => (
                  <span key={t.topic} className="badge badge-ghost">
                    {t.topic} (★{t.importance}/10 · {t.time_needed_minutes}m)
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
