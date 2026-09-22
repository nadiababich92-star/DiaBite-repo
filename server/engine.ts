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
 *   POST /tools/get_day_state       { budget: { glBudget, carbsG, kcal }, entries: [...] }
 *   POST /tools/find_alternatives   { foodId? | query?, maxGL, topK?, sameCategory? }
 *   POST /verify                    { answer, toolResults: [...], userText? }
 *   GET  /health · GET /foods/:id
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

  app.get('/health', (_req, res) => res.json({ ok: true, records: records.length }))

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
    const body = req.body as DayStateRequest
    if (!body?.budget || !Array.isArray(body.entries)) return res.status(400).json({ error: 'budget and entries required' })
    try { res.json(dayState(body.budget, body.entries)) }
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

  app.listen(PORT, () => console.log(`engine (vector) listening on http://localhost:${PORT}`))
}

main().catch((e) => { console.error(e); process.exit(1) })
