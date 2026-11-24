/**
 * The weight of a whole dish, read from the person's own message by a rule, before any model runs (docs/engineering/dish-weight-cl1.md).
 *
 * "A chicken burrito bowl with white rice and black beans, 450 g" was counted at 450 g in about half of the samples and at the parts'
 * usual portions in the rest (24 November 2026), whatever the prompt said. The weight is the person's number, so the engine applies it.
 * The shapes read here are narrow on purpose: a weight that belongs to one food ("450 g of pasta and a slice of bread") must never
 * scale a whole meal. Pure: no I/O.
 */
import { GRAMS_PER_OUNCE, GRAMS_PER_POUND } from './quantity'

export interface DishWeight { grams: number; said: string }

const WEIGHT = /(\d+(?:[.,]\d+)?)[\s-]*(kg|kilograms?|g|grams?|oz|ounces?|lbs?|pounds?)\b/gi
const HEDGE = '(?:about|around|roughly|approximately|~)?\\s*'
const r1 = (x: number) => Math.round(x * 10) / 10

export function wholeDishWeight(message: string): DishWeight | null {
  const m = message.trim()
  // A drink's ounces are fluid ounces, and a drink is one item: never a dish weight.
  if (/\bfl\.?\s*oz\b|\bfluid ounces?\b/i.test(m)) return null
  const all = [...m.matchAll(WEIGHT)].filter((x) => m[(x.index ?? 0) + x[0].length] !== '%')
  if (all.length !== 1) return null
  const x = all[0]
  const i = x.index ?? 0
  const before = m.slice(0, i)
  const after = m.slice(i + x[0].length)
  const n = parseFloat(x[1].replace(',', '.'))
  const u = x[2].toLowerCase()
  const grams = /^k/.test(u) ? n * 1000 : /^(oz|ounce)/.test(u) ? n * GRAMS_PER_OUNCE : /^(lb|pound)/.test(u) ? n * GRAMS_PER_POUND : n
  // "…, 450 g", "… (450 g)", "… - 1 lb": the weight closes the message.
  const trailing = /^\s*\)?\s*[.!]?\s*$/.test(after) && new RegExp(`[,(–—-]\\s*${HEDGE}$`, 'i').test(before)
  // "a 450 g bowl", "a 16-ounce plate" (not a container of a drink).
  const sized = /\b(a|an)\s+$/i.test(before) && /^\s*[a-z]/i.test(after) && !/^\s*(glass|cup|can|bottle|mug|carton|pack|bag)\b/i.test(after)
  // "450 g of the casserole", "16 oz of my stew".
  const ofThe = /^\s*of\s+(the|my|that|this|our|her|his|their)\b/i.test(after)
  // "it weighed about 300 g", "the bowl was 450 g".
  const weighed = new RegExp(`\\b(weigh(?:s|ed)?|was|is|came to|totall?ed)\\s+${HEDGE}$`, 'i').test(before) && /^\s*[.!]?\s*$/.test(after)
  if (!(trailing || sized || ofThe || weighed)) return null
  if (grams < 30 || grams > 3000) return null
  return { grams: r1(grams), said: x[0].trim() }
}
