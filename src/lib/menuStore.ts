import type { WeekState } from './menu'
import { MEAL_ORDER } from './menu'

/**
 * The week on screen, kept on this device until the person asks for another one.
 *
 * The Menu tab is unmounted whenever someone leaves it, and the week used to be rebuilt from a
 * fresh random number on every return: open the menu, go shopping, come back, and it was a
 * different week. Now the seed and the replacements are remembered (see `replayWeek`).
 */
const KEY = 'diabite.menu.v1'

export const newWeekState = (): WeekState => ({ seed: Math.floor(Math.random() * 1e9), edits: [] })

/** Whatever is stored is checked before it is used: a bad value means a new week, never a blank page. */
export function loadWeekState(): WeekState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { seed?: unknown; edits?: unknown } | null
    if (!raw || typeof raw.seed !== 'number' || !Number.isFinite(raw.seed) || !Array.isArray(raw.edits)) return newWeekState()
    const edits = raw.edits.filter((e): e is WeekState['edits'][number] => {
      const x = e as { day?: unknown; meal?: unknown; seed?: unknown } | null
      return !!x && typeof x === 'object' && Number.isInteger(x.day) && (x.day as number) >= 0 && (x.day as number) < 7
        && MEAL_ORDER.includes(x.meal as WeekState['edits'][number]['meal']) && typeof x.seed === 'number'
    }).slice(0, 200)
    return { seed: raw.seed, edits }
  } catch { return newWeekState() }
}

export function saveWeekState(state: WeekState): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* storage unavailable: the week lasts this visit */ }
}
