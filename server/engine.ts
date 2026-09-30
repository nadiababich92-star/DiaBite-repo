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
import express from 'express'
import cors from 'cors'
import { loadFoods, getRecord, summary } from './foods'
import { openStore, type VectorStore } from './embeddings'
import { resolvePhrases } from './resolve'
import { computeMeal, dayState, findAlternatives } from './compute'
import { verify } from './verify'
import { getSession, putSession, sessionCount } from './sessions'
import { openApiSpec } from './openapi'
import { ask, type AskRequest } from './agent'
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
  app.use(cors())
  app.use(express.json({ limit: '1mb' }))

  // Two surfaces, two audiences. The tool surface is called by Foundry's
  // OpenAPI tool and by nothing else, so it carries a shared key. The product
  // surface (/agent/ask) is called by the browser, which cannot hold a secret.
  const API_KEY = process.env.ENGINE_API_KEY
  const GUARDED = /^\/(tools|session|verify|diag)\b/
  if (API_KEY) {
    app.use((req, res, next) => {
      if (!GUARDED.test(req.path)) return next()
      if (req.get('x-api-key') === API_KEY) return next()
      res.status(401).json({ error: 'x-api-key required' })
    })
  }

  app.get('/health', (_req, res) => res.json({ ok: true, records: records.length, sessions: sessionCount() }))

  app.get('/openapi.json', (_req, res) => res.json(openApiSpec()))

  /**
   * One turn of the agent: safety gate, Foundry run, verifier, trace.
   * This is what the frontend talks to — the replacement for the n8n webhook.
   */
  app.post('/agent/ask', async (req, res) => {
    const body = req.body as AskRequest
    if (!body?.sessionId || typeof body.message !== 'string') {
      return res.status(400).json({ error: 'sessionId and message required' })
    }
    try { res.json(await ask(body)) }
    catch (e) {
      console.error('agent/ask failed:', e)
      res.status(502).json({ error: (e as Error).message })
    }
  })

  /** The client parks the day's budget and log here, then hands the agent only the id. */
  app.put('/session/:id', (req, res) => {
    const { budget, entries, avoid } = req.body ?? {}
    if (!budget || !Array.isArray(entries)) return res.status(400).json({ error: 'budget and entries required' })
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
  app.get('/diag/foundry', async (_req, res) => {
    const endpoint = process.env.PROJECT_ENDPOINT ?? ''
    const key = process.env.PROJECT_API_KEY ?? ''
    const out: Record<string, unknown> = { endpoint: endpoint.replace(/https:\/\/([^.]+).*/, '$1…'), key: key ? `${key.length} chars` : 'none' }

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
    res.json({
      results: await resolvePhrases(store, body.phrases, body.topK),
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
      const out: Record<string, unknown> = { ...meal, ...(day ? { dayState: day } : {}) }

      // Swaps in the same breath, but only when the meal needs them: over what
      // is left of the day, or heavy on its own. Asking for them on a meal that
      // fits would spend a search to print nothing.
      // The one number the model kept making a third call to look for: what
      // is left once this meal is counted. Negative means over budget, and is
      // returned as such — "fits" is the engine's verdict, not the model's.
      if (day && !('unknown' in day)) {
        const after = {
          gl: Math.round((day.remaining.gl - meal.totals.gl) * 10) / 10,
          carbsG: Math.round((day.remaining.carbsG - meal.totals.carbs) * 10) / 10,
          kcal: Math.round(day.remaining.kcal - meal.totals.kcal),
        }
        out.afterMeal = { remaining: after, fits: after.gl >= 0 }
      }

      const remaining = day && !('unknown' in day) ? day.remaining.gl : undefined
      const needsHelp = meal.totals.glLevel === 'high' || (remaining !== undefined && meal.totals.gl > remaining)
      if (body.withAlternatives && needsHelp) {
        const heaviest = [...meal.items].sort((a, b) => b.gl - a.gl)[0]
        if (heaviest) {
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

  app.listen(PORT, '0.0.0.0', () => console.log(`engine (vector) listening on port ${PORT}`))
}

main().catch((e) => { console.error(e); process.exit(1) })
