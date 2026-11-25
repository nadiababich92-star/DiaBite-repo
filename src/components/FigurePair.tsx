import type { CountBy } from '../types'
import GlHelp from './GlHelp'
import type { CarbLimitResult } from '../lib/agent'

export interface CarbFigures { carbs?: number; availableCarbs?: number; fiber?: number }

/**
 * Both ways of counting, always shown, side by side, each in its own colour: the load in the lime marker, the
 * carbohydrate in blue. The one the person said they use is on the left. The verdict is still the engine's `fits`,
 * which is worked out from the glycemic load, and a line says so when the carbohydrate comes first.
 */
export function FigurePair({ countBy, gl, carbs, limit }: {
  countBy: CountBy
  /** The engine's own comparison with the person's number from their doctor; absent when they gave none. Never worked out here. */
  limit?: CarbLimitResult
  gl: { mealGl: number; before: number; after: number; fits: boolean; partial: boolean; assumed?: boolean; /** The meal is whole, the day is not (#117): its load is "this meal", what is left is "so far". */ dayOnly?: boolean }
  carbs?: CarbFigures
}) {
  const glBlock = (
    <div key="gl" className="fig-card gl">
      <p className="fig-title">Glycemic load (GL)</p>
      <p className={`fig-big gl ${gl.partial || gl.assumed || gl.dayOnly ? '' : gl.fits ? 'ok' : 'over'}`}><span className="num">{gl.fits ? gl.after : Math.abs(gl.after)}</span></p>
      <p className="fig-cap">{gl.partial || (gl.dayOnly && gl.fits) ? 'left so far' : gl.fits ? 'left after' : 'over by'}</p>
      {/* A partial meal's load is only the foods we could count: "this meal 0" under two slices of pizza read as a meal with no load. */}
      <div className="fig-row"><span className="fig-k">{gl.partial ? 'counted so far' : 'this meal'}</span><span className="fig-v">{gl.mealGl}</span></div>
      <div className="fig-row"><span className="fig-k">before</span><span className="fig-v">{gl.before}</span></div>
      {/* Last, under the figures: above the figure it pushed the load below the carbohydrate beside it (docs/design.md, Plain-words link). */}
      <GlHelp />
    </div>
  )
  const carbBlock = typeof carbs?.carbs === 'number' ? (
    <div key="carbs" className="fig-card carb">
      <p className="fig-title">Carbohydrate</p>
      <p className="fig-big carb"><span className="num">{carbs.carbs}<small className="unit"> g</small></span></p>
      <p className="fig-cap">{gl.partial ? 'so far' : gl.assumed ? 'about, in this meal' : 'in this meal'}</p>
      {typeof carbs.fiber === 'number' && <div className="fig-row"><span className="fig-k">fibre</span><span className="fig-v">{carbs.fiber} g</span></div>}
      {typeof carbs.availableCarbs === 'number' && <div className="fig-row"><span className="fig-k">without fibre</span><span className="fig-v">{carbs.availableCarbs} g</span></div>}
    </div>
  ) : null
  return (
    <>
      <div className="fig-pair">{countBy === 'carbs' ? [carbBlock, glBlock] : [glBlock, carbBlock]}</div>
      {carbBlock && limit?.over === true && (
        <p className="fig-basis">This {limit.kind} is {limit.mealG} g, above the {limit.limitG} g per {limit.kind} you set.</p>
      )}
      {countBy === 'carbs' && carbBlock && <p className="muted fig-basis">You count by carbohydrate, so it comes first. The verdict above is worked out from the glycemic load.</p>}
    </>
  )
}
