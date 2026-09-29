import { useMemo, useState } from 'react'
import {
  ACTIVITY_LABELS, ALLERGEN_LABELS, CARB_APPROACH_LABELS, COMORBIDITY_LABELS, CONDITION_LABELS,
  EXIT_COPY, GOAL_LABELS, INSULIN_LABELS, KIDNEY_LABELS, MED_LABELS,
  calculateTargets, carbApproachBlocked, cmToFtIn, exitReason, ftInToCm, kgToLb, lbToKg,
} from '../lib/profile'
import type {
  Activity, Allergen, CarbApproach, Comorbidity, Condition, Goal, Insulin, Kidney, Med, Profile, Sex,
} from '../types'

interface Props {
  initial: Profile
  onDone: (p: Profile) => void
  /** Present when an existing user reopened onboarding from the profile tab. */
  onCancel?: () => void
}

const STEPS = ['You', 'Diagnosis', 'Medicines', 'Conditions', 'Your day'] as const

const CONDITIONS: Condition[] = ['t2', 'prediabetes', 'ir', 't1', 'gestational', 'unsure']
const INSULINS: Insulin[] = ['none', 'basal', 'mealtime_or_pump']
const MEDS: Med[] = ['metformin', 'sulfonylurea', 'sglt2', 'glp1', 'other']
const KIDNEYS: Kidney[] = ['none', 'mentioned', 'ckd', 'dialysis']
const COMORBIDITIES: Comorbidity[] = ['htn', 'ascvd', 'masld', 'gout', 'gastroparesis', 'celiac', 'pcos', 'eatingDisorder']
const ALLERGENS: Allergen[] = ['milk', 'egg', 'fish', 'shellfish', 'treenuts', 'peanuts', 'wheat', 'soy', 'sesame', 'gluten', 'lactose']
const APPROACHES: CarbApproach[] = ['moderate', 'low', 'verylow']
const GOALS: Goal[] = ['lose', 'maintain', 'gain']

/** Toggle membership in a list-valued profile field. */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export default function Onboarding({ initial, onDone, onCancel }: Props) {
  const [p, setP] = useState<Profile>({ ...initial, onboarded: false })
  const [step, setStep] = useState(0)
  const [agreed, setAgreed] = useState(false)

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setP((prev) => ({ ...prev, [key]: value }))

  const exit = exitReason(p)
  const targets = useMemo(() => calculateTargets(p), [p])
  const blocked = carbApproachBlocked(p, p.carbApproach)

  // A blocked approach must not silently survive to the targets screen.
  if (blocked && step >= 4) set('carbApproach', 'moderate')

  /**
   * Leaving an exit screen has to clear the answer that caused it — otherwise
   * "go back" lands on a step whose content the exit screen is still covering,
   * and the person is stuck with no way to correct a mis-tap.
   */
  function changeAnswer() {
    if (exit === 'minor') { setStep(0); return }
    if (exit === 'pregnancy') {
      setP((prev) => ({
        ...prev,
        pregnantOrBreastfeeding: false,
        condition: prev.condition === 'gestational' ? 'unsure' : prev.condition,
      }))
      setStep(p.condition === 'gestational' ? 1 : 2)
      return
    }
    setP((prev) => ({ ...prev, insulin: 'none' }))
    setStep(2)
  }

  const last = step === STEPS.length - 1
  const canGoOn = !exit
  const next = () => (last ? agreed && onDone({ ...p, onboarded: true }) : setStep(step + 1))

  const { ft, in: inch } = cmToFtIn(p.heightCm)
  const imperial = p.units === 'imperial'

  return (
    <div className="onb">
      <ol className="onb-steps" aria-label="Onboarding progress">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
            <span className="n">{i + 1}</span> {s}
          </li>
        ))}
      </ol>

      <section className="card onb-card">
        {exit ? (
          <div className="onb-exit">
            <p className="eyebrow-line">This one is not for us to answer</p>
            <h2>{EXIT_COPY[exit].title}</h2>
            <p>{EXIT_COPY[exit].body}</p>
            <p className="muted">
              Nothing you entered has left this device. You can go back and change your answer if you
              picked the wrong one.
            </p>
            <div className="row">
              <button className="ghost" onClick={changeAnswer}>
                {exit === 'minor' ? 'Change my age' : 'Change that answer'}
              </button>
              {onCancel && <button className="link" onClick={onCancel}>Leave onboarding</button>}
            </div>
          </div>
        ) : (
          <>
            {step === 0 && (
              <>
                <h2>First, the numbers the formula needs</h2>
                <p className="muted">
                  Energy and protein targets come from the Mifflin-St Jeor equation, which needs these
                  five. Nothing here leaves your browser.
                </p>
                <div className="grid">
                  <label className="field">
                    <span>Sex assigned at birth <em>used only for the energy formula</em></span>
                    <select value={p.sex} onChange={(e) => set('sex', e.target.value as Sex)}>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="unspecified">Prefer not to say</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Age</span>
                    <input type="number" min={1} max={110} value={p.age}
                      onChange={(e) => set('age', Number(e.target.value))} />
                  </label>
                </div>

                <div className="row onb-units">
                  <span className="muted">Units</span>
                  <button className={`ghost${imperial ? ' on' : ''}`} onClick={() => set('units', 'imperial')}>ft / lb</button>
                  <button className={`ghost${imperial ? '' : ' on'}`} onClick={() => set('units', 'metric')}>cm / kg</button>
                </div>

                <div className="grid">
                  {imperial ? (
                    <>
                      <label className="field">
                        <span>Height</span>
                        <div className="row onb-height">
                          <input type="number" min={3} max={7} value={ft} aria-label="Feet"
                            onChange={(e) => set('heightCm', ftInToCm(Number(e.target.value), inch))} />
                          <span className="muted">ft</span>
                          <input type="number" min={0} max={11} value={inch} aria-label="Inches"
                            onChange={(e) => set('heightCm', ftInToCm(ft, Number(e.target.value)))} />
                          <span className="muted">in</span>
                        </div>
                      </label>
                      <label className="field">
                        <span>Weight, lb</span>
                        <input type="number" min={80} max={660} value={kgToLb(p.weightKg)}
                          onChange={(e) => set('weightKg', lbToKg(Number(e.target.value)))} />
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="field">
                        <span>Height, cm</span>
                        <input type="number" min={120} max={220} value={p.heightCm}
                          onChange={(e) => set('heightCm', Number(e.target.value))} />
                      </label>
                      <label className="field">
                        <span>Weight, kg</span>
                        <input type="number" min={35} max={300} step={0.5} value={p.weightKg}
                          onChange={(e) => set('weightKg', Number(e.target.value))} />
                      </label>
                    </>
                  )}
                  <label className="field">
                    <span>Activity</span>
                    <select value={p.activity} onChange={(e) => set('activity', e.target.value as Activity)}>
                      {(Object.keys(ACTIVITY_LABELS) as Activity[]).map((a) => (
                        <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h2>Which of these describes you?</h2>
                <p className="muted">
                  This sets how cautious the daily ceiling is. If you are not sure, say so — the next
                  question about medicines matters more than the label.
                </p>
                <div className="chips-col">
                  {CONDITIONS.map((c) => (
                    <button key={c} className={`chip-btn${p.condition === c ? ' on' : ''}`}
                      aria-pressed={p.condition === c} onClick={() => set('condition', c)}>
                      {CONDITION_LABELS[c]}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2>What do you take for glucose?</h2>
                <p className="muted">
                  Classes only — never doses. Medicines change what is safe to recommend more than the
                  diagnosis does.
                </p>

                <h3>Insulin</h3>
                <div className="chips-col">
                  {INSULINS.map((i) => (
                    <button key={i} className={`chip-btn${p.insulin === i ? ' on' : ''}`}
                      aria-pressed={p.insulin === i} onClick={() => set('insulin', i)}>
                      {INSULIN_LABELS[i]}
                    </button>
                  ))}
                </div>

                <h3>Tablets and injections</h3>
                <div className="chips-col">
                  {MEDS.map((m) => (
                    <label key={m} className="check-row">
                      <input type="checkbox" checked={p.meds.includes(m)} aria-label={MED_LABELS[m]}
                        onChange={() => set('meds', toggle(p.meds, m))} />
                      <span>{MED_LABELS[m]}</span>
                    </label>
                  ))}
                </div>

                {p.sex === 'female' && p.age <= 50 && (
                  <label className="check-row onb-flag">
                    <input type="checkbox" checked={p.pregnantOrBreastfeeding}
                      aria-label="Pregnant, planning a pregnancy, or breastfeeding"
                      onChange={(e) => set('pregnantOrBreastfeeding', e.target.checked)} />
                    <span>I'm pregnant, planning a pregnancy, or breastfeeding</span>
                  </label>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <h2>Anything else we should know?</h2>
                <p className="muted">
                  Each item here changes a number or a filter — nothing is collected for its own sake.
                  Skipping the screen is fine.
                </p>

                <h3>Kidneys</h3>
                <label className="field">
                  <span className="sr-only">Kidneys</span>
                  <select value={p.kidney} aria-label="Kidneys"
                    onChange={(e) => set('kidney', e.target.value as Kidney)}>
                    {KIDNEYS.map((k) => <option key={k} value={k}>{KIDNEY_LABELS[k]}</option>)}
                  </select>
                </label>

                <h3>Conditions</h3>
                <div className="chips">
                  {COMORBIDITIES.map((c) => (
                    <button key={c} className={`chip-toggle${p.comorbidities.includes(c) ? ' on' : ''}`}
                      aria-pressed={p.comorbidities.includes(c)}
                      onClick={() => set('comorbidities', toggle(p.comorbidities, c))}>
                      {COMORBIDITY_LABELS[c]}
                    </button>
                  ))}
                </div>

                <h3>Foods to keep out of every suggestion</h3>
                <div className="chips">
                  {ALLERGENS.map((a) => (
                    <button key={a} className={`chip-toggle${p.allergens.includes(a) ? ' on' : ''}`}
                      aria-pressed={p.allergens.includes(a)}
                      onClick={() => set('allergens', toggle(p.allergens, a))}>
                      {ALLERGEN_LABELS[a]}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <h2>Your day, and where these numbers come from</h2>

                <div className="grid">
                  <label className="field">
                    <span>Goal</span>
                    <select value={p.goal} onChange={(e) => set('goal', e.target.value as Goal)}>
                      {GOALS.map((g) => <option key={g} value={g}>{GOAL_LABELS[g]}</option>)}
                    </select>
                  </label>
                </div>

                <h3>Carbohydrate approach</h3>
                <div className="chips-col">
                  {APPROACHES.map((a) => {
                    const why = carbApproachBlocked(p, a)
                    return (
                      <button key={a} className={`chip-btn${p.carbApproach === a ? ' on' : ''}`}
                        aria-pressed={p.carbApproach === a} disabled={!!why}
                        onClick={() => set('carbApproach', a)}>
                        {CARB_APPROACH_LABELS[a]}
                        {why && <em className="chip-why">{why}</em>}
                      </button>
                    )
                  })}
                </div>

                <h3>What that gives you</h3>
                <div className="stats">
                  <div className="stat"><div className="label">Calories</div><div className="value">{targets.kcal}</div></div>
                  <div className="stat"><div className="label">Carbs</div><div className="value">{targets.carbsG} g</div></div>
                  <div className="stat"><div className="label">Protein</div><div className="value">{targets.proteinG} g</div></div>
                  <div className="stat"><div className="label">Fibre</div><div className="value">{targets.fiberG} g</div></div>
                  <div className="stat"><div className="label">GL budget</div><div className="value">{targets.glBudget}</div></div>
                </div>

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

                <label className="check-row onb-flag">
                  <input type="checkbox" checked={agreed} aria-label="I understand this is not medical advice"
                    onChange={(e) => setAgreed(e.target.checked)} />
                  <span>
                    I understand DiaBite is a reference tool, not medical advice, and that its numbers
                    must never be used to calculate insulin doses.
                  </span>
                </label>
              </>
            )}

            <div className="row onb-actions">
              {step > 0 && <button className="ghost" onClick={() => setStep(step - 1)}>Back</button>}
              <button className="primary" onClick={next} disabled={!canGoOn || (last && !agreed)}>
                {last ? 'Start using DiaBite' : 'Continue'}
              </button>
              {!last && <span className="muted">Step {step + 1} of {STEPS.length}</span>}
              {onCancel && <button className="link" onClick={onCancel}>Cancel</button>}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
