import { useMemo, useState } from 'react'
import { CATEGORY_LABELS, FOODS, getFood } from '../data/foods'
import { availableCarbs, glycemicLoad, sumNutrients } from '../lib/glycemic'
import { MEAL_LABELS, MEAL_ORDER } from '../lib/menu'
import { viewEntry } from '../lib/diary'
import { todayISO } from '../lib/storage'
import type { DiaryEntry, MealType, Targets } from '../types'
import { GIPill, GLPill } from './Pills'

interface Props {
  targets: Targets
  diary: DiaryEntry[]
  onChange: (entries: DiaryEntry[]) => void
}

export default function DiaryPage({ targets, diary, onChange }: Props) {
  const [date, setDate] = useState(todayISO)
  const [meal, setMeal] = useState<MealType>('breakfast')
  const [query, setQuery] = useState('')
  const [grams, setGrams] = useState<number | ''>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const dayEntries = useMemo(
    () => diary.filter((e) => e.date === date),
    [diary, date],
  )

  const totals = useMemo(() => {
    const views = dayEntries.map(viewEntry)
    const gl = views.reduce((s, v) => s + v.gl, 0)
    const xe = views.reduce((s, v) => s + v.breadUnits, 0)
    return { ...sumNutrients(views.map((v) => v.nutrients)), gl, xe }
  }, [dayEntries])

  const matches =
    query.trim().length < 2
      ? []
      : FOODS.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)

  const selected = selectedId ? getFood(selectedId) : null

  function add() {
    if (!selected || !grams || grams <= 0) return
    onChange([
      ...diary,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date,
        meal,
        foodId: selected.id,
        grams: Number(grams),
      },
    ])
    setSelectedId(null)
    setQuery('')
    setGrams('')
  }

  const pct = (value: number, target: number) => Math.min(100, (value / Math.max(1, target)) * 100)

  return (
    <>
      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>Day so far</h2>
          <label className="field" style={{ maxWidth: 180 }}>
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        <div className="stats">
          <Metric label="Glycemic load" value={totals.gl.toFixed(0)} target={targets.glBudget} pct={pct(totals.gl, targets.glBudget)} over={totals.gl > targets.glBudget} />
          <Metric label="Carbohydrate" value={`${totals.carbs.toFixed(0)} g`} target={`${targets.carbsG} g`} pct={pct(totals.carbs, targets.carbsG)} over={totals.carbs > targets.carbsG} />
          <Metric label="Calories" value={totals.kcal.toFixed(0)} target={`${targets.kcal}`} pct={pct(totals.kcal, targets.kcal)} over={totals.kcal > targets.kcal} />
          <Metric label="Protein" value={`${totals.protein.toFixed(0)} g`} target={`${targets.proteinG} g`} pct={pct(totals.protein, targets.proteinG)} over={false} />
          <Metric label="Fibre" value={`${totals.fiber.toFixed(0)} g`} target={`${targets.fiberG} g`} pct={pct(totals.fiber, targets.fiberG)} over={false} />
          <div className="stat">
            <div className="label">Bread units</div>
            <div className="value">{totals.xe.toFixed(1)}</div>
            <div className="sub">1 BU = 12 g of carbs</div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Add a food</h2>
        <div className="grid">
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

      {MEAL_ORDER.map((m) => {
        const entries = dayEntries.filter((e) => e.meal === m)
        if (entries.length === 0) return null
        const mealGL = entries.reduce((s, e) => s + viewEntry(e).gl, 0)
        return (
          <section className="card" key={m}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>{MEAL_LABELS[m]}</h2>
              <GLPill gl={mealGL} />
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Food</th>
                    <th className="num">Weight</th>
                    <th className="num">Carbs</th>
                    <th className="num">GL</th>
                    <th className="num">BU</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => {
                    const v = viewEntry(e)
                    return (
                      <tr key={e.id}>
                        <td>
                          {v.name} <GIPill gi={v.gi} />
                          {e.snapshot && <span className="pill none">from agent</span>}
                        </td>
                        <td className="num">{v.portion}</td>
                        <td className="num">{v.availableCarbs.toFixed(1)} g</td>
                        <td className="num">{v.gl.toFixed(1)}</td>
                        <td className="num">{v.breadUnits.toFixed(1)}</td>
                        <td className="num">
                          <button
                            className="link"
                            aria-label="Delete entry"
                            onClick={() => onChange(diary.filter((x) => x.id !== e.id))}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

      {dayEntries.length === 0 && (
        <div className="empty">Nothing logged for this day yet.</div>
      )}
    </>
  )
}

function Metric(props: {
  label: string
  value: string
  target: string | number
  pct: number
  over: boolean
}) {
  return (
    <div className="stat">
      <div className="label">{props.label}</div>
      <div className="value">{props.value}</div>
      <div className="sub">of {props.target}</div>
      <div className="bar">
        <i className={props.over ? 'over' : ''} style={{ width: `${props.pct}%` }} />
      </div>
    </div>
  )
}
