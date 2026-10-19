/**
 * The weekly report on the people testing DiaBite.
 *
 *   npm run report
 *   npm run report -- --exclude a@x.com,b@y.com     # leave these accounts out (the builder's own, say)
 *
 * Reads accounts, profiles, diaries and feedback from Supabase with the service key (taken from the Container App
 * secret, never printed) and the turn log from Log Analytics, then prints the report and saves it to
 * docs/reports/<today>.md. No email, name or id is written anywhere: people are numbered by sign-up order.
 * The arithmetic is in src/lib/report.ts and is tested by `npm run eval`.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { buildReport, reportMarkdown, type AccountInput, type FeedbackInput, type TurnGroup, type TurnStats } from '../src/lib/report'
import { fromRow } from '../src/lib/syncCore'
import { calculateTargets, DEFAULT_PROFILE } from '../src/lib/profile'
import { sanitizeProfile, todayISO } from '../src/lib/storage'
import type { DiaryEntry } from '../src/types'

const SB = 'https://qennxqfbvgqyodjmkguo.supabase.co'
const RG = 'rg-nadia.babich92-5702'
const env = { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` }
const az = (args: string[]) => execFileSync('az', args, { env, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()

const exclude = new Set(
  (process.argv.find((a, i) => process.argv[i - 1] === '--exclude') ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
)

const key = az(['containerapp', 'secret', 'show', '-g', RG, '-n', 'diabite-engine', '--secret-name', 'supabase-service-key', '--query', 'value', '-o', 'tsv'])
const headers = { apikey: key, Authorization: `Bearer ${key}` }

// CLAUDE.md rule 2: PostgREST stops at 1,000 rows without saying so, so every read is paged until a page is short.
async function pages<T>(path: string): Promise<T[]> {
  const all: T[] = []
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${SB}${path}${path.includes('?') ? '&' : '?'}offset=${offset}&limit=1000`, { headers })
    if (!res.ok) throw new Error(`${path.split('?')[0]}: ${res.status}`)
    const rows = (await res.json()) as T[]
    all.push(...rows)
    if (rows.length < 1000) return all
  }
}

async function accounts(): Promise<{ id: string; createdAt: string }[]> {
  const out: { id: string; createdAt: string }[] = []
  for (let page = 1; ; page++) {
    const res = await fetch(`${SB}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers })
    if (!res.ok) throw new Error(`auth users: ${res.status}`)
    const users = ((await res.json()) as { users: { id: string; email?: string; created_at: string }[] }).users
    for (const u of users) {
      const mail = (u.email ?? '').toLowerCase()
      // The rehearsal, screens and demo-video throwaways live on example.com; the email is used for this filter and dropped.
      if (mail.endsWith('@example.com') || exclude.has(mail)) continue
      out.push({ id: u.id, createdAt: u.created_at })
    }
    if (users.length < 1000) return out
  }
}

function turnStats(): TurnStats | null {
  try {
    const ws = az(['containerapp', 'env', 'show', '-g', RG, '-n', 'diabite-env', '--query', 'properties.appLogsConfiguration.logAnalyticsConfiguration.customerId', '-o', 'tsv'])
    // A browser's session id is a random UUID (or 32 hex characters when the browser has no randomUUID); our scripts use other shapes.
    const base = `ContainerAppConsoleLogs_CL | where TimeGenerated > ago(7d) and ContainerName_s == "diabite-engine" and Log_s startswith '{"evt":"turn"' | extend t = parse_json(Log_s) | extend sid = tostring(t.session) | extend src = iff(sid matches regex "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" or sid matches regex "^[0-9a-f]{32}$", "browser", "tests")`
    const query = (q: string) => JSON.parse(az(['monitor', 'log-analytics', 'query', '-w', ws, '--analytics-query', q, '-o', 'json'])) as Record<string, unknown>[]
    const rows = query(`${base} | summarize turns = count(), verifiedRate = round(100.0 * countif(tobool(t.verified)) / count(), 1), p50ms = percentile(toint(t.ms), 50), p90ms = percentile(toint(t.ms), 90), blocked = countif(tobool(t.blocked)), regenerated = countif(toint(t.attempts) > 1), unknownShare = round(100.0 * countif(toint(t.unknownPhrases) > 0) / count(), 1), clarifyShare = round(100.0 * countif(toint(t.clarified) > 0) / count(), 1) by src`)
    const group = (kind: string): TurnGroup => {
      const s = rows.find((r) => r.src === kind)
      const n = (k: string) => Number(s?.[k] ?? 0)
      return { turns: n('turns'), verifiedRate: n('verifiedRate'), p50ms: n('p50ms'), p90ms: n('p90ms'), blocked: n('blocked'), regenerated: n('regenerated'), unknownShare: n('unknownShare'), clarifyShare: n('clarifyShare') }
    }
    // Deduplicated case-insensitively, keeping the first spelling; at most 50; browser sessions only.
    const byLower = new Map<string, string>()
    for (const r of query(`${base} | where src == "browser" and toint(t.unknownPhrases) > 0 | project q = tostring(t.question)`)) {
      const q = String(r.q ?? '').trim().slice(0, 200)
      if (q && !byLower.has(q.toLowerCase())) byLower.set(q.toLowerCase(), q)
      if (byLower.size >= 50) break
    }
    return { browser: group('browser'), tests: group('tests'), unknownQuestions: [...byLower.values()] }
  } catch (e) { console.error(`The turn log could not be read: ${String((e as Error).message).split('\n')[0].slice(0, 160)}`); return null }
}

try {
  const people = await accounts()
  const ids = new Set(people.map((p) => p.id))
  const profiles = new Map((await pages<{ user_id: string; data: Record<string, unknown> | null }>('/rest/v1/profiles?select=user_id,data&order=user_id')).map((p) => [p.user_id, p.data]))
  const diaries = new Map<string, DiaryEntry[]>()
  for (const row of await pages<Parameters<typeof fromRow>[0] & { user_id: string }>('/rest/v1/diary_entries?select=user_id,id,day,meal,food_id,grams,snapshot,planned&order=user_id,id')) {
    if (!ids.has(row.user_id)) continue
    const e = fromRow(row)
    if (e) diaries.set(row.user_id, [...(diaries.get(row.user_id) ?? []), e])
  }
  const input: AccountInput[] = people.map((p) => {
    const data = profiles.get(p.id)
    const profile = data ? sanitizeProfile(data) : DEFAULT_PROFILE
    return { createdAt: p.createdAt, onboarded: data?.onboarded === true, glBudget: calculateTargets(profile).glBudget, diary: diaries.get(p.id) ?? [] }
  })
  const feedback = (await pages<{ created_at: string; rating: number; context?: string | null; feedback: string }>('/rest/v1/feedback?select=created_at,rating,context,feedback&order=created_at.desc'))
    .map((f): FeedbackInput => ({ createdAt: f.created_at, rating: f.rating, context: f.context ?? null, text: f.feedback }))
  const today = todayISO()
  const md = reportMarkdown(buildReport({ today, accounts: input, feedback, turns: turnStats() }))
  mkdirSync('docs/reports', { recursive: true })
  writeFileSync(`docs/reports/${today}.md`, md)
  console.log(md)
} catch (e) {
  console.error(`The report could not be built: ${(e as Error).message}`)
  process.exit(1)
}
