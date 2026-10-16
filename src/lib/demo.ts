/**
 * Builders' tools are off unless asked for: a link ending in `?lab` turns them on.
 *
 * What is for the builders and not for the people using the app: the evaluation row (Download Responses, the saved
 * count, "Fresh context per question") and the panel that lists every tool call. Until 16 October these were on
 * for everyone and a link ending in `?demo` hid them; testers were seeing a course lab's controls at the plain
 * address, so the default is now the other way round. `?demo` still works and still hides them, even in a tab
 * that had `?lab`. Neither changes what an answer says or how it is computed, and neither stores anything but a
 * flag for the tab: it survives moving between tabs and is gone when the tab is closed.
 */
const KEY = 'diabite.lab'

function read(): boolean {
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.has('demo')) { sessionStorage.removeItem(KEY); return false }
    if (q.has('lab')) { sessionStorage.setItem(KEY, '1'); return true }
    return sessionStorage.getItem(KEY) === '1'
  } catch { return new URLSearchParams(window.location.search).has('lab') }
}

/** The builders' tools are showing. */
export const isLab: boolean = typeof window !== 'undefined' && read()
/** What the screens ask: hide the builders' tools. True for everyone except a `?lab` tab. */
export const isDemo: boolean = !isLab
