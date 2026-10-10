import { useEffect, useMemo, useState } from 'react'
import { CATEGORY_LABELS, getFood } from '../data/foods'
import { MEAL_LABELS, regenerateSlot, replayWeek, shoppingList, shoppingText, menuHidden } from '../lib/menu'
import type { PlannedDay, PlannedMeal, WeekState } from '../lib/menu'
import { loadWeekState, newWeekState, saveWeekState } from '../lib/menuStore'
import { useToday } from '../lib/useToday'
import type { DiaryEntry, MealType, Profile, Targets } from '../types'
import { DayGLPill, GIPill, GLPill } from './Pills'

interface Props {
  profile: Profile
  targets: Targets
  /** Switch to the Ask tab, for the profiles that are not shown a plan. */
  onAsk?: () => void
  /** Put what was planned into the diary, and take it out again. */
  onAdd: (entries: DiaryEntry[]) => void
  onRemove: (ids: string[]) => void
  onOpenDiary: () => void
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

/** Monday is 0, as the plan counts its days. */
const todayIndex = () => (new Date().getDay() + 6) % 7

export default function MenuPage({ profile, targets, onAsk, onAdd, onRemove, onOpenDiary }: Props) {
  const hidden = menuHidden(profile)
  const today = useToday()
  // The week stays the week until the person asks for another: it is kept on this device.
  const [week, setWeek] = useState<WeekState>(loadWeekState)
  const [day, setDay] = useState(todayIndex)
  const [showList, setShowList] = useState(false)
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(() => loadChecked(week.seed))
  // What was put into the diary from this screen: by meal, so it can be taken out again.
  const [added, setAdded] = useState<Record<string, string[]>>({})

  useEffect(() => saveWeekState(week), [week])

  // Not computed at all for a profile that is not shown a plan.
  const built = useMemo(() => (hidden ? null : replayWeek(profile, targets, week)), [hidden, profile, targets, week])
  const plan = built?.plan ?? null
  const list = useMemo(() => (plan ? shoppingList(plan) : []), [plan])

  if (hidden || !plan) {
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
  const current = plan.days[Math.min(day, plan.days.length - 1)]

  const regenerate = () => {
    const next = newWeekState()
    setWeek(next); setNote(''); setAdded({}); setChecked(new Set()); saveChecked(next.seed, new Set())
  }
  const replace = (dayIndex: number, meal: MealType) => {
    const seed = Math.floor(Math.random() * 1e9)
    const r = regenerateSlot(plan, dayIndex, meal, profile, targets, seed)
    if (!r.changed) { setNote('There is no other dish that fits what you avoid for this meal.'); return }
    setWeek({ ...week, edits: [...week.edits, { day: dayIndex, meal, seed }] })
    const dish = r.plan.days[dayIndex].meals.find((m) => m.meal === meal)?.dish.name
    setNote(`Replaced with ${dish}.${r.relaxed ? ' Few dishes fit what you avoid, so this one may come back soon.' : ''}`)
  }
  const toggle = (name: string) => {
    const next = new Set(checked)
    if (next.has(name)) next.delete(name); else next.add(name)
    setChecked(next); saveChecked(week.seed, next)
  }
  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(shoppingText(list, CATEGORY_LABELS))
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { setNote('Copying did not work on this device. Select the list and copy it by hand.') }
  }

  const slotKey = (d: number, m: PlannedMeal) => `${week.seed}:${d}:${m.meal}:${m.dish.id}`
  // The meal goes into today's diary at the weight the plan chose, food by food.
  const addToToday = (d: number, m: PlannedMeal) => {
    const stamp = Date.now()
    const entries: DiaryEntry[] = m.dish.items.map((it, i) => ({
      id: `${stamp}-${i}-${Math.random().toString(36).slice(2, 6)}`, date: today, meal: m.meal,
      foodId: it.foodId, grams: Math.max(1, Math.round(it.grams * m.scale)),
    }))
    onAdd(entries)
    setAdded((a) => ({ ...a, [slotKey(d, m)]: entries.map((e) => e.id) }))
  }
  const undoAdd = (d: number, m: PlannedMeal) => {
    const ids = added[slotKey(d, m)] ?? []
    onRemove(ids)
    setAdded((a) => { const n = { ...a }; delete n[slotKey(d, m)]; return n })
  }

  return (
    <>
      <section className="card">
        <div className="row menu-head" style={{ justifyContent: 'space-between' }}>
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
          </div>
          <div className="row">
            <button className="ghost" onClick={() => setShowList((v) => !v)} aria-expanded={showList}>
              {showList ? 'Hide shopping list' : 'Shopping list'}
            </button>
            <button className="primary" onClick={regenerate}>
              Generate again
            </button>
          </div>
        </div>
        <p className="muted" role="status" aria-live="polite" style={{ margin: '8px 0 0', minHeight: 20 }}>{note}</p>
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

      <div className="day-strip" role="group" aria-label="Day of the week">
        {plan.days.map((d, i) => (
          <button key={d.weekday} className="day-key" aria-pressed={i === day} onClick={() => setDay(i)}
            aria-label={`${d.weekday}, glycemic load ${d.gl.toFixed(0)}`}>
            <span>{d.weekday.slice(0, 3)}</span>
            <b>{d.gl.toFixed(0)}</b>
          </button>
        ))}
      </div>

      <DayCard
        day={current} dayIndex={day} budget={targets.glBudget}
        added={added} slotKey={slotKey}
        onReplace={replace} onAdd={addToToday} onUndo={undoAdd} onOpenDiary={onOpenDiary}
      />
    </>
  )
}

function DayCard({ day, dayIndex, budget, added, slotKey, onReplace, onAdd, onUndo, onOpenDiary }: {
  day: PlannedDay; dayIndex: number; budget: number
  added: Record<string, string[]>; slotKey: (d: number, m: PlannedMeal) => string
  onReplace: (d: number, m: MealType) => void; onAdd: (d: number, m: PlannedMeal) => void; onUndo: (d: number, m: PlannedMeal) => void
  onOpenDiary: () => void
}) {
  return (
    <section className="card menu-day" aria-label={day.weekday}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ margin: 0 }}>{day.weekday}</h2>
        <DayGLPill gl={day.gl} budget={budget} />
      </div>
      <div className="bar" role="img" aria-label={`${day.gl.toFixed(0)} of ${budget} glycemic load planned`}>
        <i className={day.gl > budget ? 'over' : ''} style={{ width: `${Math.min(100, (day.gl / Math.max(1, budget)) * 100)}%` }} />
      </div>
      <p className="muted menu-sub">{day.totals.kcal.toFixed(0)} kcal · {day.totals.carbs.toFixed(0)} g carbs</p>
      {day.meals.map((m) => {
        const key = slotKey(dayIndex, m)
        const done = added[key]
        const ingredients = m.dish.items.map((it) => `${getFood(it.foodId).name} - ${Math.round(it.grams * m.scale)} g`).join(' · ')
        return (
          <div className="menu-meal" key={m.meal}>
            <div className="head">
              <div>
                <div className="type">{MEAL_LABELS[m.meal]}</div>
                <div className="name">{m.dish.name}</div>
              </div>
              <span className="menu-nums">
                <GLPill gl={m.gl} />
                <span className="muted">{m.nutrients.kcal.toFixed(0)} kcal</span>
              </span>
            </div>
            <p className="ingredients"><GIPill gi={m.gi} /> {ingredients}</p>
            <details className="recipe-more">
              <summary>Recipe</summary>
              <p className="recipe">{m.dish.recipe}</p>
            </details>
            {done ? (
              <p className="menu-added" role="status">
                Added to today's {MEAL_LABELS[m.meal].toLowerCase()}.{' '}
                <button className="link" onClick={() => onUndo(dayIndex, m)}>Undo</button>{' '}
                <button className="link" onClick={onOpenDiary}>See today</button>
              </p>
            ) : (
              <div className="row menu-actions">
                <button className="ghost" onClick={() => onAdd(dayIndex, m)} aria-label={`Add ${m.dish.name} to today`}>Add to today</button>
                <button className="ghost" onClick={() => onReplace(dayIndex, m.meal)} aria-label={`Replace ${m.dish.name} on ${day.weekday}`}>Replace</button>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
