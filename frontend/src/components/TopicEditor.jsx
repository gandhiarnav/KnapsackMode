import { useState } from 'react'

/**
 * TopicEditor — Lets users tweak AI-extracted topics before the knapsack runs.
 * - Delete topics they already know
 * - Adjust importance (1-10) and difficulty (1-10) with sliders
 * - Add custom topics the AI missed
 * - Shows live "total time if all studied deep" estimate
 */

function SliderField({ label, value, onChange, color = 'var(--accent)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 120 }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', width: 70, flexShrink: 0 }}>{label}</span>
      <input
        type="range"
        min={1} max={10} step={1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: color, height: 4 }}
      />
      <span style={{
        fontSize: '0.8rem', fontWeight: 700, width: 18, textAlign: 'center',
        color: value >= 8 ? '#ef4444' : value >= 5 ? color : 'var(--text-muted)',
      }}>
        {value}
      </span>
    </div>
  )
}

function TopicRow({ topic, index, onDelete, onUpdate }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        animation: `slideIn 0.25s ease ${index * 0.04}s both`,
      }}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem' }}>
        {/* Drag handle visual */}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'grab', userSelect: 'none' }}>⋮⋮</span>

        {/* Topic name */}
        <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
          {topic.topic}
        </span>

        {/* Quick badges */}
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          ★{topic.importance} · ⚡{topic.difficulty} · ~{topic.time_needed_minutes}m
        </span>

        {/* Expand/collapse sliders */}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.25rem 0.4rem',
            borderRadius: 'var(--radius-sm)',
            transition: 'all 0.15s',
          }}
          title="Adjust scores"
        >
          {expanded ? '▲' : '▼'} Edit
        </button>

        {/* Delete */}
        <button
          onClick={() => onDelete(index)}
          style={{
            background: 'none', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer',
            color: '#ef4444', fontSize: '0.8rem', padding: '0.25rem 0.5rem',
            borderRadius: 'var(--radius-sm)', transition: 'all 0.15s',
          }}
          title="Remove topic"
        >
          ✕
        </button>
      </div>

      {/* Expanded slider panel */}
      {expanded && (
        <div style={{
          padding: '0.75rem 1rem 1rem',
          borderTop: '1px solid var(--border)',
          background: 'rgba(99,102,241,0.03)',
          display: 'flex', flexDirection: 'column', gap: '0.6rem',
        }}>
          <SliderField
            label="Importance"
            value={topic.importance}
            onChange={v => onUpdate(index, 'importance', v)}
            color="var(--amber)"
          />
          <SliderField
            label="Difficulty"
            value={topic.difficulty}
            onChange={v => onUpdate(index, 'difficulty', v)}
            color="var(--accent-light)"
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', width: 70 }}>Time est.</span>
            <input
              type="number"
              min={1} max={120} step={1}
              value={topic.time_needed_minutes}
              onChange={e => onUpdate(index, 'time_needed_minutes', Math.max(1, Number(e.target.value)))}
              style={{
                width: 60, padding: '0.25rem 0.5rem', fontSize: '0.82rem',
                borderRadius: 'var(--radius-sm)',
              }}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>minutes</span>
          </div>
        </div>
      )}
    </div>
  )
}

function AddTopicRow({ onAdd }) {
  const [text, setText] = useState('')
  const [active, setActive] = useState(false)

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onAdd({ topic: trimmed, importance: 5, difficulty: 5, time_needed_minutes: 15 })
    setText('')
    setActive(false)
  }

  if (!active) {
    return (
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setActive(true)}
        style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed' }}
      >
        + Add topic AI missed
      </button>
    )
  }

  return (
    <div style={{
      display: 'flex', gap: '0.5rem', alignItems: 'center',
      padding: '0.5rem', background: 'var(--bg-card)',
      border: '1px solid var(--accent)', borderRadius: 'var(--radius-md)',
    }}>
      <input
        autoFocus
        type="text"
        placeholder="Topic name…"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setActive(false) }}
        style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.9rem' }}
      />
      <button className="btn btn-primary btn-sm" onClick={submit}>Add</button>
      <button className="btn btn-ghost btn-sm" onClick={() => setActive(false)}>✕</button>
    </div>
  )
}

export default function TopicEditor({ topics, onTopicsChange }) {
  const handleDelete = (idx) => {
    onTopicsChange(topics.filter((_, i) => i !== idx))
  }

  const handleUpdate = (idx, field, value) => {
    onTopicsChange(topics.map((t, i) => i === idx ? { ...t, [field]: value } : t))
  }

  const handleAdd = (newTopic) => {
    onTopicsChange([...topics, newTopic])
  }

  // Live stats
  const totalTopics = topics.length
  const avgImportance = totalTopics ? (topics.reduce((s, t) => s + t.importance, 0) / totalTopics).toFixed(1) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Mini stats bar */}
      <div style={{
        display: 'flex', gap: '1.5rem', padding: '0.5rem 0.75rem',
        background: 'rgba(99,102,241,0.06)', borderRadius: 'var(--radius-sm)',
        fontSize: '0.78rem', color: 'var(--text-muted)',
      }}>
        <span><strong style={{ color: 'var(--accent-light)' }}>{totalTopics}</strong> topics</span>
        <span>avg importance <strong style={{ color: 'var(--amber)' }}>{avgImportance}</strong>/10</span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
          Click ▼ Edit on any row to adjust scores
        </span>
      </div>

      {/* Topic rows */}
      {topics.map((topic, idx) => (
        <TopicRow
          key={`${topic.topic}-${idx}`}
          topic={topic}
          index={idx}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
        />
      ))}

      {/* Add topic */}
      <AddTopicRow onAdd={handleAdd} />
    </div>
  )
}
