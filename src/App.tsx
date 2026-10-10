import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AccountBlock from './components/AccountBlock'
import AskPage from './components/AskPage'
import DiaryPage from './components/DiaryPage'
import FeedbackModal from './components/FeedbackModal'
import ImportPrompt from './components/ImportPrompt'
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

const TABS: { id: Tab; label: string }[] = [
  { id: 'ask', label: 'Can I eat this?' },
  { id: 'diary', label: 'Diary' },
  { id: 'menu', label: 'Weekly menu' },
  { id: 'profile', label: 'Profile' },
]

type AccountState = 'none' | 'loading' | 'ready' | 'failed'

export default function App() {
  const auth = useAuth()
  const signInRequired = useSignInRequired()
  const [tab, setTab] = useState<Tab>('ask')
  const [feedbackOpen, setFeedbackOpen] = useState(false)
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
          <h1>DiaBite</h1>
          <p>Nutrition for type 2 diabetes and insulin resistance</p>
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
        <h1>DiaBite</h1>
        <p>Nutrition for type 2 diabetes and insulin resistance</p>
      </header>

      <div className="disclaimer">
        <strong>This is a reference tool, not medical advice.</strong> The numbers come from
        published formulas and averaged glycemic-index values. They do not account for your
        therapy and must never be used to calculate insulin doses. Discuss any change to your
        diet with your clinician.
      </div>

      {sync.status === 'error' && (
        <section className="card tone-blocked" role="alert">
          <p style={{ margin: 0 }}>Your changes haven't been saved. <button className="link" onClick={sync.retryNow}>Try again</button></p>
        </section>
      )}

      <nav className="tabs">
        <div className="tab-row" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-controls={`panel-${t.id}`}
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button className="tab-action" onClick={() => setFeedbackOpen(true)}>Feedback</button>
      </nav>

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

      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
      {waiting > 0 && !feedbackOpen && <ImportPrompt count={waiting} onMove={moveLegacyDiary} onLater={() => setWaiting(0)} />}
    </div>
  )
}
