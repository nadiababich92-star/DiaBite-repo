/**
 * The account: a profile and a diary kept in Supabase for the signed-in person.
 *
 * The browser talks to the two tables directly with the publishable key and the
 * person's session; row-level security (supabase/migrations/*_accounts.sql) is what
 * keeps one person's rows from another. Nothing here is trusted to enforce that.
 *
 * The rule of the sync: when signed in, the account is the source of truth and the
 * local copy is a cache. The exception is a push that failed: `diabite.pending.v1`
 * says so, and on the next load the local copy is pushed first rather than lost.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { sanitizeProfile } from './storage'
import type { DiaryEntry, Profile } from '../types'

export { CONSENT_VERSION, PENDING_KEY, LEGACY_DIARY_KEY, toRow, fromRow, diffEntries, mergeById, exportShape } from './syncCore'
export type { DiaryRow, AccountExport } from './syncCore'
import { CONSENT_VERSION as _CV, PENDING_KEY, LEGACY_DIARY_KEY, toRow, fromRow, diffEntries } from './syncCore'
import type { AccountExport, DiaryRow } from './syncCore'
void _CV; void LEGACY_DIARY_KEY
const PAGE = 1000
const CHUNK = 200

// ── Reading the account ───────────────────────────────────────────────────

export interface ServerAccount {
  profile: Profile | null
  consentAt: string | null
  consentVersion: string | null
  diary: DiaryEntry[]
}

/** Both tables, paged to the end: PostgREST stops at 1,000 rows without saying so (CLAUDE.md rule 2). */
export async function loadAccount(userId: string): Promise<ServerAccount> {
  if (!supabase) throw new Error('not configured')
  const p = await supabase.from('profiles').select('data, consent_at, consent_version').eq('user_id', userId).maybeSingle()
  if (p.error) throw p.error
  const diary: DiaryEntry[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('diary_entries').select('*').eq('user_id', userId)
      .order('day', { ascending: false }).order('id').range(from, from + PAGE - 1)
    if (error) throw error
    for (const r of data ?? []) { const e = fromRow(r as DiaryRow); if (e) diary.push(e) }
    if ((data?.length ?? 0) < PAGE) break
  }
  return {
    profile: p.data ? sanitizeProfile((p.data as { data: unknown }).data) : null,
    consentAt: (p.data as { consent_at?: string } | null)?.consent_at ?? null,
    consentVersion: (p.data as { consent_version?: string } | null)?.consent_version ?? null,
    diary,
  }
}

export async function exportAccount(userId: string, email?: string): Promise<AccountExport> {
  const a = await loadAccount(userId)
  return { exportedAt: new Date().toISOString(), email, consent: { at: a.consentAt, version: a.consentVersion }, profile: a.profile, diary: a.diary }
}

// ── Writing it ────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'saving' | 'error'

async function pushProfile(userId: string, profile: Profile, consent: { at: string | null; version: string | null }) {
  if (!supabase) return
  const { error } = await supabase.from('profiles').upsert({
    user_id: userId, data: profile, consent_at: consent.at, consent_version: consent.version, updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

async function pushEntries(userId: string, upsert: DiaryEntry[], remove: string[]) {
  if (!supabase) return
  for (let i = 0; i < upsert.length; i += CHUNK) {
    const { error } = await supabase.from('diary_entries').upsert(upsert.slice(i, i + CHUNK).map((e) => toRow(userId, e)))
    if (error) throw error
  }
  for (let i = 0; i < remove.length; i += CHUNK) {
    const { error } = await supabase.from('diary_entries').delete().eq('user_id', userId).in('id', remove.slice(i, i + CHUNK))
    if (error) throw error
  }
}

/**
 * Keeps the account in step with the screen: debounced, retried every 30 s while
 * it fails, and never silent about a failure. `prime` is called once with what the
 * server holds, so the first diff is against the server and not against nothing.
 */
export function useAccountSync(args: {
  userId: string | undefined
  ready: boolean
  profile: Profile
  diary: DiaryEntry[]
  consent: { at: string | null; version: string | null }
}) {
  const { userId, ready, profile, diary, consent } = args
  const [status, setStatus] = useState<SyncStatus>('idle')
  const syncedEntries = useRef(new Map<string, string>())
  const syncedProfile = useRef<string>('')
  const [retry, setRetry] = useState(0)

  const prime = useCallback((account: ServerAccount) => {
    syncedEntries.current = new Map(account.diary.map((e) => [e.id, JSON.stringify(e)]))
    syncedProfile.current = account.profile ? JSON.stringify(account.profile) + (account.consentAt ?? '') : ''
  }, [])

  useEffect(() => {
    if (!userId || !ready) return
    const timer = setTimeout(async () => {
      const profileKey = JSON.stringify(profile) + (consent.at ?? '')
      const { upsert, remove } = diffEntries(syncedEntries.current, diary)
      const profileChanged = profileKey !== syncedProfile.current && profile.onboarded
      if (!upsert.length && !remove.length && !profileChanged) return
      setStatus('saving')
      try {
        if (profileChanged) await pushProfile(userId, profile, consent)
        await pushEntries(userId, upsert, remove)
        for (const e of upsert) syncedEntries.current.set(e.id, JSON.stringify(e))
        for (const id of remove) syncedEntries.current.delete(id)
        if (profileChanged) syncedProfile.current = profileKey
        try { localStorage.removeItem(PENDING_KEY) } catch { /* storage unavailable */ }
        setStatus('idle')
      } catch {
        try { localStorage.setItem(PENDING_KEY, '1') } catch { /* storage unavailable */ }
        setStatus('error')
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [userId, ready, profile, diary, consent.at, consent.version, retry])

  // While it fails, try again every 30 s and whenever the person returns to the tab.
  useEffect(() => {
    if (status !== 'error') return
    const again = () => setRetry((n) => n + 1)
    const t = setInterval(again, 30_000)
    window.addEventListener('focus', again)
    return () => { clearInterval(t); window.removeEventListener('focus', again) }
  }, [status])

  return { status, prime, retryNow: () => setRetry((n) => n + 1) }
}
