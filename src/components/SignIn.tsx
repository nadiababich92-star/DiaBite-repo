import { useEffect, useRef, useState } from 'react'
import { inAppBrowser, looksLikeEmail, sendLink, signInWithGoogle, verifyCode, type SignInProblem } from '../lib/auth'
import { authError } from '../lib/landingRule'
import Logo, { Wordmark } from './Logo'

/** The product's own words for each thing that can go wrong; a raw error string is never shown. */
const PROBLEM: Record<SignInProblem, string> = {
  email: 'Enter an email address like name@example.com',
  rate: 'Too many emails just now. Try again in a few minutes',
  code: "That code didn't work. Check it and try again, or ask for a new one",
  network: "Couldn't reach DiaBite. Check your connection and try again",
  unavailable: "Couldn't send the email right now. Try again in a few minutes",
}

const RESEND_SECONDS = 60

/** The data statement under the form: the second clause names both ways in only when the Google key is shown. */
export const DATA_LINE = 'By continuing you agree to how DiaBite keeps your data: your email address, your answers about yourself and your diary, stored in Ireland, which you can export or delete at any time.'
export const DATA_LINE_GOOGLE = 'By continuing, with Google or by email, you agree to how DiaBite keeps your data: your email address, your answers about yourself and your diary, stored in Ireland, which you can export or delete at any time.'
export const GOOGLE_COPY = {
  key: 'Continue with Google',
  opening: 'Opening Google…',
  or: 'or use your email',
  inApp: 'To use Google, open DiaBite in your browser. Your email works here.',
  failed: 'Google did not sign you in. Try again, or use your email.',
} as const

/**
 * The sign-in screen. `googleSignIn` comes from the engine's /health (GOOGLE_SIGN_IN=on): without it the screen is exactly the email
 * form. `ua` and `failedReturn` are read from the browser unless given (the checks render the screen without one).
 */
export default function SignIn({ notice, onCancel, googleSignIn = false, ua, failedReturn }: { notice?: string; onCancel?: () => void; googleSignIn?: boolean; ua?: string; failedReturn?: boolean }) {
  const inApp = inAppBrowser(ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : ''))
  const [googleFailed] = useState(() => failedReturn ?? (typeof window !== 'undefined' && authError(window.location)))
  const [opening, setOpening] = useState(false)
  const [googleProblem, setGoogleProblem] = useState<SignInProblem | null>(null)
  // A failed return from Google leaves its error in the address: said once above the key, then the address is cleaned.
  useEffect(() => { if (googleSignIn && googleFailed && typeof window !== 'undefined' && failedReturn === undefined) window.history.replaceState(null, '', window.location.pathname) }, [googleSignIn, googleFailed, failedReturn])
  const [step, setStep] = useState<'address' | 'code'>('address')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [problem, setProblem] = useState<SignInProblem | null>(null)
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (step === 'code') codeRef.current?.focus() }, [step])
  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  async function send(e?: React.FormEvent) {
    e?.preventDefault()
    if (busy) return
    if (!looksLikeEmail(email)) { setProblem('email'); return }
    setBusy(true); setProblem(null)
    const p = await sendLink(email)
    setBusy(false)
    if (p) { setProblem(p); return }
    setStep('code'); setCode(''); setWait(RESEND_SECONDS)
  }

  async function google() {
    if (opening) return
    setOpening(true); setGoogleProblem(null)
    const r = await signInWithGoogle()
    // On success the page is already leaving for Google; anything else is said in the product's own words, under the key.
    if (r !== 'redirecting') { setOpening(false); setGoogleProblem(r) }
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault()
    if (busy) return
    setBusy(true); setProblem(null)
    const p = await verifyCode(email, code)
    setBusy(false)
    if (p) setProblem(p)
    // On success the session arrives through useAuth and the app replaces this screen.
  }

  return (
    <div className="app">
      <header className="masthead">
        <Logo decorative />
        <Wordmark />
      </header>

      <main>
      <section className="card signin">
        <p className="signin-emergency">
          If you have symptoms such as chest pain, confusion, vomiting or fainting, call emergency services.
          DiaBite does not give insulin or medication doses.
        </p>
        {notice && <p className="muted" role="status">{notice}</p>}

        {step === 'address' && googleSignIn && (
          <div className="signin-google">
            {googleFailed && <p className="muted" role="status">{GOOGLE_COPY.failed}</p>}
            {inApp ? (
              <p className="muted">{GOOGLE_COPY.inApp}</p>
            ) : (
              <>
                <button className="ghost signin-google-key" type="button" onClick={google} disabled={opening}>{opening ? GOOGLE_COPY.opening : GOOGLE_COPY.key}</button>
                {opening && <p className="sr-only" role="status">Opening Google</p>}
                {googleProblem && <p className="signin-problem" role="alert">{PROBLEM[googleProblem]}</p>}
                <p className="muted signin-or">{GOOGLE_COPY.or}</p>
              </>
            )}
          </div>
        )}
        {step === 'address' ? (
          <form onSubmit={send} noValidate>
            <h2>Sign in with your email</h2>
            <label className="field">
              <span>Email</span>
              <input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
                value={email} onChange={(e) => { setEmail(e.target.value); setProblem(null) }}
                aria-invalid={problem === 'email'} aria-describedby={problem ? 'signin-problem' : undefined} />
            </label>
            {problem && <p id="signin-problem" className="signin-problem" role="alert">{PROBLEM[problem]}</p>}
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Email me a link'}</button>
            <p className="muted">We send a link and a code. There is no password.</p>
            <p className="muted">{googleSignIn && !inApp ? DATA_LINE_GOOGLE : DATA_LINE} <a href="/privacy.html">Privacy</a></p>
          </form>
        ) : (
          <form onSubmit={verify} noValidate>
            <h2>Check your mail</h2>
            <p role="status">
              We sent a link and a code to <b>{email.trim()}</b>. Either one signs you in: open the link on this device, or type the code below.
            </p>
            <p className="muted">It can take a minute. If it does not arrive, look in your Spam or Junk folder.</p>
            <label className="field">
              <span>Code from the email</span>
              <input ref={codeRef} className="signin-code" type="text" inputMode="numeric" autoComplete="one-time-code"
                maxLength={10} pattern="[0-9]*" value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 10)); setProblem(null) }}
                aria-invalid={problem === 'code'} aria-describedby={problem ? 'signin-problem' : undefined} />
            </label>
            {problem && <p id="signin-problem" className="signin-problem" role="alert">{PROBLEM[problem]}</p>}
            <button className="primary" type="submit" disabled={busy || code.length < 6}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <div className="row">
              <button className="ghost" type="button" onClick={() => send()} disabled={busy || wait > 0}>
                {wait > 0 ? `Send again in ${wait} s` : 'Send again'}
              </button>
              <button className="link" type="button" onClick={() => { setStep('address'); setProblem(null) }}>Use a different address</button>
            </div>
          </form>
        )}
        {onCancel && <button className="link" type="button" onClick={onCancel}>Not now</button>}
      </section>
      </main>
    </div>
  )
}
