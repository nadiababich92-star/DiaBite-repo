import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AccountBlock from './components/AccountBlock'
import AskPage from './components/AskPage'
import DiaryPage from './components/DiaryPage'
import FeedbackModal from './components/FeedbackModal'
import ImportPrompt from './components/ImportPrompt'
import Logo, { Wordmark } from './components/Logo'
import SettingsPage from './components/SettingsPage'
import ClinicianSummary from './components/ClinicianSummary'
import SignIn from './components/SignIn'
import Landing from './components/Landing'
import HowItWorks from './components/HowItWorks'
import GlInfo from './components/GlInfo'
import { GlHelpContext } from './components/GlHelp'
import Onboarding from './components/Onboarding'
import MenuPage from './components/MenuPage'
import ProfilePage from './components/ProfilePage'
import { ANON_PROFILE, answered, calculateTargets, CARB_APPROACH_LABELS, DEFERRED_ORDER, nextDeferred, shortStart, STEP_OF } from './lib/profile'
import DeferredCard from './components/DeferredCard'
import { showDefaultsLine, showDeferredCard } from './lib/firstSession'
import { eaten } from './lib/diary'
import { signOutAndClear, useAccess, useAuth } from './lib/auth'
import { SignInCard } from './components/SignInCard'
import { SIGN_IN_CARDS } from './lib/anon'
import { supabaseConfigured } from './lib/supabase'
import { claimDevice, forgetPreviousAccount, freezeWrites, heldFor, holdFor, loadDiary, loadOwner, loadProfile, loadTour, localDataOwner, saveDiary, saveProfile, saveTour, tabIsStale, thawWrites, todayISO } from './lib/storage'
import { initialSeen, STEP_ORDER, type TourStep } from './lib/tour'
import { authInUrl, showLanding, skipLanding } from './lib/landingRule'
import { CONSENT_VERSION, LEGACY_DIARY_KEY, PENDING_KEY, loadAccount, mergeById, reconcileAfterFailedPush, useAccountSync } from './lib/sync'
import type { DiaryEntry, MealType, Profile } from './types'

type Tab = 'ask' | 'diary' | 'menu' | 'profile' | 'settings'

// Five places, reachable with a thumb. Icons are drawn here so they take the colour of the bar.
const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  { id: 'ask', label: 'Ask', icon: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></> },
  { id: 'diary', label: 'Diary', icon: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" /><path d="M8 17h11" /></> },
  { id: 'menu', label: 'Menu', icon: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></> },
  { id: 'profile', label: 'Profile', icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></> },
  { id: 'settings', label: 'Settings', icon: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></> },
]

type AccountState = 'none' | 'loading' | 'ready' | 'failed'

/** A visitor with no account has no diary, and nothing here is saved for them. */
const NO_DIARY: DiaryEntry[] = []
const DEFERRED_SHOWN_KEY = 'diabite.deferredShown'
const markDeferredShown = () => { try { sessionStorage.setItem(DEFERRED_SHOWN_KEY, '1') } catch { /* private mode: once per page load */ } }
const ANON_KEY = 'diabite.anon'

export default function App() {
  const auth = useAuth()
  const access = useAccess()
  const signInRequired = access.required
  // A visitor who pressed "Ask a question" on the landing page: the Ask screen with the neutral profile, for this tab only (docs/specs/anon-screen.md, section 3).
  const [anon, setAnon] = useState<boolean>(() => { try { return sessionStorage.getItem(ANON_KEY) === '1' } catch { return false } })
  const startAnon = () => { try { sessionStorage.setItem(ANON_KEY, '1') } catch { /* private mode: this page load only */ } setAnon(true); setTab('ask') }
  const leaveAnon = useCallback(() => { try { sessionStorage.removeItem(ANON_KEY) } catch { /* nothing kept */ } setAnon(false) }, [])
  const anonTargets = useMemo(() => calculateTargets(ANON_PROFILE), [])
  const [tab, setTab] = useState<Tab>('ask')
  // The day and meal the Diary sent the person to Ask for. It lasts only while they stay on Ask.
  const [logTarget, setLogTarget] = useState<{ date: string; meal: MealType } | null>(null)
  // The day the Diary shows, kept here so a trip to Ask and back does not reset it; a meal logged for another day opens the Diary on that day.
  const [diaryDay, setDiaryDay] = useState<string | null>(null)
  useEffect(() => { if (tab !== 'ask') setLogTarget(null) }, [tab])
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  // "Summary for my clinician": a printable page that replaces the app while it is open, so only it prints.
  const [summaryOpen, setSummaryOpen] = useState(false)
  // Closing the page puts the focus back on the button that opened it.
  const summaryWasOpen = useRef(false)
  useEffect(() => {
    if (summaryWasOpen.current && !summaryOpen) document.getElementById('open-clinician-summary')?.focus()
    summaryWasOpen.current = summaryOpen
  }, [summaryOpen])
  // The first sentence of the disclaimer is always shown; the rest opens on a tap.
  const [disclaimerOpen, setDisclaimerOpen] = useState(false)
  // Onboarding is the first screen until it has been completed once (PRD A4);
  // afterwards it can be reopened from the profile tab.
  const [onboarding, setOnboarding] = useState(false)
  // One onboarding step opened from "Your answers" in Profile (1 Diagnosis, 2 Medicines, 3 Conditions, 4 Your day), and the line that says what saving it did.
  const [editStep, setEditStep] = useState<1 | 2 | 3 | 4 | null>(null)
  const [youNote, setYouNote] = useState('')
  useEffect(() => { if (tab !== 'profile') setYouNote('') }, [tab])
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
  const [glOpen, setGlOpen] = useState(false)
  // The card for the next question the short onboarding left for later (docs/specs/first-session-after-answer.md, section 4):
  // at most once a session. The flag is read once per page load, so a card on screen stays until it is answered or put off;
  // "Later" hides it until the next load, and the next load is a new session only when the tab was closed.
  const [deferredShownBefore] = useState<boolean>(() => { try { return sessionStorage.getItem(DEFERRED_SHOWN_KEY) === '1' } catch { return false } })
  const [deferredLater, setDeferredLater] = useState(false)

  // The account: loaded once per sign-in, then kept in step by useAccountSync.
  const [account, setAccount] = useState<AccountState>('none')
  const [serverHasProfile, setServerHasProfile] = useState(true)
  const [consent, setConsent] = useState<{ at: string | null; version: string | null }>({ at: null, version: null })
  const [waiting, setWaiting] = useState(0) // entries from before sign-in, held aside
  const [notice, setNotice] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  // Set by "Try DiaBite" on the landing page: the sign-in screen is shown instead, with a way back.
  const [entering, setEntering] = useState(false)
  // Only the account this tab holds is synced: right after another tab signs someone else in, auth.userId is theirs while this
  // tab's profile and diary are still the last person's.
  const sync = useAccountSync({ userId: auth.userId, ready: account === 'ready' && heldFor() === auth.userId, profile, diary, consent })
  // Another tab gave the device to another account: this one writes nothing more and starts again.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === 'diabite.owner.v1' && tabIsStale()) { freezeWrites(); window.location.reload() } }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  const prime = sync.prime
  const wasSignedIn = useRef(false)

  useEffect(() => saveProfile(profile), [profile])
  useEffect(() => saveDiary(diary), [diary])

  const load = useCallback(async (userId: string) => {
    // Another account's data on this device is removed before anything here reads it, and the page starts again clean,
    // so nothing of that person stays in memory either (storage.ts, OWNER_KEY). The reload finds the device unclaimed.
    // This tab already holds another account in memory (the other tab signed someone else in): it touches nothing and starts again.
    const held = heldFor()
    if (held && held !== userId) { freezeWrites(); window.location.reload(); return }
    if (localDataOwner(loadOwner(), userId) === 'someone-else') { forgetPreviousAccount(); window.location.reload(); return }
    setAccount('loading')
    try {
      const a = await loadAccount(userId)
      const local = loadDiary()
      const pending = (() => { try { return localStorage.getItem(PENDING_KEY) === '1' } catch { return false } })()
      // A failed push last time: this device holds the newer truth, so it is pushed, not overwritten.
      prime(a)
      // The tips are for a person's first visit. Which were shown is kept in this browser and signing out clears it, so
      // an account that already holds answers or a diary has been here before: it is not shown them again.
      if (a.profile?.onboarded || a.diary.length > 0) { setTourSeen([...STEP_ORDER]); saveTour([...STEP_ORDER]) }
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
      claimDevice(userId)
      holdFor(userId)
      setAccount('ready')
    } catch { setAccount('failed') }
  }, [prime])

  useEffect(() => {
    if (auth.status === 'signedIn' && auth.userId) { wasSignedIn.current = true; setSigningIn(false); leaveAnon(); void load(auth.userId) }
    if (auth.status === 'signedOut') {
      // Signed out: nothing of the account stays on screen or in memory.
      if (wasSignedIn.current) { holdFor(null); setProfile(loadProfile()); setDiary(loadDiary()); setWaiting(0) }
      // Whatever sign-out cleared stays cleared until the screen above has been reset.
      thawWrites()
      setAccount('none')
    }
  }, [auth.status, auth.userId, load, leaveAnon])

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

  // "Not now": asked again at the next sign-in, nothing lost. "Don't move", after its own confirmation: the old diary
  // is deleted from this device and never asked about again. Stable, so the dialog's effect does not run again on every render.
  const holdLegacyDiary = useCallback(() => setWaiting(0), [])
  const discardLegacyDiary = useCallback(() => {
    try { localStorage.removeItem(LEGACY_DIARY_KEY) } catch { /* storage unavailable: nothing was kept to delete */ }
    setWaiting(0)
  }, [])

  // Not yet known whether to ask for a sign-in, or who is asking: nothing of the app is shown.
  if (signInRequired === null || auth.status === 'loading' || (auth.status === 'signedIn' && account !== 'ready' && account !== 'failed')) {
    return <div className="app"><p className="muted" role="status">Opening DiaBite…</p></div>
  }
  // Signed out, sign-in required, free answers on, and the visitor asked a question: the app in anonymous mode, never over an email link or /?signin.
  const anonMode = signInRequired === true && auth.status === 'signedOut' && anon && access.freeAnswers > 0 && !authInUrl(window.location) && !skipLanding(window.location)
  if (signInRequired && auth.status === 'signedOut') {
    if (anonMode) {
      // "Make it yours" and every Sign in key: the sign-in screen, with a way back to the visitor's Ask screen.
      if (signingIn) return <SignIn notice={notice} onCancel={() => setSigningIn(false)} />
    } else {
      // A stranger sees the page about the product first. Never over an email link, a session that just ended, or /?signin.
      if (showLanding({ signInRequired, signedOut: true, notice, entering, location: window.location })) {
        return <Landing onEnter={() => setEntering(true)} freeAnswers={access.freeAnswers} onAsk={access.freeAnswers > 0 ? startAnon : undefined} />
      }
      return <SignIn notice={notice} onCancel={entering ? () => setEntering(false) : undefined} />
    }
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

  if (!anonMode && (!profile.onboarded || onboarding || editStep !== null)) {
    return (
      <div className="app">
        <header className="masthead">
          <Logo decorative />
          <Wordmark />
        </header>
        <main>
        <Onboarding
          // A person who has never finished onboarding gets the short one (docs/specs/first-session-onboarding-screen.md): one screen, the rest
          // later. "Redo onboarding" and one step from "Your answers" are the full flow, as before.
          mode={!profile.onboarded && editStep === null && !onboarding ? 'short' : 'full'}
          initial={!profile.onboarded && editStep === null && !onboarding ? shortStart(profile) : profile}
          only={editStep ?? undefined}
          askConsent={editStep === null && auth.status === 'signedIn' && !serverHasProfile}
          onDone={(p, consented) => {
            if (consented) { setConsent({ at: new Date().toISOString(), version: CONSENT_VERSION }); setServerHasProfile(true) }
            // Saving one step answers it: a step the short onboarding left for later stops being "Not asked yet".
            const step = editStep !== null ? DEFERRED_ORDER.find((d) => STEP_OF[d] === editStep) : undefined
            if (step) p = answered(p, step)
            // Redoing the whole onboarding answers every step.
            if (editStep === null && onboarding) p = { ...p, deferred: [] }
            if (editStep !== null) {
              // Saving one step says what it did, and what it had to change besides: a medicine can rule out the carbohydrate approach the person had.
              setYouNote(p.carbApproach !== profile.carbApproach
                ? `Saved. Your carbohydrate approach is now ${CARB_APPROACH_LABELS[p.carbApproach].split(' (')[0].toLowerCase()}, because of this answer.`
                : 'Saved. Your daily targets are recalculated.')
              setTab('profile')
            }
            setProfile(p); setOnboarding(false); setEditStep(null)
          }}
          onCancel={profile.onboarded ? () => { setOnboarding(false); setEditStep(null) } : undefined}
        />
        </main>
      </div>
    )
  }

  // After a short onboarding: the defaults line on Ask, and the card for the next question on Ask and Diary.
  const next = nextDeferred(profile)
  const defaultsLine = !anonMode && showDefaultsLine({ signedIn: true }, profile.deferred?.length ?? 0)
  const deferredCard = !anonMode && next !== null && showDeferredCard({
    signedIn: true, hasReceipt: false, eatenCount: eaten(diary).length, next,
    cardShownThisSession: deferredShownBefore, dismissedThisVisit: deferredLater,
    blocked: feedbackOpen || waiting > 0 || howOpen || glOpen,
  })
    ? <DeferredCard step={next} onShown={markDeferredShown} onAnswer={() => { setYouNote(''); setEditStep(STEP_OF[next]) }} onLater={() => setDeferredLater(true)} />
    : null

  if (!anonMode && summaryOpen) return <ClinicianSummary diary={diary} profile={profile} targets={targets} onClose={() => setSummaryOpen(false)} />

  return (
    <GlHelpContext.Provider value={() => setGlOpen(true)}>
    <div className="app">
      <header className="masthead">
        <Logo decorative />
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
        <button className="link disclaimer-toggle" aria-expanded={disclaimerOpen} aria-controls={disclaimerOpen ? 'disclaimer-rest' : undefined}
          onClick={() => setDisclaimerOpen((v) => !v)}>{disclaimerOpen ? 'Show less' : 'Read more'}</button>
      </div>

      {sync.status === 'error' && (
        <section className="card tone-blocked" role="alert">
          <p style={{ margin: 0 }}>Your changes haven't been saved. <button className="link" onClick={sync.retryNow}>Try again</button></p>
        </section>
      )}

      <main>
      <div role="tabpanel" id="tabpanel" aria-labelledby={`tab-${tab}`}>
      {tab === 'ask' && (
        <AskPage
          profile={anonMode ? ANON_PROFILE : profile} targets={anonMode ? anonTargets : targets} diary={anonMode ? NO_DIARY : diary}
          anonymous={anonMode ? { onSignIn: () => setSigningIn(true), onOff: () => { leaveAnon(); setEntering(false) }, freeAnswers: access.freeAnswers } : undefined}
          onLog={(added) => { setDiary((d) => [...d, ...added]); const day = added[0]?.date; if (day) setDiaryDay(day === todayISO() ? null : day) }} onOpenDiary={() => setTab('diary')} onSessionEnded={sessionEnded}
          logTarget={logTarget} onClearTarget={() => setLogTarget(null)}
          tourSeen={tourSeen} onTourSeen={(s) => { setTourSeen(s); saveTour(s) }} tourSuspended={feedbackOpen || waiting > 0 || howOpen || glOpen}
          firstSession={anonMode ? undefined : {
            line: defaultsLine,
            onMakeItYours: () => { if (next) { setYouNote(''); setEditStep(STEP_OF[next]) } },
            onOpenProfile: () => setTab('profile'),
            card: deferredCard,
          }}
        />
      )}
      {anonMode && tab === 'diary' && <SignInCard {...SIGN_IN_CARDS.diary} onSignIn={() => setSigningIn(true)} />}
      {anonMode && tab === 'menu' && <SignInCard {...SIGN_IN_CARDS.menu} onSignIn={() => setSigningIn(true)} />}
      {anonMode && tab === 'profile' && <SignInCard {...SIGN_IN_CARDS.profile} onSignIn={() => setSigningIn(true)} />}
      {!anonMode && tab === 'diary' && (
        <DiaryPage targets={targets} diary={diary} onChange={setDiary} picked={diaryDay} onPick={setDiaryDay} onAsk={(target) => { setLogTarget(target ?? null); setTab('ask') }} showBreadUnits={profile.showBreadUnits} units={profile.units} topCard={deferredCard} />
      )}
      {!anonMode && tab === 'menu' && (
        <MenuPage
          profile={profile} targets={targets} diary={diary} onAsk={() => setTab('ask')}
          onAdd={(added) => setDiary((d) => [...d, ...added])}
          onRemove={(ids) => setDiary((d) => d.filter((e) => !ids.includes(e.id)))}
          onOpenDiary={() => setTab('diary')}
        />
      )}
      {!anonMode && tab === 'profile' && (
        <ProfilePage
          profile={profile}
          targets={targets}
          onChange={setProfile}
          onRedoOnboarding={() => setOnboarding(true)}
          onEditAnswers={(step) => { setYouNote(''); setEditStep(step) }}
          note={youNote}
        />
      )}
      {tab === 'settings' && (
        <SettingsPage
          anonymous={anonMode ? { onSignIn: () => setSigningIn(true) } : undefined}
          onFeedback={() => setFeedbackOpen(true)}
          onHowItWorks={() => setHowOpen(true)}
          onGlInfo={() => setGlOpen(true)}
          onClinicianSummary={() => setSummaryOpen(true)}
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
            aria-controls="tabpanel"
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
      {glOpen && <GlInfo budget={anonMode ? anonTargets.glBudget : targets.glBudget} onClose={() => setGlOpen(false)} />}
      {waiting > 0 && !feedbackOpen && <ImportPrompt count={waiting} onMove={moveLegacyDiary} onLater={holdLegacyDiary} onDiscard={discardLegacyDiary} />}
    </div>
    </GlHelpContext.Provider>
  )
}
