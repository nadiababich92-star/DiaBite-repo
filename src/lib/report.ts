/**
 * The weekly report: how the people testing DiaBite are using it, from the diary and the feedback table.
 *
 * Pure arithmetic; `scripts/report.ts` does the fetching. A day is in range by the same function the Diary uses
 * (`weekSummary`), so the number in this report and the number a person sees on their own screen cannot differ.
 * Only eaten meals count: a planned meal is a promise, not a log. Nothing here names a person: people are
 * numbered by sign-up order and the output carries no email, name or id.
 */
import { addDays, eaten } from './diary'
import { weekSummary } from './history'
import type { DiaryEntry } from '../types'

export interface AccountInput {
  createdAt: string
  /** The profile row exists and its data says onboarding is done. */
  onboarded: boolean
  glBudget: number
  /** Every entry of this person, planned ones included. */
  diary: DiaryEntry[]
}
export interface FeedbackInput { createdAt: string; rating: number; context: string | null; text: string }
export interface TurnStats {
  turns: number; verifiedRate: number; p50ms: number; p90ms: number
  blocked: number; regenerated: number; unknownShare: number; clarifyShare: number
  /** Typed questions that held a food we do not have, deduplicated, at most 50. */
  unknownQuestions: string[]
}
export interface ReportInput { today: string; accounts: AccountInput[]; feedback: FeedbackInput[]; turns: TurnStats | null }

export interface PersonRow {
  /** 1, 2, 3 … in order of sign-up. */
  n: number
  onboarded: boolean
  firstMealDate: string | null
  mealSlots7: number
  inRangeDays7: number
  loggedDays7: number
  /** null while fewer than 2 (or 7) days have passed since the first meal. */
  returnedWithin2: boolean | null
  returnedWithin7: boolean | null
}
export interface Retention { eligible: number; returned: number }
export interface Report {
  today: string
  signedUp: number; onboarded: number; firstMeal: number; active7: number
  retention: { within2: Retention; within7: Retention }
  mealSlots7Median: number | null; inRangeDays7Median: number | null
  people: PersonRow[]
  feedback: {
    count: number; average: number | null; byContext: Record<string, number>
    comments: { createdAt: string; rating: number; context: string | null; text: string }[]
  }
  turns: TurnStats | null
}

const one = (x: number) => Math.round(x * 10) / 10

export function median(values: number[]): number | null {
  if (!values.length) return null
  const v = [...values].sort((a, b) => a - b)
  const mid = Math.floor(v.length / 2)
  return one(v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2)
}

function person(a: AccountInput, n: number, today: string): PersonRow {
  const ate = eaten(a.diary)
  const firstMealDate = ate.reduce<string | null>((f, e) => (f === null || e.date < f ? e.date : f), null)
  const from = addDays(today, -6)
  const slots = new Set(ate.filter((e) => e.date >= from && e.date <= today).map((e) => `${e.date}|${e.meal}`))
  const week = weekSummary(ate, a.glBudget, today)
  const returned = (days: number): boolean | null => {
    if (!firstMealDate || today < addDays(firstMealDate, days)) return null
    const limit = addDays(firstMealDate, days)
    return ate.some((e) => e.date > firstMealDate && e.date <= limit)
  }
  return {
    n, onboarded: a.onboarded, firstMealDate, mealSlots7: slots.size,
    inRangeDays7: week.inRangeDays, loggedDays7: week.loggedDays,
    returnedWithin2: returned(2), returnedWithin7: returned(7),
  }
}

export function buildReport(input: ReportInput): Report {
  const { today } = input
  const ordered = [...input.accounts].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const people = ordered.map((a, i) => person(a, i + 1, today))
  const active = people.filter((p) => p.mealSlots7 > 0)
  const retention = (pick: (p: PersonRow) => boolean | null): Retention => {
    const eligible = people.filter((p) => pick(p) !== null)
    return { eligible: eligible.length, returned: eligible.filter((p) => pick(p) === true).length }
  }
  const byContext: Record<string, number> = {}
  for (const f of input.feedback) { const k = f.context ?? 'form'; byContext[k] = (byContext[k] ?? 0) + 1 }
  const comments = [...input.feedback].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return {
    today,
    signedUp: people.length,
    onboarded: people.filter((p) => p.onboarded).length,
    firstMeal: people.filter((p) => p.firstMealDate !== null).length,
    active7: active.length,
    retention: { within2: retention((p) => p.returnedWithin2), within7: retention((p) => p.returnedWithin7) },
    mealSlots7Median: median(active.map((p) => p.mealSlots7)),
    inRangeDays7Median: median(active.map((p) => p.inRangeDays7)),
    people,
    feedback: {
      count: input.feedback.length,
      average: input.feedback.length ? one(input.feedback.reduce((s, f) => s + f.rating, 0) / input.feedback.length) : null,
      byContext,
      comments: comments.map((f) => ({ createdAt: f.createdAt, rating: f.rating, context: f.context, text: f.text })),
    },
    turns: input.turns,
  }
}

const yn = (v: boolean | null) => (v === null ? 'not yet' : v ? 'yes' : 'no')

export function reportMarkdown(r: Report): string {
  const out: string[] = []
  const ret = (x: Retention) => `${x.returned} of ${x.eligible}`
  out.push(`# DiaBite weekly report, ${r.today}`, '')
  out.push('## People', '',
    `- Signed up: ${r.signedUp}`, `- Finished the setup: ${r.onboarded}`,
    `- Logged a first meal: ${r.firstMeal}`, `- Active in the last 7 days: ${r.active7}`, '')
  out.push('## Coming back', '',
    `- Within 2 days of the first meal: ${ret(r.retention.within2)}`,
    `- Within 7 days of the first meal: ${ret(r.retention.within7)}`, '')
  out.push('## Use in the last 7 days', '',
    `- Meal slots logged, median: ${r.mealSlots7Median ?? 'no one yet'}`,
    `- Days in range, median: ${r.inRangeDays7Median ?? 'no one yet'}`, '')
  out.push('| # | Setup done | First meal | Meal slots | Days in range | Days logged | Back in 2 days | Back in 7 days |', '|---|---|---|---|---|---|---|---|')
  for (const p of r.people) {
    out.push(`| ${p.n} | ${p.onboarded ? 'yes' : 'no'} | ${p.firstMealDate ?? 'none'} | ${p.mealSlots7} | ${p.inRangeDays7} | ${p.loggedDays7} | ${yn(p.returnedWithin2)} | ${yn(p.returnedWithin7)} |`)
  }
  out.push('', '## Feedback', '',
    `- Answers: ${r.feedback.count}`, `- Average rating: ${r.feedback.average ?? 'none yet'}`,
    `- By moment: ${Object.entries(r.feedback.byContext).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`, '')
  for (const c of r.feedback.comments) out.push(`- ${c.createdAt.slice(0, 10)}, ${c.rating}/5, ${c.context ?? 'form'}: ${c.text}`)
  out.push('', '## The agent', '')
  if (r.turns) {
    const t = r.turns
    out.push(`- Turns: ${t.turns}`, `- Verified: ${t.verifiedRate}%`, `- Median ${t.p50ms} ms, 90th percentile ${t.p90ms} ms`,
      `- Blocked by a rule: ${t.blocked}`, `- Answer regenerated: ${t.regenerated}`,
      `- Turns with a food we do not have: ${t.unknownShare}%`, `- Clarifying questions: ${t.clarifyShare}%`, '',
      '## Typed questions with a food we do not have', '')
    for (const q of t.unknownQuestions) out.push(`- ${q}`)
    if (!t.unknownQuestions.length) out.push('- none')
  } else out.push('The turn log could not be read.')
  out.push('', 'Numbered by sign-up order. No email or name is in this file.')
  return out.join('\n') + '\n'
}
