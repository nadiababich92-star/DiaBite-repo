import { useState } from 'react'
import { MEAL_CARBS_MAX, MEAL_CARBS_MIN } from '../lib/profile'

/**
 * The carbohydrate per meal the person's doctor or dietitian suggested. Optional, and never prefilled: the number is
 * theirs, DiaBite has no default for it (docs/PLAN.md, "Questions waiting for a clinician"). Empty means no number.
 */
export default function MealCarbsLimit({ value, onChange, kind }: { value: number; onChange: (g: number) => void; kind: 'meal' | 'snack' }) {
  const [text, setText] = useState(value > 0 ? String(value) : '')
  const typed = Number(text)
  const bad = text !== '' && (!Number.isFinite(typed) || typed < MEAL_CARBS_MIN || typed > MEAL_CARBS_MAX)
  const change = (t: string) => {
    setText(t)
    const n = Number(t)
    onChange(t !== '' && Number.isFinite(n) && n >= MEAL_CARBS_MIN && n <= MEAL_CARBS_MAX ? Math.round(n) : 0)
  }
  return (
    <label className="field">
      <span>Carbohydrate per {kind === 'snack' ? 'snack' : 'main meal'} your doctor or dietitian suggested (optional)</span>
      <input type="number" inputMode="numeric" min={MEAL_CARBS_MIN} max={MEAL_CARBS_MAX} placeholder="I don't have a number"
        value={text} onChange={(e) => change(e.target.value)} aria-invalid={bad} aria-describedby={`${kind}-carbs-hint`} />
      <span id={`${kind}-carbs-hint`} className={bad ? 'field-error' : 'muted'}>
        {bad ? `Enter grams between ${MEAL_CARBS_MIN} and ${MEAL_CARBS_MAX}, or leave it empty.`
             : `In grams. If you set one, an answer tells you when a ${kind} goes above it. Leave it empty if you were not given one.`}
      </span>
    </label>
  )
}
