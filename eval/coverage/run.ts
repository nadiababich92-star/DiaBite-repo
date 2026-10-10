/**
 * How much of what Americans actually eat does the engine recognise?
 *
 * No model, no money: it embeds each phrase in eval/coverage/phrases.txt, asks
 * the resolver, and reports what came back. Nothing here asserts; it finds
 * holes. A phrase is a HOLE when the answer is `unknown`, a CLARIFY when the
 * engine would ask a question, and a REVIEW when it is confident but the top
 * match is not obviously the same food (read those by eye).
 *
 *   npx tsx eval/coverage/run.ts            # full table
 *   npx tsx eval/coverage/run.ts --holes    # only what needs work
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadFoods } from '../../server/foods'
import { openStore } from '../../server/embeddings'
import { resolvePhrases, sameFood } from '../../server/resolve'

const here = dirname(fileURLToPath(import.meta.url))
const phrases = readFileSync(join(here, 'phrases.txt'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
const { records } = loadFoods()
const store = await openStore(records, () => {})
const out = await resolvePhrases(store, phrases, 3)

const rows = out.map((r) => {
  const top = r.candidates[0]
  const kind = r.unknown ? 'HOLE' : r.clarify ? 'CLARIFY' : r.confidence !== 'high' ? 'MEDIUM' : 'ok'
  return { phrase: r.phrase, kind, conf: r.confidence, top: top ? `${top.name} [${top.id}]` : '—', score: top?.score ?? 0, clarify: r.clarify ?? '' }
})
const count = (k: string) => rows.filter((r) => r.kind === k).length
console.log(`${rows.length} phrases: ${count('ok')} ok, ${count('CLARIFY')} clarify, ${count('MEDIUM')} medium, ${count('HOLE')} holes\n`)
const only = process.argv.includes('--holes')
for (const r of rows) {
  if (only && r.kind === 'ok') continue
  console.log(`${r.kind.padEnd(8)} ${r.phrase.padEnd(34)} → ${r.top}  ${r.score}${r.clarify ? '  ? ' + r.clarify : ''}`)
}
void sameFood
