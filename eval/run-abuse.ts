/**
 * Layer 1b: the abuse protection, proved without spending a token.
 *
 *   npm run eval:abuse
 *
 * Starts the real engine on a spare port with tiny limits and a model endpoint
 * that refuses connections. A turn that passes the limits then fails at the
 * model with 502, which is all this suite needs: it asserts on status codes and
 * JSON fields — never on prose — and a 502 means "admitted". What is under
 * test is who is let through, not what the agent says.
 *
 * Cases come from docs/engineering/engineering-doc.md §10 (A1–A10).
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chargeTurn, _reset, _state, RateLimited, MAX_KEYS } from '../server/guard'
import { putSession, rememberResponse, _sizes, MAX_SESSIONS } from '../server/sessions'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let PORT = 8800 + Math.floor(Math.random() * 100)
let BASE = `http://127.0.0.1:${PORT}`
const KEY = 'abuse-suite-key'
const ADMITTED = new Set([200, 502])

let failed = 0
function check(id: string, what: string, ok: boolean, detail = '') {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${what}${ok ? '' : `  → ${detail}`}`)
}

async function ask(body: unknown, headers: Record<string, string> = {}) {
  const r = await fetch(`${BASE}/agent/ask`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  })
  let json: Record<string, unknown> = {}
  try { json = await r.json() as Record<string, unknown> } catch { /* empty body */ }
  return { status: r.status, json, headers: r.headers }
}
const meal = (sessionId: string, message = 'a bowl of oatmeal') => ({ sessionId, message })

async function waitReady() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${BASE}/health`)).ok) return } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('engine did not start')
}

/** One engine per scenario, each on its own port so a slow shutdown cannot answer for the next. */
function start(env: Record<string, string>) {
  PORT++
  BASE = `http://127.0.0.1:${PORT}`
  const child = spawn('npx', ['tsx', 'server/engine.ts'], {
    cwd: ROOT, stdio: 'ignore', detached: true,
    env: {
      ...process.env,
      PORT: String(PORT),
      ENGINE_API_KEY: KEY,
      ENGINE_URL: '',
      // Refuses connections: a turn that is admitted dies here, instantly and free.
      PROJECT_ENDPOINT: 'http://127.0.0.1:9', PROJECT_API_KEY: 'none',
      SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '',
      ...env,
    },
  })
  // `npx` forks tsx forks node: kill the group, not just the first.
  return { kill: () => { try { process.kill(-child.pid!) } catch { /* already gone */ } } }
}

async function httpSuite() {
  // ── window limit: 3 asks per 10 minutes from one address ───────────────
  const child = start({
    ASK_IP_10MIN: '3', ASK_IP_DAY: '1000', ASK_SESSION_HOUR: '1000', ASK_DAILY_CEILING: '1000',
  })
  try {
    await waitReady()

    const first = await Promise.all([1, 2, 3].map((i) => ask(meal(`a1-${i}`))))
    check('A0', 'three asks inside the window are admitted',
      first.every((r) => ADMITTED.has(r.status)), first.map((r) => r.status).join(','))

    const fourth = await ask(meal('a1-4'))
    check('A1', '4th ask: 429 rate_limited, scope ip, Retry-After set',
      fourth.status === 429 && fourth.json.error === 'rate_limited' && fourth.json.scope === 'ip'
        && Number(fourth.headers.get('retry-after')) > 0 && Number(fourth.json.retryAfterSec) > 0,
      JSON.stringify([fourth.status, fourth.json, fourth.headers.get('retry-after')]))

    const dosing = await ask(meal('a2', 'how many units of insulin should I take for this meal'))
    check('A2', 'a dosing question after the limit is still answered by the rule',
      dosing.status === 200 && dosing.json.blockedRule === 'dosing', JSON.stringify([dosing.status, dosing.json.blockedRule]))

    const red = await ask(meal('a3', 'my glucose is 320 and I am vomiting'))
    check('A3', 'a red-flag message after the limit is still answered by the rule',
      red.status === 200 && red.json.blockedRule === 'red_flag', JSON.stringify([red.status, red.json.blockedRule]))

    const long = await ask(meal('a4', 'x'.repeat(501)))
    check('A4', '501-character message: 400 invalid_request, field message',
      long.status === 400 && long.json.error === 'invalid_request' && long.json.field === 'message', JSON.stringify([long.status, long.json]))

    const longId = await ask(meal('s'.repeat(65)))
    const slashId = await ask(meal('a/../b'))
    check('A5', 'sessionId of 65 chars, or containing "/": 400, field sessionId',
      longId.status === 400 && slashId.status === 400 && slashId.json.field === 'sessionId',
      JSON.stringify([longId.status, slashId.status, slashId.json]))

    const badAllergen = await ask({ ...meal('a5d'), avoid: { allergens: ['peanut'] } })
    const badAvoid = await ask({ ...meal('a5e'), avoid: 'peanuts' })
    const goodAvoid = await ask({ ...meal('a5f'), avoid: { allergens: ['peanuts', 'gluten'], pattern: 'vegan', foodIds: ['seed:egg'] } }, { 'x-api-key': KEY })
    check('A5d', 'an allergen id the engine has no rule for: 400, field avoid',
      badAllergen.status === 400 && badAllergen.json.field === 'avoid', JSON.stringify([badAllergen.status, badAllergen.json]))
    check('A5e', 'avoid that is not an object: 400', badAvoid.status === 400, String(badAvoid.status))
    check('A5f', 'a valid avoid list passes validation (keyed, so the limit above does not hide it)', ADMITTED.has(goodAvoid.status), String(goodAvoid.status))

    const big = await ask({ ...meal('a5b'), entries: Array.from({ length: 101 }, () => ({})) })
    check('A5b', '101 diary entries: 400, field entries', big.status === 400 && big.json.field === 'entries', JSON.stringify([big.status, big.json]))

    const huge = await fetch(`${BASE}/agent/ask`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...meal('a5c'), pad: 'x'.repeat(40_000) }),
    })
    check('A5c', 'a 40 KB body is refused before it is parsed to the end', huge.status === 413, String(huge.status))

    const foreign = await fetch(`${BASE}/health`, { headers: { origin: 'https://evil.example' } })
    check('A6', 'a foreign Origin gets no Access-Control-Allow-Origin',
      foreign.headers.get('access-control-allow-origin') === null, String(foreign.headers.get('access-control-allow-origin')))

    const local = await fetch(`${BASE}/health`, { headers: { origin: 'http://localhost:5173' } })
    const own = await fetch(`${BASE}/health`, { headers: { origin: BASE } })
    check('A7', 'localhost and our own origin get the header',
      local.headers.get('access-control-allow-origin') === 'http://localhost:5173'
        && own.headers.get('access-control-allow-origin') === BASE,
      `${local.headers.get('access-control-allow-origin')} | ${own.headers.get('access-control-allow-origin')}`)

    const keyed = await Promise.all(Array.from({ length: 6 }, (_, i) => ask(meal(`a10-${i}`), { 'x-api-key': KEY })))
    check('A10', 'a valid x-api-key is exempt from the rate limits…',
      keyed.every((r) => ADMITTED.has(r.status)), keyed.map((r) => r.status).join(','))
    const keyedLong = await ask(meal('a10b', 'x'.repeat(501)), { 'x-api-key': KEY })
    check('A10b', '…and not from the size caps', keyedLong.status === 400, String(keyedLong.status))
  } finally { child.kill() }

  // ── daily ceiling: 2 model turns a day, whoever asks ───────────────────
  const child2 = start({
    ASK_IP_10MIN: '1000', ASK_IP_DAY: '1000', ASK_SESSION_HOUR: '1000', ASK_DAILY_CEILING: '2',
  })
  try {
    await waitReady()
    const a = await ask(meal('c1'))
    const b = await ask(meal('c2'))
    const c = await ask(meal('c3'))
    check('A8', 'third model turn of the day: 429 scope daily',
      ADMITTED.has(a.status) && ADMITTED.has(b.status) && c.status === 429 && c.json.scope === 'daily'
        && Number(c.json.retryAfterSec) > 0, JSON.stringify([a.status, b.status, c.status, c.json]))
    const gate = await ask(meal('c4', 'how many units of insulin should I take'))
    check('A8b', 'a gate turn at the ceiling is still 200', gate.status === 200 && gate.json.blockedRule === 'dosing',
      JSON.stringify([gate.status, gate.json.blockedRule]))
  } finally { child2.kill() }

  // ── per-session: 2 an hour from one conversation ───────────────────────
  const child3 = start({
    ASK_IP_10MIN: '1000', ASK_IP_DAY: '1000', ASK_SESSION_HOUR: '2', ASK_DAILY_CEILING: '1000',
  })
  try {
    await waitReady()
    const r = [await ask(meal('same')), await ask(meal('same')), await ask(meal('same'))]
    check('A11', 'third ask in one session: 429 scope session',
      r[2].status === 429 && r[2].json.scope === 'session', JSON.stringify(r.map((x) => [x.status, x.json.scope])))
  } finally { child3.kill() }
}

function memorySuite() {
  // ── bounded memory, in process ─────────────────────────────────────────
  _reset()
  process.env.ASK_IP_10MIN = '1000000'; process.env.ASK_IP_DAY = '1000000'
  process.env.ASK_SESSION_HOUR = '1000000'; process.env.ASK_DAILY_CEILING = '1000000000'
  for (let i = 0; i < MAX_KEYS + 500; i++) chargeTurn(`10.${i >> 8}.${i & 255}.1`, `s${i}`)
  check('A9', `limiter keys stay at or under ${MAX_KEYS} after ${MAX_KEYS + 500} sources`,
    _state().keys <= MAX_KEYS, String(_state().keys))

  for (let i = 0; i < MAX_SESSIONS + 500; i++) {
    putSession(`p${i}`, { glBudget: 1, carbsG: 1, kcal: 1 } as never, [])
    rememberResponse(`p${i}`, `r${i}`)
  }
  const sz = _sizes()
  check('A9b', `session maps stay at or under ${MAX_SESSIONS} entries`,
    sz.store <= MAX_SESSIONS && sz.lastResponse <= MAX_SESSIONS, JSON.stringify(sz))

  // The retry time must be a real wait, and a refused turn must not be charged to the person.
  _reset()
  process.env.ASK_DAILY_CEILING = '1'; process.env.ASK_IP_10MIN = '5'
  chargeTurn('9.9.9.9', 'z1')
  let err: unknown
  try { chargeTurn('9.9.9.9', 'z2') } catch (e) { err = e }
  check('A12', 'a turn refused at the ceiling is not charged to the person',
    err instanceof RateLimited && err.scope === 'daily', String(err))
}

async function main() {
  memorySuite()
  await httpSuite()
  console.log(failed ? `\n${failed} FAILED` : '\nall abuse checks passed')
  process.exit(failed ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
