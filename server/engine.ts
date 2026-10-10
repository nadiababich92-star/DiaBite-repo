/**
 * DiaBite engine service — vector-search edition.
 *
 * Every endpoint is a tool the n8n agent can call, and the source of every
 * number the frontend shows. Stateless: the day's log arrives in the request.
 *
 *   npm run server   -> http://localhost:8787
 *
 * Endpoints (JSON in / JSON out):
 *   POST /tools/resolve_foods       { phrases: string[], topK? }
 *   POST /tools/compute_meal        { items: [{ foodId, grams? | servings? }] }
 *   POST /tools/get_day_state       { sessionId } | { budget: { glBudget, carbsG, kcal }, entries: [...] }
 *   POST /tools/find_alternatives   { foodId? | query?, maxGL, topK?, sameCategory? }
 *   POST /verify                    { answer, toolResults: [...], userText? }
 *   POST /agent/ask                 { sessionId, message, budget?, entries?, threadId? }
 *   PUT  /session/:id               { budget, entries, avoid? }  — day state and the
 *                                   person's allergens/exclusions, both kept
 *                                   out of the model's hands
 *   GET  /health · GET /foods/:id · GET /openapi.json
 *
 * Index: 350 ingredients + 86 everyday foods + 1,000 recipes, embedded locally
 * (see embeddings.ts). See contract.ts for the exact shapes.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import express from 'express'
import cors from 'cors'
import { loadFoods, getRecord, summary } from './foods'
import { openStore, type VectorStore } from './embeddings'
import { resolvePhrases } from './resolve'
import { afterMealFor, computeMeal, dayState, driverOf, findAlternatives } from './compute'
import { verify } from './verify'
import { getSession, noteResolution, putSession } from './sessions'
import { openApiSpec } from './openapi'
import { ask, SignInRequired, type AskRequest } from './agent'
import { personOf, signInRequired } from './auth'
import { createHash, timingSafeEqual } from 'node:crypto'
import { RateLimited, addressKey, chargeDelete, chargeRecompute, originAllowed, sourceTag, validSessionId, validateAsk, validateRecompute } from './guard'
import type {
  AlternativesRequest, ComputeMealRequest, DayStateRequest, ResolveRequest, VerifyRequest,
} from './contract'

const PORT = Number(process.env.PORT ?? 8787)

async function main() {
  const t0 = Date.now()
  const { records } = loadFoods()
  console.log(`foods loaded: ${records.length} records`)
  const store: VectorStore = await openStore(records)
  console.log(`ready in ${Date.now() - t0} ms`)

  const app = express()
  // Nobody needs to be told which framework answered.
  app.disable('x-powered-by')

  // What the browser is told to refuse. The app is one page from one origin: its
  // scripts and API are ours, its fonts come from Google, and the feedback form
  // talks to the Supabase project. Anything else it is asked to load is blocked,
  // which is what turns an injected script into a harmless string. X-XSS-Protection
  // is left out on purpose: modern browsers ignore it and old ones had bugs with it.
  const supabaseOrigin = (() => { try { return new URL(process.env.SUPABASE_URL ?? '').origin } catch { return '' } })()
  const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin}`.trim(),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
  app.use((_req, res, next) => {
    res.set({
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      // No includeSubDomains: this host is a subdomain of a domain we do not own.
      'Strict-Transport-Security': 'max-age=31536000',
    })
    next()
  })
  // Container Apps ingress is one hop, so the client address is the last entry
  // of X-Forwarded-For. Wrong here and every visitor shares one rate-limit bucket.
  app.set('trust proxy', 1)
  // Only our own origin and localhost may read a browser response. This does not
  // stop a script, which sends no Origin — the rate limits do that.
  app.use(cors((req, cb) => {
    const ok = originAllowed(req.header('origin'), req.header('host'))
    cb(null, { origin: ok })
  }))
  // The agent route takes a message, never a document: 32 KB is generous.
  app.use('/agent', express.json({ limit: '32kb' }))
  app.use(express.json({ limit: '1mb' }))

  // Two surfaces, two audiences. The tool surface is called by Foundry's
  // OpenAPI tool and by nothing else, so it carries a shared key. The product
  // surface (/agent/ask) is called by the browser, which cannot hold a secret.
  const API_KEY = process.env.ENGINE_API_KEY
  // Compared as digests, in constant time, so neither the length of the key nor
  // how many leading characters were right can be read from how long a refusal took.
  const keyDigest = API_KEY ? createHash('sha256').update(API_KEY).digest() : null
  const keyMatches = (given: string | undefined): boolean =>
    !!keyDigest && !!given && timingSafeEqual(createHash('sha256').update(given).digest(), keyDigest)
  const GUARDED = /^\/(tools|session|verify|diag)\b/
  // Fail closed. A deploy that loses the secret must not quietly open the tool
  // routes (and /diag/foundry, which spends model tokens): in production, no
  // key means no access, and the service says why in its log.
  if (!API_KEY && process.env.NODE_ENV === 'production') {
    console.error('ENGINE_API_KEY is not set: tool, session, verify and diag routes are closed')
    app.use((req, res, next) => (GUARDED.test(req.path) ? res.status(503).json({ error: 'engine key not configured' }) : next()))
  }
  if (API_KEY) {
    app.use((req, res, next) => {
      if (!GUARDED.test(req.path)) return next()
      if (keyMatches(req.get('x-api-key'))) return next()
      res.status(401).json({ error: 'x-api-key required' })
    })
  }

  app.get('/health', (_req, res) => res.json({ ok: true, records: records.length, signIn: signInRequired() }))

  app.get('/openapi.json', (_req, res) => res.json(openApiSpec()))

  /**
   * One turn of the agent: safety gate, Foundry run, verifier, trace.
   * This is what the frontend talks to — the replacement for the n8n webhook.
   */
  app.post('/agent/ask', async (req, res) => {
    const bad = validateAsk(req.body)
    if (bad) return res.status(400).json({ error: 'invalid_request', field: bad.field })
    const body = req.body as AskRequest
    // A caller holding the key (the agent evals, 87 cases from one address) is
    // exempt from the rate limits, never from the size caps above.
    const trusted = keyMatches(req.get('x-api-key'))
    const person = trusted ? null : await personOf(req)
    try { res.json(await ask(body, { clientKey: trusted ? undefined : addressKey(req.ip), trusted, person, requireSignIn: signInRequired() })) }
    catch (e) {
      if (e instanceof SignInRequired) return res.status(401).json({ error: 'sign_in_required' })
      if (e instanceof RateLimited) {
        console.warn(JSON.stringify({ evt: 'rate_limited', scope: e.scope, source: sourceTag(addressKey(req.ip)), retryAfterSec: e.retryAfterSec }))
        res.set('Retry-After', String(e.retryAfterSec))
        return res.status(429).json({ error: 'rate_limited', scope: e.scope, retryAfterSec: e.retryAfterSec })
      }
      // The full error stays in the log. What the browser gets is fixed text:
      // an upstream message can carry endpoint names, deployment ids and links.
      console.error('agent/ask failed:', e)
      // Azure's content filter refusing a prompt is an answer, not an outage.
      if (/content management policy|content[_ ]filter|ResponsibleAI/i.test((e as Error).message ?? '')) {
        return res.json({
          answer: "I can't help with that request. I can tell you what a meal does to your day, or answer a general question about food and blood sugar.",
          blocked: true, blockedRule: 'content_filter', verified: true,
          unmatchedNumbers: [], matchedNumbers: [], toolCalls: 0, trace: [], routedBy: 'gate',
        })
      }
      res.status(502).json({ error: 'agent_unavailable' })
    }
  })

  /**
   * Delete the signed-in person's account and, through the foreign keys, their profile and
   * diary. The browser cannot remove an auth user; this can, with the service key, which is a
   * Container App secret and never leaves this function. Only the token's own `sub` is deleted.
   */
  app.delete('/account', async (req, res) => {
    const person = await personOf(req)
    if (!person) return res.status(401).json({ error: 'sign_in_required' })
    const wait = chargeDelete(person.sub)
    if (wait) { res.set('Retry-After', String(wait)); return res.status(429).json({ error: 'rate_limited', scope: 'user', retryAfterSec: wait }) }
    const base = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
    const service = process.env.SUPABASE_SERVICE_KEY
    if (!base || !service) { console.error('DELETE /account: SUPABASE_URL or SUPABASE_SERVICE_KEY is not set'); return res.status(502).json({ error: 'delete_failed' }) }
    try {
      const r = await fetch(`${base}/auth/v1/admin/users/${person.sub}`, {
        method: 'DELETE', headers: { apikey: service, authorization: `Bearer ${service}` }, signal: AbortSignal.timeout(15_000),
      })
      // A token outlives the account it names, so a second press (or a retry after a lost
      // reply) reaches Supabase for a person who is already gone. That is the answer the
      // person wanted, not a failure.
      if (r.status === 404) { console.warn(JSON.stringify({ evt: 'account_already_gone', who: sourceTag(person.sub) })); return res.json({ ok: true }) }
      if (!r.ok) { console.error(`DELETE /account: Supabase answered ${r.status}`); return res.status(502).json({ error: 'delete_failed' }) }
      console.warn(JSON.stringify({ evt: 'account_deleted', who: sourceTag(person.sub) }))
      res.json({ ok: true })
    } catch (e) {
      console.error('DELETE /account failed:', (e as Error).message)
      res.status(502).json({ error: 'delete_failed' })
    }
  })

  /** The client parks the day's budget and log here, then hands the agent only the id. */
  app.put('/session/:id', (req, res) => {
    const { budget, entries, avoid } = req.body ?? {}
    if (!validSessionId(req.params.id)) return res.status(400).json({ error: 'invalid session id' })
    if (!budget || !Array.isArray(entries) || entries.length > 100) return res.status(400).json({ error: 'budget and at most 100 entries required' })
    putSession(req.params.id, budget, entries, avoid)
    res.json({ ok: true, sessionId: req.params.id, entries: entries.length })
  })

  /**
   * Can this process reach Foundry, and how fast?
   *
   * Added because the same call takes 17 seconds from a laptop and hangs for
   * eight minutes from inside the container. Three timings separate the
   * possible culprits: DNS and TLS to the endpoint, a cheap authenticated read,
   * and one real agent turn.
   */
  /** What the limits see as the caller's address. Behind the ingress this must be the client, not the proxy. */
  app.get('/diag/ip', (req, res) => res.json({
    ip: req.ip, ips: req.ips, xForwardedFor: req.get('x-forwarded-for') ?? null,
  }))

  app.get('/diag/foundry', async (_req, res) => {
    const endpoint = process.env.PROJECT_ENDPOINT ?? ''
    const key = process.env.PROJECT_API_KEY ?? ''
    const out: Record<string, unknown> = { endpoint: endpoint.replace(/https:\/\/([^.]+).*/, '$1…'), key: key ? 'set' : 'none' }

    const timed = async (name: string, run: () => Promise<string>) => {
      const t0 = Date.now()
      // The elapsed time is read after the call, not built into the object
      // literal beside the await — which is how the first version of this
      // endpoint reported every call as taking zero milliseconds.
      try {
        const result = await run()
        out[name] = { ms: Date.now() - t0, result }
      } catch (e) {
        out[name] = { ms: Date.now() - t0, error: (e as Error).message.slice(0, 160) }
      }
    }

    await timed('reach', async () => {
      const r = await fetch(`${endpoint}/openai/v1/models`, {
        headers: key ? { 'api-key': key } : {},
        signal: AbortSignal.timeout(10_000),
      })
      return `${r.status}`
    })

    // The tool-using turn, which is the one that hangs in the real path. Same
    // agent, same key, a plain fetch from this process: if this answers and the
    // engine's own turn does not, the difference is ours, not Foundry's.
    if ('meal' in _req.query) {
      await timed('meal', async () => {
        const r = await fetch(`${endpoint}/openai/v1/responses`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(key ? { 'api-key': key } : {}) },
          body: JSON.stringify({
            input: '[session_id: diag]\n\ngreek yogurt with blueberries',
            agent_reference: { name: 'diabite-meal', type: 'agent_reference' },
            tool_choice: 'required',
          }),
          signal: AbortSignal.timeout(120_000),
        })
        const body = (await r.json()) as { output?: { type?: string }[] }
        return `${r.status} items: ${(body.output ?? []).map((o) => o.type).join(',').slice(0, 120)}`
      })
    }

    await timed('turn', async () => {
      const r = await fetch(`${endpoint}/openai/v1/responses`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(key ? { 'api-key': key } : {}) },
        body: JSON.stringify({ input: 'hello', agent_reference: { name: 'diabite-triage', type: 'agent_reference' } }),
        signal: AbortSignal.timeout(45_000),
      })
      const text = await r.text()
      return `${r.status} ${text.slice(0, 80)}`
    })

    res.json(out)
  })

  app.get('/foods/:id', (req, res) => {
    try { res.json(summary(getRecord(req.params.id))) }
    catch (e) { res.status(404).json({ error: (e as Error).message }) }
  })

  /**
   * The day's entries, minus anything this build cannot cost.
   *
   * One stale id in the diary — a food renamed or dropped between releases —
   * threw out of `dayState`, which made every tool call 500, which Foundry
   * turns into a fatal error: the user asked about their lunch and got a
   * validation error, because of a breakfast they logged last week. The day's
   * budget is worth more than its completeness, so an id we cannot cost is
   * dropped and named in the log rather than taking the answer with it.
   */
  const skippedIds = new Set<string>()
  const costable = (entries: { foodId: string }[]) => entries.filter((e) => {
    try { getRecord(e.foodId); return true }
    catch {
      if (!skippedIds.has(e.foodId)) {
        skippedIds.add(e.foodId)
        console.warn(`day state: skipping an entry this build cannot cost: ${e.foodId}`)
      }
      return false
    }
  })

  /** Today's budget for a session, or the marker that says we do not hold it. */
  const dayStateFor = (sessionId: string | undefined) => {
    if (sessionId === undefined) return undefined
    const held = sessionId ? getSession(sessionId) : undefined
    if (!held) return { unknown: true as const, sessionId: sessionId ?? '' }
    return dayState(held.budget, costable(held.entries))
  }

  /**
   * The same meal, with a portion the person changed. No model runs: this is the
   * arithmetic of compute_meal and the day's budget held for the session, so a
   * number on the screen after a change was computed, exactly as before. The
   * browser calls it (it cannot hold the tool key), so it carries the same
   * sign-in wall and a per-address limit, and refuses anything it cannot cost.
   */
  app.post('/meal/recompute', async (req, res) => {
    const bad = validateRecompute(req.body)
    if (bad) return res.status(400).json({ error: 'invalid_request', field: bad.field })
    const body = req.body as { sessionId: string; items: { foodId: string; grams?: number; servings?: number }[] }
    const trusted = keyMatches(req.get('x-api-key'))
    if (!trusted) {
      const person = await personOf(req)
      if (signInRequired() && !person) return res.status(401).json({ error: 'sign_in_required' })
      const key = addressKey(req.ip)
      const wait = key ? chargeRecompute(key) : 0
      if (wait) { res.set('Retry-After', String(wait)); return res.status(429).json({ error: 'rate_limited', scope: 'ip', retryAfterSec: wait }) }
    }
    try {
      const meal = computeMeal(body.items)
      const day = dayStateFor(body.sessionId)
      const top = driverOf(meal.items)
      const out: Record<string, unknown> = { ...meal, ...(top ? { driver: top } : {}) }
      if (day && !('unknown' in day)) {
        out.dayState = day
        const unknownFoods = getSession(body.sessionId)?.unknownFoods ?? []
        const unscored = meal.items.filter((it) => !it.loadAvailable).map((it) => it.name)
        out.afterMeal = afterMealFor(day.remaining, meal.totals, unknownFoods, unscored)
      }
      res.json(out)
    } catch (e) {
      // A food this build cannot cost is the caller's mistake, not an outage.
      console.warn('meal/recompute refused:', (e as Error).message)
      res.status(400).json({ error: 'invalid_request', field: 'items.foodId' })
    }
  })

  app.post('/tools/resolve_foods', async (req, res) => {
    const body = req.body as ResolveRequest
    // Model-facing tools answer 200 even when the call was wrong. Foundry turns
    // any non-2xx from an OpenAPI tool into a `tool_user_error` that kills the
    // whole response, so a 400 costs the user their answer and tells the model
    // nothing it can act on. The error travels in the body instead, where the
    // model can read it and fix the call.
    if (!Array.isArray(body?.phrases)) {
      return res.json({ results: [], error: 'phrases must be a list of food names, e.g. ["oatmeal", "banana"].' })
    }
    // The day state rides along when asked for: one model round trip fewer,
    // and the budget is the thing the next step needs anyway.
    const results = await resolvePhrases(store, body.phrases, body.topK)
    if (body.sessionId) noteResolution(body.sessionId, results)
    res.json({
      results,
      ...(body.sessionId !== undefined ? { dayState: dayStateFor(body.sessionId) } : {}),
    })
  })

  app.post('/tools/compute_meal', async (req, res) => {
    const body = req.body as ComputeMealRequest
    if (!Array.isArray(body?.items) || body.items.length === 0) {
      return res.json({ error: 'items must be a non-empty list of { foodId, grams } — call resolve_foods first to get the ids.' })
    }
    const bad = body.items.find((it) => (it.grams !== undefined && !(it.grams > 0)) || (it.servings !== undefined && !(it.servings > 0)))
    if (bad) {
      return res.json({ error: `grams and servings must be positive numbers; ${bad.foodId} had none. Use the defaultPortion from resolve_foods when the user gave no amount.` })
    }
    try {
      const meal = computeMeal(body.items)
      const day = dayStateFor(body.sessionId)
      const top = driverOf(meal.items)
      const out: Record<string, unknown> = {
        ...meal,
        ...(top ? { driver: top } : {}),
        ...(day ? { dayState: day } : {}),
      }

      // Swaps in the same breath, but only when the meal needs them: over what
      // is left of the day, or heavy on its own. Asking for them on a meal that
      // fits would spend a search to print nothing.
      // The one number the model kept making a third call to look for: what
      // is left once this meal is counted. Negative means over budget, and is
      // returned as such — "fits" is the engine's verdict, not the model's.
      if (day && !('unknown' in day)) {
        const unknownFoods = (body.sessionId ? getSession(body.sessionId)?.unknownFoods : undefined) ?? []
        const unscored = meal.items.filter((it) => !it.loadAvailable).map((it) => it.name)
        out.afterMeal = afterMealFor(day.remaining, meal.totals, unknownFoods, unscored)
      }

      const remaining = day && !('unknown' in day) ? day.remaining.gl : undefined
      const needsHelp = meal.totals.glLevel === 'high' || (remaining !== undefined && meal.totals.gl > remaining)
      if (body.withAlternatives && needsHelp) {
        // Only a scored item can be "the heaviest": a branded one has no load to swap on.
        const heaviest = meal.items.filter((it) => it.gl !== null).sort((a, b) => (b.gl ?? 0) - (a.gl ?? 0))[0]
        if (heaviest && heaviest.gl !== null) {
          const avoid = body.sessionId ? getSession(body.sessionId)?.avoid : undefined
          out.alternatives = await findAlternatives(store, {
            foodId: heaviest.foodId,
            grams: heaviest.grams,
            maxGL: remaining !== undefined ? Math.max(0, remaining) : heaviest.gl,
            topK: 3,
          }, avoid)
          out.alternativesFor = { foodId: heaviest.foodId, name: heaviest.name, grams: heaviest.grams }
        }
      }
      res.json(out)
    }
    // An id the database does not hold is the common case here, and it is the
    // model's to correct: resolve the phrase again rather than lose the turn.
    catch (e) { res.json({ error: `${(e as Error).message}. Use an id that resolve_foods returned, and never invent one.` }) }
  })

  app.post('/tools/get_day_state', (req, res) => {
    // Two callers, two shapes. The agent sends a session id and never sees the
    // budget; the frontend, which owns the profile, may pass it directly.
    const body = req.body as DayStateRequest & { sessionId?: string }
    let budget = body?.budget
    let entries = body?.entries
    // The agent always arrives by session id; the frontend always arrives with
    // a budget. Which key is present tells the two apart, and an empty id
    // counts as present — the agent is told to send one rather than invent it.
    if (body && 'sessionId' in body) {
      const s = body.sessionId ? getSession(body.sessionId) : undefined
      // A session we do not hold is answered, not refused. Foundry turns any
      // non-2xx from a tool into a `tool_user_error` that kills the whole
      // response, so a 404 here costs the user the answer to a question the
      // engine could otherwise mostly answer — and sessions expire after an
      // hour. Saying "no day state" lets the model cost the meal and admit it
      // does not know the budget.
      if (!s) return res.json({ unknown: true, sessionId: body.sessionId ?? '' })
      budget = s.budget
      entries = s.entries
    }
    if (!budget || !Array.isArray(entries)) return res.status(400).json({ error: 'sessionId, or budget and entries, required' })
    try { res.json(dayState(budget, costable(entries))) }
    catch (e) { res.json({ unknown: true, error: (e as Error).message }) }
  })

  app.post('/tools/find_alternatives', async (req, res) => {
    const body = req.body as AlternativesRequest
    if (typeof body?.maxGL !== 'number') {
      return res.json({ alternatives: [], error: 'maxGL is required — pass the remaining glycemic load from get_day_state.' })
    }
    // The allergy filter lives here rather than in the prompt: an option the
    // person must not eat should never reach the model in the first place.
    const avoid = body.sessionId ? getSession(body.sessionId)?.avoid : undefined
    res.json({ alternatives: await findAlternatives(store, body, avoid) })
  })

  app.post('/verify', (req, res) => {
    const body = req.body as VerifyRequest
    if (typeof body?.answer !== 'string') return res.status(400).json({ error: 'answer required' })
    res.json(verify(body))
  })

  /**
   * The app itself, when the image was built with it.
   *
   * One container, one address: the browser app is served from the same origin
   * as the agent it talks to, which is why it needs no CORS, no second
   * service, and no laptop running a dev server. The API routes are declared
   * above this line and win; everything else falls through to index.html
   * because the app routes in the browser.
   *
   * An image built without `dist` simply skips it — the engine's own job does
   * not depend on there being a frontend.
   */
  const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
  if (existsSync(join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }))
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next()
      if (/^\/(tools|session|verify|diag|agent|foods|health|openapi)\b/.test(req.path)) return next()
      res.sendFile(join(dist, 'index.html'))
    })
    console.log('serving the app from ./dist')
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`engine (vector) listening on port ${PORT}`))
}

main().catch((e) => { console.error(e); process.exit(1) })
