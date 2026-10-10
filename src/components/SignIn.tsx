import { useEffect, useRef, useState } from 'react'
import { looksLikeEmail, sendLink, verifyCode, type SignInProblem } from '../lib/auth'

/** The product's own words for each thing that can go wrong; a raw error string is never shown. */
const PROBLEM: Record<SignInProblem, string> = {
  email: 'Enter an email address like name@example.com',
  rate: 'Too many emails just now. Try again in a few minutes',
  code: "That code didn't work. Check it and try again, or ask for a new one",
  network: "Couldn't reach DiaBite. Check your connection and try again",
  unavailable: "Couldn't send the email right now. Try again in a few minutes",
}

const RESEND_SECONDS = 60

export default function SignIn({ notice, onCancel }: { notice?: string; onCancel?: () => void }) {
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
        <h1>DiaBite</h1>
        <p>Nutrition for type 2 diabetes and insulin resistance</p>
      </header>

      <section className="card signin">
        <p className="signin-emergency">
          If you have symptoms such as chest pain, confusion, vomiting or fainting, call emergency services.
          DiaBite does not give insulin or medication doses.
        </p>
        {notice && <p className="muted" role="status">{notice}</p>}

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
            <p className="muted">By continuing you agree to how DiaBite keeps your data: your email address, your answers about yourself and your diary, stored in Ireland, which you can export or delete at any time.</p>
          </form>
        ) : (
          <form onSubmit={verify} noValidate>
            <h2>Check your mail</h2>
            <p role="status">
              We sent a sign-in link to <b>{email.trim()}</b>. Open it on this device, or type the code from the email.
            </p>
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
    </div>
  )
}
