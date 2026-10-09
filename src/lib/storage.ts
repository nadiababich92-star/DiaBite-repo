import type { DiaryEntry, Profile } from '../types'
import { FOODS } from '../data/foods'
import { DEFAULT_PROFILE } from './profile'

const PROFILE_KEY = 'diabite.profile.v1'
const DIARY_KEY = 'diabite.diary.v1'

/**
 * localStorage can be unavailable (private window, site data blocked), so every
 * access is guarded - the app must work even when nothing can be saved.
 */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Swallowed on purpose: failing to persist must not break the flow.
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * What was stored is whatever an older build, a browser extension or a person
 * with devtools left there, so it is checked before anything reads it: a
 * profile field of the wrong type falls back to the default, and a list that is
 * not a list becomes empty. Without this, one bad value blanks the app on load.
 */
export function sanitizeProfile(stored: unknown): Profile {
  const base = { ...DEFAULT_PROFILE }
  if (!isObj(stored)) return base
  const out: Record<string, unknown> = { ...base }
  for (const [key, def] of Object.entries(base)) {
    const v = stored[key]
    if (v === undefined) continue
    if (Array.isArray(def)) { if (Array.isArray(v) && v.every((x) => typeof x === 'string')) out[key] = v; continue }
    if (typeof def === 'number') { if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[key] = v; continue }
    if (typeof def === 'string') { if (typeof v === 'string') out[key] = v; continue }
    if (typeof def === 'boolean') { if (typeof v === 'boolean') out[key] = v }
  }
  return out as unknown as Profile
}

/** A diary entry the app can render: known food or a stored snapshot, a real weight, a real date. */
function usableEntry(e: unknown): e is DiaryEntry {
  if (!isObj(e)) return false
  if (typeof e.id !== 'string' || typeof e.date !== 'string' || typeof e.foodId !== 'string') return false
  if (typeof e.grams !== 'number' || !Number.isFinite(e.grams) || e.grams <= 0) return false
  return isObj(e.snapshot) || FOODS.some((f) => f.id === e.foodId)
}

export const loadProfile = (): Profile => sanitizeProfile(read<unknown>(PROFILE_KEY, {}))
export const saveProfile = (p: Profile): void => write(PROFILE_KEY, p)

export const loadDiary = (): DiaryEntry[] => {
  const stored = read<unknown>(DIARY_KEY, [])
  return Array.isArray(stored) ? stored.filter(usableEntry) : []
}
export const saveDiary = (entries: DiaryEntry[]): void => write(DIARY_KEY, entries)

/**
 * The person's own calendar day. `toISOString()` is UTC, which for a user in
 * Los Angeles turns to tomorrow at 17:00 — the day's budget would silently
 * reset in the middle of dinner.
 */
export const todayISO = (): string => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
