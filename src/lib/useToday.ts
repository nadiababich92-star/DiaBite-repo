import { useEffect, useState } from 'react'
import { todayISO } from './storage'

/**
 * The person's own date, kept current. A tab left open overnight would otherwise show
 * yesterday's budget until something happened to redraw it: this updates at local midnight
 * and whenever the tab comes back into view (a phone that slept through the night).
 */
export function useToday(): string {
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    const refresh = () => setToday(todayISO())
    const now = new Date()
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
    const timer = setTimeout(refresh, Math.max(1000, nextMidnight - now.getTime() + 1000))
    document.addEventListener('visibilitychange', refresh)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [today])
  return today
}
