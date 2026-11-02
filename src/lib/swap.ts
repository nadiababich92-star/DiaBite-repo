/** One swap the engine offered for the heaviest food of the meal, as `find_alternatives` returned it. */
export interface SwapOffer { id: string; name: string; unit: 'g' | 'serving'; portion: number }

/** "Zucchini, raw" is "zucchini": the way a sentence would name it. */
const plainName = (name: string) => name.replace(/\s*\(.*?\)/g, '').split(',')[0].trim().toLowerCase()

/**
 * The swap the Next line talks about, picked out of the alternatives the engine returned. The sentence only says which
 * of them it means; the food, its weight and every number come from the engine's result, and a Next line that names
 * none of them gets no button.
 */
export function swapNamedIn(next: string | undefined, meal: { alternatives?: SwapOffer[]; alternativesFor?: { foodId: string; name: string } } | undefined): SwapOffer | undefined {
  if (!next || !meal?.alternativesFor || !meal.alternatives?.length) return undefined
  const said = next.toLowerCase()
  const replaced = plainName(meal.alternativesFor.name)
  // The food being replaced is not its own swap ("potato, scalloped" is in "mashed potato"), and in "swap X for Y" it is the last one named.
  const named = meal.alternatives
    .map((a) => ({ a, at: said.lastIndexOf(plainName(a.name)), n: plainName(a.name) }))
    .filter((x) => x.n.length > 2 && x.at >= 0 && !replaced.includes(x.n) && !x.n.includes(replaced))
    .sort((x, y) => y.at - x.at)
  return named[0]?.a
}
