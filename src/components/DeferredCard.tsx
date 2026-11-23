import { useEffect } from 'react'
import type { DeferredStep } from '../types'

interface Props {
  step: DeferredStep
  /** Opens that one onboarding step (the `only` mode). */
  onAnswer: () => void
  /** Hides the card until the next page load. */
  onLater: () => void
  /** Called once when the card is first on screen: App records that a card was shown in this session. */
  onShown?: () => void
}

const TITLE = 'Two minutes more, and the numbers become yours'

const BODY: Record<DeferredStep, string> = {
  medicines: 'Which medicines you take changes what is safe to suggest. Classes only, never doses.',
  diagnosis: 'Your diagnosis sets how cautious the daily ceiling is.',
  conditions: 'Kidneys, other conditions, allergies and how you eat change what DiaBite suggests.',
  day: 'Your goal and how you count carbohydrate set the numbers you see each day.',
}

/** Every string the card can show, for the check that none of them holds a figure. */
export const deferredCardCopy = (): string[] => [TITLE, ...Object.values(BODY), 'Answer now', 'Later']

/**
 * Offers the next question the short onboarding left for later: one card, a plain way to answer it and a plain way to
 * put it off. It is announced politely and never takes focus: the person is in the middle of something else.
 * The look is the feedback card's (`card nudge`), so no new style is needed.
 */
export default function DeferredCard({ step, onAnswer, onLater, onShown }: Props) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onShown?.() }, [])
  return (
    <section className="card nudge" role="region" aria-label={TITLE} aria-live="polite">
      <h2>{TITLE}</h2>
      <p className="muted">{BODY[step]}</p>
      <div className="row">
        <button type="button" className="primary" onClick={onAnswer}>Answer now</button>
        <button type="button" className="link" onClick={onLater}>Later</button>
      </div>
    </section>
  )
}
