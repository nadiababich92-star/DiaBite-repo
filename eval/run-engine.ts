/**
 * Layer 1: the engine evals. No model, no judge, no money.
 *
 *   npm run eval
 *
 * These exercise the tools and the verifier directly, so they run in seconds
 * and belong after every change to data, aliases, thresholds or targets —
 * which is where regressions actually come from. Every threshold in
 * resolve_foods was tuned by hand on a dozen phrases, and the food database
 * keeps growing.
 *
 * Five sections, from eval/cases.json:
 *   resolve  — did the phrase reach the right record, or correctly reach none
 *   clarify  — did the confidence band ask when it should have
 *   verify   — does the verifier accept true answers and reject altered ones
 *   gate     — does the safety gate stop what it must and leave ordinary meals alone
 *   answer   — does the browser read the verdict out of both forms the agent writes
 *
 * Exits non-zero when resolve falls under its target, so this can gate a
 * build. The target is the PRD's: parsing at or above 90%.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadFoods } from '../server/foods'
import { openStore } from '../server/embeddings'
import { resolvePhrases } from '../server/resolve'
import { verify } from '../server/verify'
import { safetyGate } from '../server/safety'
import { parseMeal } from '../src/lib/answer'
import type { VerifyRequest } from '../server/contract'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = Number(process.env.RESOLVE_TARGET ?? 90)

interface ResolveCase { phrase: string; expect: string[]; tags: string[] }
interface ClarifyCase { phrase: string; band: string; why: string }
interface AnswerCase { id: string; text: string; verdict: string | null; next?: string; why?: string; costed?: boolean }
interface GateCase { phrase: string; rule: string | null }
interface VerifyCase { id: string; answer: string; toolResults: unknown[]; ok: boolean }

const cases = JSON.parse(readFileSync(join(ROOT, 'eval', 'cases.json'), 'utf8')) as {
  engine: { resolve: ResolveCase[]; clarify: ClarifyCase[]; verify: VerifyCase[]; gate: GateCase[]; answer: AnswerCase[] }
}

const t0 = Date.now()
const { records } = loadFoods()
// Whichever store the engine itself would open, so the same cases prove the
// database returns what the embedded index does.
const store = await openStore(records, (m: string) => { if (/pg-store|pgvector/.test(m)) console.log(m) })
console.log(`engine ready: ${records.length} records in ${Date.now() - t0} ms\n`)

const fail = <T>(list: T[], label: string) => { if (list.length) console.log(`  ${label}: ${list.length}`) }

// ── resolve ───────────────────────────────────────────────────────────────

const resolved = await resolvePhrases(store, cases.engine.resolve.map((c) => c.phrase))
const byTag: Record<string, { pass: number; total: number }> = {}
const misses: string[] = []

cases.engine.resolve.forEach((c, i) => {
  const r = resolved[i]
  // "unknown" is an answer, not an absence: the database has no verified match
  // and saying so is the correct behaviour.
  const ok = c.expect.includes('unknown')
    ? r.unknown === true
    : c.expect.includes(r.candidates[0]?.id ?? '')
  for (const tag of c.tags) {
    const b = (byTag[tag] ??= { pass: 0, total: 0 })
    b.total++
    if (ok) b.pass++
  }
  if (!ok) {
    const got = c.expect.includes('unknown')
      ? `${r.confidence}, top ${r.candidates[0]?.id} ${r.candidates[0]?.score.toFixed(2)}`
      : (r.candidates[0]?.id ?? 'none')
    misses.push(`    ${c.phrase.padEnd(28)} want ${c.expect.join('|').padEnd(26)} got ${got}`)
  }
})

const resolvePass = cases.engine.resolve.length - misses.length
const resolvePct = (resolvePass / cases.engine.resolve.length) * 100
console.log(`resolve   ${resolvePass}/${cases.engine.resolve.length}  ${resolvePct.toFixed(0)}%`)
for (const [tag, b] of Object.entries(byTag)) {
  console.log(`  ${tag.padEnd(12)} ${b.pass}/${b.total}`)
}
if (misses.length) { console.log('  misses:'); misses.forEach((m) => console.log(m)) }

// ── clarify ───────────────────────────────────────────────────────────────

const clarified = await resolvePhrases(store, cases.engine.clarify.map((c) => c.phrase))
const bandMisses: string[] = []
cases.engine.clarify.forEach((c, i) => {
  const got = clarified[i].confidence
  if (got !== c.band) bandMisses.push(`    ${c.phrase.padEnd(28)} want ${c.band.padEnd(8)} got ${got.padEnd(8)} (${c.why})`)
})
console.log(`\nclarify   ${cases.engine.clarify.length - bandMisses.length}/${cases.engine.clarify.length}`)
if (bandMisses.length) { console.log('  wrong band:'); bandMisses.forEach((m) => console.log(m)) }

// ── gate ──────────────────────────────────────────────────────────────────
// The rules that run before any model. A phrasing that once got past them is
// a case here forever; so is every ordinary sentence that must not be stopped.

const gateMisses: string[] = []
for (const c of cases.engine.gate) {
  const got = safetyGate(c.phrase)
  const rule = got.blocked ? got.rule ?? '?' : null
  if (rule !== c.rule) gateMisses.push(`    want ${String(c.rule).padEnd(14)} got ${String(rule).padEnd(14)} ${c.phrase.slice(0, 70)}`)
}
console.log(`\ngate      ${cases.engine.gate.length - gateMisses.length}/${cases.engine.gate.length}`)
if (gateMisses.length) { console.log('  wrong rule:'); gateMisses.forEach((m) => console.log(m)) }

// ── answer ────────────────────────────────────────────────────────────────
// The browser reads a meal answer's verdict and next step out of the agent's
// text. The model writes the labelled form and the plain form about equally,
// and both must come out the same.

const answerMisses: string[] = []
for (const c of cases.engine.answer) {
  const got = parseMeal(c.text, { costed: c.costed })
  const ok = c.verdict === null ? got === null : got?.verdict === c.verdict && (c.next === undefined || got?.next === c.next) && (c.why === undefined || !!got?.why?.includes(c.why))
  if (!ok) answerMisses.push(`    ${c.id.padEnd(24)} want ${JSON.stringify(c.verdict)} got ${JSON.stringify(got?.verdict ?? null)}`)
}
console.log(`\nanswer    ${cases.engine.answer.length - answerMisses.length}/${cases.engine.answer.length}`)
if (answerMisses.length) { console.log('  parsed wrong:'); answerMisses.forEach((m) => console.log(m)) }

// ── verify ────────────────────────────────────────────────────────────────

const verifyMisses: string[] = []
for (const c of cases.engine.verify) {
  const got = verify({ answer: c.answer, toolResults: c.toolResults } as VerifyRequest).ok
  if (got !== c.ok) verifyMisses.push(`    ${c.id} want ok=${c.ok} got ok=${got}  ${c.answer.slice(0, 60)}`)
}
console.log(`\nverify    ${cases.engine.verify.length - verifyMisses.length}/${cases.engine.verify.length}`)
if (verifyMisses.length) { console.log('  wrong verdict:'); verifyMisses.forEach((m) => console.log(m)) }
fail([], '')

console.log(`\ndone in ${Date.now() - t0} ms`)
if (resolvePct < TARGET) {
  console.log(`resolve ${resolvePct.toFixed(0)}% is under the ${TARGET}% target`)
  process.exit(1)
}
if (verifyMisses.length) { console.log('the verifier disagreed with a probe'); process.exit(1) }
if (gateMisses.length) { console.log('the safety gate disagreed with a probe'); process.exit(1) }
if (answerMisses.length) { console.log('an answer was parsed wrong'); process.exit(1) }
