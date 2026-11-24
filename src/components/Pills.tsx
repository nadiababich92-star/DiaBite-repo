import { GI_LEVEL_LABELS, LEVEL_LABELS, dayGlLevel, giLevel, glLevel } from '../lib/glycemic'

/** `carbs`: the food's available carbohydrate as eaten. A food with no GI and real carbohydrate (pizza, a branded bar) is "carbs only", never
 *  "no carbs": two slices of pizza were labelled "no carbs" beside "65.3 g carbs" in the Diary (24 November 2026, CLAUDE.md rule 4). */
export function GIPill({ gi, carbs }: { gi: number | null; carbs?: number }) {
  const level = giLevel(gi)
  if (level === null) return <span className="pill none">{typeof carbs === 'number' && carbs >= 1 ? 'carbs only' : 'no carbs'}</span>
  return (
    <span className={`pill ${level}`}>
      GI {gi} · {GI_LEVEL_LABELS[level]}
    </span>
  )
}

export function GLPill({ gl }: { gl: number }) {
  const level = glLevel(gl)
  return (
    <span className={`pill ${level}`}>
      GL {gl.toFixed(1)} · {LEVEL_LABELS[level]}
    </span>
  )
}

/** Daily-load badge, judged against the user's own budget. */
export function DayGLPill({ gl, budget }: { gl: number; budget: number }) {
  const level = dayGlLevel(gl, budget)
  return (
    <span className={`pill ${level}`}>
      GL {gl.toFixed(0)} of {budget} · {LEVEL_LABELS[level]}
    </span>
  )
}
