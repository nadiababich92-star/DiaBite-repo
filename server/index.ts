/**
 * Engine service: the deterministic core of DiaBite exposed as HTTP tools
 * for the n8n agent. Every number the agent reports comes from here.
 *
 * Pure functions from src/lib and src/data - the same modules the React
 * frontend imports. Stateless: day state arrives in the request body.
 *
 *   npm run engine      -> http://localhost:3001
 *
 * Endpoints (all POST, JSON in / JSON out):
 *   /resolve_foods       { queries: string[] }
 *   /compute_meal        { items: [{ foodId, grams }] }
 *   /get_day_state       { profile, entries: [{ foodId, grams, meal }] }
 *   /find_alternatives   { foodId, grams, remainingGl?, excludedFoodIds?, limit? }
 *   GET /health
 */
import express from 'express'
import cors from 'cors'
import type { Food, MealType, Profile } from '../src/types'
import { FOODS } from '../src/data/foods'
import {
  availableCarbs,
  breadUnits,
  dayGlLevel,
  giLevel,
  glLevel,
  glycemicLoad,
  nutrientsFor,
  sumNutrients,
  weightedGI,
} from '../src/lib/glycemic'
import { calculateTargets, DEFAULT_PROFILE } from '../src/lib/profile'

const PORT = Number(process.env.PORT ?? 3001)
const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

const r1 = (n: number) => Math.round(n * 10) / 10
const foodById = new Map(FOODS.map((f) => [f.id, f]))

// ── resolve_foods ────────────────────────────────────────────────────────

/** Common US names that the seed database spells differently. */
const SYNONYMS: Record<string, string> = {
  oatmeal: 'oats', porridge: 'oats', 'rolled oats': 'oats',
  rice: 'rice-white', 'white rice': 'rice-white', 'brown rice': 'rice-brown',
  pasta: 'pasta-durum', spaghetti: 'pasta-durum', noodles: 'pasta-durum',
  bread: 'bread-white', toast: 'bread-white', 'rye bread': 'bread-rye',
  potato: 'potato-boil', potatoes: 'potato-boil', 'mashed potatoes': 'potato-mash', 'sweet potato': 'sweetpotato',
  carrot: 'carrot-raw', carrots: 'carrot-raw',
  'green beans': 'greenbeans', peas: 'greenpeas', 'kidney beans': 'kidneybean', 'black beans': 'blackbean',
  strawberries: 'strawberry', blueberries: 'blueberry', raspberries: 'raspberry',
  'greek yogurt': 'greekyogurt', 'cottage cheese': 'cottage', eggs: 'egg',
  'olive oil': 'oliveoil', 'dark chocolate': 'darkchoc', 'milk chocolate': 'milkchoc', chocolate: 'milkchoc',
  'orange juice': 'orangejuice', soda: 'cola', coke: 'cola',
  'bell pepper': 'bellpepper', pepper: 'bellpepper',
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const tokens = (s: string) => norm(s).split(' ').filter((t) => t.length > 1)

interface Candidate { foodId: string; name: string; score: number }

/**
 * Rank foods for a free-text query. Exact synonym or id match scores 1;
 * otherwise the share of query tokens found in the food name.
 * The caller decides what to do with low scores - the engine never guesses.
 */
function rankFoods(query: string): Candidate[] {
  const q = norm(query)
  const exact = SYNONYMS[q] ?? (foodById.has(q) ? q : undefined)
  if (exact) {
    const f = foodById.get(exact)!
    return [{ foodId: f.id, name: f.name, score: 1 }]
  }
  const qt = tokens(q)
  if (qt.length === 0) return []
  const scored = FOODS.map((f) => {
    const ft = new Set([...tokens(f.name), ...f.id.split('-')])
    const hits = qt.filter((t) => [...ft].some((x) => x.startsWith(t) || t.startsWith(x))).length
    const score = hits / qt.length
    return { foodId: f.id, name: f.name, score: r1(score * 100) / 100 }
  })
  return scored.filter((c) => c.score > 0).sort((a, b) => b.score - a.score).slice(0, 5)
}

app.post('/resolve_foods', (req, res) => {
  const queries: string[] = Array.isArray(req.body?.queries) ? req.body.queries : [req.body?.query ?? '']
  const results = queries.map((query) => {
    const candidates = rankFoods(query)
    const best = candidates[0]
    const matched = best && best.score >= 0.99 ? best : null
    return {
      query,
      matched, // null = unknown food; the agent must say so, not guess
      candidates,
      defaultPortionGrams: matched ? foodById.get(matched.foodId)!.portion.grams : null,
      defaultPortionLabel: matched ? foodById.get(matched.foodId)!.portion.label : null,
    }
  })
  res.json({ results })
})

// ── compute_meal ─────────────────────────────────────────────────────────

interface Item { foodId: string; grams: number }

function describePortion(food: Food, grams: number) {
  const n = nutrientsFor(food, grams)
  const gl = glycemicLoad(food, grams)
  return {
    foodId: food.id,
    name: food.name,
    grams,
    gi: food.gi,
    giLevel: giLevel(food.gi),
    kcal: Math.round(n.kcal),
    carbsG: r1(n.carbs),
    fiberG: r1(n.fiber),
    availableCarbsG: r1(availableCarbs(food, grams)),
    proteinG: r1(n.protein),
    fatG: r1(n.fat),
    glycemicLoad: r1(gl),
    glLevel: glLevel(gl),
    breadUnits: r1(breadUnits(food, grams)),
  }
}

function computeMeal(items: Item[]) {
  const unknown: string[] = []
  const resolved: { food: Food; grams: number }[] = []
  for (const it of items) {
    const food = foodById.get(it.foodId)
    if (!food) unknown.push(it.foodId)
    else resolved.push({ food, grams: Number(it.grams) })
  }
  const parts = resolved.map(({ food, grams }) => describePortion(food, grams))
  const totals = sumNutrients(resolved.map(({ food, grams }) => nutrientsFor(food, grams)))
  const gl = resolved.reduce((s, { food, grams }) => s + glycemicLoad(food, grams), 0)
  const avail = resolved.reduce((s, { food, grams }) => s + availableCarbs(food, grams), 0)
  return {
    items: parts,
    unknownFoodIds: unknown,
    totals: {
      kcal: Math.round(totals.kcal),
      carbsG: r1(totals.carbs),
      fiberG: r1(totals.fiber),
      availableCarbsG: r1(avail),
      proteinG: r1(totals.protein),
      fatG: r1(totals.fat),
      glycemicLoad: r1(gl),
      glLevel: glLevel(gl),
      breadUnits: r1(avail / 12),
      weightedGI: weightedGI(resolved),
    },
  }
}

app.post('/compute_meal', (req, res) => {
  const items: Item[] = Array.isArray(req.body?.items) ? req.body.items : []
  if (items.length === 0) return res.status(400).json({ error: 'items[] required' })
  res.json(computeMeal(items))
})

// ── get_day_state ────────────────────────────────────────────────────────

interface Entry extends Item { meal?: MealType }

app.post('/get_day_state', (req, res) => {
  const profile: Profile = { ...DEFAULT_PROFILE, ...(req.body?.profile ?? {}) }
  const entries: Entry[] = Array.isArray(req.body?.entries) ? req.body.entries : []
  const targets = calculateTargets(profile)
  const consumed = computeMeal(entries.length ? entries : []).totals
  const eatenGl = entries.length ? consumed.glycemicLoad : 0
  const remaining = {
    kcal: targets.kcal - (entries.length ? consumed.kcal : 0),
    carbsG: r1(targets.carbsG - (entries.length ? consumed.carbsG : 0)),
    glycemicLoad: r1(targets.glBudget - eatenGl),
  }
  res.json({
    profile: { condition: profile.condition, goal: profile.goal, carbApproach: profile.carbApproach, excludedFoodIds: profile.excludedFoodIds },
    targets,
    consumed: entries.length ? consumed : null,
    remaining,
    dayGlLevel: dayGlLevel(eatenGl, targets.glBudget),
    entriesCount: entries.length,
  })
})

// ── find_alternatives ────────────────────────────────────────────────────

app.post('/find_alternatives', (req, res) => {
  const food = foodById.get(String(req.body?.foodId ?? ''))
  if (!food) return res.status(400).json({ error: 'unknown foodId' })
  const grams = Number(req.body?.grams ?? food.portion.grams)
  const limit = Number(req.body?.limit ?? 3)
  const excluded = new Set<string>(req.body?.excludedFoodIds ?? [])
  const remainingGl: number | undefined = req.body?.remainingGl != null ? Number(req.body.remainingGl) : undefined

  const original = describePortion(food, grams)

  // Same category, lower GL for the same weight, not excluded.
  const swaps = FOODS.filter((f) => f.id !== food.id && f.category === food.category && !excluded.has(f.id))
    .map((f) => describePortion(f, grams))
    .filter((p) => p.glycemicLoad < original.glycemicLoad)
    .sort((a, b) => a.glycemicLoad - b.glycemicLoad)
    .slice(0, limit)
    .map((p) => ({ ...p, glSaved: r1(original.glycemicLoad - p.glycemicLoad) }))

  // Portion that would fit the remaining budget, if a budget was given.
  let smallerPortion: ReturnType<typeof describePortion> | null = null
  if (remainingGl !== undefined && original.glycemicLoad > remainingGl && original.glycemicLoad > 0) {
    const fitGrams = Math.floor((grams * Math.max(0, remainingGl)) / original.glycemicLoad / 10) * 10
    if (fitGrams >= 30) smallerPortion = describePortion(food, fitGrams)
  }

  res.json({ original, swaps, smallerPortion, remainingGl: remainingGl ?? null })
})

app.get('/health', (_req, res) => res.json({ ok: true, foods: FOODS.length }))

app.listen(PORT, () => {
  console.log(`DiaBite engine listening on http://localhost:${PORT} (${FOODS.length} foods)`)
})
