import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * "What is GL?" in two sentences. A dialog with the same promises as the others:
 * focus goes in and stays in, the page behind is inert, Escape closes it and focus
 * goes back to what opened it. It is drawn into `.app` so that making the rest of
 * `.app` inert does not make the dialog inert too.
 *
 * The wording is a draft for a clinician (docs/CLINICAL_REVIEW.md, question 26).
 */
export default function GlInfo({ budget, onClose }: { budget: number; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const behind = [...document.querySelectorAll<HTMLElement>('.app > :not(.modal-backdrop)')]
    behind.forEach((el) => el.setAttribute('inert', ''))
    document.body.classList.add('modal-open')
    close.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      behind.forEach((el) => el.removeAttribute('inert'))
      document.body.classList.remove('modal-open')
      opener?.focus?.()
    }
  }, [onClose])

  const host = document.querySelector('.app') ?? document.body
  return createPortal(
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="gl-title" ref={dialog}>
        <h2 id="gl-title">What is GL?</h2>
        <p>
          Glycemic load puts two things into one number: how fast a food raises blood sugar, and how much
          carbohydrate is in your portion.
        </p>
        <p>
          Your day has a budget of {budget}. Each meal spends some of it, and the number you see is what is left.
        </p>
        <div className="row">
          <button className="primary" ref={close} onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>,
    host,
  )
}
