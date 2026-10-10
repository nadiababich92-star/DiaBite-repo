import { useEffect, useRef } from 'react'

/**
 * "We found a diary on this device. Move it to your account?" A dialog with the same
 * promises as the feedback dialog: focus goes in and stays in, the page behind is
 * inert, Escape means "not now", and focus returns to what opened it.
 */
export default function ImportPrompt({ count, onMove, onLater }: { count: number; onMove: () => void; onLater: () => void }) {
  const dialog = useRef<HTMLDivElement>(null)
  const first = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const behind = [...document.querySelectorAll<HTMLElement>('.app > :not(.modal-backdrop)')]
    behind.forEach((el) => el.setAttribute('inert', ''))
    document.body.classList.add('modal-open')
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onLater(); return }
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
  }, [onLater])

  return (
    <div className="modal-backdrop">
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="import-title" ref={dialog}>
        <h2 id="import-title">We found a diary on this device</h2>
        <p>
          {count} {count === 1 ? 'entry' : 'entries'} from before you signed in. Move {count === 1 ? 'it' : 'them'} to your account,
          so {count === 1 ? 'it is' : 'they are'} there on every device?
        </p>
        <div className="row">
          <button className="primary" ref={first} onClick={onMove}>Move</button>
          <button className="ghost" onClick={onLater}>Not now</button>
        </div>
      </div>
    </div>
  )
}
