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
export const looksLikeCode = (c: string) => /^\d{6,10}$/.test(c)
