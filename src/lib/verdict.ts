/**
 * What the stamp over an answer says, and the fixed words of the Ask screen (docs/specs/ask-words-and-stamp.md).
 *
 * The stamp follows the engine's comparison (`afterMeal.fits`) and nothing else: it says "Fits" or "Over today's budget", and says nothing
 * about alternatives. A swap is offered in the Next line, with its own button. Kept out of the component so a check can read it without a
 * browser, and so every label and every fixed string is one constant the page and the check share.
 */
import { lastMealCall, type AgentResponse } from './agent'

export type VerdictTone = 'good' | 'bad' | 'ask' | 'advice' | 'carbs' | 'partial' | 'estimate' | 'day'

/**
 * The badge over an answer: who answered decides the label, and only a meal has a verdict. A dish counted from an assumed
 * recipe is an estimate, a partial meal has no verdict to badge, and a meal the engine judged is "Fits" or "Over" by `afterMeal.fits`.
 */
export function verdictTone(answer: string, route?: string, reply?: AgentResponse): VerdictTone {
  if (route === 'advisor') return 'advice'
  // The engine already decided this. Reading it out of the prose worked only
  // while the prose was a label: the moment the verdict became a sentence a
  // person would say — "This one goes over today." — the badge over it read
  // "One question first". `afterMeal.fits` is the same comparison the answer
  // is built on, and it cannot be paraphrased.
  const meal = lastMealCall(reply?.trace)?.result as
    { afterMeal?: { fits?: boolean | null; partial?: { unknownFoods?: string[]; unscored?: string[]; dayUnscored?: string[] } }; items?: { loadAvailable?: boolean }[]; assumed?: boolean } | undefined
  // A dish counted from an assumed recipe is an estimate, whatever the engine's comparison says: the
  // badge never reads "Fits" for a guess. The engine states `assumed`; nothing here reads the sentence.
  if (meal?.assumed === true && (meal.items ?? []).length > 0) return 'estimate'
  // A partial meal has no verdict to badge: a food is missing and the answer is
  // asking what is in it, which is what "One question first" says.
  // Every item branded: carbohydrate and no load. Some branded, some scored: the
  // part of a meal that could be judged. Neither is a verdict, and neither is green.
  if (meal?.afterMeal?.partial?.unscored?.length && (meal.items ?? []).length > 0 && (meal.items ?? []).every((it) => it.loadAvailable === false)) return 'carbs'
  if (meal?.afterMeal?.partial?.unscored?.length && meal.afterMeal.fits !== false) return 'partial'
  // Every food of this meal was counted, but something eaten earlier today has no load in our data: the meal is whole, the day's room is
  // not known, so it is neither "Fits" nor "Part of the meal" (tracker #117, the owner's wording, 25 November 2026).
  if (dayOnly(meal?.afterMeal) && meal?.afterMeal?.fits === null) return 'day'
  if (meal?.afterMeal?.fits === null) return 'ask'
  // The server found a food the turn named and left out of the count (server/agent.ts uncountedFoods): what was counted may fit, the meal is not known to.
  if (reply?.uncounted?.length && meal?.afterMeal?.fits === true) return 'partial'
  if (meal?.afterMeal && typeof meal.afterMeal.fits === 'boolean') return meal.afterMeal.fits ? 'good' : 'bad'
  // No tool result: the only path that reads the sentence.
  const first = answer.split('\n')[0].toLowerCase()
  if (first.includes('does not fit') || first.includes("doesn't fit") || first.includes('not today') || first.includes('goes over')) return 'bad'
  if (first.includes('fits') || first.startsWith('**yes') || first.startsWith('yes')) return 'good'
  return 'ask'
}

/** The day, not the meal, is partly counted: only foods eaten earlier today are without a load. */
export function dayOnly(a: { partial?: { unknownFoods?: string[]; unscored?: string[]; dayUnscored?: string[]; notCounted?: string[] } } | undefined): boolean {
  const p = a?.partial
  return !!p?.dayUnscored?.length && !p.unknownFoods?.length && !p.unscored?.length && !p.notCounted?.length
}

/** The line under the figures when foods eaten earlier today have no load (tracker #117): from the engine's names, never the model's words. */
export function dayUnscoredNote(names: string[]): string {
  const list = names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `${list}, earlier today, ${names.length > 1 ? 'have' : 'has'} no glycemic load in our data, so what is left today may be less.`
}

/** The word printed in the stamp, by tone. No label names an alternative or a change. */
export const STAMP_LABEL: Record<VerdictTone | 'blocked', string> = {
  good: 'Fits',
  bad: 'Over today’s budget',
  ask: 'One question first',
  advice: 'Advice',
  carbs: 'Carbs only',
  partial: 'Part of the meal',
  day: 'Day partly counted',
  estimate: 'Estimate',
  blocked: "Not something I'll answer",
}

/** The fixed strings of the Ask screen that the page prints and a check reads. */
export const HINT = "Say it the way you'd say it to a friend. DiaBite counts it and shows the arithmetic."
export const GL_LINK_LABEL = 'What is GL?'
export const PILL_NO_NUMBERS = 'No numbers stated, so nothing to check'
export const pillChecked = (n: number) => n === 1 ? 'Checked · 1 number matches the calculation' : `Checked · ${n} numbers match the calculation`
export const ERROR_EYEBROW = "Couldn't reach DiaBite"
/** Buttons under an answer: no label changes with state; the open state is `aria-expanded`. */
export const BUTTONS = { calculation: 'Calculation', portions: 'Portions', recipe: 'Recipe' } as const

/** Every fixed string above, for the check that none of them says "agent", "tools" or "traced". */
export function askCopy(): string[] {
  return [HINT, GL_LINK_LABEL, PILL_NO_NUMBERS, pillChecked(3), ERROR_EYEBROW, 'Log it', BUTTONS.calculation, BUTTONS.portions, BUTTONS.recipe]
}
