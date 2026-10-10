/**
 * The last seven days, from the diary: how much glycemic load each day used against the
 * budget, and how many of the days that were logged stayed within it.
 *
 * Pure and tested (npm run eval). It describes; it does not score. A day with nothing
 * logged is not "good" or "bad", it is not logged; and a day that holds a packaged food
 * (carbohydrate counted, no load available) says so, because its load is understated.
 */
import { viewEntry } from './diary'
import type { DiaryEntry } from '../types'

export interface DayPoint {
  date: string
  /** "Mon", "Tue"... in the person's own calendar. */
  label: string
  used: number
  logged: boolean
  /** Part of the day is carbohydrate only: the load above is what could be counted. */
  partial: boolean
  within: boolean
}

export interface WeekSummary { days: DayPoint[]; loggedDays: number; withinDays: number }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** `today` is the person's own date (YYYY-MM-DD); the week ends on it and starts six days before. */
export function weekSummary(diary: DiaryEntry[], glBudget: number, today: string): WeekSummary {
  const [y, m, d] = today.split('-').map(Number)
  const end = new Date(y, m - 1, d)
  const days: DayPoint[] = []
  for (let back = 6; back >= 0; back--) {
    const day = new Date(end.getFullYear(), end.getMonth(), end.getDate() - back)
    const date = iso(day)
    const entries = diary.filter((e) => e.date === date).map(viewEntry)
    const used = Math.round(entries.reduce((s, e) => s + e.gl, 0) * 10) / 10
    days.push({
      date, label: day.toLocaleDateString('en-US', { weekday: 'short' }), used,
      logged: entries.length > 0, partial: entries.some((e) => !e.loadAvailable), within: entries.length > 0 && used <= glBudget,
    })
  }
  return { days, loggedDays: days.filter((x) => x.logged).length, withinDays: days.filter((x) => x.within).length }
}
