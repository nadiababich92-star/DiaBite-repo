import { useState, type ReactNode } from 'react'
import { loadTheme, saveTheme } from '../lib/theme'
import type { ThemeChoice } from '../lib/theme'

interface Props {
  /** The account: what a signed-in person can do with their data, or the way in for someone who is not. */
  account: ReactNode
  /** Opens the feedback form. It lives here, not in the navigation bar. */
  onFeedback: () => void
  /** Opens the "How it works" sheet. */
  onHowItWorks: () => void
}

/** The app's own settings: how it looks, the account, help. The person's health answers stay in You. */
export default function SettingsPage({ account, onFeedback, onHowItWorks }: Props) {
  const [theme, setTheme] = useState<ThemeChoice>(loadTheme)
  const choose = (c: ThemeChoice) => { setTheme(c); saveTheme(c) }

  return (
    <>
      <section className="card">
        <h2>Appearance</h2>
        <div className="theme-options" role="group" aria-label="Appearance">
          <button className="theme-option" aria-pressed={theme === 'tape'} onClick={() => choose('tape')}>
            <span className="theme-swatch" aria-hidden="true"><i className="n" /></span>Tape
          </button>
          <button className="theme-option" aria-pressed={theme === 'paper'} onClick={() => choose('paper')}>
            <span className="theme-swatch" aria-hidden="true"><i className="p" /></span>Paper
          </button>
          <button className="theme-option" aria-pressed={theme === 'system'} onClick={() => choose('system')}>
            <span className="theme-swatch" aria-hidden="true"><i className="p" /><i className="n" /></span>Follow my phone
          </button>
        </div>
        <p className="muted theme-note">Tape is the dark page. Follow my phone uses Paper in the daytime and Tape after dark.</p>
      </section>

      {account}

      <section className="card">
        <h2>Help</h2>
        <p className="muted">Tell us what was wrong, unclear or missing. It goes to the people building DiaBite.</p>
        <div className="row">
          <button className="ghost" onClick={onHowItWorks}>How it works</button>
          <button className="ghost" onClick={onFeedback}>Send feedback</button>
        </div>
      </section>

      <section className="card touch-only">
        <h2>Keep it in your pocket</h2>
        <p className="muted">Put DiaBite on your home screen so it opens in one tap. On an iPhone, tap Share in Safari, then Add to Home Screen. On Android, tap the three dots in Chrome, then Add to Home screen.</p>
      </section>
    </>
  )
}
