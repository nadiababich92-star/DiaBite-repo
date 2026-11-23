import { BANNER_KEY, BANNER_TEXT } from '../lib/anon'

/**
 * The line under the budget bar for a visitor with no account (docs/specs/anon-screen.md, section 4): the budget is a typical adult's,
 * not theirs, and the second sentence is a key that opens sign-in. The disclosure line under it is built and empty until the owner says yes.
 */
export function AnonBanner({ onMakeItYours, disclosure }: { onMakeItYours: () => void; disclosure: string }) {
  return (
    <>
      <p className="anon-banner">{BANNER_TEXT} <button type="button" className="link anon-make" onClick={onMakeItYours}>{BANNER_KEY}</button></p>
      {disclosure ? <p className="anon-note muted">{disclosure}</p> : null}
    </>
  )
}
