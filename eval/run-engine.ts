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
 * Sections, from eval/cases.json:
 *   resolve  — did the phrase reach the right record, or correctly reach none
 *   clarify  — did the confidence band ask when it should have
 *   verify   — does the verifier accept true answers and reject altered ones
 *   gate     — does the safety gate stop what it must and leave ordinary meals alone
 *   partial  — is a meal with a missing food never called a fit
 *   answer   — does the browser read the verdict out of both forms the agent writes
 *
 * Exits non-zero when resolve falls under its target, so this can gate a
 * build. The target is the PRD's: parsing at or above 90%.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { carbsWithoutLoad, loadFoods } from '../server/foods'
import { openStore } from '../server/embeddings'
import { resolvePhrases } from '../server/resolve'
import { verify } from '../server/verify'
import { safetyGate } from '../server/safety'
import { parseMeal } from '../src/lib/answer'
import { afterMealFor, computeItem, computeMeal, driverOf } from '../server/compute'
import { sanitizeProfile } from '../src/lib/storage'
import { looksLikeMeal, withHangRetry } from '../server/agent'
import { diffEntries, exportShape, fromRow, mergeById, toRow } from '../src/lib/syncCore'
import { looksLikeCode, looksLikeEmail, problemOf } from '../src/lib/authCore'
import { weekSummary } from '../src/lib/history'
import { generateWeek, menuHidden, regenerateSlot, replayWeek, shoppingList, shoppingText, MEAL_ORDER } from '../src/lib/menu'
import { loadWeekState } from '../src/lib/menuStore'
import { addDays, dayLabel, gramStep, mealForNow, nudgeGrams, recentEntries } from '../src/lib/diary'
import { calculateTargets, DEFAULT_PROFILE } from '../src/lib/profile'
import { CATEGORY_LABELS } from '../src/data/foods'
import { getSession, noteResolution, putSession } from '../server/sessions'
import type { VerifyRequest } from '../server/contract'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = Number(process.env.RESOLVE_TARGET ?? 90)

interface ResolveCase { phrase: string; expect: string[]; tags: string[] }
interface ClarifyCase { phrase: string; band: string; why: string }
interface AnswerCase { id: string; text: string; verdict: string | null; next?: string; why?: string; costed?: boolean }
interface PartialCase { id: string; remainingGl?: number; mealGl?: number; unknown?: string[]; unscored?: string[]; fits?: boolean | null; flow?: boolean; fitsAfterRetry?: boolean }
interface GateCase { phrase: string; rule: string | null }
interface VerifyCase { id: string; answer: string; toolResults: unknown[]; ok: boolean }

const cases = JSON.parse(readFileSync(join(ROOT, 'eval', 'cases.json'), 'utf8')) as {
  engine: { resolve: ResolveCase[]; clarify: ClarifyCase[]; verify: VerifyCase[]; gate: GateCase[]; answer: AnswerCase[]; portion: { id: string; grams: number }[]; partial: PartialCase[]; branded: { id: string; foodId: string; grams: number }[] }
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

// ── portion ───────────────────────────────────────────────────────────────
// A default serving that is plainly wrong becomes a wrong number, disclosed or not.

const { byId } = loadFoods()
const portionMisses = cases.engine.portion.filter((c) => byId.get(c.id)?.defaultPortion !== c.grams)
  .map((c) => `    ${c.id.padEnd(24)} want ${c.grams} g got ${byId.get(c.id)?.defaultPortion}`)
console.log(`\nportion   ${cases.engine.portion.length - portionMisses.length}/${cases.engine.portion.length}`)
if (portionMisses.length) { console.log('  wrong default serving:'); portionMisses.forEach((m) => console.log(m)) }

// ── catalogue ─────────────────────────────────────────────────────────────
// Rule 4: nothing with real carbohydrate and no glycemic index may be costed.

const catalogueMisses = records.filter((r) => carbsWithoutLoad(r)).map((r) => `    ${r.id} ${r.name}`)
const probe = (gi: number | null, carbs: number, fibre = 0) => carbsWithoutLoad({ gi, per100: { kcal: 0, protein: 0, fat: 0, carbs, fiber: fibre } })
const predicateOk = probe(null, 28) && probe(0, 12.7) && !probe(null, 0.5) && !probe(null, 8, 4) && !probe(56, 28)
if (!predicateOk) catalogueMisses.push('    the rule 4 predicate disagreed with a probe')
console.log(`\ncatalogue ${catalogueMisses.length === 0 ? 'ok' : 'WRONG'}  (${records.length} records, none carbohydrate-without-load)`)
catalogueMisses.forEach((m) => console.log(m))

// ── branded ───────────────────────────────────────────────────────────────
// A branded item is costed for carbohydrate from its label and never for a load.

const brandedMisses: string[] = []
{
  const all = records.filter((r) => r.kind === 'branded')
  if (all.length < 300 || all.length > 2000) brandedMisses.push(`    ${all.length} branded records, expected 300 to 2,000`)
  if (all.some((r) => r.gi !== null)) brandedMisses.push('    a branded record has a glycemic index')
  if (records.some((r) => r.kind !== 'branded' && carbsWithoutLoad(r))) brandedMisses.push('    a non-branded record has carbohydrate and no GI')
  for (const c of cases.engine.branded) {
    const rec = records.find((r) => r.id === c.foodId)
    if (!rec) { brandedMisses.push(`    ${c.id}: ${c.foodId} is not in the catalogue`); continue }
    const it = computeItem({ foodId: c.foodId, grams: c.grams })
    const k = c.grams / 100, p = rec.per100!
    const ok = it.loadAvailable === false && it.gl === null && it.glLevel === null && it.gi === null
      && Math.abs(it.carbs - Math.round(p.carbs * k * 10) / 10) < 0.11 && Math.abs(it.kcal - Math.round(p.kcal * k * 10) / 10) < 0.11
    if (!ok) brandedMisses.push(`    ${c.id}: ${JSON.stringify(it)}`)
    // ...and a meal made of it has no load of its own to total
    const meal = computeMeal([{ foodId: c.foodId, grams: c.grams }])
    if (meal.totals.gl !== 0) brandedMisses.push(`    ${c.id}: the meal total carries a load`)
  }
}
{
  // The engine names the driver, so the answer does not compare numbers itself.
  const m = computeMeal([{ foodId: 'ing:apple', grams: 100 }, { foodId: 'ing:almonds', grams: 100 }])
  const d = driverOf(m.items)
  if (!d || !/apple/i.test(d.name)) brandedMisses.push(`    the driver of apple and almonds is ${d?.name}`)
  if (driverOf(computeMeal([{ foodId: 'branded:2529927', grams: 34 }]).items) !== undefined) brandedMisses.push('    a meal of branded products has a driver')
}
console.log(`\nbranded   ${brandedMisses.length === 0 ? 'ok' : 'WRONG'}`)
brandedMisses.forEach((m) => console.log(m))

// ── image ─────────────────────────────────────────────────────────────────
// A data file the engine reads that the Dockerfile does not copy is a service
// that starts, finds the vectors do not match its records, tries to rebuild the
// index in a read-only folder and dies. It happened on 9 October with the branded
// list. Every file server/foods.ts and server/embeddings.ts open must be copied.

const imageMisses: string[] = []
{
  const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf8')
  const read = readFileSync(join(ROOT, 'server', 'foods.ts'), 'utf8') + readFileSync(join(ROOT, 'server', 'embeddings.ts'), 'utf8')
  for (const f of ['foods_usda.json', 'branded_common.json', 'ingredients.json', 'recipes_db.json', 'embeddings.bin', 'embeddings.ids.json']) {
    if (read.includes(f) && !dockerfile.includes(f)) imageMisses.push(`    ${f} is read by the engine and not copied into the image`)
  }
}
console.log(`\nimage     ${imageMisses.length === 0 ? 'ok' : 'WRONG'}`)
imageMisses.forEach((m) => console.log(m))

// ── stored ────────────────────────────────────────────────────────────────
// What the browser hands back from localStorage is not trusted: one wrong type
// must not take the app down.

const storedMisses: string[] = []
const expectOk = (name: string, ok: boolean) => { if (!ok) storedMisses.push(`    ${name}`) }
{
  const p = sanitizeProfile({ age: 'forty', allergens: 'milk', meds: [1, 2], weightKg: -3, onboarded: 'yes', sex: 'male', comorbidities: ['gout'] })
  expectOk('a string age falls back to the default', typeof p.age === 'number' && p.age > 0)
  expectOk('allergens that is not a list becomes the default list', Array.isArray(p.allergens))
  expectOk('a list of numbers is refused', p.meds.every((m) => typeof m === 'string'))
  expectOk('a negative weight is refused', p.weightKg > 0)
  expectOk('a string where a boolean belongs is refused', typeof p.onboarded === 'boolean')
  expectOk('a valid value survives', p.sex === 'male' && p.comorbidities.includes('gout'))
  expectOk('null and arrays give the default profile', sanitizeProfile(null).age === sanitizeProfile([]).age)
}
console.log(`\nstored    ${storedMisses.length === 0 ? 'ok' : 'WRONG'}`)
storedMisses.forEach((m) => console.log(m))

// ── menu ──────────────────────────────────────────────────────────────────
// The weekly menu runs in the browser; its rules are tested here, without one.

const menuMisses: string[] = []
{
  const profile = { ...DEFAULT_PROFILE, onboarded: true }
  const targets = calculateTargets(profile)
  // (a) no dish twice inside the repeat gap, wherever the pool allows it
  let repeats = 0
  for (let seed = 1; seed <= 200; seed++) {
    const plan = generateWeek(profile, targets, seed)
    plan.days.forEach((d, i) => d.meals.forEach((m) => {
      for (let j = Math.max(0, i - 2); j < i; j++) if (plan.days[j].meals.some((x) => x.dish.id === m.dish.id)) repeats++
    }))
  }
  if (repeats > 0) menuMisses.push(`    ${repeats} dishes repeated inside 3 days over 200 seeds`)
  // (b) one slot changes, nothing else, and the day still adds up
  const plan = generateWeek(profile, targets, 7)
  const r = regenerateSlot(plan, 2, 'lunch', profile, targets, 99)
  const sameElsewhere = r.plan.days.every((d, i) => i === 2 || d === plan.days[i])
  const sameMeals = r.plan.days[2].meals.every((m, i) => m.meal === 'lunch' || m === plan.days[2].meals[i])
  const newLunch = r.plan.days[2].meals.find((m) => m.meal === 'lunch')!.dish.id
  const oldLunch = plan.days[2].meals.find((m) => m.meal === 'lunch')!.dish.id
  const kcal = r.plan.days[2].meals.reduce((t, m) => t + m.nutrients.kcal, 0)
  if (!r.changed || !sameElsewhere || !sameMeals || newLunch === oldLunch) menuMisses.push('    replacing one meal changed more than that meal, or nothing')
  if (Math.abs(kcal - r.plan.days[2].totals.kcal) > 0.01) menuMisses.push('    the day total does not equal the sum of its meals after a replacement')
  // (c) the same seed, the same answer
  const again = regenerateSlot(plan, 2, 'lunch', profile, targets, 99)
  if (again.plan.days[2].meals.find((m) => m.meal === 'lunch')!.dish.id !== newLunch) menuMisses.push('    a replacement is not deterministic for a seed')
  // (c2) the week comes back exactly: the seed and the replacements, in order, rebuild the same plan
  {
    const edits = [{ day: 2, meal: 'lunch' as const, seed: 99 }, { day: 5, meal: 'dinner' as const, seed: 7 }, { day: 2, meal: 'lunch' as const, seed: 123 }]
    let walked = generateWeek(profile, targets, 4242)
    for (const e of edits) walked = regenerateSlot(walked, e.day, e.meal, profile, targets, e.seed).plan
    const replayed = replayWeek(profile, targets, { seed: 4242, edits }).plan
    const ids = (pl: typeof walked) => pl.days.map((d) => d.meals.map((m) => `${m.dish.id}@${m.scale}`).join(',')).join('|')
    if (ids(replayed) !== ids(walked)) menuMisses.push('    a week rebuilt from its seed and replacements is not the week that was on screen')
    if (replayWeek(profile, targets, { seed: 4242, edits: [] }).plan.days.map((d) => d.gl).join() !== generateWeek(profile, targets, 4242).days.map((d) => d.gl).join()) menuMisses.push('    a week with no replacements is not the generated week')
    // What is stored is checked before it is used: rubbish means a new week, never a crash.
    const g = globalThis as { localStorage?: unknown }
    const store: Record<string, string> = {}
    g.localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem: (k: string) => { delete store[k] } }
    store['diabite.menu.v1'] = JSON.stringify({ seed: 5, edits: [{ day: 2, meal: 'lunch', seed: 1 }, { day: 9, meal: 'lunch', seed: 1 }, { day: 1, meal: 'brunch', seed: 1 }, 'x', null] })
    const loaded = loadWeekState()
    if (loaded.seed !== 5 || loaded.edits.length !== 1) menuMisses.push('    a stored week keeps bad replacements (a day past Sunday, an unknown meal, junk)')
    store['diabite.menu.v1'] = '{not json'
    if (!Number.isFinite(loadWeekState().seed)) menuMisses.push('    a stored week that is not JSON does not give a new week')
    delete g.localStorage
  }
  // (d) who is not shown a plan
  const hide = (patch: object) => menuHidden({ ...profile, ...patch } as typeof profile)
  const hiddenOk = hide({ comorbidities: ['eatingDisorder'] }) && hide({ kidney: 'ckd' }) && hide({ kidney: 'dialysis' })
  const shownOk = !hide({}) && !hide({ kidney: 'mentioned' }) && !hide({ comorbidities: ['gout'] }) && !hide({ comorbidities: ['gastroparesis'] }) && !hide({ comorbidities: ['brittle'] }) && !hide({ kidney: 'none', comorbidities: ['htn', 'celiac'] })
  if (!hiddenOk) menuMisses.push('    a profile that must not see a plan does')
  if (!shownOk) menuMisses.push('    a profile that may see a plan does not')
  // the list: rounded to 5 g and ready to paste
  const list = shoppingList(plan)
  if (list.some((l) => l.grams % 5 !== 0)) menuMisses.push('    the shopping list is not rounded to 5 g')
  const text = shoppingText(list, CATEGORY_LABELS)
  if (!text.includes('\n') || !/ g$|kg$/m.test(text)) menuMisses.push('    the shopping list text has no amounts')
  if (MEAL_ORDER.length !== 4) menuMisses.push('    meal order changed')
}
console.log(`\nmenu      ${menuMisses.length === 0 ? 'ok' : 'WRONG'}`)
menuMisses.forEach((m) => console.log(m))

// ── routing ───────────────────────────────────────────────────────────────
// Which messages may start the meal agent before the router has answered.

const routeMisses: string[] = []
for (const m of ['two eggs and rye toast', 'A burrito bowl with white rice, black beans and chicken', 'oatmeal with a banana and a spoon of peanut butter', 'a pack of Oreos', 'grilled salmon with quinoa and broccoli', 'a slice of grandma\'s kugel']) {
  if (!looksLikeMeal(m)) routeMisses.push(`    should start at once: ${m}`)
}
for (const m of ['Is brown rice better than white rice?', 'Can I have an apple with almonds?', 'why is my blood sugar highest in the morning', 'Should I stop eating fruit', 'how does the glycemic index work', 'What should I eat for breakfast', 'is keto sensible for type 2', 'will low carb lower my A1c', 'tell me about oatmeal', 'a banana, is that ok']) {
  if (looksLikeMeal(m)) routeMisses.push(`    should wait for the router: ${m}`)
}
console.log(`\nrouting   ${routeMisses.length === 0 ? 'ok' : 'WRONG'}`)
routeMisses.forEach((m) => console.log(m))

// ── account ───────────────────────────────────────────────────────────────
// Sign-in and sync: the parts that need no network. The rows themselves are proved in
// the database (docs/security/security-plan.md); the engine's checks are in eval:abuse.

const accountMisses: string[] = []
{
  const ok = (name: string, cond: boolean) => { if (!cond) accountMisses.push(`    ${name}`) }
  const e1 = { id: '1760000000000-0', date: '2026-10-10', meal: 'lunch' as const, foodId: 'seed:egg', grams: 110, snapshot: { name: 'Egg', kcal: 156, carbs: 0.8, fiber: 0, protein: 13, fat: 11, availableCarbs: 0.8, gi: null, gl: 0 } }
  const e2 = { id: '1760000000000-1', date: '2026-10-10', meal: 'dinner' as const, foodId: 'seed:oats', grams: 200 }
  const row = toRow('00000000-0000-4000-8000-000000000001', e1)
  ok('an entry survives the trip to a row and back', JSON.stringify(fromRow(row)) === JSON.stringify(e1))
  ok('a row with a meal outside the four is dropped, never rendered', fromRow({ ...row, meal: 'brunch' }) === null)
  ok('a row with no grams is dropped', fromRow({ ...row, grams: 0 }) === null && fromRow({ ...row, grams: 'x' as never }) === null)
  const synced = new Map([[e1.id, JSON.stringify(e1)]])
  const d1 = diffEntries(synced, [e1, e2])
  ok('a new entry is pushed and an unchanged one is not', d1.upsert.length === 1 && d1.upsert[0].id === e2.id && d1.remove.length === 0)
  const d2 = diffEntries(synced, [{ ...e1, grams: 55 }])
  ok('an edited entry is pushed', d2.upsert.length === 1 && d2.upsert[0].grams === 55)
  const d3 = diffEntries(new Map([[e1.id, JSON.stringify(e1)], [e2.id, JSON.stringify(e2)]]), [e2])
  ok('a removed entry is deleted on the server', d3.remove.length === 1 && d3.remove[0] === e1.id && d3.upsert.length === 0)
  const merged = mergeById([e1], [e1, e2], () => '')
  ok('moving a diary twice leaves one of each entry', merged.length === 2 && mergeById(merged, [e1, e2], () => '').length === 2)
  const newer = mergeById([{ id: 'a', n: 1, t: '2026-10-10T10:00' }], [{ id: 'a', n: 2, t: '2026-10-10T11:00' }], (x) => x.t)
  ok('where both have an id the later one wins', newer.length === 1 && newer[0].n === 2)
  ok('the export has exactly the keys consent, diary, email, exportedAt, profile',
    exportShape({ exportedAt: '', email: '', consent: { at: null, version: null }, profile: null, diary: [] }) === 'consent,diary,email,exportedAt,profile')
  {
    const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}`
    const egg = (id: string, date: string, grams = 110) => ({ id, date, meal: 'lunch' as const, foodId: 'egg', grams })
    const rice = (id: string, date: string) => ({ id, date, meal: 'dinner' as const, foodId: 'rice-white', grams: 400 })
    const w = weekSummary([egg('a', day(10)), egg('b', day(10)), rice('c', day(8)), rice('d', day(8)), rice('e', day(8))], 20, day(10))
    ok('the week is seven days ending today, oldest first', w.days.length === 7 && w.days[6].date === day(10) && w.days[0].date === day(4))
    ok('a day with nothing logged is not logged, never "within"', !w.days[0].logged && !w.days[0].within && w.loggedDays === 2)
    ok('a day over the budget is logged and not within; a light day is within', w.days[4].logged && !w.days[4].within && w.days[6].within && w.withinDays === 1)
    const carbsOnly = weekSummary([{ id: 'x', date: day(10), meal: 'snack' as const, foodId: 'branded:1', grams: 30, snapshot: { name: 'Bar', kcal: 100, carbs: 20, fiber: 1, protein: 2, fat: 3, availableCarbs: 19, gi: null, gl: 0, loadAvailable: false } }], 20, day(10))
    ok('a day with a packaged food says its load is only what could be counted', carbsOnly.days[6].partial && carbsOnly.days[6].logged)
    ok('the week crosses a month boundary', weekSummary([], 20, '2026-11-02').days[0].date === '2026-10-27')
    // The diary's own small helpers.
    ok('a day moved by days, across a month and a year', addDays('2026-10-31', 1) === '2026-11-01' && addDays('2026-01-01', -1) === '2025-12-31' && addDays('2026-03-01', -1) === '2026-02-28')
    ok('a day is named Today, Yesterday, or by its date', dayLabel('2026-10-11', '2026-10-11') === 'Today' && dayLabel('2026-10-10', '2026-10-11') === 'Yesterday' && /Oct/.test(dayLabel('2026-10-05', '2026-10-11')))
    ok('the meal for a food follows the clock', mealForNow(7) === 'breakfast' && mealForNow(12) === 'lunch' && mealForNow(16) === 'snack' && mealForNow(20) === 'dinner')
    ok('a weight steps by a tenth in fives, never under five, never over a kilo and a half',
      gramStep(180) === 20 && gramStep(10) === 5 && nudgeGrams(5, -1) === 5 && nudgeGrams(1500, 1) === 1500 && nudgeGrams(180, 1) === 200 && nudgeGrams(200, -1) === 180)
    const mk = (id: string, date: string, foodId: string, grams: number) => ({ id, date, meal: 'lunch' as const, foodId, grams })
    const rec = recentEntries([mk('1', '2026-10-09', 'egg', 110), mk('2', '2026-10-10', 'rice-white', 150), mk('3', '2026-10-10', 'egg', 110), mk('4', '2026-10-08', 'egg', 55)], 3)
    ok('the foods logged again are newest first, one per food and weight', rec.map((e) => e.id).join() === '3,2,4')
    // The day is a calendar day, not 24 hours: across a clock change, in three zones, the week is still seven
    // different consecutive dates ending today, and the labels follow the calendar.
    const savedTz = process.env.TZ
    const nextDay = (d: string) => { const [y, m, dd] = d.split('-').map(Number); const n = new Date(Date.UTC(y, m - 1, dd + 1)); return n.toISOString().slice(0, 10) }
    const zoneProblems: string[] = []
    for (const tz of ['America/Los_Angeles', 'Europe/Warsaw', 'Pacific/Auckland']) {
      process.env.TZ = tz
      for (const today of ['2026-03-08', '2026-03-29', '2026-04-05', '2026-09-27', '2026-10-25', '2026-11-01', '2026-11-02']) {
        const ds = weekSummary([], 20, today).days.map((x) => x.date)
        const consecutive = ds.every((d, i) => i === 0 || d === nextDay(ds[i - 1]))
        if (ds.length !== 7 || ds[6] !== today || !consecutive || new Set(ds).size !== 7) zoneProblems.push(`${tz} ${today}: ${ds.join(',')}`)
      }
    }
    if (savedTz === undefined) delete process.env.TZ; else process.env.TZ = savedTz
    ok('across clock changes, in three zones, the week is seven consecutive dates ending today', zoneProblems.length === 0 && (console.log(zoneProblems.slice(0, 2).join(' | ')), true) && zoneProblems.length === 0)
  }
  ok('the code may be 6 to 10 digits, whatever Supabase is set to', looksLikeCode('12345678') && looksLikeCode('123456') && looksLikeCode('1234567890') && !looksLikeCode('12345') && !looksLikeCode('12345678901') && !looksLikeCode('12a456'))
  ok('an address is an address', looksLikeEmail('name@example.com') && !looksLikeEmail('name@') && !looksLikeEmail('a b@c.de') && !looksLikeEmail(''))
  ok('a rate limit is a rate limit', problemOf({ status: 429, code: 'over_email_send_rate_limit' }) === 'rate')
  ok('a wrong code is a code problem', problemOf({ status: 403, code: 'otp_expired' }) === 'code' && problemOf({ status: 400, message: 'Token has expired or is invalid' }) === 'code')
  ok('our SMTP failing is "unavailable", never the raw text', problemOf({ status: 500, code: 'unexpected_failure', message: 'Error sending confirmation email' }) === 'unavailable')
  ok('no connection is "network"', problemOf({ name: 'AuthRetryableFetchError', status: 0 }) === 'network')
}
console.log(`\naccount   ${accountMisses.length === 0 ? 'ok' : 'WRONG'}`)
accountMisses.forEach((m) => console.log(m))

// ── hang ──────────────────────────────────────────────────────────────────
// A call to Foundry that hangs gets one more try; an error that is the caller's
// own is not retried; a second hang is an error, not a loop.

const hangMisses: string[] = []
{
  const hang = Object.assign(new Error('Request timed out.'), { name: 'APIConnectionTimeoutError' })
  let calls = 0
  const recovered = await withHangRetry(async () => { if (++calls === 1) throw hang; return 'ok' })
  if (recovered !== 'ok' || calls !== 2) hangMisses.push(`    a hang was not retried once (calls ${calls})`)
  calls = 0
  try { await withHangRetry(async () => { calls++; throw hang }); hangMisses.push('    two hangs did not fail') } catch { if (calls !== 2) hangMisses.push(`    two hangs made ${calls} calls`) }
  calls = 0
  try { await withHangRetry(async () => { calls++; throw Object.assign(new Error('bad request'), { status: 400 }) }) } catch { /* expected */ }
  if (calls !== 1) hangMisses.push(`    a 400 was retried (${calls} calls)`)
}
console.log(`\nhang      ${hangMisses.length === 0 ? 'ok' : 'WRONG'}`)
hangMisses.forEach((m) => console.log(m))

// ── partial ───────────────────────────────────────────────────────────────
// CLAUDE.md rule 3: a meal costed without a food the database lacks is
// understated, and may never be called "fits". The engine decides that, not the
// model, so it is tested here without one.

const partialMisses: string[] = []
const room = (gl: number) => ({ gl, carbsG: 100, kcal: 1500 })
for (const c of cases.engine.partial) {
  if (c.flow) {
    // The session carries what resolve_foods could not find, and a retry under
    // another name clears it; a new turn starts clean.
    putSession('eval-partial', { glBudget: 40, carbsG: 150, kcal: 1700 }, [])
    noteResolution('eval-partial', [{ phrase: 'kugel', unknown: true }, { phrase: 'eggs', unknown: false }])
    const held = afterMealFor(room(20), { gl: 5, carbs: 10, kcal: 100 }, getSession('eval-partial')?.unknownFoods).fits
    noteResolution('eval-partial', [{ phrase: 'kugel', unknown: false }])
    const retried = afterMealFor(room(20), { gl: 5, carbs: 10, kcal: 100 }, getSession('eval-partial')?.unknownFoods).fits
    noteResolution('eval-partial', [{ phrase: 'kugel', unknown: true }])
    putSession('eval-partial', { glBudget: 40, carbsG: 150, kcal: 1700 }, [])
    const fresh = getSession('eval-partial')?.unknownFoods.length === 0
    if (held !== null || retried !== c.fitsAfterRetry || !fresh) partialMisses.push(`    ${c.id} held=${held} retried=${retried} fresh=${fresh}`)
    continue
  }
  const got = afterMealFor(room(c.remainingGl!), { gl: c.mealGl!, carbs: 10, kcal: 100 }, c.unknown, c.unscored).fits
  if (got !== c.fits) partialMisses.push(`    ${c.id.padEnd(40)} want ${c.fits} got ${got}`)
}
console.log(`\npartial   ${cases.engine.partial.length - partialMisses.length}/${cases.engine.partial.length}`)
if (partialMisses.length) { console.log('  a partial meal got the wrong verdict:'); partialMisses.forEach((m) => console.log(m)) }

// ── answer ────────────────────────────────────────────────────────────────────
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
if (portionMisses.length) { console.log('a default serving is wrong'); process.exit(1) }
if (partialMisses.length) { console.log('a partial meal was called a fit'); process.exit(1) }
if (menuMisses.length) { console.log('the weekly menu broke a rule'); process.exit(1) }
if (routeMisses.length) { console.log('a message started the meal agent that should have waited'); process.exit(1) }
if (accountMisses.length) { console.log('the account sync or the sign-in messages misbehaved'); process.exit(1) }
if (hangMisses.length) { console.log('the hang retry misbehaved'); process.exit(1) }
if (imageMisses.length) { console.log('the image is missing a data file the engine reads'); process.exit(1) }
if (brandedMisses.length) { console.log('a branded product was given a load, or the layer is the wrong size'); process.exit(1) }
if (storedMisses.length) { console.log('stored data was trusted'); process.exit(1) }
if (catalogueMisses.length) { console.log('a food with carbohydrate and no glycemic index is in the catalogue'); process.exit(1) }
