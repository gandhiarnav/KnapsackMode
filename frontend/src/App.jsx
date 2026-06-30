import { useState, useEffect } from 'react'
import './index.css'
import InputScreen from './screens/InputScreen'
import PlanScreen from './screens/PlanScreen'
import SprintScreen from './screens/SprintScreen'
import { useSession } from './hooks/useSession'

/**
 * App — Top-level state machine with session persistence and view transitions.
 * Views: input → plan → sprint
 */
export default function App() {
  const { saveSession, loadSession, clearSession } = useSession()

  const [view, setView] = useState('input')

  // Study material & constraints
  const [rawText, setRawText]       = useState('')
  const [timeBudget, setTimeBudget] = useState(45)
  const [contextType, setContextType] = useState('exam') // 'exam' | 'interview'

  // AI-extracted topics (editable list)
  const [topics, setTopics] = useState([])

  // Knapsack plan
  const [plan, setPlan] = useState([])

  // Resume banner: set when a saved session is found on mount
  const [resumeSession, setResumeSession] = useState(null)

  // ── Load saved session on mount ────────────────────────────────────────────
  useEffect(() => {
    const saved = loadSession()
    if (saved && (saved.topics?.length > 0 || saved.plan?.length > 0)) {
      setResumeSession(saved)
    }
  }, [])

  // ── Auto-save whenever key state changes ───────────────────────────────────
  useEffect(() => {
    if (view === 'input' && !rawText && topics.length === 0) return // nothing worth saving
    saveSession({ view, rawText, timeBudget, contextType, topics, plan })
  }, [view, rawText, timeBudget, contextType, topics, plan])

  // ── Transition helper (View Transitions API with graceful fallback) ─────────
  const transition = (fn) => {
    if (document.startViewTransition) {
      document.startViewTransition(fn)
    } else {
      fn()
    }
  }

  // ── Event handlers ─────────────────────────────────────────────────────────
  const handlePlanReady = (extractedTopics, allocatedPlan) => {
    setTopics(extractedTopics)
    setPlan(allocatedPlan)
    transition(() => setView('plan'))
  }

  const handlePlanUpdated = (newPlan) => {
    setPlan(newPlan)
  }

  const handleStartSprint = () => transition(() => setView('sprint'))

  const handleRestart = () => {
    clearSession()
    setResumeSession(null)
    transition(() => {
      setView('input')
      setTopics([])
      setPlan([])
    })
  }

  const handleResume = () => {
    if (!resumeSession) return
    setRawText(resumeSession.rawText || '')
    setTimeBudget(resumeSession.timeBudget || 45)
    setContextType(resumeSession.contextType || 'exam')
    setTopics(resumeSession.topics || [])
    setPlan(resumeSession.plan || [])
    transition(() => setView(resumeSession.view === 'sprint' ? 'sprint' : 'plan'))
    setResumeSession(null)
  }

  const handleDismissResume = () => {
    clearSession()
    setResumeSession(null)
  }

  return (
    <>
      {view === 'input' && (
        <InputScreen
          rawText={rawText}
          setRawText={setRawText}
          timeBudget={timeBudget}
          setTimeBudget={setTimeBudget}
          contextType={contextType}
          setContextType={setContextType}
          onPlanReady={handlePlanReady}
          resumeSession={resumeSession}
          onResume={handleResume}
          onDismissResume={handleDismissResume}
        />
      )}
      {view === 'plan' && (
        <PlanScreen
          topics={topics}
          setTopics={setTopics}
          plan={plan}
          timeBudget={timeBudget}
          contextType={contextType}
          onPlanUpdated={handlePlanUpdated}
          onStartSprint={handleStartSprint}
          onBack={() => transition(() => setView('input'))}
        />
      )}
      {view === 'sprint' && (
        <SprintScreen
          topics={topics}
          initialPlan={plan}
          totalBudget={timeBudget}
          contextType={contextType}
          onRestart={handleRestart}
        />
      )}
    </>
  )
}
