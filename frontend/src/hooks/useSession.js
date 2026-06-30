import { useEffect, useRef } from 'react'

const SESSION_KEY = 'knapsack_session'

/**
 * useSession — Persists app state to localStorage with debouncing.
 * Returns { saveSession, loadSession, clearSession }.
 */
export function useSession() {
  const debounceTimer = useRef(null)

  const saveSession = (state) => {
    // Debounce saves to avoid hammering localStorage on every keystroke
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
          ...state,
          savedAt: Date.now(),
        }))
      } catch {
        // localStorage full or unavailable — silently skip
      }
    }, 400)
  }

  const loadSession = () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return null
      const session = JSON.parse(raw)
      // Expire sessions older than 24 hours
      if (Date.now() - session.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(SESSION_KEY)
        return null
      }
      return session
    } catch {
      return null
    }
  }

  const clearSession = () => {
    clearTimeout(debounceTimer.current)
    try { localStorage.removeItem(SESSION_KEY) } catch {}
  }

  // Cleanup on unmount
  useEffect(() => () => clearTimeout(debounceTimer.current), [])

  return { saveSession, loadSession, clearSession }
}
