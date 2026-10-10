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
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { SignJWT, exportJWK, generateKeyPair } from 'jose'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chargeTurn, addressKey, _reset, _state, RateLimited, MAX_KEYS } from '../server/guard'
import { newSessionId, sessionId } from '../src/lib/session'
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
    ASK_IP_10MIN: '3', ASK_IP_DAY: '1000', ASK_SESSION_HOUR: '1000', ASK_DAILY_CEILING: '1000', RECOMPUTE_MIN: '4',
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

    // ── /meal/recompute: a portion changed, no model, same arithmetic ─────
    const rc = (body: unknown, headers: Record<string, string> = {}) => fetch(`${BASE}/meal/recompute`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) as Record<string, any>, retry: r.headers.get('retry-after') }))
    // Park a day for one session, as the agent route does, so afterMeal has a budget to subtract from.
    await fetch(`${BASE}/session/rc-1`, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-api-key': KEY },
      body: JSON.stringify({ budget: { glBudget: 49, carbsG: 108, kcal: 1660 }, entries: [] }) })
    const r1 = await rc({ sessionId: 'rc-1', items: [{ foodId: 'seed:rice-white', grams: 180 }] })
    const r2 = await rc({ sessionId: 'rc-1', items: [{ foodId: 'seed:rice-white', grams: 360 }] })
    check('R1', 'a portion recomputed against the held day: totals and afterMeal come from the engine',
      r1.status === 200 && typeof r1.json.totals?.gl === 'number' && r1.json.afterMeal?.fits === true
        && Math.abs(r1.json.afterMeal.remaining.gl - (49 - r1.json.totals.gl)) < 0.11, JSON.stringify([r1.status, r1.json.afterMeal]))
    check('R2', 'twice the weight is twice the load, and past the budget the verdict is the engine\'s: fits false',
      r2.status === 200 && Math.abs(r2.json.totals.gl - 2 * r1.json.totals.gl) < 0.2 && r2.json.afterMeal?.fits === false, JSON.stringify([r2.status, r2.json.afterMeal]))
    const r3 = await rc({ sessionId: 'rc-never', items: [{ foodId: 'seed:rice-white', grams: 180 }] })
    check('R3', 'no day held for the session: totals only, no afterMeal, so no verdict can be invented',
      r3.status === 200 && r3.json.afterMeal === undefined && typeof r3.json.totals?.gl === 'number', JSON.stringify(r3))
    const bads = await Promise.all([
      rc({ sessionId: 'rc-1', items: [] }), rc({ sessionId: 'rc-1', items: [{ foodId: 'seed:rice-white', grams: -5 }] }),
      rc({ sessionId: 'rc-1', items: [{ foodId: 'seed:rice-white' }] }), rc({ sessionId: 'a/b', items: [{ foodId: 'seed:egg', grams: 50 }] }),
    ])
    check('R4', 'empty list, a negative weight, no weight, a bad session id: all 400 invalid_request',
      bads.every((b) => b.status === 400 && b.json.error === 'invalid_request'), JSON.stringify(bads.map((b) => b.status)))
    const ghost = await rc({ sessionId: 'rc-1', items: [{ foodId: 'seed:no-such-food', grams: 50 }] })
    check('R5', 'a food this build cannot cost: 400, never a 500', ghost.status === 400, String(ghost.status))
    const over = await rc({ sessionId: 'rc-1', items: [{ foodId: 'seed:rice-white', grams: 180 }] })
    check('R6', 'past RECOMPUTE_MIN from one address: 429 with Retry-After', over.status === 429 && Number(over.retry) > 0, JSON.stringify([over.status, over.retry]))
    const rcKeyed = await rc({ sessionId: 'rc-1', items: [{ foodId: 'seed:rice-white', grams: 180 }] }, { 'x-api-key': KEY })
    check('R7', 'a caller with the engine key is exempt from the limit', rcKeyed.status === 200, String(rcKeyed.status))

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

    // ── what the browser is told, and what an error says ──────────────────
    const page = await fetch(`${BASE}/`)
    const h = (n: string) => page.headers.get(n)
    check('A13', 'every response carries the security headers and no x-powered-by',
      h('x-powered-by') === null && h('x-content-type-options') === 'nosniff' && h('x-frame-options') === 'DENY'
        && !!h('referrer-policy') && !!h('permissions-policy') && !!h('strict-transport-security'),
      JSON.stringify([...page.headers.entries()].map(([k]) => k)))
    const csp = h('content-security-policy') ?? ''
    check('A13b', "the CSP allows scripts only from 'self', no framing and no objects",
      /script-src 'self'(;|$)/.test(csp) && csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'") && !/script-src[^;]*unsafe/.test(csp), csp)
    const health = await (await fetch(`${BASE}/health`)).json() as Record<string, unknown>
    check('A14', '/health says it is up and how many foods, and nothing about live sessions',
      health.ok === true && typeof health.records === 'number' && !('sessions' in health), JSON.stringify(health))
    const badPut = await fetch(`${BASE}/session/${'x'.repeat(65)}`, {
      method: 'PUT', headers: { 'content-type': 'application/json', 'x-api-key': KEY }, body: JSON.stringify({ budget: { glBudget: 1 }, entries: [] }),
    })
    const okPut = await fetch(`${BASE}/session/abc-123`, {
      method: 'PUT', headers: { 'content-type': 'application/json', 'x-api-key': KEY }, body: JSON.stringify({ budget: { glBudget: 1 }, entries: [] }),
    })
    check('A15', 'PUT /session refuses an id over 64 characters and accepts a normal one', badPut.status === 400 && okPut.status === 200, `${badPut.status} ${okPut.status}`)
    const wrongKey = await fetch(`${BASE}/tools/resolve_foods`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': KEY + 'x' }, body: '{}' })
    const noKey = await fetch(`${BASE}/tools/resolve_foods`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    check('A16', 'a wrong key and no key are both 401', wrongKey.status === 401 && noKey.status === 401, `${wrongKey.status} ${noKey.status}`)
    const failed = await ask(meal('a17'), { 'x-api-key': KEY })
    check('A17', 'an upstream failure reaches the browser as fixed text, never the upstream message',
      failed.status === 502 && failed.json.error === 'agent_unavailable', JSON.stringify([failed.status, failed.json]))
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

/**
 * Sign-in: the token check, the gate before it, the per-person limit, the switch, and DELETE /account.
 * The engine is given the test's own public key (AUTH_JWKS_JSON works outside production only) and a
 * stand-in for Supabase's admin API, so this runs with no network and no Supabase.
 */
async function authSuite() {
  const mine = await generateKeyPair('ES256')
  const other = await generateKeyPair('ES256')
  const jwk = { ...(await exportJWK(mine.publicKey)), kid: 'k1', alg: 'ES256', use: 'sig' }
  const jwks = JSON.stringify({ keys: [jwk] })

  const deletes: { url: string; auth: string | undefined; apikey: string | undefined }[] = []
  let adminStatus = 200
  const stub = createServer((req, res) => {
    if (req.method === 'DELETE' && req.url?.startsWith('/auth/v1/admin/users/')) {
      deletes.push({ url: req.url, auth: req.headers.authorization, apikey: req.headers.apikey as string | undefined })
      res.statusCode = adminStatus; res.end('{}'); return
    }
    res.statusCode = 404; res.end()
  })
  await new Promise<void>((r) => stub.listen(0, '127.0.0.1', () => r()))
  const stubUrl = `http://127.0.0.1:${(stub.address() as { port: number }).port}`
  const ISS = `${stubUrl}/auth/v1`
  const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

  const token = (sub: string, opts: { key?: CryptoKey; aud?: string; iss?: string; exp?: string | number } = {}) =>
    new SignJWT({ role: 'authenticated', email: 'p@example.com' })
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
      .setSubject(sub).setIssuer(opts.iss ?? ISS).setAudience(opts.aud ?? 'authenticated')
      .setIssuedAt().setExpirationTime(opts.exp ?? '1h')
      .sign(opts.key ?? mine.privateKey)
  const bearer = async (sub: string, o?: Parameters<typeof token>[1]) => ({ authorization: `Bearer ${await token(sub, o)}` })

  const child = start({
    SUPABASE_URL: stubUrl, AUTH_JWKS_JSON: jwks, REQUIRE_SIGN_IN: 'on', SUPABASE_SERVICE_KEY: 'stub-service-key',
    ASK_IP_10MIN: '1000', ASK_IP_DAY: '1000', ASK_SESSION_HOUR: '1000', ASK_DAILY_CEILING: '1000', ASK_USER_HOUR: '2', ASK_USER_DAY: '1000', ACCOUNT_DELETE_DAY: '2',
  })
  try {
    await waitReady()
    const none = await ask(meal('s1'))
    check('S1', 'sign-in required: a model turn with no token is 401 sign_in_required',
      none.status === 401 && none.json.error === 'sign_in_required', JSON.stringify([none.status, none.json]))

    const dosing = await ask(meal('s2', 'how many units of insulin should I take for this meal'))
    const red = await ask(meal('s3', 'my glucose is 320 and I am vomiting'))
    check('S2', 'a dosing question with no token is still refused by the rule (200, never 401)',
      dosing.status === 200 && dosing.json.blockedRule === 'dosing', JSON.stringify([dosing.status, dosing.json.blockedRule]))
    check('S3', 'a red-flag message with no token is still answered (200, never 401)',
      red.status === 200 && red.json.blockedRule === 'red_flag', JSON.stringify([red.status, red.json.blockedRule]))

    const good = await ask(meal('s4'), await bearer(uid(1)))
    check('S4', 'a valid token is admitted', ADMITTED.has(good.status), String(good.status))

    const forged = await ask(meal('s5'), await bearer(uid(2), { key: other.privateKey }))
    const expired = await ask(meal('s6'), await bearer(uid(2), { exp: Math.floor(Date.now() / 1000) - 60 }))
    const wrongAud = await ask(meal('s7'), await bearer(uid(2), { aud: 'anon' }))
    const wrongIss = await ask(meal('s8'), await bearer(uid(2), { iss: 'https://evil.example/auth/v1' }))
    const notUuid = await ask(meal('s9'), await bearer('not-a-uuid'))
    const garbage = await ask(meal('s10'), { authorization: 'Bearer abc.def' })
    const basic = await ask(meal('s11'), { authorization: 'Basic abc' })
    check('S5', 'a token signed by another key is 401', forged.status === 401, String(forged.status))
    check('S6', 'an expired token is 401', expired.status === 401, String(expired.status))
    check('S7', 'a token for another audience is 401', wrongAud.status === 401, String(wrongAud.status))
    check('S8', 'a token from another issuer is 401', wrongIss.status === 401, String(wrongIss.status))
    check('S9', 'a subject that is not a UUID, a garbage token and a Basic header are all 401',
      notUuid.status === 401 && garbage.status === 401 && basic.status === 401, `${notUuid.status} ${garbage.status} ${basic.status}`)

    // the limit is two model turns an hour per person; person 1 already spent one on S4
    const second = await ask(meal('s12'), await bearer(uid(1)))
    const third = await ask(meal('s13'), await bearer(uid(1)))
    check('S10', 'the third model turn in an hour from one person: 429 scope user, with a retry time',
      ADMITTED.has(second.status) && third.status === 429 && third.json.scope === 'user' && Number(third.json.retryAfterSec) > 0,
      JSON.stringify([second.status, third.status, third.json]))
    const gateAtLimit = await ask(meal('s14', 'how many units of insulin should I take'), await bearer(uid(1)))
    check('S11', 'a gate message from that same person at the limit is still 200',
      gateAtLimit.status === 200 && gateAtLimit.json.blockedRule === 'dosing', JSON.stringify([gateAtLimit.status, gateAtLimit.json.blockedRule]))
    const another = await ask(meal('s15'), await bearer(uid(3)))
    check('S12', 'another person is not affected by that limit', ADMITTED.has(another.status), String(another.status))

    const keyed = await ask(meal('s16'), { 'x-api-key': KEY })
    check('S13', 'a caller with the engine key needs no token (the agent evals)', ADMITTED.has(keyed.status), String(keyed.status))

    const rcAnon = await fetch(`${BASE}/meal/recompute`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'rc-s', items: [{ foodId: 'seed:egg', grams: 50 }] }) })
    check('S13b', 'with required sign-in, /meal/recompute without a token is 401', rcAnon.status === 401, String(rcAnon.status))
    const rcSigned = await fetch(`${BASE}/meal/recompute`, { method: 'POST', headers: { 'content-type': 'application/json', ...(await bearer(uid(9))) },
      body: JSON.stringify({ sessionId: 'rc-s', items: [{ foodId: 'seed:egg', grams: 50 }] }) })
    check('S13c', 'and with a valid token it answers', rcSigned.status === 200, String(rcSigned.status))
    // DELETE /account
    const del = (h: Record<string, string> = {}) => fetch(`${BASE}/account`, { method: 'DELETE', headers: h })
    const noTok = await del()
    check('S14', 'DELETE /account with no token is 401 and calls nothing', noTok.status === 401 && deletes.length === 0, `${noTok.status} ${deletes.length}`)
    const ok = await del(await bearer(uid(4)))
    check('S15', 'DELETE /account with a token: 200, and the admin API is asked to delete exactly that person, with the service key',
      ok.status === 200 && deletes.length === 1 && deletes[0].url.endsWith(`/users/${uid(4)}`)
        && deletes[0].auth === 'Bearer stub-service-key' && deletes[0].apikey === 'stub-service-key',
      JSON.stringify([ok.status, deletes]))
    adminStatus = 500
    const fail = await del(await bearer(uid(5)))
    const failBody = await fail.text()
    check('S16', 'when the admin call fails the answer is 502 delete_failed and fixed text, nothing leaked',
      fail.status === 502 && failBody.includes('delete_failed') && !failBody.includes('stub-service-key'), `${fail.status} ${failBody}`)
    adminStatus = 404
    const gone = await del(await bearer(uid(6)))
    check('S16b', 'deleting an account that is already gone is 200, not a failure (a token outlives its account)', gone.status === 200, String(gone.status))
    adminStatus = 200
    await del(await bearer(uid(4))) // the second of two allowed in a day (the first was S15)
    const limited = await del(await bearer(uid(4)))
    check('S17', 'a third delete in a day from one person: 429', limited.status === 429, String(limited.status))
    adminStatus = 200
  } finally { child.kill() }

  // The switch: with REQUIRE_SIGN_IN off the engine is anonymous again, so a rollback is one revision.
  const off = start({
    SUPABASE_URL: stubUrl, AUTH_JWKS_JSON: jwks, SUPABASE_SERVICE_KEY: 'stub-service-key',
    ASK_IP_10MIN: '1000', ASK_IP_DAY: '1000', ASK_SESSION_HOUR: '1000', ASK_DAILY_CEILING: '1000',
  })
  try {
    await waitReady()
    const anon = await ask(meal('o1'))
    check('S18', 'with REQUIRE_SIGN_IN off, a model turn with no token is admitted as before', ADMITTED.has(anon.status), String(anon.status))
    const badTok = await ask(meal('o2'), { authorization: 'Bearer aaa.bbb.ccc' })
    check('S19', 'with it off, a bad token does not turn a person away either', ADMITTED.has(badTok.status), String(badTok.status))
  } finally { off.kill(); stub.close() }
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

  // One person, one /64: rotating through your own IPv6 block must not dodge a limit.
  const same = addressKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd') === addressKey('2001:db8:1:2::1')
  const other = addressKey('2001:db8:1:3::1') !== addressKey('2001:db8:1:2::1')
  const v4 = addressKey('203.0.113.9') === '203.0.113.9' && addressKey('::ffff:203.0.113.9') === '203.0.113.9'
  check('A18', 'an IPv6 address is keyed on its /64; IPv4 and mapped IPv4 are themselves', same && other && v4, `${same} ${other} ${v4}`)

  // A session id is random, 8-plus word characters, and never a constant, even with no storage.
  const ids = new Set(Array.from({ length: 200 }, () => newSessionId()))
  const shaped = [...ids].every((i) => /^[\w-]{16,64}$/.test(i))
  const a = sessionId(), b = sessionId()
  check('A19', 'session ids are unique and well-formed, and stay stable per page with no storage',
    ids.size === 200 && shaped && a === b && a !== 'anon', `${ids.size} ${shaped} ${a}`)

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
  await authSuite()
  console.log(failed ? `\n${failed} FAILED` : '\nall abuse checks passed')
  process.exit(failed ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
