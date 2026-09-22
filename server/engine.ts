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
 *   PUT  /session/:id               { budget, entries }  — day state, kept out of the model's hands
 *   GET  /health · GET /foods/:id · GET /openapi.json
 *
 * Index: 350 ingredients + 86 everyday foods + 1,000 recipes, embedded locally
 * (see embeddings.ts). See contract.ts for the exact shapes.
 */
import express from 'express'
import cors from 'cors'
import { loadFoods, getRecord, summary } from './foods'
import { loadOrBuildIndex, type VectorStore } from './embeddings'
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
  const store: VectorStore = await loadOrBuildIndex(records)
  console.log(`ready in ${Date.now() - t0} ms`)

  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '1mb' }))

  // Two surfaces, two audiences. The tool surface is called by Foundry's
  // OpenAPI tool and by nothing else, so it carries a shared key. The product
  // surface (/agent/ask) is called by the browser, which cannot hold a secret.
  const API_KEY = process.env.ENGINE_API_KEY
  const GUARDED = /^\/(tools|session|verify)\b/
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
    const { budget, entries } = req.body ?? {}
    if (!budget || !Array.isArray(entries)) return res.status(400).json({ error: 'budget and entries required' })
    putSession(req.params.id, budget, entries)
    res.json({ ok: true, sessionId: req.params.id, entries: entries.length })
  })

  app.get('/foods/:id', (req, res) => {
    try { res.json(summary(getRecord(req.params.id))) }
    catch (e) { res.status(404).json({ error: (e as Error).message }) }
  })

  app.post('/tools/resolve_foods', async (req, res) => {
    const body = req.body as ResolveRequest
    if (!Array.isArray(body?.phrases)) return res.status(400).json({ error: 'phrases: string[] required' })
    res.json({ results: await resolvePhrases(store, body.phrases, body.topK) })
  })

  app.post('/tools/compute_meal', (req, res) => {
    const body = req.body as ComputeMealRequest
    if (!Array.isArray(body?.items) || body.items.length === 0) return res.status(400).json({ error: 'items required (non-empty)' })
    const bad = body.items.find((it) => (it.grams !== undefined && !(it.grams > 0)) || (it.servings !== undefined && !(it.servings > 0)))
    if (bad) return res.status(400).json({ error: `grams/servings must be positive: ${bad.foodId}` })
    try { res.json(computeMeal(body.items)) }
    catch (e) { res.status(400).json({ error: (e as Error).message }) }
  })

  app.post('/tools/get_day_state', (req, res) => {
    // Two callers, two shapes. The agent sends a session id and never sees the
    // budget; the frontend, which owns the profile, may pass it directly.
    const body = req.body as DayStateRequest & { sessionId?: string }
    let budget = body?.budget
    let entries = body?.entries
    if (body?.sessionId) {
      const s = getSession(body.sessionId)
      if (!s) return res.status(404).json({ error: `unknown sessionId: ${body.sessionId}` })
      budget = s.budget
      entries = s.entries
    }
    if (!budget || !Array.isArray(entries)) return res.status(400).json({ error: 'sessionId, or budget and entries, required' })
    try { res.json(dayState(budget, entries)) }
    catch (e) { res.status(400).json({ error: (e as Error).message }) }
  })

  app.post('/tools/find_alternatives', async (req, res) => {
    const body = req.body as AlternativesRequest
    if (typeof body?.maxGL !== 'number') return res.status(400).json({ error: 'maxGL required' })
    res.json({ alternatives: await findAlternatives(store, body) })
  })

  app.post('/verify', (req, res) => {
    const body = req.body as VerifyRequest
    if (typeof body?.answer !== 'string') return res.status(400).json({ error: 'answer required' })
    res.json(verify(body))
  })

  app.listen(PORT, '0.0.0.0', () => console.log(`engine (vector) listening on port ${PORT}`))
}

main().catch((e) => { console.error(e); process.exit(1) })
