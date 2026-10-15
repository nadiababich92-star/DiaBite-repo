import { useState } from 'react'
import { RATING_LABELS, RATING_ONLY, submitFeedback } from '../lib/feedback'
import type { Milestone } from '../lib/nudge'

interface Props {
  milestone: Milestone
  /** The moment has been dealt with (sent, or "Not now"): it is not asked again in this browser. */
  onAsked: (milestone: Milestone) => void
  /** The card goes away. */
  onClose: () => void
}

const RATINGS = [1, 2, 3, 4, 5]
const MAX = 300

/**
 * "How is it going?": one rating, one optional line, shown once per moment. It sits at the top of the Ask
 * screen, is announced politely and never takes focus: the person is in the middle of something else.
 */
export default function FeedbackNudge({ milestone, onAsked, onClose }: Props) {
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<'asking' | 'sending' | 'sent'>('asking')
  const [failure, setFailure] = useState('')
  const sending = status === 'sending'

  async function send() {
    if (!rating || sending) return
    setStatus('sending'); setFailure('')
    try {
      await submitFeedback({ rating, comment: comment.trim() || RATING_ONLY, context: milestone })
      onAsked(milestone)
      setStatus('sent')
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStatus('asking')
    }
  }

  if (status === 'sent') {
    return (
      <section className="card nudge" role="region" aria-label="Feedback" aria-live="polite">
        <p className="nudge-thanks">Thank you. This goes to the person building DiaBite.</p>
        <button type="button" className="link" onClick={onClose}>Close</button>
      </section>
    )
  }

  return (
    <section className="card nudge" role="region" aria-label="Feedback" aria-live="polite">
      <h2>How is it going?</h2>
      <div className="rating" role="radiogroup" aria-label="Rating from 1 to 5">
        {RATINGS.map((n) => (
          <button
            key={n} type="button" role="radio" aria-checked={rating === n}
            aria-label={`${n} — ${RATING_LABELS[n]}`}
            className={`rating-dot${rating === n ? ' on' : ''}`} disabled={sending}
            onClick={() => setRating(n)}
          >{n}</button>
        ))}
        <span className="muted rating-caption">{rating ? RATING_LABELS[rating] : '1 = not useful, 5 = very useful'}</span>
      </div>
      <textarea
        rows={2} value={comment} maxLength={MAX} disabled={sending} aria-label="Tell us what worked or did not"
        placeholder="Tell us what worked or did not. Please don't write your medical details here."
        onChange={(e) => setComment(e.target.value)}
      />
      {failure && <p className="form-error" role="alert">{failure}</p>}
      <div className="row nudge-actions">
        <button type="button" className="primary" onClick={send} disabled={!rating || sending}>{sending ? 'Sending…' : 'Send'}</button>
        <button type="button" className="ghost" disabled={sending} onClick={() => { onAsked(milestone); onClose() }}>Not now</button>
      </div>
    </section>
  )
}
