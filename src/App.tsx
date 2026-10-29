import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AccountBlock from './components/AccountBlock'
import AskPage from './components/AskPage'
import DiaryPage from './components/DiaryPage'
import FeedbackModal from './components/FeedbackModal'
import ImportPrompt from './components/ImportPrompt'
import Logo, { Wordmark } from './components/Logo'
import SettingsPage from './components/SettingsPage'
import SignIn from './components/SignIn'
import Landing from './components/Landing'
import HowItWorks from './components/HowItWorks'
import Onboarding from './components/Onboarding'
import MenuPage from './components/MenuPage'
import ProfilePage from './components/ProfilePage'
import { calculateTargets } from './lib/profile'
import { signOutAndClear, useAuth, useSignInRequired } from './lib/auth'
import { supabaseConfigured } from './lib/supabase'
import { loadDiary, loadProfile, loadTour, saveDiary, saveProfile, saveTour, thawWrites } from './lib/storage'
import { initialSeen, type TourStep } from './lib/tour'
import { showLanding } from './lib/landingRule'
import { CONSENT_VERSION, LEGACY_DIARY_KEY, PENDING_KEY, loadAccount, mergeById, reconcileAfterFailedPush, useAccountSync } from './lib/sync'
import type { DiaryEntry, MealType, Profile } from './types'

type Tab = 'ask' | 'diary' | 'menu' | 'profile' | 'settings'

// Five places, reachable with a thumb. Icons are drawn here so they take the colour of the bar.
const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  { id: 'ask', label: 'Ask', icon: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></> },
  { id: 'diary', label: 'Diary', icon: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" /><path d="M8 17h11" /></> },
  { id: 'menu', label: 'Menu', icon: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></> },
  { id: 'profile', label: 'You', icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></> },
  { id: 'settings', label: 'Settings', icon: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></> },
]

type AccountState = 'none' | 'loading' | 'ready' | 'failed'

export default function App() {
  const auth = useAuth()
  const signInRequired = useSignInRequired()
  const [tab, setTab] = useState<Tab>('ask')
  // The day and meal the Diary sent the person to Ask for. It lasts only while they stay on Ask.
  const [logTarget, setLogTarget] = useState<{ date: string; meal: MealType } | null>(null)
  useEffect(() => { if (tab !== 'ask') setLogTarget(null) }, [tab])
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  // The first sentence of the disclaimer is always shown; the rest opens on a tap.
  const [disclaimerOpen, setDisclaimerOpen] = useState(false)
  // Onboarding is the first screen until it has been completed once (PRD A4);
  // afterwards it can be reopened from the profile tab.
  const [onboarding, setOnboarding] = useState(false)
  const [profile, setProfile] = useState<Profile>(loadProfile)
  const [diary, setDiary] = useState<DiaryEntry[]>(loadDiary)
  // First-run tips: which were shown, in this browser. The start-up snapshot comes from storage alone, before
  // onboarding can finish in this visit; a person who used the app before this release is recorded as seen.
  const [tourSeen, setTourSeen] = useState<TourStep[]>(() => {
    const seen = initialSeen(loadTour(), { onboardedAtStart: loadProfile().onboarded, diaryAtStart: loadDiary().length })
    saveTour(seen)
    return seen
  })
  const [howOpen, setHowOpen] = useState(false)

  // The account: loaded once per sign-in, then kept in step by useAccountSync.
  const [account, setAccount] = useState<AccountState>('none')
  const [serverHasProfile, setServerHasProfile] = useState(true)
  const [consent, setConsent] = useState<{ at: string | null; version: string | null }>({ at: null, version: null })
  const [waiting, setWaiting] = useState(0) // entries from before sign-in, held aside
  const [notice, setNotice] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  // Set by "Try DiaBite" on the landing page: the sign-in screen is shown instead, with a way back.
  const [entering, setEntering] = useState(false)
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
      if (pending) {
        setServerHasProfile(true); setConsent({ at: a.consentAt, version: a.consentVersion })
        // Merged, not replaced: the account may hold entries from another device that this one never saw.
        setDiary(reconcileAfterFailedPush(a.diary, local))
      } else {
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
      // Whatever sign-out cleared stays cleared until the screen above has been reset.
      thawWrites()
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
  if (signInRequired && auth.status === 'signedOut') {
    // A stranger sees the page about the product first. Never over an email link, a session that just ended, or /?signin.
    if (showLanding({ signInRequired, signedOut: true, notice, entering, location: window.location })) {
      return <Landing onEnter={() => setEntering(true)} />
    }
    return <SignIn notice={notice} onCancel={entering ? () => setEntering(false) : undefined} />
  }
  // Not required, but wanted: someone signing in from the Settings tab to keep their diary across devices.
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
        <main>
        <Onboarding
          initial={profile}
          askConsent={auth.status === 'signedIn' && !serverHasProfile}
          onDone={(p, consented) => {
            if (consented) { setConsent({ at: new Date().toISOString(), version: CONSENT_VERSION }); setServerHasProfile(true) }
            setProfile(p); setOnboarding(false)
          }}
          onCancel={profile.onboarded ? () => setOnboarding(false) : undefined}
        />
        </main>
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

      <main>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      {tab === 'ask' && (
        <AskPage
          profile={profile} targets={targets} diary={diary} onLog={(added) => setDiary((d) => [...d, ...added])} onOpenDiary={() => setTab('diary')} onSessionEnded={sessionEnded}
          logTarget={logTarget} onClearTarget={() => setLogTarget(null)}
          tourSeen={tourSeen} onTourSeen={(s) => { setTourSeen(s); saveTour(s) }} tourSuspended={feedbackOpen || waiting > 0 || howOpen}
        />
      )}
      {tab === 'diary' && (
        <DiaryPage targets={targets} diary={diary} onChange={setDiary} onAsk={(target) => { setLogTarget(target ?? null); setTab('ask') }} showBreadUnits={profile.showBreadUnits} />
      )}
      {tab === 'menu' && (
        <MenuPage
          profile={profile} targets={targets} diary={diary} onAsk={() => setTab('ask')}
          onAdd={(added) => setDiary((d) => [...d, ...added])}
          onRemove={(ids) => setDiary((d) => d.filter((e) => !ids.includes(e.id)))}
          onOpenDiary={() => setTab('diary')}
        />
      )}
      {tab === 'profile' && (
        <ProfilePage
          profile={profile}
          targets={targets}
          onChange={setProfile}
          onRedoOnboarding={() => setOnboarding(true)}
        />
      )}
      {tab === 'settings' && (
        <SettingsPage
          onFeedback={() => setFeedbackOpen(true)}
          onHowItWorks={() => setHowOpen(true)}
          account={<>
            {auth.status === 'signedIn' && auth.userId && <AccountBlock userId={auth.userId} email={auth.email} />}
            {auth.status === 'signedOut' && !signInRequired && supabaseConfigured && (
              <section className="card">
                <h2>Keep your profile and diary</h2>
                <p className="muted">Sign in with your email and they follow you to any device. Without it they stay in this browser only.</p>
                <button className="primary" onClick={() => setSigningIn(true)}>Sign in</button>
              </section>
            )}
          </>}
        />
      )}
      </div>
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
      {howOpen && <HowItWorks onClose={() => setHowOpen(false)} />}
      {waiting > 0 && !feedbackOpen && <ImportPrompt count={waiting} onMove={moveLegacyDiary} onLater={() => setWaiting(0)} />}
    </div>
  )
}
