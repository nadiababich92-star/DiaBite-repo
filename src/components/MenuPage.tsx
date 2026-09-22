import { useMemo, useState } from 'react'
import { CATEGORY_LABELS, getFood } from '../data/foods'
import { MEAL_LABELS, generateWeek, shoppingList } from '../lib/menu'
import type { PlannedMeal } from '../lib/menu'
import type { Profile, Targets } from '../types'
import { DayGLPill, GIPill, GLPill } from './Pills'

interface Props {
  profile: Profile
  targets: Targets
}

export default function MenuPage({ profile, targets }: Props) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9))
  const [showList, setShowList] = useState(false)

  const plan = useMemo(() => generateWeek(profile, targets, seed), [profile, targets, seed])
  const list = useMemo(() => shoppingList(plan), [plan])

  const avgKcal = plan.days.reduce((s, d) => s + d.totals.kcal, 0) / plan.days.length
  const avgGL = plan.days.reduce((s, d) => s + d.gl, 0) / plan.days.length

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
          </div>
          <div className="row">
            <button className="ghost" onClick={() => setShowList((v) => !v)}>
              {showList ? 'Hide shopping list' : 'Shopping list'}
            </button>
            <button className="primary" onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>
              Generate again
            </button>
          </div>
        </div>
      </section>

      {showList && (
        <section className="card">
          <h2>Shopping list for the week</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Food</th>
                  <th>Category</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <tr key={item.name}>
                    <td>{item.name}</td>
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
              <MealBlock key={m.meal} meal={m} />
            ))}
          </div>
        </details>
      ))}
    </>
  )
}

function MealBlock({ meal }: { meal: PlannedMeal }) {
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
    </div>
  )
}
