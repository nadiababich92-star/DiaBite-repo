import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { allSteps, copyFor, markSeen, nextStep, type TourContext, type TourStep } from '../lib/tour'

interface Props {
  seen: readonly TourStep[]
  onSeen: (seen: TourStep[]) => void
  ctx: TourContext
}

/** The tip's width on a laptop; a phone pins it edge to edge. */
const TIP_W = 300

const anchorOf = (step: TourStep) => document.querySelector<HTMLElement>(`[data-tour="${step}"]`)

/**
 * One tip at a time, pointing at the real screen. Non-modal: the page behind stays usable and the tip never
 * takes focus (a tip on the empty Ask screen would pull it out of the box the person is about to type in).
 * It is announced politely and its buttons are reachable by Tab; Escape means "Skip tips".
 */
export default function Tour({ seen, onSeen, ctx }: Props) {
  const step = nextStep(seen, ctx)
  const [place, setPlace] = useState<{ top: number; left: number } | { bottom: number } | null>(null)
  const [present, setPresent] = useState(false)

  // The step shows only while its anchor is on the page; until then it waits and is not marked seen.
  useEffect(() => {
    if (!step) { setPresent(false); return }
    const look = () => setPresent(!!anchorOf(step))
    look()
    const id = window.setInterval(look, 400)
    return () => window.clearInterval(id)
  }, [step])

  const measure = useCallback(() => {
    if (!step) return
    const a = anchorOf(step)
    if (!a) return
    const set = (next: NonNullable<typeof place>) => setPlace((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    // A phone: pinned above the tab bar, so it never covers the box or the keyboard.
    if (window.innerWidth <= 560) {
      const bar = document.querySelector<HTMLElement>('nav.tabs')
      set({ bottom: bar ? Math.round(window.innerHeight - bar.getBoundingClientRect().top + 12) : 16 })
      return
    }
    const r = a.getBoundingClientRect()
    const tip = document.querySelector<HTMLElement>('.tour-tip')
    const height = tip?.offsetHeight ?? 170
    // Beside the column when there is room, so it never sits on top of the answer it is explaining.
    const colRight = document.querySelector('main')?.getBoundingClientRect().right ?? 0
    if (window.innerWidth - colRight >= TIP_W + 32) {
      set({ top: Math.round(Math.max(8, Math.min(r.top, window.innerHeight - height - 8))), left: Math.round(colRight + 16) })
      return
    }
    const left = Math.max(16, Math.min(r.left, window.innerWidth - TIP_W - 16))
    const below = r.bottom + 12
    set({ top: Math.round(below + height > window.innerHeight - 8 ? Math.max(8, r.top - height - 12) : below), left: Math.round(left) })
  }, [step])

  // Ring on the anchor, and scroll to it when it is out of view (never for the input).
  useLayoutEffect(() => {
    if (!step || !present) return
    const a = anchorOf(step)
    if (!a) return
    a.classList.add('tour-ring')
    if (step !== 'input' && window.innerWidth > 560) {
      const r = a.getBoundingClientRect()
      if (r.top < 0 || r.bottom > window.innerHeight) {
        const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        a.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' })
      }
    }
    measure()
    return () => a.classList.remove('tour-ring')
  }, [step, present, measure])

  useEffect(() => {
    if (!step || !present) return
    const again = () => measure()
    window.addEventListener('resize', again)
    window.addEventListener('scroll', again, true)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(again) : null
    ro?.observe(document.body)
    return () => { window.removeEventListener('resize', again); window.removeEventListener('scroll', again, true); ro?.disconnect() }
  }, [step, present, measure])

  // A phone: the tip is pinned at the bottom, so scroll until the anchor sits clear above it.
  useLayoutEffect(() => {
    if (!step || !present || !place || !('bottom' in place) || step === 'input') return
    const a = anchorOf(step)
    const tip = document.querySelector<HTMLElement>('.tour-tip')
    if (!a || !tip) return
    const ar = a.getBoundingClientRect()
    const limit = tip.getBoundingClientRect().top - 12
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (ar.bottom > limit) window.scrollBy({ top: ar.bottom - limit, behavior: calm ? 'auto' : 'smooth' })
    else if (ar.top < 8) window.scrollBy({ top: ar.top - 8, behavior: calm ? 'auto' : 'smooth' })
  }, [step, present, place])

  // Escape is "Skip tips", wherever focus is.
  useEffect(() => {
    if (!step || !present) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onSeen(allSteps()) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [step, present, onSeen])

  if (!step || !present) return null
  const copy = copyFor(step, ctx)
  return (
    <div
      className={`tour-tip${place && 'bottom' in place ? ' pinned' : ''}`} role="region" aria-label="Tip" aria-live="polite"
      style={place ? ('bottom' in place ? { bottom: place.bottom } : { top: place.top, left: place.left }) : { visibility: 'hidden' }}
    >
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
      <div className="row">
        <button className="primary" onClick={() => onSeen(markSeen(seen, step))}>{copy.button}</button>
        <button className="link" onClick={() => onSeen(allSteps())}>Skip tips</button>
      </div>
    </div>
  )
}
