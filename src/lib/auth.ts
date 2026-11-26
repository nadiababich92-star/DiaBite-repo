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
import { adoptSessionOwner } from './session'
import { AGENT_URL } from './agent'
import { clearDevice, thawWrites } from './storage'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn'
export interface AuthState { status: AuthStatus; userId?: string; email?: string }

const stateOf = (s: Session | null): AuthState =>
  s ? { status: 'signedIn', userId: s.user.id, email: s.user.email ?? undefined } : { status: 'signedOut' }

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: supabase ? 'loading' : 'signedOut' })
  useEffect(() => {
    if (!supabase) return
    let live = true
    supabase.auth.getSession().then(({ data }) => { adoptSessionOwner(data.session?.user.id ?? null); if (live) setState(stateOf(data.session)) })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { adoptSessionOwner(session?.user.id ?? null); if (live) setState(stateOf(session)) })
    return () => { live = false; data.subscription.unsubscribe() }
  }, [])
  return state
}

/**
 * Does this deployment make people sign in? Asked of the engine, so turning
 * REQUIRE_SIGN_IN on or off is one revision and no new build. `null` while unknown.
 */
export function useAccess(): Access {
  const [access, setAccess] = useState<Access>({ required: supabase ? null : false, freeAnswers: 0, googleSignIn: false })
  useEffect(() => {
    if (!supabase) return
    let live = true
    fetch(healthUrl())
      .then((r) => r.json() as Promise<{ signIn?: boolean; freeAnswers?: number; googleSignIn?: boolean }>)
      .then((h) => { if (live) setAccess(accessOf(h)) })
      // If the engine cannot be reached nothing else works either; the wall is the safe side, with no free answers.
      .catch(() => { if (live) setAccess({ required: true, freeAnswers: 0, googleSignIn: false }) })
    return () => { live = false }
  }, [])
  return access
}

/** The older name, kept for the one place that asks only whether sign-in is required. */
export const useSignInRequired = (): boolean | null => useAccess().required

/** The engine's /health, whatever the agent URL looks like in this build (/agent/ask, /agent, or absolute). */
export function engineUrl(path: '/health' | '/account'): string {
  const u = new URL(AGENT_URL, window.location.origin)
  u.pathname = u.pathname.replace(/\/agent(\/ask)?\/?$/, path)
  return u.toString()
}
const healthUrl = () => engineUrl('/health')

export { accessOf, inAppBrowser, looksLikeCode, looksLikeEmail, problemOf, signInReasonOf } from './authCore'
export type { Access, SignInProblem, SignInReason } from './authCore'
import { accessOf, looksLikeCode, looksLikeEmail, problemOf, type Access, type SignInProblem } from './authCore'

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

/**
 * Starts Google's sign-in (docs/specs/first-session-google-signin.md). On success the browser leaves for Google and comes back to this
 * page's own address with a session, which useAuth picks up like an email link's. Email only: the consent card says DiaBite keeps your
 * email address, and nothing else from Google is asked for.
 */
export async function signInWithGoogle(): Promise<'redirecting' | SignInProblem> {
  if (!supabase) return 'unavailable'
  try {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin, scopes: 'email' } })
    return error ? problemOf(error) : 'redirecting'
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

export { clearDevice } from './storage'

export async function signOutAndClear(): Promise<void> {
  // Cleared first, then signed out: the sign-out event re-renders the app, and what it reads from storage must
  // already be empty. If the sign-out itself fails the person is still signed in, so writing resumes.
  clearDevice()
  // `local`: the default is `global`, which also ends the person's sessions on their other devices, and those
  // would then lose the session without clearing what they hold.
  try { await supabase?.auth.signOut({ scope: 'local' }) } catch (e) { thawWrites(); throw e }
}
