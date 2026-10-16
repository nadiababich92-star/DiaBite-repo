import { useEffect, useMemo, useState } from 'react'
import { CATEGORY_LABELS, getFood } from '../data/foods'
import { MEAL_LABELS, recipeCount, regenerateSlot, replayWeek, shoppingFromEntries, shoppingList, shoppingText, menuHidden } from '../lib/menu'
import { addDays, dayLabel, plannedOnly } from '../lib/diary'
import DayPicker from './DayPicker'
import { loadMenuRecipes } from '../lib/recipes'
import type { PlannedDay, PlannedMeal, WeekState } from '../lib/menu'
import { loadWeekState, newWeekState, saveWeekState } from '../lib/menuStore'
import { useToday } from '../lib/useToday'
import type { DiaryEntry, MealType, Profile, Targets } from '../types'
import { DayGLPill, GIPill, GLPill } from './Pills'

interface Props {
  profile: Profile
  targets: Targets
  /** The diary, for the shopping list that follows what the person has planned. */
  diary: DiaryEntry[]
  /** Switch to the Ask tab, for the profiles that are not shown a plan. */
  onAsk?: () => void
  /** Put what was planned into the diary, and take it out again. */
  onAdd: (entries: DiaryEntry[]) => void
  onRemove: (ids: string[]) => void
  onOpenDiary: () => void
}

const CHECKED_KEY = 'diabite.shopping.v1'

/** Ticked shopping lines, remembered only while the plan they belong to is the one on screen. */
function loadChecked(key: string): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(CHECKED_KEY) ?? 'null') as { seed?: number | string; checked?: string[] } | null
    return raw && String(raw.seed) === key && Array.isArray(raw.checked) ? new Set(raw.checked.filter((x) => typeof x === 'string')) : new Set()
  } catch { return new Set() }
}
function saveChecked(key: string, checked: Set<string>) {
  try { localStorage.setItem(CHECKED_KEY, JSON.stringify({ seed: key, checked: [...checked] })) } catch { /* storage unavailable */ }
}

/** Monday is 0, as the plan counts its days. */
const todayIndex = () => (new Date().getDay() + 6) % 7

export default function MenuPage({ profile, targets, diary, onAsk, onAdd, onRemove, onOpenDiary }: Props) {
  const hidden = menuHidden(profile)
  const today = useToday()
  // The week stays the week until the person asks for another: it is kept on this device.
  const [week, setWeek] = useState<WeekState>(loadWeekState)
  const [day, setDay] = useState(todayIndex)
  const [showList, setShowList] = useState(false)
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(() => loadChecked(String(week.seed)))
  // What was put into the diary from this screen: by meal, so it can be taken out again.
  const [added, setAdded] = useState<Record<string, { ids: string[]; text: string }>>({})
  // Which meal has the "Plan it…" picker open, and the day chosen in it.
  const [planning, setPlanning] = useState<{ key: string; date: string } | null>(null)
  // The shopping list follows what is planned; the generated week is the fallback, or a choice.
  const [useWeek, setUseWeek] = useState(false)

  useEffect(() => saveWeekState(week), [week])

  // The recipes are a file of their own, fetched when the Menu first opens. The week waits for it, so that
  // a week rebuilt from its seed is always built from the same library.
  const [ready, setReady] = useState(recipeCount() > 0)
  const [recipesFailed, setRecipesFailed] = useState(false)
  useEffect(() => {
    if (ready) return
    let live = true
    loadMenuRecipes().catch(() => { if (live) setRecipesFailed(true) }).finally(() => { if (live) setReady(true) })
    return () => { live = false }
  }, [ready])

  // Not computed at all for a profile that is not shown a plan.
  const built = useMemo(() => (hidden || !ready ? null : replayWeek(profile, targets, week)), [hidden, ready, profile, targets, week])
  const plan = built?.plan ?? null
  const weekList = useMemo(() => (plan ? shoppingList(plan) : []), [plan])
  const planned = useMemo(() => plannedOnly(diary), [diary])
  // `ready` is a dependency: a planned recipe is expanded into its ingredients only once the recipe file has loaded.
  const plannedList = useMemo(() => shoppingFromEntries(diary, today), [diary, today, ready])
  const fromPlan = plannedList.length > 0 && !useWeek
  const list = fromPlan ? plannedList : weekList
  // Ticks belong to one list: a changed plan starts a fresh one, because a wrong tick that hides something to buy is worse than a lost tick.
  const tickKey = fromPlan ? `plan:${planned.filter((e) => e.date >= today).map((e) => e.id).sort().join(',')}` : String(week.seed)
  useEffect(() => { setChecked(loadChecked(tickKey)) }, [tickKey])
  // The span the list covers, from the planned entries it was built from.
  const span = useMemo(() => {
    const dates = planned.filter((e) => e.date >= today && e.date <= addDays(today, 14)).map((e) => e.date).sort()
    return dates.length ? [dates[0], dates[dates.length - 1]] : null
  }, [planned, today])
  const shortDate = (d: string) => dayLabel(d, today) === d ? d : new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  if (!hidden && !ready) {
    return <section className="card" role="status"><p className="muted" style={{ margin: 0 }}>Getting the recipes…</p></section>
  }
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
    setWeek(next); setNote(''); setAdded({}); setChecked(new Set()); saveChecked(String(next.seed), new Set())
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
    setChecked(next); saveChecked(tickKey, next)
  }
  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(shoppingText(list, CATEGORY_LABELS))
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { setNote('Copying did not work on this device. Select the list and copy it by hand.') }
  }

  const slotKey = (d: number, m: PlannedMeal) => `${week.seed}:${d}:${m.meal}:${m.dish.id}`
  // The meal goes into the diary at the weight the plan chose, food by food: eaten on today ("I ate this"),
  // or planned for a day ("Plan it…"). A plan counts nowhere until the person marks it eaten in the Diary.
  const putInDiary = (d: number, m: PlannedMeal, date: string, planned: boolean) => {
    const stamp = Date.now()
    const flag = planned ? { planned: true as const } : {}
    // A recipe goes in as one entry carrying the numbers it was planned with, like a meal logged from an answer.
    const s = m.dish.serving
    const entries: DiaryEntry[] = s && m.dish.recipeId ? [{
      id: `${stamp}-0-${Math.random().toString(36).slice(2, 6)}`, date, meal: m.meal,
      foodId: `rec:${m.dish.recipeId}`, grams: m.scale, ...flag,
      snapshot: {
        name: m.dish.name, kcal: s.kcal * m.scale, carbs: s.carbs * m.scale, fiber: s.fiber * m.scale, protein: s.protein * m.scale, fat: s.fat * m.scale,
        availableCarbs: Math.max(0, s.carbs - s.fiber) * m.scale, gi: s.gi, gl: s.gl * m.scale, loadAvailable: true, servings: m.scale,
      },
    }] : m.dish.items.map((it, i) => ({
      id: `${stamp}-${i}-${Math.random().toString(36).slice(2, 6)}`, date, meal: m.meal,
      foodId: it.foodId, grams: Math.max(1, Math.round(it.grams * m.scale)), ...flag,
    }))
    onAdd(entries)
    const text = planned
      ? `Planned for ${dayLabel(date, today)}.`
      : `Added to today's ${MEAL_LABELS[m.meal].toLowerCase()}.`
    setAdded((a) => ({ ...a, [slotKey(d, m)]: { ids: entries.map((e) => e.id), text } }))
    setPlanning(null)
  }
  const addToToday = (d: number, m: PlannedMeal) => putInDiary(d, m, today, false)
  const undoAdd = (d: number, m: PlannedMeal) => {
    const ids = added[slotKey(d, m)]?.ids ?? []
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
            {recipesFailed && <p className="muted" style={{ margin: '4px 0 0' }}>The larger recipe file did not load, so this week is built from the short list.</p>}
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
            <h2 style={{ margin: 0 }}>{fromPlan ? 'Shopping list for what you planned' : 'Shopping list for the week'}</h2>
            <button className="ghost" onClick={copyList}>{copied ? 'Copied' : 'Copy list'}</button>
          </div>
          {fromPlan && span && <p className="muted" style={{ margin: '4px 0 0' }}>From {shortDate(span[0])} to {shortDate(span[1])}.</p>}
          {plannedList.length > 0 && weekList.length > 0 && (
            <p style={{ margin: '4px 0 0' }}>
              <button type="button" className="link" onClick={() => setUseWeek((v) => !v)}>{fromPlan ? 'Use the generated week instead' : 'Use what I planned'}</button>
            </p>
          )}
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
        added={added} slotKey={slotKey} today={today} planning={planning} onPlanning={setPlanning}
        onReplace={replace} onAdd={addToToday} onPlan={putInDiary} onUndo={undoAdd} onOpenDiary={onOpenDiary}
      />
    </>
  )
}

function DayCard({ day, dayIndex, budget, added, slotKey, today, planning, onPlanning, onReplace, onAdd, onPlan, onUndo, onOpenDiary }: {
  day: PlannedDay; dayIndex: number; budget: number
  added: Record<string, { ids: string[]; text: string }>; slotKey: (d: number, m: PlannedMeal) => string
  today: string; planning: { key: string; date: string } | null; onPlanning: (p: { key: string; date: string } | null) => void
  onReplace: (d: number, m: MealType) => void; onAdd: (d: number, m: PlannedMeal) => void
  onPlan: (d: number, m: PlannedMeal, date: string, planned: boolean) => void; onUndo: (d: number, m: PlannedMeal) => void
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
        const ingredients = m.dish.ingredients
          ? m.dish.ingredients.map((i) => `${i.name} - ${Math.round(i.grams * m.scale)} g`).join(' · ')
          : m.dish.items.map((it) => `${getFood(it.foodId).name} - ${Math.round(it.grams * m.scale)} g`).join(' · ')
        const steps = m.dish.recipe.split('\n').filter(Boolean)
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
            {m.dish.serving && (
              <p className="muted menu-serving">{m.scale === 1 ? '1 serving' : `${m.scale} servings`}{m.dish.minutes ? ` · ${m.dish.minutes} min` : ''}{m.dish.cuisine ? ` · ${m.dish.cuisine}` : ''}</p>
            )}
            <details className="recipe-more">
              <summary>Recipe</summary>
              {steps.length > 1 ? <ol className="recipe-steps">{steps.map((st, i) => <li key={i}>{st.replace(/^\d+\.\s*/, '')}</li>)}</ol> : <p className="recipe">{m.dish.recipe}</p>}
            </details>
            {done ? (
              <p className="menu-added" role="status">
                {done.text}{' '}
                <button className="link" onClick={() => onUndo(dayIndex, m)}>Undo</button>{' '}
                <button className="link" onClick={onOpenDiary}>{done.text.startsWith('Planned') ? 'See the Diary' : 'See today'}</button>
              </p>
            ) : (
              <>
                <div className="row menu-actions">
                  <button className="ghost" onClick={() => onAdd(dayIndex, m)} aria-label={`I ate ${m.dish.name}`}>I ate this</button>
                  <button className="ghost" id={`plan-btn-${key}`} aria-expanded={planning?.key === key} onClick={() => onPlanning(planning?.key === key ? null : { key, date: addDays(today, 1) })} aria-label={`Plan ${m.dish.name} for another day`}>Plan it…</button>
                  <button className="ghost" onClick={() => onReplace(dayIndex, m.meal)} aria-label={`Replace ${m.dish.name} on ${day.weekday}`}>Replace</button>
                </div>
                {planning?.key === key && (
                  <div className="plan-inline">
                    <DayPicker value={planning.date} today={today} min={today} chips={['today', 'tomorrow']} onChange={(date) => onPlanning({ key, date })} />
                    <div className="row">
                      <button className="primary" onClick={() => onPlan(dayIndex, m, planning.date, true)}>Plan it</button>
                      <button className="ghost" onClick={() => { onPlanning(null); setTimeout(() => document.getElementById(`plan-btn-${key}`)?.focus(), 0) }}>Cancel</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
    </section>
  )
}
