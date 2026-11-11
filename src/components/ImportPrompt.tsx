import { useEffect, useRef, useState } from 'react'
import { lockPage } from '../lib/pageLock'

/**
 * "We found a diary on this device. Move it to your account?" A dialog with the same
 * promises as the feedback dialog: focus goes in and stays in, the page behind is
 * inert, Escape means "not now", and focus returns to what opened it.
 *
 * Three answers: Move, Not now (asked again at the next sign-in, nothing is lost), and Don't move, for a person who
 * does not want the old diary at all. Don't move deletes it from this device, so it asks once more, in words, and
 * says it cannot be undone. Nothing is deleted without that second answer, and the account is never touched.
 */
export default function ImportPrompt({ count, onMove, onLater, onDiscard }: { count: number; onMove: () => void; onLater: () => void; onDiscard: () => void }) {
  const dialog = useRef<HTMLDivElement>(null)
  const first = useRef<HTMLButtonElement>(null)
  const keep = useRef<HTMLButtonElement>(null)
  const [confirming, setConfirming] = useState(false)
  const opened = useRef(false)
  const one = count === 1

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const unlock = lockPage()
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
      unlock()
      opener?.focus?.()
    }
  }, [onLater])

  // Focus follows the question: into the safe answer when the confirmation opens, back to the first button when it closes.
  useEffect(() => {
    if (!opened.current) { opened.current = true; return }
    ;(confirming ? keep : first).current?.focus()
  }, [confirming])

  return (
    <div className="modal-backdrop">
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="import-title" ref={dialog}>
        {confirming ? (
          <>
            <h2 id="import-title">Delete {one ? 'this entry' : `these ${count} entries`}?</h2>
            <p>
              {one ? 'It is' : 'They are'} on this device only, from before you signed in. Deleting removes {one ? 'it' : 'them'} for good and
              cannot be undone. Your account is not touched.
            </p>
            <div className="row">
              <button className="ghost" ref={keep} onClick={() => setConfirming(false)}>Keep {one ? 'it' : 'them'}</button>
              <button className="danger" onClick={onDiscard}>Delete</button>
            </div>
          </>
        ) : (
          <>
            <h2 id="import-title">We found a diary on this device</h2>
            <p>
              {count} {one ? 'entry' : 'entries'} from before you signed in. Move {one ? 'it' : 'them'} to your account,
              so {one ? 'it is' : 'they are'} there on every device?
            </p>
            <div className="row">
              <button className="primary" ref={first} onClick={onMove}>Move</button>
              <button className="ghost" onClick={onLater}>Not now</button>
              <button className="ghost" onClick={() => setConfirming(true)}>Don&apos;t move</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
