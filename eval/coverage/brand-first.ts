/**
 * Does a brand beat the plain food when nobody typed a brand?
 *
 * No model, no money. Every survey food that has carbohydrate and no glycemic
 * index (kind: unrated: pizza, cereal, candy) is typed as its own name, the
 * way a person would write it, and the resolver is asked. The answer is wrong
 * when the first candidate is a branded product: nothing in the phrase named
 * one, and a single brand then stands for the whole food ("pepperoni pizza"
 * costed as Tombstone, 23 October 2026).
 *
 *   npx tsx eval/coverage/brand-first.ts            # summary and the first 40 cases
 *   npx tsx eval/coverage/brand-first.ts --all      # every case
 */
import { loadFoods } from '../../server/foods'
import { openStore } from '../../server/embeddings'
import { resolvePhrases } from '../../server/resolve'

const { records } = loadFoods()
const store = await openStore(records, () => {})
const names = [...new Set(records.filter((r) => r.kind === 'unrated').map((r) => r.name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim()))]
const out = await resolvePhrases(store, names, 3)
const brandedFirst = out.filter((r) => r.candidates[0]?.id.startsWith('branded:'))
const unknown = out.filter((r) => r.unknown)
console.log(`${out.length} phrases from unrated survey foods: ${brandedFirst.length} put a brand first (${(100 * brandedFirst.length / out.length).toFixed(1)}%), ${unknown.length} unknown`)
for (const r of (process.argv.includes('--all') ? brandedFirst : brandedFirst.slice(0, 40)))
  console.log(`  ${r.phrase.padEnd(52)} → ${r.candidates[0].name}  ${r.candidates[0].score}  [${r.confidence}]`)
if (process.argv.includes('--strict') && brandedFirst.length) process.exit(1)
