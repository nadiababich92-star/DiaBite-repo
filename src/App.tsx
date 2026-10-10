import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AccountBlock from './components/AccountBlock'
import AskPage from './components/AskPage'
import DiaryPage from './components/DiaryPage'
import FeedbackModal from './components/FeedbackModal'
import ImportPrompt from './components/ImportPrompt'
import Logo, { Wordmark } from './components/Logo'
import SignIn from './components/SignIn'
import Onboarding from './components/Onboarding'
import MenuPage from './components/MenuPage'
import ProfilePage from './components/ProfilePage'
import { calculateTargets } from './lib/profile'
import { signOutAndClear, useAuth, useSignInRequired } from './lib/auth'
import { supabaseConfigured } from './lib/supabase'
import { loadDiary, loadProfile, saveDiary, saveProfile } from './lib/storage'
import { CONSENT_VERSION, LEGACY_DIARY_KEY, PENDING_KEY, loadAccount, mergeById, useAccountSync } from './lib/sync'
import type { DiaryEntry, Profile } from './types'

type Tab = 'ask' | 'diary' | 'menu' | 'profile'

// Four places, reachable with a thumb. Icons are drawn here so they take the colour of the bar.
const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  { id: 'ask', label: 'Ask', icon: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></> },
  { id: 'diary', label: 'Diary', icon: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" /><path d="M8 17h11" /></> },
  { id: 'menu', label: 'Menu', icon: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></> },
  { id: 'profile', label: 'You', icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></> },
]

type AccountState = 'none' | 'loading' | 'ready' | 'failed'

export default function App() {
  const auth = useAuth()
  const signInRequired = useSignInRequired()
  const [tab, setTab] = useState<Tab>('ask')
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  // The first sentence of the disclaimer is always shown; the rest opens on a tap.
  const [disclaimerOpen, setDisclaimerOpen] = useState(false)
  // Onboarding is the first screen until it has been completed once (PRD A4);
  // afterwards it can be reopened from the profile tab.
  const [onboarding, setOnboarding] = useState(false)
  const [profile, setProfile] = useState<Profile>(loadProfile)
  const [diary, setDiary] = useState<DiaryEntry[]>(loadDiary)

  // The account: loaded once per sign-in, then kept in step by useAccountSync.
  const [account, setAccount] = useState<AccountState>('none')
  const [serverHasProfile, setServerHasProfile] = useState(true)
  const [consent, setConsent] = useState<{ at: string | null; version: string | null }>({ at: null, version: null })
  const [waiting, setWaiting] = useState(0) // entries from before sign-in, held aside
  const [notice, setNotice] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  const sync = useAccountSync({ userId: auth.userId, ready: account === 'ready', profile, diary, consent })
  const prime = sync.prime
  const wasSignedIn = useRef(false)

  useEffect(() => saveProfile(profile), [profile])
  useEffect(() => saveDiary(diary), [diary])

  const load = useCallback(async (userId: string) => {
    setAccount('loading')
    try {
      const a = await loadAccount(userId)
      const local = loadDiary()
      const pending = (() => { try { return localStorage.getItem(PENDING_KEY) === '1' } catch { return false } })()
      // A failed push last time: this device holds the newer truth, so it is pushed, not overwritten.
      prime(a)
      if (pending) { setServerHasProfile(true); setConsent({ at: a.consentAt, version: a.consentVersion }) }
      else {
        // A diary from before sign-in is set aside, never dropped, until the person decides.
        try {
          if (local.length > 0 && !localStorage.getItem(LEGACY_DIARY_KEY) && local.some((e) => !a.diary.some((x) => x.id === e.id))) {
            localStorage.setItem(LEGACY_DIARY_KEY, JSON.stringify(local))
          }
        } catch { /* storage unavailable: nothing to set aside */ }
        setDiary(a.diary)
        setConsent({ at: a.consentAt, version: a.consentVersion })
        setServerHasProfile(a.profile !== null)
        // No profile on the server yet: onboarding runs, seeded from whatever this device knew.
        setProfile(a.profile ?? { ...loadProfile(), onboarded: false })
      }
      try {
        const kept = JSON.parse(localStorage.getItem(LEGACY_DIARY_KEY) ?? '[]') as unknown[]
        setWaiting(Array.isArray(kept) ? kept.length : 0)
      } catch { setWaiting(0) }
      setAccount('ready')
    } catch { setAccount('failed') }
  }, [prime])

  useEffect(() => {
    if (auth.status === 'signedIn' && auth.userId) { wasSignedIn.current = true; setSigningIn(false); void load(auth.userId) }
    if (auth.status === 'signedOut') {
      // Signed out: nothing of the account stays on screen or in memory.
      if (wasSignedIn.current) { setProfile(loadProfile()); setDiary(loadDiary()); setWaiting(0) }
      setAccount('none')
    }
  }, [auth.status, auth.userId, load])

  const targets = useMemo(() => calculateTargets(profile), [profile])

  const sessionEnded = useCallback(() => { setNotice('Your session ended. Sign in again.'); void signOutAndClear() }, [])

  function moveLegacyDiary() {
    try {
      const kept = JSON.parse(localStorage.getItem(LEGACY_DIARY_KEY) ?? '[]') as DiaryEntry[]
      setDiary((d) => mergeById(d, kept, () => ''))
      localStorage.removeItem(LEGACY_DIARY_KEY)
    } catch { /* unreadable: leave it where it is */ }
    setWaiting(0)
  }

  // Not yet known whether to ask for a sign-in, or who is asking: nothing of the app is shown.
  if (signInRequired === null || auth.status === 'loading' || (auth.status === 'signedIn' && account !== 'ready' && account !== 'failed')) {
    return <div className="app"><p className="muted" role="status">Opening DiaBite…</p></div>
  }
  if (signInRequired && auth.status === 'signedOut') return <SignIn notice={notice} />
  // Not required, but wanted: someone signing in from the Profile tab to keep their diary across devices.
  if (!signInRequired && auth.status === 'signedOut' && signingIn) return <SignIn notice={notice} onCancel={() => setSigningIn(false)} />
  if (auth.status === 'signedIn' && account === 'failed') {
    return (
      <div className="app">
        <section className="card" role="alert">
          <h2>Couldn't open your account</h2>
          <p className="muted">Check your connection and try again. Nothing was changed.</p>
          <div className="row">
            <button className="primary" onClick={() => auth.userId && void load(auth.userId)}>Try again</button>
            <button className="link" onClick={() => void signOutAndClear()}>Sign out</button>
          </div>
        </section>
      </div>
    )
  }

  if (!profile.onboarded || onboarding) {
    return (
      <div className="app">
        <header className="masthead">
          <Logo />
          <Wordmark />
        </header>
        <Onboarding
          initial={profile}
          askConsent={auth.status === 'signedIn' && !serverHasProfile}
          onDone={(p, consented) => {
            if (consented) { setConsent({ at: new Date().toISOString(), version: CONSENT_VERSION }); setServerHasProfile(true) }
            setProfile(p); setOnboarding(false)
          }}
          onCancel={profile.onboarded ? () => setOnboarding(false) : undefined}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="masthead">
        <Logo />
        <Wordmark />
      </header>

      <div className="disclaimer">
        <strong>This is a reference tool, not medical advice.</strong>
        {' '}
        {disclaimerOpen && (
          <span id="disclaimer-rest">
            The numbers come from published formulas and averaged glycemic-index values. They do not
            account for your therapy and must never be used to calculate insulin doses. Discuss any
            change to your diet with your clinician.{' '}
          </span>
        )}
        <button className="link disclaimer-toggle" aria-expanded={disclaimerOpen} aria-controls="disclaimer-rest"
          onClick={() => setDisclaimerOpen((v) => !v)}>{disclaimerOpen ? 'Show less' : 'Read more'}</button>
      </div>

      {sync.status === 'error' && (
        <section className="card tone-blocked" role="alert">
          <p style={{ margin: 0 }}>Your changes haven't been saved. <button className="link" onClick={sync.retryNow}>Try again</button></p>
        </section>
      )}

      <main role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      {tab === 'ask' && (
        <AskPage profile={profile} targets={targets} diary={diary} onLog={(added) => setDiary((d) => [...d, ...added])} onSessionEnded={sessionEnded} />
      )}
      {tab === 'diary' && (
        <DiaryPage targets={targets} diary={diary} onChange={setDiary} />
      )}
      {tab === 'menu' && <MenuPage profile={profile} targets={targets} onAsk={() => setTab('ask')} />}
      {tab === 'profile' && (
        <ProfilePage
          profile={profile}
          targets={targets}
          onChange={setProfile}
          onRedoOnboarding={() => setOnboarding(true)}
          onFeedback={() => setFeedbackOpen(true)}
        />
      )}
      {tab === 'profile' && auth.status === 'signedIn' && auth.userId && <AccountBlock userId={auth.userId} email={auth.email} />}
      {tab === 'profile' && auth.status === 'signedOut' && !signInRequired && supabaseConfigured && (
        <section className="card">
          <h2>Keep your profile and diary</h2>
          <p className="muted">Sign in with your email and they follow you to any device. Without it they stay in this browser only.</p>
          <button className="primary" onClick={() => setSigningIn(true)}>Sign in</button>
        </section>
      )}
      </main>

      <nav className="tabs" role="tablist" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-controls={`panel-${t.id}`}
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-ico" aria-hidden="true"><svg viewBox="0 0 24 24">{t.icon}</svg></span>
            {t.label}
          </button>
        ))}
      </nav>

      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
      {waiting > 0 && !feedbackOpen && <ImportPrompt count={waiting} onMove={moveLegacyDiary} onLater={() => setWaiting(0)} />}
    </div>
  )
}
