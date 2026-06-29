import { useState } from 'react'
import './index.css'
import InputScreen from './screens/InputScreen'
import PlanScreen from './screens/PlanScreen'
import SprintScreen from './screens/SprintScreen'

/**
 * App — Top-level state machine.
 * Three views: input → plan → sprint
 * All shared state lives here and is passed down as props.
 */
export default function App() {
  const [view, setView] = useState('input') // 'input' | 'plan' | 'sprint'

  // Raw study material and constraints
  const [rawText, setRawText] = useState('')
  const [timeBudget, setTimeBudget] = useState(45)

  // Extracted topics from LLM (full list, including ones not in plan)
  const [topics, setTopics] = useState([])

  // Knapsack-optimized plan
  const [plan, setPlan] = useState([])

  const handlePlanReady = (extractedTopics, allocatedPlan) => {
    setTopics(extractedTopics)
    setPlan(allocatedPlan)
    setView('plan')
  }

  const handleStartSprint = () => setView('sprint')

  const handleRestart = () => {
    setView('input')
    setTopics([])
    setPlan([])
  }

  return (
    <>
      {view === 'input' && (
        <InputScreen
          rawText={rawText}
          setRawText={setRawText}
          timeBudget={timeBudget}
          setTimeBudget={setTimeBudget}
          onPlanReady={handlePlanReady}
        />
      )}
      {view === 'plan' && (
        <PlanScreen
          topics={topics}
          plan={plan}
          timeBudget={timeBudget}
          onStartSprint={handleStartSprint}
          onBack={() => setView('input')}
        />
      )}
      {view === 'sprint' && (
        <SprintScreen
          topics={topics}
          initialPlan={plan}
          totalBudget={timeBudget}
          onRestart={handleRestart}
        />
      )}
    </>
  )
}
