import { useMemo, useState } from 'react'
import { CATEGORY_LABELS, getFood } from '../data/foods'
import { MEAL_LABELS, generateWeek, menuHidden, regenerateSlot, shoppingList, shoppingText } from '../lib/menu'
import type { PlannedMeal, WeekPlan } from '../lib/menu'
import type { MealType, Profile, Targets } from '../types'
import { DayGLPill, GIPill, GLPill } from './Pills'

interface Props {
  profile: Profile
  targets: Targets
  /** Switch to the Ask tab, for the profiles that are not shown a plan. */
  onAsk?: () => void
}

const CHECKED_KEY = 'diabite.shopping.v1'

/** Ticked shopping lines, remembered only while the plan they belong to is the one on screen. */
function loadChecked(seed: number): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(CHECKED_KEY) ?? 'null') as { seed?: number; checked?: string[] } | null
    return raw && raw.seed === seed && Array.isArray(raw.checked) ? new Set(raw.checked.filter((x) => typeof x === 'string')) : new Set()
  } catch { return new Set() }
}
function saveChecked(seed: number, checked: Set<string>) {
  try { localStorage.setItem(CHECKED_KEY, JSON.stringify({ seed, checked: [...checked] })) } catch { /* storage unavailable */ }
}

export default function MenuPage({ profile, targets, onAsk }: Props) {
  const hidden = menuHidden(profile)
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9))
  const [showList, setShowList] = useState(false)
  const [edited, setEdited] = useState<{ base: WeekPlan; plan: WeekPlan } | null>(null)
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(() => loadChecked(seed))

  // Not computed at all for a profile that is not shown a plan.
  const base = useMemo(() => (hidden ? null : generateWeek(profile, targets, seed)), [hidden, profile, targets, seed])
  const plan = edited && edited.base === base ? edited.plan : base
  const list = useMemo(() => (plan ? shoppingList(plan) : []), [plan])

  if (hidden || !plan || !base) {
    return (
      <section className="card">
        <h2>A weekly menu is not something DiaBite should plan for you.</h2>
        <p className="muted">
          With what you told us, a fixed plan of meals and calories is better written by your doctor or
          dietitian. You can still ask about any meal you are thinking of eating.
        </p>
        {onAsk && <button className="primary" onClick={onAsk}>Ask about a meal</button>}
      </section>
    )
  }

  const avgKcal = plan.days.reduce((s, d) => s + d.totals.kcal, 0) / plan.days.length
  const avgGL = plan.days.reduce((s, d) => s + d.gl, 0) / plan.days.length

  const regenerate = () => {
    const next = Math.floor(Math.random() * 1e9)
    setSeed(next); setEdited(null); setNote(''); setChecked(new Set()); saveChecked(next, new Set())
  }
  const replace = (dayIndex: number, meal: MealType) => {
    const r = regenerateSlot(plan, dayIndex, meal, profile, targets, Math.floor(Math.random() * 1e9))
    if (!r.changed) { setNote('There is no other dish that fits what you avoid for this meal.'); return }
    setEdited({ base, plan: r.plan })
    const dish = r.plan.days[dayIndex].meals.find((m) => m.meal === meal)?.dish.name
    setNote(`Replaced with ${dish}.${r.relaxed ? ' Few dishes fit what you avoid, so this one may come back soon.' : ''}`)
  }
  const toggle = (name: string) => {
    const next = new Set(checked)
    if (next.has(name)) next.delete(name); else next.add(name)
    setChecked(next); saveChecked(seed, next)
  }
  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(shoppingText(list, CATEGORY_LABELS))
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { setNote('Copying did not work on this device. Select the list and copy it by hand.') }
  }

  return (
    <>
      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0 }}>Weekly menu</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Averaging {avgKcal.toFixed(0)} kcal and GL {avgGL.toFixed(0)} a day, against a target of{' '}
              {targets.kcal} kcal and GL {targets.glBudget}.
            </p>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              These meals have not been reviewed by a clinician yet. Treat them as ideas, and check anything
              that matters for your health with your doctor or dietitian.
            </p>
            {plan.pool.available < plan.pool.total && (
              <p className="muted" style={{ margin: '4px 0 0' }}>
                {plan.pool.available} of {plan.pool.total} dishes fit what you avoid
                {plan.pool.available < 12 && ' — too few for a week without repeats, so the same meals come round quickly. More recipes are the fix, not fewer restrictions.'}
              </p>
            )}
            <p className="muted" role="status" aria-live="polite" style={{ margin: '4px 0 0' }}>{note}</p>
          </div>
          <div className="row">
            <button className="ghost" onClick={() => setShowList((v) => !v)}>
              {showList ? 'Hide shopping list' : 'Shopping list'}
            </button>
            <button className="primary" onClick={regenerate}>
              Generate again
            </button>
          </div>
        </div>
      </section>

      {showList && (
        <section className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>Shopping list for the week</h2>
            <button className="ghost" onClick={copyList}>{copied ? 'Copied' : 'Copy list'}</button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th><span className="sr-only">Got it</span></th>
                  <th>Food</th>
                  <th>Category</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <tr key={item.name} className={checked.has(item.name) ? 'muted' : undefined}>
                    <td>
                      <input type="checkbox" checked={checked.has(item.name)} onChange={() => toggle(item.name)}
                        aria-label={`Got ${item.name}`} />
                    </td>
                    <td>{checked.has(item.name) ? <s>{item.name}</s> : item.name}</td>
                    <td className="muted">
                      {CATEGORY_LABELS[item.category]}
                    </td>
                    <td className="num">
                      {item.grams >= 1000
                        ? `${(item.grams / 1000).toFixed(2)} kg`
                        : `${item.grams} g`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {plan.days.map((day, i) => (
        <details className="day" key={day.weekday} open={i === 0}>
          <summary>
            <h3>{day.weekday}</h3>
            <span className="row">
              <span className="muted">{day.totals.kcal.toFixed(0)} kcal</span>
              <span className="muted">{day.totals.carbs.toFixed(0)} g carbs</span>
              <DayGLPill gl={day.gl} budget={targets.glBudget} />
            </span>
          </summary>
          <div className="body">
            {day.meals.map((m) => (
              <MealBlock key={m.meal} meal={m} weekday={day.weekday} onReplace={() => replace(i, m.meal)} />
            ))}
          </div>
        </details>
      ))}
    </>
  )
}

function MealBlock({ meal, weekday, onReplace }: { meal: PlannedMeal; weekday: string; onReplace: () => void }) {
  const ingredients = meal.dish.items
    .map((it) => `${getFood(it.foodId).name} - ${Math.round(it.grams * meal.scale)} g`)
    .join(' · ')

  return (
    <div className="meal">
      <div className="head">
        <div>
          <div className="type">{MEAL_LABELS[meal.meal]}</div>
          <div className="name">{meal.dish.name}</div>
        </div>
        <span className="row">
          <GIPill gi={meal.gi} />
          <GLPill gl={meal.gl} />
          <span className="muted">{meal.nutrients.kcal.toFixed(0)} kcal</span>
        </span>
      </div>
      <p className="ingredients">{ingredients}</p>
      <p className="recipe">{meal.dish.recipe}</p>
      <button className="ghost" onClick={onReplace} aria-label={`Replace ${meal.dish.name} on ${weekday}`}>Replace</button>
    </div>
  )
}
