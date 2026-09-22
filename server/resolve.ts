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

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
const STOP = new Set(['a', 'an', 'the', 'of', 'with', 'and', 'some', 'my', 'plate', 'bowl', 'cup', 'slice', 'slices', 'piece', 'pieces'])
const tokens = (s: string) => norm(s).split(' ').filter((t) => t && !STOP.has(t))

function lexicalBoost(phrase: string, name: string): number {
  const ts = tokens(phrase)
  if (ts.length === 0) return 0
  const n = norm(name)
  const hit = ts.filter((t) => n.includes(t)).length
  return hit === ts.length ? LEXICAL_BOOST : (hit / ts.length) * LEXICAL_BOOST * 0.5
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

function band(cands: ResolveCandidate[]): Confidence {
  const top = cands[0]
  if (!top || top.score < LOW_MAX) return 'low'
  const rival = cands.slice(1).find((c) => !sameFood(c.name, top.name))
  if (top.score >= HIGH_MIN && (!rival || top.score - rival.score >= HIGH_GAP)) return 'high'
  return 'medium'
}

export async function resolvePhrases(store: VectorStore, phrases: string[], topK = 5): Promise<ResolvedPhrase[]> {
  const { byId } = loadFoods()
  const clean = phrases.map((p) => p.trim()).filter(Boolean)
  if (clean.length === 0) return []
  const vectors = await embed(clean)

  return clean.map((phrase, i) => {
    const hits = store.search(vectors[i], Math.max(topK * 3, 15))
    const candidates: ResolveCandidate[] = hits
      .map((h) => {
        const rec = byId.get(h.id)!
        const exact = rec.aliases?.includes(norm(phrase)) || norm(rec.name) === norm(phrase)
        const score = exact ? Math.max(ALIAS_SCORE, h.score) : Math.min(1, h.score + lexicalBoost(phrase, rec.name) + kindPrior(phrase, rec.kind))
        return { ...summary(rec), score }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((c) => ({ ...c, score: Math.round(c.score * 1000) / 1000 }))

    const confidence = band(candidates)
    const unknown = confidence === 'low'
    let clarify: string | undefined
    if (confidence === 'medium') {
      const rival = candidates.slice(1).find((c) => !sameFood(c.name, candidates[0].name))
      clarify = rival ? `Did you mean ${candidates[0].name} or ${rival.name}?` : undefined
    }
    return { phrase, confidence, candidates, clarify, unknown }
  })
}
