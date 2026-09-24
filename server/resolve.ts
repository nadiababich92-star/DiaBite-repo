/**
 * resolve_foods: user phrases -> verified records, with an honest confidence.
 *
 * Vector search picks WHICH record; it never produces a number. The confidence
 * bands are what let the agent ask one question (medium) or admit it has no
 * verified data (low) instead of guessing.
 */
import { loadFoods, summary } from './foods'
import { embed, type VectorStore } from './embeddings'
import type { Confidence, ResolveCandidate, ResolvedPhrase } from './contract'

// Tuned on the sample set in server/eval; revisit when the labelled set exists.
const HIGH_MIN = 0.66      // best candidate must be at least this similar…
const HIGH_GAP = 0.05      // …and this far ahead of the nearest *different* food
const LOW_MAX = 0.60       // below this nothing is close enough to use
const ALIAS_SCORE = 0.97   // the phrase IS one of the record's everyday names
const LEXICAL_BOOST = 0.12 // every phrase token appears in the record name
// Short phrases ("rice", "greek yogurt") are almost always an ingredient; long
// ones ("chicken burrito bowl with guac") are usually a dish.
const KIND_PRIOR = 0.04
// A word the record's name never mentions is a difference the score should
// feel. "frozen yogurt" is not yogurt and "mac and cheese" is not cheddar,
// however close the embeddings sit.
const MISSING_TOKEN_PENALTY = Number(process.env.MISSING_TOKEN_PENALTY ?? 0.20)

/**
 * Words that name a category, not a food.
 *
 * "rice" can default to white rice and be defensible — it is what most people
 * mean and the worst case besides. "chicken" cannot: breast, ground and
 * rotisserie differ enough that a guess is a wrong number. No threshold can
 * tell those two apart, because the difference is editorial, so the list is
 * written down rather than inferred. An exact name match to one of these
 * caps the confidence at medium, which is the agent's cue to ask.
 */
const CATEGORY_WORDS = new Set([
  'chicken', 'fish', 'beans', 'nuts', 'oatmeal', 'oats', 'tortilla',
  'cheese', 'yogurt', 'greens', 'berries', 'squash', 'seeds',
])

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
const STOP = new Set(['a', 'an', 'the', 'of', 'with', 'and', 'some', 'my', 'plate', 'bowl', 'cup', 'slice', 'slices', 'piece', 'pieces'])
const tokens = (s: string) => norm(s).split(' ').filter((t) => t && !STOP.has(t))

/** How much of the phrase the record's name accounts for, and what that is worth. */
function lexicalScore(phrase: string, name: string): number {
  const ts = tokens(phrase)
  if (ts.length === 0) return 0
  const n = norm(name)
  const coverage = ts.filter((t) => n.includes(t)).length / ts.length
  if (coverage === 1) return LEXICAL_BOOST
  return coverage * LEXICAL_BOOST * 0.5 - (1 - coverage) * MISSING_TOKEN_PENALTY
}

function kindPrior(phrase: string, kind: string): number {
  const n = tokens(phrase).length
  if (n <= 2 && kind === 'ingredient') return KIND_PRIOR
  if (n >= 4 && kind === 'recipe') return KIND_PRIOR
  return 0
}

/** Two records that are really the same food (e.g. seed and ingredient copies) are not competitors. */
function sameFood(a: string, b: string): boolean {
  const ta = new Set(tokens(a)), tb = new Set(tokens(b))
  const inter = [...ta].filter((t) => tb.has(t)).length
  return inter / Math.max(1, Math.min(ta.size, tb.size)) >= 0.75
}

function band(phrase: string, cands: ResolveCandidate[]): Confidence {
  const top = cands[0]
  if (!top || top.score < LOW_MAX) return 'low'
  // A category word is never certain, however well it matched.
  if (tokens(phrase).every((t) => CATEGORY_WORDS.has(t))) return 'medium'
  const rival = cands.slice(1).find((c) => !sameFood(c.name, top.name))
  if (top.score >= HIGH_MIN && (!rival || top.score - rival.score >= HIGH_GAP)) return 'high'
  return 'medium'
}

/**
 * Every everyday name, pointing at its record.
 *
 * Built once, because an alias has to work whether or not vector search
 * happened to surface the record: "penne" is written down as pasta, but the
 * nearest fifteen vectors to it are led by Dijon mustard, and a boost applied
 * only to what search already found never reached the pasta.
 */
let aliasIndex: Map<string, string> | null = null
function aliasesOf(): Map<string, string> {
  if (aliasIndex) return aliasIndex
  aliasIndex = new Map()
  for (const rec of loadFoods().records) {
    for (const a of rec.aliases ?? []) if (!aliasIndex.has(norm(a))) aliasIndex.set(norm(a), rec.id)
    if (!aliasIndex.has(norm(rec.name))) aliasIndex.set(norm(rec.name), rec.id)
  }
  return aliasIndex
}

export async function resolvePhrases(store: VectorStore, phrases: string[], topK = 5): Promise<ResolvedPhrase[]> {
  const { byId } = loadFoods()
  const clean = phrases.map((p) => p.trim()).filter(Boolean)
  if (clean.length === 0) return []
  const vectors = await embed(clean)

  return clean.map((phrase, i) => {
    const hits = store.search(vectors[i], Math.max(topK * 3, 15))
    // An exact everyday name belongs in the running whatever the vectors said.
    const named = aliasesOf().get(norm(phrase))
    if (named && !hits.some((h) => h.id === named)) hits.unshift({ id: named, score: ALIAS_SCORE })

    const candidates: ResolveCandidate[] = hits
      .map((h) => {
        const rec = byId.get(h.id)!
        const exact = rec.aliases?.includes(norm(phrase)) || norm(rec.name) === norm(phrase)
        const score = exact
          ? Math.max(ALIAS_SCORE, h.score)
          : Math.min(1, h.score + lexicalScore(phrase, rec.name) + kindPrior(phrase, rec.kind))
        return { ...summary(rec), score }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((c) => ({ ...c, score: Math.round(c.score * 1000) / 1000 }))

    const confidence = band(phrase, candidates)
    const unknown = confidence === 'low'
    let clarify: string | undefined
    if (confidence === 'medium') {
      const rival = candidates.slice(1).find((c) => !sameFood(c.name, candidates[0].name))
      clarify = rival ? `Did you mean ${candidates[0].name} or ${rival.name}?` : undefined
    }
    return { phrase, confidence, candidates, clarify, unknown }
  })
}
