import { useState } from 'react'
import { DAILY_CARBS_MAX, DAILY_CARBS_MIN, MEAL_CARBS_MAX, MEAL_CARBS_MIN } from '../lib/profile'

type Kind = 'day' | 'meal' | 'snack'

/**
 * A carbohydrate number the person's doctor or dietitian gave them: for a day, a main meal or a snack. Optional, and
 * never prefilled: the number is theirs, DiaBite has no default for it (docs/PLAN.md, "Questions waiting for a
 * clinician"). Empty means no number. A daily number replaces the one DiaBite calculates; a meal or snack number only
 * tells the person when one goes above it.
 */
export default function MealCarbsLimit({ value, onChange, kind }: { value: number; onChange: (g: number) => void; kind: Kind }) {
  const min = kind === 'day' ? DAILY_CARBS_MIN : MEAL_CARBS_MIN
  const max = kind === 'day' ? DAILY_CARBS_MAX : MEAL_CARBS_MAX
  const [text, setText] = useState(value > 0 ? String(value) : '')
  const typed = Number(text)
  const bad = text !== '' && (!Number.isFinite(typed) || typed < min || typed > max)
  const change = (t: string) => {
    setText(t)
    const n = Number(t)
    onChange(t !== '' && Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : 0)
  }
  const label = kind === 'day' ? 'a day' : `per ${kind === 'snack' ? 'snack' : 'main meal'}`
  return (
    <label className="field">
      <span>Carbohydrate {label} your doctor or dietitian suggested (optional)</span>
      <input type="number" inputMode="numeric" min={min} max={max} placeholder="I don't have a number"
        value={text} onChange={(e) => change(e.target.value)} aria-invalid={bad} aria-describedby={`${kind}-carbs-hint`} />
      <span id={`${kind}-carbs-hint`} className={bad ? 'field-error' : 'muted'}>
        {bad ? `Enter grams between ${min} and ${max}, or leave it empty.`
          : kind === 'day'
            ? 'In grams. If you set one, DiaBite counts your day against it instead of its own figure. Leave it empty if you were not given one.'
            : `In grams. If you set one, an answer tells you when a ${kind} goes above it. Leave it empty if you were not given one.`}
      </span>
    </label>
  )
}
