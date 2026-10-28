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

/**
 * Signing out clears the device while the screen still holds the account's diary for one more render, and its
 * save effect would put that diary straight back into the storage that was just emptied: the next person to
 * sign in on this browser would be offered it as their own. So clearing freezes writes, and the app thaws them
 * once the screen has been reset.
 */
let frozen = false
export const thawWrites = (): void => { frozen = false }

/** Every key this app keeps on the device. Signing out removes all of them, and nothing is written until `thawWrites`. */
export function clearDevice(): void {
  frozen = true
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('diabite.')) localStorage.removeItem(k)
  } catch { /* storage unavailable */ }
}

function write(key: string, value: unknown): void {
  if (frozen) return
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
  // `planned` is true only when it is exactly true: a string "false" or a stray value reads as eaten.
  return Array.isArray(stored) ? stored.map(repairServings).filter(usableEntry).map(normalisePlanned) : []
}
/** An entry logged from a recipe counted by servings once carried a weight of 0 (which the server refuses): its servings stand in for the weight. */
const repairServings = (e: unknown): unknown => {
  if (!isObj(e) || typeof e.grams !== 'number' || e.grams > 0 || !isObj(e.snapshot)) return e
  const servings = e.snapshot.servings
  return typeof servings === 'number' && servings > 0 ? { ...e, grams: servings } : e
}
const normalisePlanned = (e: DiaryEntry): DiaryEntry => {
  if (e.planned === true) return e
  if (!('planned' in e)) return e
  const { planned: _p, ...rest } = e
  return rest
}
export const saveDiary = (entries: DiaryEntry[]): void => write(DIARY_KEY, entries)

// Which first-run tips were shown, in this browser. Not synced, not exported, no personal data.
const TOUR_KEY = 'diabite.tour.v1'
/** null when nothing is stored (or storage is unavailable): the key is absent. */
export const loadTour = (): unknown | null => read<unknown | null>(TOUR_KEY, null)
export const saveTour = (seen: string[]): void => write(TOUR_KEY, seen)

// Which feedback moments were asked, in this browser. Not synced, not exported, no personal data.
const NUDGE_KEY = 'diabite.nudge.v1'
export const loadNudge = (): unknown | null => read<unknown | null>(NUDGE_KEY, null)
export const saveNudge = (asked: string[]): void => write(NUDGE_KEY, asked)

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
