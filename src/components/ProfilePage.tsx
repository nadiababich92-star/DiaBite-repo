import { useState } from 'react'
import { CATEGORY_LABELS, FOODS } from '../data/foods'
import { excludedLabel, ingredientOptions, isIngredientId, nameMatches } from '../lib/excludable'
import { loadMenuRecipes } from '../lib/recipes'
import {
  ACTIVITY_LABELS,
  CARB_APPROACH_LABELS,
  CONDITION_LABELS,
  COUNT_BY_LABELS,
  GOAL_LABELS,
} from '../lib/profile'
import { answerRows } from '../lib/answers'
import GiGlExplainer from './GiGlExplainer'
import MealCarbsLimit from './MealCarbsLimit'
import type { Activity, CarbApproach, Condition, CountBy, Goal, Profile, Sex, Targets } from '../types'

interface Props {
  profile: Profile
  targets: Targets
  onChange: (p: Profile) => void
  /** Reopens the onboarding flow, where the medical answers live. */
  onRedoOnboarding: () => void
  /** Opens one onboarding step on its own: 2 Medicines, 3 Conditions. */
  onEditAnswers: (step: 2 | 3) => void
  /** What saving one step just did, shown at the top. */
  note?: string
}

export default function ProfilePage({ profile, targets, onChange, onRedoOnboarding, onEditAnswers, note }: Props) {
  const [query, setQuery] = useState('')

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    onChange({ ...profile, [key]: value })

  const excluded = new Set(profile.excludedFoodIds)
  // The recipes' ingredients are in a separate file, fetched the first time the box is used.
  const [, setRecipesReady] = useState(0)
  const loadIngredients = () => { loadMenuRecipes().then(() => setRecipesReady((n) => n + 1)).catch(() => {}) }
  const q = query.trim().toLowerCase()
  const matches: { id: string; name: string; hint: string }[] =
    q.length < 2
      ? []
      : (() => {
          const all = [...FOODS.map((f) => ({ id: f.id, name: f.name, hint: CATEGORY_LABELS[f.category] })), ...ingredientOptions()].filter((f) => !excluded.has(f.id))
          // What was typed as a part of a word comes first; a word typed with one slip ("pistacio") follows.
          const exact = all.filter((f) => nameMatches(f.name, q, false))
          return [...exact, ...all.filter((f) => !exact.includes(f) && nameMatches(f.name, q))].slice(0, 8)
        })()

  return (
    <>
      {note && <p className="muted you-note" role="status">{note}</p>}
      <section className="card">
        <details className="recipe-more">
          <summary>Put DiaBite on your home screen</summary>
          <p className="muted" style={{ marginTop: 0 }}>It then opens like an app, with no address to type.</p>
          <h3>iPhone or iPad</h3>
          <ol className="recipe-steps">
            <li>Open diabite.pro in Safari.</li>
            <li>Tap the Share button, the square with an arrow.</li>
            <li>Choose Add to Home Screen, then Add.</li>
          </ol>
          <h3>Android</h3>
          <ol className="recipe-steps">
            <li>Open diabite.pro in Chrome.</li>
            <li>Tap the menu, the three dots at the top right.</li>
            <li>Choose Add to Home screen (or Install app), then confirm.</li>
          </ol>
          <h3>Computer</h3>
          <ol className="recipe-steps">
            <li>In Chrome or Edge, look for the install icon at the right end of the address bar.</li>
            <li>Click it, then Install.</li>
          </ol>
        </details>
      </section>
      <section className="card">
        <h2>About you</h2>
        <div className="grid">
          <label className="field">
            <span>Sex</span>
            <select value={profile.sex} onChange={(e) => set('sex', e.target.value as Sex)}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="unspecified">Prefer not to say</option>
            </select>
          </label>
          <label className="field">
            <span>Age, years</span>
            <input
              type="number" inputMode="numeric" min={14} max={100} value={profile.age}
              onChange={(e) => set('age', Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>Height, cm</span>
            <input
              type="number" inputMode="decimal" min={120} max={220} value={profile.heightCm}
              onChange={(e) => set('heightCm', Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>Weight, kg</span>
            <input
              type="number" inputMode="decimal" min={35} max={250} step={0.5} value={profile.weightKg}
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
          <label className="field">
            <span>What you usually count</span>
            <select value={profile.countBy} onChange={(e) => set('countBy', e.target.value as CountBy)}>
              {Object.entries(COUNT_BY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted" style={{ margin: '12px 0 0' }}>
          The carbohydrate approach moves your carbohydrate, fat and glycemic-load targets below. Calories
          and protein come from your body, activity and weight goal, so they stay the same when you change it.
          What you usually count only decides which figures come first on an answer; both are always shown.
        </p>
        <h3>Carbohydrate per meal</h3>
        <div className="grid grid-2">
          <MealCarbsLimit kind="meal" value={profile.mealCarbsG} onChange={(g) => set('mealCarbsG', g)} />
          <MealCarbsLimit kind="snack" value={profile.snackCarbsG} onChange={(g) => set('snackCarbsG', g)} />
        </div>
        <GiGlExplainer />
      </section>

      <section className="card">
        <h2>Your daily targets</h2>
        <label className="check-row">
          <input type="checkbox" checked={profile.showBreadUnits} onChange={(e) => set('showBreadUnits', e.target.checked)} />
          <span>Also show bread units <em className="muted">(1 BU = 12 g of carbohydrate)</em></span>
        </label>
        <div className="stats">
          <div className="stat">
            <div className="label">Calories</div>
            <div className="value">{targets.kcal}</div>
            <div className="sub">kcal a day</div>
          </div>
          <div className="stat">
            <div className="label">Carbohydrate</div>
            <div className="value">{targets.carbsG} g</div>
            <div className="sub">{profile.showBreadUnits ? `≈ ${(targets.carbsG / 12).toFixed(1)} BU` : 'grams a day'}</div>
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
        <h2>Your answers</h2>
        <p className="muted" style={{ marginTop: 0 }}>What you told us at the start. Change one without going through the rest.</p>
        <ul className="answers">
          {answerRows(profile).map((r) => (
            <li key={r.id}>
              <div>
                <b>{r.title}</b>
                <span className="muted">{r.text}</span>
              </div>
              <button className="ghost" aria-label={`Edit ${r.title.toLowerCase()}`} onClick={() => onEditAnswers(r.step)}>Edit</button>
            </li>
          ))}
        </ul>
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
          onFocus={loadIngredients}
          aria-describedby="excluded-hint"
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
                <span className="meta">{f.hint}</span>
              </button>
            ))}
          </div>
        )}
        {query.trim().length >= 2 && matches.length === 0 && (
          <p className="muted" role="status" style={{ margin: '8px 0 0' }}>
            No food or recipe ingredient matches "{query.trim()}".
          </p>
        )}
        <p id="excluded-hint" className="muted" style={{ margin: '8px 0 0' }}>
          This list is for single foods. For an allergy (for example shellfish, milk or nuts) or a way of eating
          (for example vegetarian or halal), use the questions you answered at the start: they cover the whole group.{' '}
          <button type="button" className="link" onClick={onRedoOnboarding}>Go through them again</button>
        </p>
        {profile.excludedFoodIds.some(isIngredientId) && (
          <p className="muted" style={{ margin: '8px 0 0' }}>
            An ingredient you add from the recipes is kept out of the weekly menu and out of the swaps DiaBite suggests.
            If you describe a meal that contains it, DiaBite still counts the meal as you said it, so look at what it used.
          </p>
        )}
        {profile.excludedFoodIds.length > 0 && (
          <div className="chips">
            {profile.excludedFoodIds.map((id) => (
              <span key={id} className="chip">
                {excludedLabel(id)}
                <button
                  className="link"
                  aria-label={`Remove ${excludedLabel(id)} from exclusions`}
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
