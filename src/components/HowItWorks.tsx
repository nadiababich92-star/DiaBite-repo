import { useEffect, useRef } from 'react'

/**
 * "How it works": what each tab is for, and where the numbers come from. A dialog with the same promises as the
 * import prompt: focus goes in and stays in, the page behind is inert, Escape closes it, and focus returns to
 * what opened it. No figures anywhere in it.
 */
export default function HowItWorks({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null)
  const first = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const behind = [...document.querySelectorAll<HTMLElement>('.app > :not(.modal-backdrop)')]
    behind.forEach((el) => el.setAttribute('inert', ''))
    document.body.classList.add('modal-open')
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || !dialog.current) return
      const items = [...dialog.current.querySelectorAll<HTMLElement>('button')]
      const a = items[0], b = items[items.length - 1]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus() }
      else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      behind.forEach((el) => el.removeAttribute('inert'))
      document.body.classList.remove('modal-open')
      opener?.focus?.()
    }
  }, [onClose])

  return (
    <div className="modal-backdrop">
      <div className="modal card how" role="dialog" aria-modal="true" aria-labelledby="how-title" ref={dialog}>
        <h2 id="how-title">How it works</h2>
        <dl className="how-list">
          <div><dt>Ask</dt><dd>Describe a meal in your own words. You get a verdict, the numbers behind it, and a receipt showing every food.</dd></div>
          <div><dt>Diary</dt><dd>What you logged, what you planned for the days ahead, and your week.</dd></div>
          <div><dt>Menu</dt><dd>A week of meals, and a shopping list that follows what you planned. It has not been reviewed by a clinician yet.</dd></div>
          <div><dt>You</dt><dd>Your answers about yourself, your daily targets, and the foods you leave out.</dd></div>
          <div><dt>Settings</dt><dd>How the app looks, your account and data (export or delete), and help.</dd></div>
        </dl>
        <p>Every number is computed by the engine from a food database, never written by the AI. Open Show calculation on any answer to see it.</p>
        <div className="row">
          <button className="primary" ref={first} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
