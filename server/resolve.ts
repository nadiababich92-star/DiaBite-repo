/**
 * resolve_foods: user phrases -> verified records, with an honest confidence.
 *
 * Vector search picks WHICH record; it never produces a number. The confidence
 * bands are what let the agent ask one question (medium) or admit it has no
 * verified data (low) instead of guessing.
 */
import { loadFoods, summary, type FoodRecord } from './foods'
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
/**
 * The curated records win a tie against the coverage layer.
 *
 * USDA's survey table holds a food for nearly everything someone types, which
 * is why it is there — but where we have curated a record it is the better
 * answer, and the two tie at the top because both match the phrase exactly.
 * Measured: "oatmeal" went to a USDA row with **no glycemic index at all**
 * over our own with a measured 55, "tomato sauce" went to tomato chili sauce
 * at a 17 g portion, and peanut butter to a category estimate of 47 over a
 * measured 14. Coverage is for the gaps, not for the foods we know.
 */
const COVERAGE_PENALTY = 0.08
/**
 * And a coverage record we cannot compute a load from is weaker still.
 *
 * A record without a glycemic index can give carbohydrate and calories but no
 * glycemic load, which is the number this product exists to produce. Where two
 * rows name the same food and only one can be costed, the one that can be
 * costed is the better answer: it is why "cornbread" went to *chicken*
 * cornbread (no GI) over cornbread from a mix (GI 60), and why "miso" left our
 * own measured paste for a USDA row with no GI at all.
 */
const NO_GI_PENALTY = 0.16
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

/**
 * A record's name with its negations removed.
 *
 * "Chicken Tortilla Soup (No Chips)" contains the word "chips", so a lexical
 * score that reads it as a match hands "tortilla chips" a confident answer for
 * a soup. Recipe names use negation freely — "(no chips)", ", no sugar added"
 * — and a bag of words cannot see it, so the negated part is cut before any
 * matching. The same cut makes "Salsa, no sugar added" match the phrase
 * "salsa" exactly, which is what it is.
 */
const plainName = (name: string) =>
  name
    .replace(/\([^)]*\b(no|without|free)\b[^)]*\)/gi, ' ')
    .replace(/,\s*(no|without)\b[^,]*/gi, ' ')

/**
 * How much of a food there was, cut from the phrase before anything tries to
 * identify it.
 *
 * "two eggs" resolved to nothing while "eggs" resolved with high confidence:
 * the count is a token the record's name cannot contain, so it cost coverage
 * in the lexical score and pushed a common breakfast under the unknown
 * threshold. The quantity is the model's business — it multiplies the default
 * portion by the count — and identity is this file's, so they are separated
 * here rather than argued about downstream.
 *
 * A digit against a percent sign stays: "2% milk" is a food's name, not an
 * amount of milk.
 */
const COUNT_WORD = /^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half|couple|pair)\b\s*(of\s+)?/i
const AMOUNT = /^\s*\d+(?:[.,]\d+)?\s*(?!%)(g|gram|grams|kg|oz|ounces?|lb|ml|l|cups?|tbsp|tablespoons?|tsp|teaspoons?|slices?|pieces?|servings?|portions?|bowls?|plates?|glass(?:es)?)?\b\s*(of\s+)?/i
export function withoutQuantity(phrase: string): string {
  let out = phrase.trim()
  for (let i = 0; i < 3; i++) {
    const next = out.replace(AMOUNT, '').replace(COUNT_WORD, '').trim()
    if (next === out || next === '') break
    out = next
  }
  return out || phrase.trim()
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
const STOP = new Set(['a', 'an', 'the', 'of', 'with', 'and', 'some', 'my', 'plate', 'bowl', 'cup', 'slice', 'slices', 'piece', 'pieces'])
const tokens = (s: string) => norm(s).split(' ').filter((t) => t && !STOP.has(t))

/**
 * Words that describe what was done to a food, not which food it is.
 *
 * "Frozen yogurt" is not yogurt, "fried rice" is not rice, and the vectors
 * put them next to each other anyway. If the phrase carries one of these and
 * the record's name does not, the record is a different food — no confidence
 * band, however high the cosine, can make it the right answer.
 */
const STATE_WORDS = new Set([
  'frozen', 'fried', 'deep', 'breaded', 'battered', 'candied', 'dried', 'crispy',
  'chips', 'crisps', 'smoothie', 'pickled', 'smoked', 'jerky', 'powdered', 'instant',
])

/**
 * Singular and plural are the same food.
 *
 * The catalogue names some foods one way and some the other — "Carrot",
 * "Almonds", "Strawberries" — and people type whichever they please. Matching
 * the letters exactly meant "carrots" covered none of "Carrot", took the
 * missing-token penalty, and came back as a food we do not have, while
 * "carrot" resolved with high confidence. Only the plural forms a catalogue
 * actually uses are handled: the naive rule would turn "grits" into "grit".
 */
const SAME_WORD = new Set(['grits', 'oats', 'greens', 'chips', 'crisps', 'molasses', 'hummus', 'couscous', 'asparagus'])
function stem(t: string): string {
  if (t.length <= 3 || SAME_WORD.has(t)) return t
  if (t.endsWith('ies')) return `${t.slice(0, -3)}y`
  if (t.endsWith('es') && t.length > 4) return t.slice(0, -2)
  if (t.endsWith('s')) return t.slice(0, -1)
  return t
}

/** How much of the phrase the record's name accounts for, and what that is worth. */
function lexicalScore(phrase: string, name: string): number {
  const ts = tokens(phrase)
  if (ts.length === 0) return 0
  const n = norm(plainName(name))
  const stems = new Set(n.split(' ').map(stem))
  const covered = (t: string) => n.includes(t) || stems.has(stem(t))
  const coverage = ts.filter(covered).length / ts.length
  if (coverage === 1) return LEXICAL_BOOST
  return coverage * LEXICAL_BOOST * 0.5 - (1 - coverage) * MISSING_TOKEN_PENALTY
}

function kindPrior(phrase: string, kind: string): number {
  const n = tokens(phrase).length
  if (n <= 2 && kind === 'ingredient') return KIND_PRIOR
  if (n >= 4 && kind === 'recipe') return KIND_PRIOR
  return 0
}

/**
 * Ids the catalogue in this build does not hold, named once each.
 *
 * Silence here would hide a half-finished deploy; a line per query would bury
 * everything else.
 */
const warned = new Set<string>()
function unknownId(id: string): false {
  if (!warned.has(id)) {
    warned.add(id)
    console.warn(`[resolve] ${id} is in the vector store but not in this build's food table — skipped`)
  }
  return false
}

/** Two records that are really the same food (e.g. seed and ingredient copies) are not competitors. */
/**
 * Is one food just a dressed-up version of the other?
 *
 * `sameFood` compares whole token sets and lets "Rice, white, with gravy, fat
 * added" past "White rice, cooked" — they share two tokens of three, which is
 * under its threshold. But the leading words of a food's name are what name
 * it: everything after them is preparation. So if the anchor's first two words
 * both appear in the candidate, it is the same food with something on it, and
 * offering it as a swap is advice that changes nothing.
 *
 * "Brown rice" and "Cauliflower rice" survive this, which is the point.
 */
export function sameFamily(anchor: string, candidate: string): boolean {
  const head = tokens(plainName(anchor)).slice(0, 2)
  if (head.length < 2) return false
  const other = new Set(tokens(plainName(candidate)))
  return head.every((t) => other.has(t))
}

export function sameFood(a: string, b: string): boolean {
  const ta = new Set(tokens(a)), tb = new Set(tokens(b))
  const inter = [...ta].filter((t) => tb.has(t)).length
  return inter / Math.max(1, Math.min(ta.size, tb.size)) >= 0.75
}

function band(phrase: string, cands: ResolveCandidate[]): Confidence {
  const top = cands[0]
  if (!top || top.score < LOW_MAX) return 'low'
  // A preparation the record never mentions makes it a different food.
  const stated = tokens(phrase).filter((t) => STATE_WORDS.has(t))
  if (stated.length) {
    const n = norm(plainName(top.name))
    if (stated.some((t) => !n.includes(t))) return 'low'
  }
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

/**
 * A spelling pass, for when the meaning pass has nothing to work with.
 *
 * Vector search reads meaning, which is why "yoghurt", "soda" and "porridge"
 * all land correctly. It does not read letters: a typo is simply a different
 * set of subword tokens, so "avacado" scored 0.43 against Avocado, "brocolli"
 * 0.40 against Broccoli, and "bannana" came back first as Cotija cheese. Each
 * of those reached the user as "I do not have that food", which is a true
 * sentence about a word nobody meant to type.
 *
 * So when nothing is close enough in meaning, we look at the characters:
 * trigram overlap against every name and alias. The bar is deliberately high —
 * a loose one turns an honest "I do not have that" into a confident wrong
 * answer, and the foods we genuinely lack must stay lacking.
 */
/**
 * How many single-character edits apart two words are, giving up past a cap.
 *
 * Typos are edits, so edit distance is the measure; trigram overlap was tried
 * first and was both too loose at the bottom and too tight at the top — one
 * substitution in "avacado" scores 0.45, which is also roughly what two
 * unrelated short words score.
 */
function editsWithin(a: string, b: string, cap: number): boolean {
  if (Math.abs(a.length - b.length) > cap) return false
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      best = Math.min(best, row[j])
    }
    if (best > cap) return false
    prev = row
  }
  return prev[b.length] <= cap
}

/**
 * The closest record by spelling, or nothing.
 *
 * One edit for a short word, two for a long one, and a long word must agree on
 * its first two letters — without that, "doritos" finds "burritos" and a food
 * we honestly do not have becomes a confident wrong answer. The foods we lack
 * have to stay lacking: that is the behaviour this product is built around.
 */
function closestBySpelling(phrase: string, records: FoodRecord[]): FoodRecord | null {
  const q = norm(phrase)
  // One word to one word. A phrase is a different problem, and a misspelt
  // phrase usually still has a correctly spelt word in it for the vectors.
  if (!q || q.includes(' ') || q.length < 4) return null
  const cap = q.length >= 7 ? 2 : 1
  for (const rec of records) {
    for (const name of [norm(plainName(rec.name)), ...(rec.aliases ?? [])]) {
      for (const word of name.split(' ')) {
        if (word.length < 4 || Math.abs(word.length - q.length) > cap) continue
        if (cap === 2 && word.slice(0, 2) !== q.slice(0, 2)) continue
        if (word === q) return rec
        if (editsWithin(q, word, cap)) return rec
      }
    }
  }
  return null
}

export async function resolvePhrases(store: VectorStore, phrases: string[], topK = 5): Promise<ResolvedPhrase[]> {
  const { byId } = loadFoods()
  const given = phrases.map((p) => p.trim()).filter(Boolean)
  if (given.length === 0) return []
  // Identify the food, not the amount of it. The phrase the user typed is
  // still what comes back, so the answer can echo their words.
  const clean = given.map(withoutQuantity)
  const vectors = await embed(clean)

  return Promise.all(clean.map(async (phrase, i) => {
    const hits = await store.search(vectors[i], Math.max(topK * 3, 15))
    // An exact everyday name belongs in the running whatever the vectors said.
    const named = aliasesOf().get(norm(phrase))
    if (named && !hits.some((h) => h.id === named)) hits.unshift({ id: named, score: ALIAS_SCORE })

    const candidates: ResolveCandidate[] = hits
      // A store can hold an id this build does not know: the vectors live in
      // Postgres and the records in the image, so a food added to the table
      // before a deploy would otherwise crash the tool — and a 500 from a tool
      // costs the whole answer.
      .filter((h) => byId.has(h.id) || unknownId(h.id))
      .map((h) => {
        const rec = byId.get(h.id)!
        const exact = rec.aliases?.includes(norm(phrase)) || norm(plainName(rec.name)) === norm(phrase)
        const base = exact
          ? Math.max(ALIAS_SCORE, h.score)
          : Math.min(1, h.score + lexicalScore(phrase, rec.name) + kindPrior(phrase, rec.kind))
        const penalty = h.id.startsWith('usda:') ? (rec.gi === null ? NO_GI_PENALTY : COVERAGE_PENALTY) : 0
        const score = base - penalty
        return { ...summary(rec), score }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((c) => ({ ...c, score: Math.round(c.score * 1000) / 1000 }))

    let confidence = band(phrase, candidates)
    let cands = candidates
    let clarify: string | undefined

    // Nothing close in meaning: try the spelling before giving up.
    if (confidence === 'low') {
      const spelled = closestBySpelling(phrase, loadFoods().records)
      if (spelled) {
        confidence = 'medium'
        cands = [{ ...summary(spelled), score: 0.62 },
                 ...candidates.filter((c) => c.id !== spelled.id)].slice(0, topK)
        clarify = `Did you mean ${spelled.name}?`
      }
    }
    const unknown = confidence === 'low'
    if (confidence === 'medium' && !clarify) {
      const rival = cands.slice(1).find((c) => !sameFood(c.name, cands[0].name))
      clarify = rival ? `Did you mean ${cands[0].name} or ${rival.name}?` : undefined
    }
    return { phrase: given[i], confidence, candidates: cands, clarify, unknown }
  }))
}
