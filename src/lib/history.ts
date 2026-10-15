/**
 * The week, from the diary: how much glycemic load each day used against the budget, and which days
 * were in range. This is the product's north-star metric (docs/PRD.md), counted in one place.
 *
 * A day is IN RANGE when at least three distinct meal slots were logged, no entry lacks a glycemic
 * load (a packaged or unrated food holds carbohydrate but no load, rule 4), and the day's load is at
 * or under the budget. An estimate (a dish counted from an assumed recipe) does not stop a day from
 * counting; the day says so.
 *
 * Pure and tested (npm run eval). It describes; it does not score. A day with nothing logged is not
 * "good" or "bad", it is not logged; and a day too thin to judge is named, not counted.
 */
import { addDays, eaten, viewEntry } from './diary'
import type { DiaryEntry } from '../types'

/** The PRD's "eating occasions": distinct meal slots, not entries. */
export const MIN_SLOTS = 3

export type DayStatus = 'none' | 'over' | 'carbs_only' | 'thin' | 'in_range'

export interface DayPoint {
  date: string
  /** "Mon", "Tue"... in the person's own calendar. */
  label: string
  used: number
  logged: boolean
  /** Part of the day is carbohydrate only: the load above is what could be counted. */
  partial: boolean
  /** Distinct meal slots with an entry, 0 to 4. */
  slots: number
  /** Some entry is a dish counted from an assumed recipe. */
  estimate: boolean
  status: DayStatus
  /** `status === 'in_range'`: the one field every count reads. */
  inRange: boolean
}

export interface WeekSummary {
  days: DayPoint[]
  loggedDays: number
  inRangeDays: number
  thinDays: number
  carbsOnlyDays: number
}

/** `ago` 0 is the week ending today, 1 the week before it. */
export interface WeekBlock extends WeekSummary { ago: number }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function statusOf(logged: boolean, used: number, glBudget: number, partial: boolean, slots: number): DayStatus {
  if (!logged) return 'none'
  if (used > glBudget) return 'over'
  if (partial) return 'carbs_only'
  if (slots < MIN_SLOTS) return 'thin'
  return 'in_range'
}

function summarize(byDate: Map<string, DiaryEntry[]>, glBudget: number, today: string): WeekSummary {
  const [y, m, d] = today.split('-').map(Number)
  const end = new Date(y, m - 1, d)
  const days: DayPoint[] = []
  for (let back = 6; back >= 0; back--) {
    const day = new Date(end.getFullYear(), end.getMonth(), end.getDate() - back)
    const date = iso(day)
    const raw = byDate.get(date) ?? []
    const entries = raw.map(viewEntry)
    const used = Math.round(entries.reduce((s, e) => s + e.gl, 0) * 10) / 10
    const logged = entries.length > 0
    const partial = entries.some((e) => !e.loadAvailable)
    const slots = new Set(raw.map((e) => e.meal)).size
    const status = statusOf(logged, used, glBudget, partial, slots)
    days.push({
      date, label: day.toLocaleDateString('en-US', { weekday: 'short' }), used, logged, partial, slots,
      estimate: raw.some((e) => e.snapshot?.assumed === true), status, inRange: status === 'in_range',
    })
  }
  const count = (s: DayStatus) => days.filter((x) => x.status === s).length
  return { days, loggedDays: days.filter((x) => x.logged).length, inRangeDays: count('in_range'), thinDays: count('thin'), carbsOnlyDays: count('carbs_only') }
}

// Only what was eaten counts: a planned meal is a promise, not a log.
const group = (diary: DiaryEntry[]) => {
  const byDate = new Map<string, DiaryEntry[]>()
  for (const e of eaten(diary)) {
    const list = byDate.get(e.date)
    if (list) list.push(e); else byDate.set(e.date, [e])
  }
  return byDate
}

/** `today` is the person's own date (YYYY-MM-DD); the week ends on it and starts six days before. */
export function weekSummary(diary: DiaryEntry[], glBudget: number, today: string): WeekSummary {
  return summarize(group(diary), glBudget, today)
}

/**
 * `count` consecutive weeks, newest first. Block `ago` covers `today - (7·ago + 6)` through
 * `today - 7·ago`, so block 0 is `weekSummary` and the blocks tile the last 28 days without overlap.
 */
export function weeksSummary(diary: DiaryEntry[], glBudget: number, today: string, count = 4): WeekBlock[] {
  const byDate = group(diary)
  return Array.from({ length: count }, (_, ago) => ({ ago, ...summarize(byDate, glBudget, addDays(today, -7 * ago)) }))
}
