import { useState } from 'react'
import { CATEGORY_LABELS, FOODS, getFood } from '../data/foods'
import {
  ACTIVITY_LABELS,
  CARB_APPROACH_LABELS,
  CONDITION_LABELS,
  GOAL_LABELS,
} from '../lib/profile'
import type { Activity, CarbApproach, Condition, Goal, Profile, Sex, Targets } from '../types'

interface Props {
  profile: Profile
  targets: Targets
  onChange: (p: Profile) => void
  /** Reopens the onboarding flow, where the medical answers live. */
  onRedoOnboarding: () => void
}

export default function ProfilePage({ profile, targets, onChange, onRedoOnboarding }: Props) {
  const [query, setQuery] = useState('')

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    onChange({ ...profile, [key]: value })

  const excluded = new Set(profile.excludedFoodIds)
  const matches =
    query.trim().length < 2
      ? []
      : FOODS.filter(
          (f) => !excluded.has(f.id) && f.name.toLowerCase().includes(query.trim().toLowerCase()),
        ).slice(0, 8)

  return (
    <>
      <section className="card">
        <h2>About you</h2>
        <div className="grid">
          <label className="field">
            <span>Sex</span>
            <select value={profile.sex} onChange={(e) => set('sex', e.target.value as Sex)}>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </label>
          <label className="field">
            <span>Age, years</span>
            <input
              type="number" min={14} max={100} value={profile.age}
              onChange={(e) => set('age', Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>Height, cm</span>
            <input
              type="number" min={120} max={220} value={profile.heightCm}
              onChange={(e) => set('heightCm', Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>Weight, kg</span>
            <input
              type="number" min={35} max={250} step={0.5} value={profile.weightKg}
              onChange={(e) => set('weightKg', Number(e.target.value))}
            />
          </label>
        </div>

        <h3>Condition and goals</h3>
        <div className="grid">
          <label className="field">
            <span>Condition</span>
            <select
              value={profile.condition}
              onChange={(e) => set('condition', e.target.value as Condition)}
            >
              {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Activity</span>
            <select
              value={profile.activity}
              onChange={(e) => set('activity', e.target.value as Activity)}
            >
              {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Weight goal</span>
            <select value={profile.goal} onChange={(e) => set('goal', e.target.value as Goal)}>
              {Object.entries(GOAL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Carbohydrate approach</span>
            <select
              value={profile.carbApproach}
              onChange={(e) => set('carbApproach', e.target.value as CarbApproach)}
            >
              {Object.entries(CARB_APPROACH_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Your daily targets</h2>
        <div className="stats">
          <div className="stat">
            <div className="label">Calories</div>
            <div className="value">{targets.kcal}</div>
            <div className="sub">kcal a day</div>
          </div>
          <div className="stat">
            <div className="label">Carbohydrate</div>
            <div className="value">{targets.carbsG} g</div>
            <div className="sub">≈ {(targets.carbsG / 12).toFixed(1)} BU</div>
          </div>
          <div className="stat">
            <div className="label">Protein</div>
            <div className="value">{targets.proteinG} g</div>
            <div className="sub">{(targets.proteinG / profile.weightKg).toFixed(1)} g/kg</div>
          </div>
          <div className="stat">
            <div className="label">Fat</div>
            <div className="value">{targets.fatG} g</div>
            <div className="sub">remaining calories</div>
          </div>
          <div className="stat">
            <div className="label">Fibre</div>
            <div className="value">{targets.fiberG} g</div>
            <div className="sub">minimum a day</div>
          </div>
          <div className="stat">
            <div className="label">Glycemic load</div>
            <div className="value">{targets.glBudget}</div>
            <div className="sub">daily ceiling</div>
          </div>
        </div>
        <p className="muted">
          Calories use Mifflin-St Jeor with an activity factor. Carbohydrate is a share of that
          energy, set by the approach you chose. The glycemic-load ceiling is derived so the diet
          holds a mean GI of about {profile.condition === 't1' || profile.condition === 't2' ? 45 : 50}.
        </p>

        {targets.constraints.length > 0 && (
          <>
            <h3>What your answers changed</h3>
            <ul className="why-list">
              {targets.constraints.map((c) => (
                <li key={c.id}>
                  <span className={`pill ${c.field === 'none' ? 'none' : 'medium'}`}>
                    {c.field === 'none' ? 'advice' : c.field}
                  </span>{' '}
                  {c.reason}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="row" style={{ marginTop: 14 }}>
          <button className="ghost" onClick={onRedoOnboarding}>Review my medical answers</button>
          <span className="muted">Insulin, medicines, kidneys, other conditions</span>
        </div>
      </section>

      <section className="card">
        <h2>Excluded foods</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Allergy, intolerance, or simply not something you eat. Dishes containing these will
          never appear in a generated menu.
        </p>
        <input
          type="text"
          placeholder="Start typing a food name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {matches.length > 0 && (
          <div className="search-results">
            {matches.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  set('excludedFoodIds', [...profile.excludedFoodIds, f.id])
                  setQuery('')
                }}
              >
                <span>{f.name}</span>
                <span className="meta">{CATEGORY_LABELS[f.category]}</span>
              </button>
            ))}
          </div>
        )}
        {profile.excludedFoodIds.length > 0 && (
          <div className="chips">
            {profile.excludedFoodIds.map((id) => (
              <span key={id} className="chip">
                {getFood(id).name}
                <button
                  className="link"
                  aria-label="Remove from exclusions"
                  onClick={() =>
                    set('excludedFoodIds', profile.excludedFoodIds.filter((x) => x !== id))
                  }
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
