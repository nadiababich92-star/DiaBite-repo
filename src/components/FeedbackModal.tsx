import { useEffect, useRef, useState } from 'react'
import { COMMENT_MAX, submitFeedback, validate, type FeedbackErrors } from '../lib/feedback'

interface Props {
  onClose: () => void
}

const RATINGS = [1, 2, 3, 4, 5]
const RATING_LABELS: Record<number, string> = {
  1: 'Not useful',
  2: 'Barely useful',
  3: 'Somewhat useful',
  4: 'Useful',
  5: 'Very useful',
}

type Status = 'editing' | 'sending' | 'sent' | 'failed'

export default function FeedbackModal({ onClose }: Props) {
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<FeedbackErrors>({})
  const [status, setStatus] = useState<Status>('editing')
  const [failure, setFailure] = useState('')
  const dialog = useRef<HTMLDivElement>(null)
  const firstField = useRef<HTMLButtonElement>(null)

  const sending = status === 'sending'

  useEffect(() => { firstField.current?.focus() }, [])

  // Esc closes, except mid-submit so an in-flight send is never orphaned.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sending, onClose])

  // Re-validate as the person fixes a field, but only after the first attempt.
  const revalidate = (next: Partial<{ rating: number | null; comment: string; email: string }>) => {
    if (!Object.keys(errors).length) return
    setErrors(validate({ rating, comment, email, ...next }))
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (sending) return // duplicate submissions
    const found = validate({ rating, comment, email })
    setErrors(found)
    if (Object.keys(found).length) {
      dialog.current?.querySelector<HTMLElement>('[data-invalid="true"]')?.focus()
      return
    }
    setStatus('sending')
    setFailure('')
    try {
      await submitFeedback({
        rating: rating as number,
        comment: comment.trim(),
        name: name.trim() || undefined,
        email: email.trim() || undefined,
      })
      setStatus('sent')
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStatus('failed')
    }
  }

  function startOver() {
    setRating(null); setComment(''); setName(''); setEmail('')
    setErrors({}); setFailure(''); setStatus('editing')
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !sending) onClose() }}
    >
      <div
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        ref={dialog}
      >
        <div className="modal-head">
          <h2 id="feedback-title">{status === 'sent' ? 'Thank you' : 'Send feedback'}</h2>
          <button className="link" onClick={onClose} disabled={sending} aria-label="Close feedback">Close</button>
        </div>

        {status === 'sent' ? (
          <div className="feedback-done">
            <p className="eyebrow-line">Feedback sent</p>
            <p>
              Thanks — this goes straight into what gets built next. Nothing you wrote is shared
              with anyone outside DiaBite.
            </p>
            <div className="row">
              <button className="primary" onClick={onClose}>Back to the app</button>
              <button className="ghost" onClick={startOver}>Send another</button>
            </div>
          </div>
        ) : (
          <form className="feedback-form" onSubmit={send} noValidate>
            <p className="muted modal-intro">
              Tell us how the answers are working for you. Takes a few seconds; nothing here is
              medical advice and no health data is required.
            </p>

            <fieldset className="field-set" aria-describedby={errors.rating ? 'rating-error' : undefined}>
              <legend>How useful is DiaBite so far? <em>Required</em></legend>
              <div className="rating" role="radiogroup" aria-label="Rating from 1 to 5">
                {RATINGS.map((n) => (
                  <button
                    key={n}
                    ref={n === 1 ? firstField : undefined}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} — ${RATING_LABELS[n]}`}
                    className={`rating-dot${rating === n ? ' on' : ''}`}
                    data-invalid={errors.rating ? 'true' : undefined}
                    disabled={sending}
                    onClick={() => { setRating(n); revalidate({ rating: n }) }}
                  >
                    {n}
                  </button>
                ))}
                <span className="muted rating-caption">{rating ? RATING_LABELS[rating] : '1 = not useful, 5 = very useful'}</span>
              </div>
              {errors.rating && <p className="field-error" id="rating-error">{errors.rating}</p>}
            </fieldset>

            <label className="field">
              <span>What worked, what didn&apos;t? <em>Required</em></span>
              <textarea
                value={comment}
                rows={4}
                maxLength={COMMENT_MAX + 100}
                disabled={sending}
                aria-invalid={errors.comment ? true : undefined}
                aria-describedby={errors.comment ? 'comment-error' : 'comment-hint'}
                data-invalid={errors.comment ? 'true' : undefined}
                placeholder="e.g. the receipt made the rice portion obvious, but I couldn't find my usual breakfast"
                onChange={(e) => { setComment(e.target.value); revalidate({ comment: e.target.value }) }}
              />
              {errors.comment
                ? <p className="field-error" id="comment-error">{errors.comment}</p>
                : <p className="field-hint" id="comment-hint">{comment.trim().length}/{COMMENT_MAX}</p>}
            </label>

            <div className="grid">
              <label className="field">
                <span>Name <em>Optional</em></span>
                <input
                  type="text" value={name} disabled={sending} autoComplete="name"
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Email <em>Optional</em></span>
                <input
                  type="email" value={email} disabled={sending} autoComplete="email"
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? 'email-error' : 'email-hint'}
                  data-invalid={errors.email ? 'true' : undefined}
                  placeholder="only if you want a reply"
                  onChange={(e) => { setEmail(e.target.value); revalidate({ email: e.target.value }) }}
                />
                {errors.email
                  ? <p className="field-error" id="email-error">{errors.email}</p>
                  : <p className="field-hint" id="email-hint">We only use it to answer you.</p>}
              </label>
            </div>

            {status === 'failed' && (
              <div className="form-error" role="alert">
                <strong>Not sent.</strong> {failure} Your answers are still here.
              </div>
            )}

            <div className="row modal-actions">
              <button className="primary" type="submit" disabled={sending} aria-busy={sending}>
                {sending ? 'Sending…' : status === 'failed' ? 'Try again' : 'Send feedback'}
              </button>
              <button className="ghost" type="button" onClick={onClose} disabled={sending}>Cancel</button>
              {sending && <span className="muted" role="status">Sending your feedback…</span>}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
