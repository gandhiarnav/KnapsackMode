// PlanScreen — Shows the knapsack-optimized sprint plan before starting

const DEPTH_LABELS = {
  deep:     { label: 'Deep Dive',   cls: 'depth-deep',     icon: '🔬' },
  standard: { label: 'Core Review', cls: 'depth-standard', icon: '📖' },
  skim:     { label: 'Quick Pass',  cls: 'depth-skim',     icon: '👀' },
}

function ImportanceBadge({ value }) {
  const color = value >= 8 ? '#ef4444' : value >= 5 ? '#f59e0b' : '#94a3b8'
  return (
    <span className="badge" style={{ background: `${color}1a`, color, borderColor: `${color}4d`, fontSize: '0.7rem' }}>
      ★ {value}
    </span>
  )
}

function DifficultyBadge({ value }) {
  const color = value >= 8 ? '#a78bfa' : value >= 5 ? '#60a5fa' : '#94a3b8'
  return (
    <span className="badge badge-ghost" style={{ fontSize: '0.7rem' }}>
      ⚡ {value}
    </span>
  )
}

function SummaryBar({ plan, timeBudget }) {
  const usedTime = plan.reduce((s, t) => s + t.allocated_minutes, 0)
  const pct = Math.round((usedTime / timeBudget) * 100)
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
          <div className="stat-label">of {timeBudget} min used</div>
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
          <span className="text-muted">{pct}% of your time budget allocated</span>
          <span className="text-muted">{timeBudget - usedTime} min buffer</span>
        </div>
      </div>
    </div>
  )
}

export default function PlanScreen({ plan, timeBudget, onStartSprint, onBack }) {
  return (
    <div className="page">
      {/* Header */}
      <div className="row-between" style={{ marginBottom: '1.5rem' }}>
        <div>
          <div className="row" style={{ gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🎯</span>
            <h2>Your Optimized Sprint Plan</h2>
          </div>
          <p className="text-muted text-sm">
            Knapsack algorithm selected the best depth for each topic to maximize coverage within your time budget.
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onBack} id="back-to-input">
          ← Edit Material
        </button>
      </div>

      {/* Summary stats */}
      <SummaryBar plan={plan} timeBudget={timeBudget} />

      {/* Algorithmic note */}
      <div className="card-glass" style={{ marginBottom: '1.5rem', padding: '0.875rem 1.25rem' }}>
        <p className="text-sm" style={{ color: 'var(--accent-light)' }}>
          <strong>How this was built:</strong>{' '}
          <span style={{ color: 'var(--text-secondary)' }}>
            Topics sorted by importance-density (importance ÷ minutes). Each topic was expanded
            into 3 depth levels (skim/standard/deep) and a 0/1 DP knapsack selected the optimal
            combination — not an even split.
          </span>
        </p>
      </div>

      {/* Topic list */}
      <div className="gap-sm stagger-children" style={{ marginBottom: '2rem' }}>
        {plan.map((topic, idx) => {
          const depth = DEPTH_LABELS[topic.depth_level] || DEPTH_LABELS.standard
          return (
            <div key={topic.topic} className="topic-card">
              <div className="topic-card-rank">#{idx + 1}</div>
              <div className="topic-card-body">
                <div className="topic-card-title">{topic.topic}</div>
                <div className="topic-card-meta">
                  <span className={`badge ${depth.cls}`}>
                    {depth.icon} {depth.label}
                  </span>
                  <ImportanceBadge value={topic.importance} />
                  <DifficultyBadge value={topic.difficulty} />
                </div>
              </div>
              <div className="topic-card-time">{topic.allocated_minutes}m</div>
            </div>
          )
        })}
      </div>

      {/* CTA */}
      <button
        id="start-sprint-btn"
        className="btn btn-primary btn-lg"
        onClick={onStartSprint}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        🚀 Start Sprint
      </button>
    </div>
  )
}
