import { GI_LEVEL_LABELS, LEVEL_LABELS, dayGlLevel, giLevel, glLevel } from '../lib/glycemic'

export function GIPill({ gi }: { gi: number | null }) {
  const level = giLevel(gi)
  if (level === null) return <span className="pill none">no carbs</span>
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
