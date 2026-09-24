import { useEffect, useMemo, useState } from 'react'
import AskPage from './components/AskPage'
import DiaryPage from './components/DiaryPage'
import FeedbackModal from './components/FeedbackModal'
import Onboarding from './components/Onboarding'
import MenuPage from './components/MenuPage'
import ProfilePage from './components/ProfilePage'
import { calculateTargets } from './lib/profile'
import { loadDiary, loadProfile, saveDiary, saveProfile } from './lib/storage'
import type { DiaryEntry, Profile } from './types'

type Tab = 'ask' | 'diary' | 'menu' | 'profile'

const TABS: { id: Tab; label: string }[] = [
  { id: 'ask', label: 'Can I eat this?' },
  { id: 'diary', label: 'Diary' },
  { id: 'menu', label: 'Weekly menu' },
  { id: 'profile', label: 'Profile' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('ask')
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  // Onboarding is the first screen until it has been completed once (PRD A4);
  // afterwards it can be reopened from the profile tab.
  const [onboarding, setOnboarding] = useState(false)
  const [profile, setProfile] = useState<Profile>(loadProfile)
  const [diary, setDiary] = useState<DiaryEntry[]>(loadDiary)

  useEffect(() => saveProfile(profile), [profile])
  useEffect(() => saveDiary(diary), [diary])

  const targets = useMemo(() => calculateTargets(profile), [profile])

  if (!profile.onboarded || onboarding) {
    return (
      <div className="app">
        <header className="masthead">
          <h1>DiaBite</h1>
          <p>Nutrition for type 2 diabetes and insulin resistance</p>
        </header>
        <Onboarding
          initial={profile}
          onDone={(p) => { setProfile(p); setOnboarding(false) }}
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

      <nav className="tabs">
        <div className="tab-row" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button className="tab-action" onClick={() => setFeedbackOpen(true)}>Feedback</button>
      </nav>

      {tab === 'ask' && (
        <AskPage targets={targets} diary={diary} onLog={(added) => setDiary((d) => [...d, ...added])} />
      )}
      {tab === 'diary' && (
        <DiaryPage targets={targets} diary={diary} onChange={setDiary} />
      )}
      {tab === 'menu' && <MenuPage profile={profile} targets={targets} />}
      {tab === 'profile' && (
        <ProfilePage
          profile={profile}
          targets={targets}
          onChange={setProfile}
          onRedoOnboarding={() => setOnboarding(true)}
        />
      )}

      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </div>
  )
}
