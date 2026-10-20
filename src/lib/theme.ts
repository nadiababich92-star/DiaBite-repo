/**
 * Appearance: Tape (a dark page with cream slips, the default), Paper (light), or Follow my phone.
 * The choice is kept on the device, like the rest of what is not an account. <html data-theme> is always
 * one of 'tape' or 'paper': "Follow my phone" resolves to Paper in the daytime and Tape after dark, and is
 * resolved again when the phone changes (watchSystemTheme).
 */
export type ThemeChoice = 'system' | 'paper' | 'tape'
type Look = 'paper' | 'tape'

const KEY = 'diabite.theme'
const COLORS: Record<Look, string> = { paper: '#f1ece0', tape: '#0a1812' }

const prefersLight = (): boolean => !!window.matchMedia?.('(prefers-color-scheme: light)').matches

/** 'night' was the old name of the dark look; it is Tape now. Nothing stored (or anything else) is Tape. */
export function loadTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'paper' || v === 'system' ? v : 'tape'
  } catch { return 'tape' }
}

export function lookOf(choice: ThemeChoice, light: boolean): Look {
  return choice === 'paper' || (choice === 'system' && light) ? 'paper' : 'tape'
}

export function applyTheme(choice: ThemeChoice): void {
  const look = lookOf(choice, prefersLight())
  document.documentElement.setAttribute('data-theme', look)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[look])
}

export function saveTheme(choice: ThemeChoice): void {
  try { if (choice === 'tape') localStorage.removeItem(KEY); else localStorage.setItem(KEY, choice) } catch { /* private window: the choice lasts this visit */ }
  applyTheme(choice)
}

/** Follow my phone: look again when the phone changes between light and dark. Returns the way to stop. */
export function watchSystemTheme(): () => void {
  const q = window.matchMedia?.('(prefers-color-scheme: light)')
  if (!q) return () => {}
  const on = () => { if (loadTheme() === 'system') applyTheme('system') }
  q.addEventListener('change', on)
  return () => q.removeEventListener('change', on)
}
