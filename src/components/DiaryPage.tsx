import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORY_LABELS, FOODS, getFood } from '../data/foods'
import { availableCarbs, glycemicLoad, sumNutrients } from '../lib/glycemic'
import { MEAL_LABELS, MEAL_ORDER } from '../lib/menu'
import { addDays, dayLabel, mealForNow, nudgeGrams, recentEntries, viewEntry } from '../lib/diary'
import { weekSummary } from '../lib/history'
import { useToday } from '../lib/useToday'
import type { DiaryEntry, MealType, Targets } from '../types'
import { GIPill, GLPill } from './Pills'

interface Props {
  targets: Targets
  diary: DiaryEntry[]
  onChange: (entries: DiaryEntry[]) => void
  /** Take the person to the Ask tab, from an empty day. */
  onAsk?: () => void
}

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export default function DiaryPage({ targets, diary, onChange, onAsk }: Props) {
  // The day on show follows the calendar until the person moves to another one.
  const today = useToday()
  const [picked, setPicked] = useState<string | null>(null)
  const date = picked ?? today
  const isToday = date === today
  const [meal, setMeal] = useState<MealType>(mealForNow)
  const [query, setQuery] = useState('')
  const [grams, setGrams] = useState<number | ''>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // One line that says what just happened and can take it back. It goes by itself after ten seconds.
  const [notice, setNotice] = useState<{ text: string; undo: () => void } | null>(null)
  const latest = useRef(diary)
  latest.current = diary
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 10_000)
    return () => clearTimeout(t)
  }, [notice])

  const dayEntries = useMemo(() => diary.filter((e) => e.date === date), [diary, date])

  const totals = useMemo(() => {
    const views = dayEntries.map(viewEntry)
    const gl = views.reduce((s, v) => s + v.gl, 0)
    const xe = views.reduce((s, v) => s + v.breadUnits, 0)
    return { ...sumNutrients(views.map((v) => v.nutrients)), gl, xe }
  }, [dayEntries])

  const week = useMemo(() => weekSummary(diary, targets.glBudget, today), [diary, targets.glBudget, today])
  const recent = useMemo(() => recentEntries(diary, 6), [diary])

  const matches =
    query.trim().length < 2
      ? []
      : FOODS.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
  const selected = selectedId ? getFood(selectedId) : null

  const pct = (value: number, target: number) => Math.min(100, (value / Math.max(1, target)) * 100)

  function add() {
    if (!selected || !grams || grams <= 0) return
    const entry: DiaryEntry = { id: newId(), date, meal, foodId: selected.id, grams: Number(grams) }
    onChange([...diary, entry])
    setNotice({ text: `Added ${selected.name} to ${MEAL_LABELS[meal].toLowerCase()}.`, undo: () => onChange(latest.current.filter((e) => e.id !== entry.id)) })
    setSelectedId(null); setQuery(''); setGrams('')
  }

  // One tap: the same food at the same weight, again, on the day and meal on show.
  function again(e: DiaryEntry) {
    const copy: DiaryEntry = { ...e, id: newId(), date, meal }
    onChange([...diary, copy])
    setNotice({ text: `Added ${viewEntry(e).name} to ${MEAL_LABELS[meal].toLowerCase()}.`, undo: () => onChange(latest.current.filter((x) => x.id !== copy.id)) })
  }

  function remove(e: DiaryEntry) {
    onChange(diary.filter((x) => x.id !== e.id))
    setNotice({ text: `Removed ${viewEntry(e).name}.`, undo: () => onChange([...latest.current, e]) })
  }

  function nudge(e: DiaryEntry, dir: 1 | -1) {
    onChange(diary.map((x) => (x.id === e.id ? { ...x, grams: nudgeGrams(x.grams, dir) } : x)))
  }

  const left = Math.round((targets.glBudget - totals.gl) * 10) / 10
  const over = left < 0

  return (
    <>
      <section className="card">
        <div className="day-nav">
          <button className="ghost step-day" aria-label="The day before" onClick={() => setPicked(addDays(date, -1))}>‹</button>
          <h2 style={{ margin: 0 }} aria-live="polite">{dayLabel(date, today)}</h2>
          <button className="ghost step-day" aria-label="The day after" disabled={isToday} onClick={() => setPicked(addDays(date, 1) >= today ? null : addDays(date, 1))}>›</button>
        </div>
        {!isToday && <button className="link back-today" onClick={() => setPicked(null)}>Back to today</button>}

        {/* The one number that matters: what is left today, or what the day used. */}
        <div className={`fig fig-lead ${isToday ? (over ? 'over' : 'ok') : ''}`} style={{ marginTop: 14 }}>
          <span className="fig-k">{isToday ? (over ? 'glycemic load over' : 'glycemic load left') : 'glycemic load used'}</span>
          <span className="fig-v">{isToday ? Math.abs(left) : totals.gl.toFixed(1)}</span>
        </div>
        <p className="muted" style={{ margin: '0 0 6px' }}>{totals.gl.toFixed(1)} used of {targets.glBudget}</p>
        <div className="bar" role="img" aria-label={`${totals.gl.toFixed(0)} of ${targets.glBudget} glycemic load used`}>
          <i className={over ? 'over' : ''} style={{ width: `${pct(totals.gl, targets.glBudget)}%` }} />
        </div>

        <ul className="quiet-list">
          <Quiet label="Carbohydrate" value={`${totals.carbs.toFixed(0)} of ${targets.carbsG} g`} pct={pct(totals.carbs, targets.carbsG)} over={totals.carbs > targets.carbsG} />
          <Quiet label="Calories" value={`${totals.kcal.toFixed(0)} of ${targets.kcal}`} pct={pct(totals.kcal, targets.kcal)} over={totals.kcal > targets.kcal} />
          <Quiet label="Protein" value={`${totals.protein.toFixed(0)} of ${targets.proteinG} g`} pct={pct(totals.protein, targets.proteinG)} over={false} />
          <Quiet label="Fibre" value={`${totals.fiber.toFixed(0)} of ${targets.fiberG} g`} pct={pct(totals.fiber, targets.fiberG)} over={false} />
          <li className="quiet-row"><span>Bread units</span><span /><span className="num">{totals.xe.toFixed(1)} <em>1 BU = 12 g</em></span></li>
        </ul>
      </section>

      <p className="diary-notice muted" role="status" aria-live="polite">
        {notice && <>{notice.text}{' '}<button className="link" onClick={() => { notice.undo(); setNotice(null) }}>Undo</button></>}
      </p>

      {dayEntries.length === 0 && (
        <div className="empty">
          <p style={{ margin: '0 0 10px' }}>Nothing logged for {isToday ? 'today' : 'this day'} yet.</p>
          {onAsk && isToday && <button className="primary" onClick={onAsk}>Ask about a meal</button>}
        </div>
      )}

      {MEAL_ORDER.map((m) => {
        const entries = dayEntries.filter((e) => e.meal === m)
        if (entries.length === 0) return null
        const mealGL = entries.reduce((s, e) => s + viewEntry(e).gl, 0)
        return (
          <section className="card" key={m}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <h2 style={{ margin: 0 }}>{MEAL_LABELS[m]}</h2>
              <GLPill gl={mealGL} />
            </div>
            <ul className="entries">
              {entries.map((e) => {
                const v = viewEntry(e)
                return (
                  <li className="entry" key={e.id}>
                    <div className="entry-main">
                      <span className="entry-name">{v.name}</span>
                      <span className="muted entry-sub">
                        <GIPill gi={v.gi} />{' '}
                        {e.snapshot && <span className="pill none">from Ask</span>}
                        {' '}{v.availableCarbs.toFixed(1)} g carbs · GL {v.loadAvailable ? v.gl.toFixed(1) : '—'}
                      </span>
                    </div>
                    <div className="entry-side">
                      {e.snapshot ? (
                        <span className="step-v">{v.portion}</span>
                      ) : (
                        <span className="stepper">
                          <button className="step" aria-label={`Less ${v.name}`} onClick={() => nudge(e, -1)}>−</button>
                          <span className="step-v" aria-live="polite">{e.grams} g</span>
                          <button className="step" aria-label={`More ${v.name}`} onClick={() => nudge(e, 1)}>+</button>
                        </span>
                      )}
                      <button className="link entry-x" aria-label={`Delete ${v.name}, ${v.portion}`} onClick={() => remove(e)}>✕</button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      <section className="card">
        <h2>Add a food</h2>

        {recent.length > 0 && (
          <div className="recent">
            <span className="label">Again, to {MEAL_LABELS[meal].toLowerCase()}</span>
            <div className="chips">
              {recent.map((e) => (
                <button key={e.id} className="chip-toggle" onClick={() => again(e)}>
                  {viewEntry(e).name} <em>{viewEntry(e).portion}</em>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid" style={{ marginTop: recent.length > 0 ? 16 : 0 }}>
          <label className="field">
            <span>Meal</span>
            <select value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
              {MEAL_ORDER.map((m) => (
                <option key={m} value={m}>{MEAL_LABELS[m]}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Food</span>
            <input
              type="text"
              placeholder="e.g. buckwheat"
              value={selected ? selected.name : query}
              onChange={(e) => {
                setSelectedId(null)
                setQuery(e.target.value)
              }}
            />
          </label>
          <label className="field">
            <span>Weight, g</span>
            <input
              type="number" min={1} max={2000}
              placeholder={selected ? String(selected.portion.grams) : '0'}
              value={grams}
              onChange={(e) => setGrams(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </label>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <button className="primary" onClick={add} disabled={!selected || !grams}>
              Add
            </button>
          </div>
        </div>

        {!selected && matches.length > 0 && (
          <div className="search-results">
            {matches.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setSelectedId(f.id)
                  setGrams(f.portion.grams)
                  setQuery('')
                }}
              >
                <span>{f.name}</span>
                <span className="meta">
                  {CATEGORY_LABELS[f.category]} · {f.gi === null ? 'no GI' : `GI ${f.gi}`}
                </span>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <p className="muted" style={{ marginBottom: 0 }}>
            <GIPill gi={selected.gi} />{' '}
            <GLPill gl={glycemicLoad(selected, Number(grams) || selected.portion.grams)} />{' '}
            Available carbs:{' '}
            {availableCarbs(selected, Number(grams) || selected.portion.grams).toFixed(1)} g ·
            typical portion — {selected.portion.label}, {selected.portion.grams} g
          </p>
        )}
      </section>

      <section className="card">
        <h2>The last seven days</h2>
        <ol className="week" aria-label="Glycemic load used each of the last seven days, against your daily budget">
          {week.days.map((d) => (
            <li key={d.date} className={d.logged ? (d.within ? 'ok' : 'over') : 'none'}>
              <span className="wk-day">{d.label}</span>
              <span className="wk-bar" aria-hidden="true"><i style={{ width: `${d.logged ? Math.min(100, (d.used / Math.max(1, targets.glBudget)) * 100) : 0}%` }} /></span>
              <span className="wk-num">
                {d.logged ? `${d.used.toFixed(0)} of ${targets.glBudget}` : 'not logged'}
                {d.logged && d.partial && <em> + carbs only</em>}
              </span>
            </li>
          ))}
        </ol>
        <p className="muted">
          {week.loggedDays === 0
            ? 'Log what you eat and the week fills in here.'
            : `${week.withinDays} of the ${week.loggedDays} ${week.loggedDays === 1 ? 'day' : 'days'} you logged stayed within your glycemic-load budget.`}
        </p>
      </section>
    </>
  )
}

/** A figure that is not the main one: a label, a thin bar, and plain numbers. */
function Quiet({ label, value, pct, over }: { label: string; value: string; pct: number; over: boolean }) {
  return (
    <li className="quiet-row">
      <span>{label}</span>
      <span className="bar" aria-hidden="true"><i className={over ? 'over' : ''} style={{ width: `${pct}%` }} /></span>
      <span className="num">{value}</span>
    </li>
  )
}
