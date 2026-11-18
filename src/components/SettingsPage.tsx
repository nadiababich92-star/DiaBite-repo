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
  /** Opens "What are GI and GL?". */
  onGlInfo: () => void
  /** Opens "Summary for my clinician", a printable page of the person's own diary. */
  onClinicianSummary: () => void
}

/** The app's own settings: how it looks, the account, help. The person's health answers stay in Profile. */
export default function SettingsPage({ account, onFeedback, onHowItWorks, onGlInfo, onClinicianSummary }: Props) {
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
        <h2>For your clinician</h2>
        <p className="muted">A printable page of your last days of eating and your daily targets, to show a dietitian or doctor. It lists your condition and medicines. It does not include your email, age or weight. Nothing is sent anywhere: you print it or save it as a PDF.</p>
        <button id="open-clinician-summary" className="ghost" onClick={onClinicianSummary}>Summary for my clinician</button>
      </section>

      <section className="card">
        <h2>Help</h2>
        <p className="muted">Tell us what was wrong, unclear or missing. It goes to the people building DiaBite.</p>
        <div className="row">
          <button className="ghost" onClick={onHowItWorks}>How it works</button>
          <button className="ghost" onClick={onGlInfo}>What are GI and GL?</button>
          <button className="ghost" onClick={onFeedback}>Send feedback</button>
        </div>
      </section>
    </>
  )
}
