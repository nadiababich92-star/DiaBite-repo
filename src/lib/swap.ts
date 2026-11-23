/** One swap the engine offered for the heaviest food of the meal, as `find_alternatives` returned it. */
export interface SwapOffer {
  id: string
  name: string
  unit: 'g' | 'serving'
  portion: number
  /** 'portion' is less of the food being replaced (docs/specs/swaps-engine.md). Absent means 'swap', which is what an older engine sends. */
  change?: 'swap' | 'portion'
  /** The engine's own phrase for the option with its weight, e.g. "half the banana (59 g)". The agent repeats it; nothing here composes it. */
  label?: string
  /** Portions only: 0.75 or 0.5. */
  fraction?: number
}

type MealWithOffers = { alternatives?: SwapOffer[]; alternativesFor?: { foodId: string; name: string } }

/** "Zucchini, raw" is "zucchini": the way a sentence would name it. */
const plainName = (name: string) => name.replace(/\s*\(.*?\)/g, '').split(',')[0].trim().toLowerCase()

/** The words a sentence uses for a fraction the engine returned. */
const FRACTION_WORDS: Record<number, string[]> = { 0.5: ['half'], 0.75: ['three quarters', 'three-quarters', '3/4'] }

/**
 * A smaller portion the Next line talks about ("have half the banana (59 g)"), and where in the sentence. It is read by the engine's `label`
 * (without the weight in brackets), or by the fraction word with the food's plain name, or by the grams with the food's plain name; never by the
 * food's name alone, because a portion is the replaced food, which `swapNamedIn` drops on purpose. Docs/specs/swaps-screen.md, section 2.
 */
export function portionMention(next: string | undefined, meal: MealWithOffers | undefined): { offer: SwapOffer; at: number } | undefined {
  if (!next || !meal?.alternativesFor || !meal.alternatives?.length) return undefined
  const said = next.toLowerCase().replace(/\s+/g, ' ')
  const food = plainName(meal.alternativesFor.name)
  let best: { offer: SwapOffer; at: number } | undefined
  for (const a of meal.alternatives) {
    if (a.change !== 'portion') continue
    const at: number[] = []
    const label = (a.label ?? '').toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
    if (label && said.includes(label)) at.push(said.lastIndexOf(label))
    const foodAt = food ? said.lastIndexOf(food) : -1
    if (foodAt >= 0) {
      for (const w of FRACTION_WORDS[a.fraction ?? 0] ?? []) { const i = said.lastIndexOf(w); if (i >= 0) at.push(Math.max(i, foodAt)) }
      if (a.unit === 'g' && a.portion > 0) {
        const g = Math.round(a.portion)
        const m = new RegExp(`\\b${g}\\s*(g|grams?)\\b`).exec(said)
        if (m) at.push(Math.max(m.index, foodAt))
      }
    }
    if (at.length) { const here = Math.max(...at); if (!best || here > best.at) best = { offer: a, at: here } }
  }
  return best
}

export const portionNamedIn = (next: string | undefined, meal: MealWithOffers | undefined): SwapOffer | undefined => portionMention(next, meal)?.offer

/**
 * The swap the Next line talks about, picked out of the alternatives the engine returned. The sentence only says which
 * of them it means; the food, its weight and every number come from the engine's result, and a Next line that names
 * none of them gets no button. A smaller portion is named by `portionMention`; when a sentence names both, the one
 * mentioned last is the one meant ("instead of the pear, have half the banana").
 */
export function swapNamedIn(next: string | undefined, meal: MealWithOffers | undefined): SwapOffer | undefined {
  if (!next || !meal?.alternativesFor || !meal.alternatives?.length) return undefined
  const said = next.toLowerCase()
  const replaced = plainName(meal.alternativesFor.name)
  // The food being replaced is not its own swap ("potato, scalloped" is in "mashed potato"), and in "swap X for Y" it is the last one named.
  const named = meal.alternatives
    .filter((a) => a.change !== 'portion')
    .map((a) => ({ a, at: said.lastIndexOf(plainName(a.name)), n: plainName(a.name) }))
    .filter((x) => x.n.length > 2 && x.at >= 0 && !replaced.includes(x.n) && !x.n.includes(replaced))
    .sort((x, y) => y.at - x.at)
  const portion = portionMention(next, meal)
  if (!named[0]) return portion?.offer
  return portion && portion.at > named[0].at ? portion.offer : named[0].a
}
