/**
 * Appearance: Follow my phone (the default), Paper (light) or Night (dark).
 * The choice is kept on the device, like the rest of what is not an account.
 * "system" removes the attribute and lets prefers-color-scheme decide.
 */
export type ThemeChoice = 'system' | 'paper' | 'night'

const KEY = 'diabite.theme'
const COLORS: Record<'paper' | 'night', string> = { paper: '#f1ece0', night: '#0a1812' }

export function loadTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'paper' || v === 'night' ? v : 'system'
  } catch { return 'system' }
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)
  const dark = choice === 'night' || (choice === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[dark ? 'night' : 'paper'])
}

export function saveTheme(choice: ThemeChoice): void {
  try { if (choice === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, choice) } catch { /* private window: the choice lasts this visit */ }
  applyTheme(choice)
}
