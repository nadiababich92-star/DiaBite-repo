/**
 * Signing in: an emailed link and a code, no password.
 *
 * The account is Supabase Auth; this file is the only place the app talks to it
 * about identity. Everything that can go wrong comes back as one of a few
 * `SignInProblem` words, never as the raw error text, so the screen can say it in
 * the product's own voice.
 */
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { AGENT_URL } from './agent'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn'
export interface AuthState { status: AuthStatus; userId?: string; email?: string }

const stateOf = (s: Session | null): AuthState =>
  s ? { status: 'signedIn', userId: s.user.id, email: s.user.email ?? undefined } : { status: 'signedOut' }

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: supabase ? 'loading' : 'signedOut' })
  useEffect(() => {
    if (!supabase) return
    let live = true
    supabase.auth.getSession().then(({ data }) => { if (live) setState(stateOf(data.session)) })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { if (live) setState(stateOf(session)) })
    return () => { live = false; data.subscription.unsubscribe() }
  }, [])
  return state
}

/**
 * Does this deployment make people sign in? Asked of the engine, so turning
 * REQUIRE_SIGN_IN on or off is one revision and no new build. `null` while unknown.
 */
export function useSignInRequired(): boolean | null {
  const [required, setRequired] = useState<boolean | null>(supabase ? null : false)
  useEffect(() => {
    if (!supabase) return
    let live = true
    fetch(healthUrl())
      .then((r) => r.json() as Promise<{ signIn?: boolean }>)
      // If the engine cannot be reached nothing else works either; the wall is the safe side.
      .then((h) => { if (live) setRequired(h.signIn === true) })
      .catch(() => { if (live) setRequired(true) })
    return () => { live = false }
  }, [])
  return required
}

/** The engine's /health, whatever the agent URL looks like in this build (/agent/ask, /agent, or absolute). */
export function engineUrl(path: '/health' | '/account'): string {
  const u = new URL(AGENT_URL, window.location.origin)
  u.pathname = u.pathname.replace(/\/agent(\/ask)?\/?$/, path)
  return u.toString()
}
const healthUrl = () => engineUrl('/health')

export { looksLikeCode, looksLikeEmail, problemOf } from './authCore'
export type { SignInProblem } from './authCore'
import { looksLikeCode, looksLikeEmail, problemOf, type SignInProblem } from './authCore'

export async function sendLink(email: string): Promise<SignInProblem | null> {
  if (!supabase) return 'unavailable'
  if (!looksLikeEmail(email)) return 'email'
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
    })
    return error ? problemOf(error) : null
  } catch { return 'network' }
}

export async function verifyCode(email: string, code: string): Promise<SignInProblem | null> {
  if (!supabase) return 'unavailable'
  if (!looksLikeCode(code)) return 'code'
  try {
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' })
    return error ? problemOf(error) : null
  } catch { return 'network' }
}

/** The token the engine checks. Read fresh for every ask: it is short-lived and refreshed here. */
export async function accessToken(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

/** Every key this app keeps on the device. Signing out removes all of them. */
export function clearDevice(): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('diabite.')) localStorage.removeItem(k)
  } catch { /* storage unavailable */ }
}

export async function signOutAndClear(): Promise<void> {
  try { await supabase?.auth.signOut() } finally { clearDevice() }
}
