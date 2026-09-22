import type { DiaryEntry, Profile } from '../types'
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

export const loadProfile = (): Profile => ({ ...DEFAULT_PROFILE, ...read(PROFILE_KEY, {}) })
export const saveProfile = (p: Profile): void => write(PROFILE_KEY, p)

export const loadDiary = (): DiaryEntry[] => read<DiaryEntry[]>(DIARY_KEY, [])
export const saveDiary = (entries: DiaryEntry[]): void => write(DIARY_KEY, entries)

export const todayISO = (): string => new Date().toISOString().slice(0, 10)
