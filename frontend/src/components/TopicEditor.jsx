import { useState } from 'react'
import {
  IconSliders,
  IconTrash,
  IconPlus,
  IconChevronDown,
  IconChevronUp,
  IconClock,
  IconX,
} from './Icons'

/**
 * TopicEditor — Allows users to curate AI-extracted topics before re-running the knapsack solver:
 * - Remove topics they already know
 * - Adjust importance (1-10), difficulty (1-10), and estimated minutes
 * - Add custom topics
 */

function SliderField({ id, label, value, onChange }) {
  return (
    <div className="form-field">
      <label htmlFor={id} className="field-label">
        <span>{label}</span>
        <span className="badge badge-ghost tabular">{value} / 10</span>
      </label>
      <input
        id={id}
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

function TopicRow({ topic, index, onDelete, onUpdate }) {
  const [expanded, setExpanded] = useState(false)

  const impBadgeClass =
    topic.importance >= 8
      ? 'badge-red'
      : topic.importance >= 5
      ? 'badge-amber'
      : 'badge-ghost'

  return (
    <div className="editor-row">
      <div className="editor-row-header">
        <span className="topic-card-rank">{String(index + 1).padStart(2, '0')}</span>

        <div className="topic-card-body">
          <div className="topic-card-title">{topic.topic}</div>
        </div>

        <div className="row">
          <span className={`badge ${impBadgeClass} tabular`}>
            Importance {topic.importance}/10
          </span>
          <span className="badge badge-ghost tabular">
            Difficulty {topic.difficulty}/10
          </span>
          <span className="badge badge-accent tabular">
            <IconClock />
            <span>{topic.time_needed_minutes}m est.</span>
          </span>
        </div>

        <div className="row">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
          >
            <IconSliders />
            <span>Adjust</span>
            {expanded ? <IconChevronUp /> : <IconChevronDown />}
          </button>

          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => onDelete(index)}
            aria-label={`Remove topic ${topic.topic}`}
          >
            <IconTrash />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="editor-row-controls">
          <SliderField
            id={`imp-${index}`}
            label="Exam / Interview Importance"
            value={topic.importance}
            onChange={(v) => onUpdate(index, 'importance', v)}
          />

          <SliderField
            id={`diff-${index}`}
            label="Concept Difficulty"
            value={topic.difficulty}
            onChange={(v) => onUpdate(index, 'difficulty', v)}
          />

          <div className="form-field">
            <label htmlFor={`time-${index}`} className="field-label">
              <span>Full Study Time (Minutes)</span>
            </label>
            <input
              id={`time-${index}`}
              type="number"
              min={1}
              max={120}
              step={1}
              value={topic.time_needed_minutes}
              onChange={(e) =>
                onUpdate(index, 'time_needed_minutes', Math.max(1, Number(e.target.value)))
              }
            />
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
    onAdd({ topic: trimmed, importance: 7, difficulty: 5, time_needed_minutes: 15 })
    setText('')
    setActive(false)
  }

  if (!active) {
    return (
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => setActive(true)}
      >
        <IconPlus />
        <span>Add Custom Topic</span>
      </button>
    )
  }

  return (
    <div className="card-subtle row-between">
      <input
        autoFocus
        type="text"
        aria-label="New topic name"
        placeholder="Enter topic name (e.g., Dynamic Programming on Trees)..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') setActive(false)
        }}
        style={{ flex: '1 1 16rem' }}
      />
      <div className="row">
        <button type="button" className="btn btn-primary btn-sm" onClick={submit}>
          <IconPlus />
          <span>Add Topic</span>
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setActive(false)}
          aria-label="Cancel adding topic"
        >
          <IconX />
        </button>
      </div>
    </div>
  )
}

export default function TopicEditor({ topics, onTopicsChange }) {
  const handleDelete = (idx) => {
    onTopicsChange(topics.filter((_, i) => i !== idx))
  }

  const handleUpdate = (idx, field, value) => {
    onTopicsChange(topics.map((t, i) => (i === idx ? { ...t, [field]: value } : t)))
  }

  const handleAdd = (newTopic) => {
    onTopicsChange([...topics, newTopic])
  }

  const totalTopics = topics.length
  const totalRawTime = topics.reduce((s, t) => s + (t.time_needed_minutes || 0), 0)
  const avgImportance = totalTopics
    ? (topics.reduce((s, t) => s + t.importance, 0) / totalTopics).toFixed(1)
    : 0

  return (
    <div className="gap-sm">
      <div className="preset-bar">
        <div className="row">
          <span className="badge badge-accent tabular">{totalTopics} extracted topics</span>
          <span className="badge badge-ghost tabular">Avg importance: {avgImportance}/10</span>
          <span className="badge badge-amber tabular">Uncompressed time: {totalRawTime}m</span>
        </div>
        <span className="text-muted">
          Remove topics you already know or tune weights before re-optimizing
        </span>
      </div>

      <div className="gap-sm stagger-children">
        {topics.map((topic, idx) => (
          <TopicRow
            key={`${topic.topic}-${idx}`}
            topic={topic}
            index={idx}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
          />
        ))}
      </div>

      <AddTopicRow onAdd={handleAdd} />
    </div>
  )
}
