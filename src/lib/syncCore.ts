/**
 * The parts of the account sync that need no network: how a diary entry becomes a row
 * and back, what changed since the server last agreed, and how two lists merge. Kept
 * apart from `sync.ts` so the engine suite can test them without a browser or Supabase.
 */
import type { DiaryEntry, MealType, Profile } from '../types'

export const CONSENT_VERSION = '2026-10-draft'
export const PENDING_KEY = 'diabite.pending.v1'
export const LEGACY_DIARY_KEY = 'diabite.legacy.diary.v1'

// ── Rows and entries, both ways ───────────────────────────────────────────

export interface DiaryRow {
  user_id: string; id: string; day: string; meal: string; food_id: string; grams: number
  snapshot: DiaryEntry['snapshot'] | null; updated_at: string
}

export const toRow = (userId: string, e: DiaryEntry, now = new Date().toISOString()): DiaryRow => ({
  user_id: userId, id: e.id, day: e.date, meal: e.meal, food_id: e.foodId, grams: e.grams,
  snapshot: e.snapshot ?? null, updated_at: now,
})

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

/** A row from the table back to an entry; a row the app cannot read is dropped, never rendered. */
export function fromRow(r: Partial<DiaryRow>): DiaryEntry | null {
  if (typeof r.id !== 'string' || typeof r.day !== 'string' || typeof r.food_id !== 'string') return null
  const grams = Number(r.grams)
  if (!Number.isFinite(grams) || grams <= 0 || !MEALS.includes(r.meal as MealType)) return null
  return { id: r.id, date: r.day, meal: r.meal as MealType, foodId: r.food_id, grams, ...(r.snapshot ? { snapshot: r.snapshot } : {}) }
}

/** What changed since the last time the server agreed: new or edited entries, and removed ids. */
export function diffEntries(synced: Map<string, string>, entries: DiaryEntry[]): { upsert: DiaryEntry[]; remove: string[] } {
  const ids = new Set(entries.map((e) => e.id))
  return {
    upsert: entries.filter((e) => synced.get(e.id) !== JSON.stringify(e)),
    remove: [...synced.keys()].filter((id) => !ids.has(id)),
  }
}

/** Merge two lists by id; where both have an id, the later `updatedAt` wins (the second wins a tie). */
export function mergeById<T extends { id: string }>(a: T[], b: T[], at: (x: T) => string): T[] {
  const out = new Map(a.map((x) => [x.id, x]))
  for (const x of b) {
    const prev = out.get(x.id)
    if (!prev || at(x) >= at(prev)) out.set(x.id, x)
  }
  return [...out.values()]
}

export interface AccountExport {
  exportedAt: string
  email?: string
  consent: { at: string | null; version: string | null }
  profile: Profile | null
  diary: DiaryEntry[]
}

export const exportShape = (x: AccountExport) => Object.keys(x).sort().join(',')

