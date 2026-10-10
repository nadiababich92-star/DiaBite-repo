/**
 * Demo mode: a link for showing DiaBite to people, ending in `?demo`.
 *
 * It hides what is for the builders and not for the audience: the evaluation row
 * (Download Responses, the saved count, "Fresh context per question") and the panel
 * that lists every tool call. It changes nothing about what an answer says or how it
 * is computed, and it stores nothing extra. Remembered for the tab, so moving between
 * tabs does not drop it, and gone when the tab is closed.
 */
const KEY = 'diabite.demo'

function read(): boolean {
  try {
    if (new URLSearchParams(window.location.search).has('demo')) { sessionStorage.setItem(KEY, '1'); return true }
    return sessionStorage.getItem(KEY) === '1'
  } catch { return new URLSearchParams(window.location.search).has('demo') }
}

export const isDemo: boolean = typeof window !== 'undefined' && read()
