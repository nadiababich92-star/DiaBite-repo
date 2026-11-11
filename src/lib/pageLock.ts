/**
 * Every dialog makes the page behind it inert and stops it scrolling. With one dialog that is a class and an
 * attribute set on open and removed on close; with two open at once (the import prompt arrives while "What are
 * GI and GL?" is up) the first to close used to give the page back while the other was still showing. So the
 * page is locked while at least one dialog holds it, and released only when the last one lets go.
 *
 * The attribute is removed only from the elements this module set it on.
 */
const BEHIND = '.app > :not(.modal-backdrop)'

let holders = 0
const inerted = new Set<HTMLElement>()

function sync(): void {
  if (holders > 0) {
    document.body.classList.add('modal-open')
    document.querySelectorAll<HTMLElement>(BEHIND).forEach((el) => {
      if (!el.hasAttribute('inert')) { el.setAttribute('inert', ''); inerted.add(el) }
    })
  } else {
    document.body.classList.remove('modal-open')
    inerted.forEach((el) => el.removeAttribute('inert'))
    inerted.clear()
  }
}

/** Lock the page for one dialog. Call the returned function once, when the dialog goes away; a second call does nothing. */
export function lockPage(): () => void {
  holders++
  sync()
  let released = false
  return () => {
    if (released) return
    released = true
    holders = Math.max(0, holders - 1)
    sync()
  }
}

/** How many dialogs hold the page now (for the checks). */
export const lockCount = (): number => holders
