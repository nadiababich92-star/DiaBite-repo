/**
 * When the landing page is drawn instead of the sign-in screen (docs/specs/landing-routing.md).
 *
 * Pure, so the rule can be tested without a browser. It never reads, logs or stores a token: it looks
 * only at the *names* in the address, so an email link is never covered by the landing page.
 */
interface Where { hash: string; search: string }

const AUTH_KEYS = ['access_token', 'refresh_token', 'error_description', 'error_code', 'code']
const AUTH_TYPES = ['magiclink', 'recovery', 'signup']

const parts = (loc: Where) => [new URLSearchParams(loc.hash.replace(/^#/, '')), new URLSearchParams(loc.search)]

/** True when the address carries a sign-in result (a link that worked, or one that failed). */
export function authInUrl(loc: Where): boolean {
  return parts(loc).some((p) => AUTH_KEYS.some((k) => p.has(k)) || AUTH_TYPES.includes(p.get('type') ?? ''))
}

/** True for /?signin: the address the owner sends for a moderated session goes straight to sign-in. */
export function skipLanding(loc: Pick<Where, 'search'>): boolean {
  return new URLSearchParams(loc.search).has('signin')
}

export interface LandingInput {
  signInRequired: boolean | null
  signedOut: boolean
  notice: string | null | undefined
  entering: boolean
  location: Where
}

/** The whole rule: a stranger, with sign-in required, who is not in the middle of signing in. */
export function showLanding(i: LandingInput): boolean {
  return i.signInRequired === true && i.signedOut && !i.notice && !i.entering
    && !authInUrl(i.location) && !skipLanding(i.location)
}
