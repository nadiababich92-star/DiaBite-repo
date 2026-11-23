/** The parts of signing in that need no browser: is this an address, and what an auth error means for the person. */

export type SignInProblem = 'email' | 'rate' | 'code' | 'network' | 'unavailable'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const looksLikeEmail = (s: string) => EMAIL.test(s.trim()) && s.trim().length <= 254

/** What a Supabase auth error means for the person. */
export function problemOf(e: { status?: number; code?: string; name?: string; message?: string } | null | undefined): SignInProblem {
  if (!e) return 'unavailable'
  if (e.status === 429 || /rate_limit/.test(e.code ?? '')) return 'rate'
  if (/otp_expired|otp_invalid|token/.test(e.code ?? '') || /expired|invalid/i.test(e.message ?? '')) return 'code'
  if (/email_address_invalid|validation_failed/.test(e.code ?? '')) return 'email'
  if (e.name === 'AuthRetryableFetchError' || e.status === 0 || e.status === undefined) return 'network'
  return 'unavailable'
}


/** The length is Supabase's setting (6 to 10 digits), not ours: accept what it can send. */
/** What the engine says about access, from GET /health: whether sign-in is required and how many free answers a signed-out visitor may have. */
export interface Access { required: boolean | null; freeAnswers: number }

/** Anything but a whole number above zero is no free answers: the engine that does not say it does not offer it. */
export function accessOf(health: { signIn?: unknown; freeAnswers?: unknown } | null | undefined): Access {
  const n = health?.freeAnswers
  return { required: health?.signIn === true, freeAnswers: typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 0 }
}

/** The 401 body of an anonymous request: why the person is asked to sign in, and when another free answer comes. Unknown words are no reason. */
export type SignInReason = 'free_limit' | 'anonymous_off'
export function signInReasonOf(body: { reason?: unknown; retryAfterSec?: unknown } | null | undefined): { reason?: SignInReason; retryAfterSec?: number } {
  const reason = body?.reason === 'free_limit' || body?.reason === 'anonymous_off' ? body.reason : undefined
  const wait = typeof body?.retryAfterSec === 'number' && body.retryAfterSec > 0 ? Math.ceil(body.retryAfterSec) : undefined
  return { ...(reason ? { reason } : {}), ...(wait ? { retryAfterSec: wait } : {}) }
}

export const looksLikeCode = (c: string) => /^\d{6,10}$/.test(c)
