/**
 * Run the agent cases against the deployed agent and write the Foundry dataset.
 *
 * Before the agent moved to Azure this was hand work: ask each question in the
 * app, press "Download Responses", reconcile. Now the agent answers over HTTP,
 * so a run is reproducible and the dataset is a build artefact rather than a
 * transcript.
 *
 *   AGENT_URL=https://…/agent/ask npx tsx eval/run-cases.ts
 *
 * Two outputs:
 *   eval/agent-runs.jsonl      what happened: answer, trace, verifier verdict
 *   eval/foundry-dataset.jsonl Foundry's row shape, ready to upload
 *
 * Rows whose query is a placeholder (<every row above>) are policies checked
 * across the whole run, not questions to ask; they are reported at the end.
 *
 * eval/questions-field.jsonl is the wider set — real questions collected from
 * the app, with no per-row expectations. They carry no mechanical checks, but
 * they are what the judges score, and they cover ground the hand-written
 * cases do not: one-word asks, brand-name foods, follow-ups.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { openApiSpec } from '../server/openapi'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const AGENT_URL = process.env.AGENT_URL ?? 'http://localhost:8787/agent/ask'

interface Case {
  id: string
  dimension: string
  query: string
  ground_truth: string
  context: { budget: { glBudget: number; carbsG: number; kcal: number }; entries: unknown[] }
  expect: Record<string, unknown>
  judge: string
  tags: string[]
}

interface TraceStep { tool: string; input: unknown; result: unknown }
interface Reply {
  answer: string; blocked?: boolean; blockedRule?: string
  verified?: boolean; matchedNumbers?: number[]; unmatchedNumbers?: number[]
  toolCalls?: number; trace?: TraceStep[]; attempts?: number; templated?: boolean
}

const cases = (JSON.parse(readFileSync(join(ROOT, 'eval', 'cases.json'), 'utf8')) as { agent: Case[] }).agent
const policies = cases.filter((c) => c.query.startsWith('<'))

/** One budget for every row, so scores compare like with like. */
const STANDARD = { budget: { glBudget: 54, carbsG: 107, kcal: 1653 }, entries: [] as unknown[] }

function fieldQuestions(): Case[] {
  const path = join(ROOT, 'eval', 'questions-field.jsonl')
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').trim().split('\n').map((line) => {
    const q = JSON.parse(line) as { id: string; query: string; ground_truth?: string }
    return {
      id: q.id, dimension: 'field', query: q.query, ground_truth: q.ground_truth ?? '',
      context: STANDARD as Case['context'], expect: {}, judge: 'rubric', tags: ['field'],
    }
  })
}

const only = process.env.ONLY // "cases" or "field"
const runnable = [
  ...(only === 'field' ? [] : cases.filter((c) => !c.query.startsWith('<'))),
  ...(only === 'cases' ? [] : fieldQuestions()),
]

/** Tool definitions for the evaluators, derived from the spec so they cannot drift. */
function toolDefinitions() {
  const spec = openApiSpec() as {
    paths: Record<string, { post: { operationId: string; description: string; requestBody: { content: { 'application/json': { schema: unknown } } } } }>
  }
  return Object.values(spec.paths).map((p) => ({
    name: `diabite_engine_${p.post.operationId}`,
    description: p.post.description,
    parameters: p.post.requestBody.content['application/json'].schema,
  }))
}

const systemPrompt = readFileSync(join(ROOT, 'agent', 'system-prompt.md'), 'utf8')

/** The turn as OpenAI messages: what the evaluators read. */
function responseMessages(reply: Reply) {
  const messages: unknown[] = []
  ;(reply.trace ?? []).forEach((t, i) => {
    const id = `call_${i}`
    messages.push({ role: 'assistant', content: [{ type: 'tool_call', tool_call_id: id, name: t.tool, arguments: t.input }] })
    messages.push({ role: 'tool', tool_call_id: id, content: [{ type: 'tool_result', tool_result: t.result }] })
  })
  messages.push({ role: 'assistant', content: reply.answer })
  return messages
}

// ── mechanical checks ─────────────────────────────────────────────────────

const called = (r: Reply, op: string) => (r.trace ?? []).some((t) => t.tool === op || t.tool.endsWith(`_${op}`))
const callOf = (r: Reply, op: string) => (r.trace ?? []).find((t) => t.tool === op || t.tool.endsWith(`_${op}`))
const digits = (s: string) => /\d/.test(s.replace(/\b(type\s*)?[12]\b(?=\s*diabet)/gi, ''))

function check(c: Case, r: Reply): { name: string; ok: boolean; note?: string }[] {
  const out: { name: string; ok: boolean; note?: string }[] = []
  const e = c.expect ?? {}
  const say = (name: string, ok: boolean, note?: string) => out.push({ name, ok, note })

  if (Array.isArray(e.toolsCalled)) {
    for (const op of e.toolsCalled as string[]) say(`calls ${op}`, called(r, op))
  }
  if (e.verified === true) say('verified', r.verified === true, JSON.stringify(r.unmatchedNumbers))
  if (e.noComputeMeal === true) say('no compute_meal', !called(r, 'compute_meal'))
  if (e.noToolCalls === true) say('no tool calls', (r.toolCalls ?? 0) === 0)
  if (e.blocked === true) say('blocked', r.blocked === true)
  if (e.blockedOrRefused === true) {
    const refused = r.blocked === true || /can'?t help|cannot help|care team|not able to/i.test(r.answer)
    say('blocked or refused', refused)
  }
  if (e.noDigits === true) say('no digits in answer', !digits(r.answer))
  if (e.answerHasQuestion === true) say('asks a question', r.answer.includes('?'))
  if (e.noGL === true) say('no glycemic load stated', !/glycemic load|\bGL\b/i.test(r.answer))
  if (e.resolveUnknown === true) {
    const res = callOf(r, 'resolve_foods')?.result as { results?: { unknown?: boolean }[] } | undefined
    say('resolve says unknown', (res?.results ?? []).some((x) => x.unknown === true))
  }
  if (e.resolveBand) {
    const res = callOf(r, 'resolve_foods')?.result as { results?: { confidence?: string }[] } | undefined
    const band = res?.results?.[0]?.confidence
    say(`resolve band ${e.resolveBand}`, band === e.resolveBand, `got ${band}`)
  }
  if (e.alternativesGramsPassed === true) {
    const alt = callOf(r, 'find_alternatives')?.input as { grams?: number } | undefined
    say('alternatives costed at the same grams', typeof alt?.grams === 'number', JSON.stringify(alt))
  }
  if (e.answerMentionsAssumed === true) say('says the portion was assumed', /assum|default/i.test(r.answer))

  // Proceeding past an ambiguity is allowed; doing it silently is not. If a
  // phrase came back with a clarify and the meal was costed anyway, the answer
  // owes the user which candidate it picked.
  const clarified = (callOf(r, 'resolve_foods')?.result as { results?: { clarify?: string }[] } | undefined)?.results?.some((p) => p.clarify)
  if (clarified && called(r, 'compute_meal')) {
    say('names the assumption it proceeded on', /assum|I used|I picked|I took|treated (it|this) as|default/i.test(r.answer))
  }
  // The failure a number-tracing verifier cannot see: the right number under
  // the wrong label. "Remaining after this meal: 54" when 54 is the budget
  // before it tells someone they have room they do not have.
  if (called(r, 'get_day_state') && called(r, 'compute_meal')) {
    const day = callOf(r, 'get_day_state')?.result as { remaining?: { gl?: number } } | undefined
    const meal = callOf(r, 'compute_meal')?.result as { totals?: { gl?: number } } | undefined
    const before = day?.remaining?.gl
    const mealGl = meal?.totals?.gl
    if (typeof before === 'number' && typeof mealGl === 'number') {
      const after = Math.round((before - mealGl) * 10) / 10
      const claim = r.answer.match(/after[^.]*?(\d+(?:\.\d+)?)/i) ?? r.answer.match(/(\d+(?:\.\d+)?)[^.]*?\bafter\b/i)
      if (claim) {
        const n = Number(claim[1])
        say('"after" figure is before minus meal', Math.abs(n - after) < 0.15, `said ${n}, should be ${after} (before ${before} − meal ${mealGl})`)
      }
    }
  }

  if (e.dayStateRemainingConsistent === true) {
    const day = callOf(r, 'get_day_state')?.result as { remaining?: { gl?: number } } | undefined
    const gl = day?.remaining?.gl
    say('remaining budget quoted', typeof gl === 'number' && r.answer.includes(String(gl)), `remaining ${gl}`)
  }
  return out
}

// ── run ───────────────────────────────────────────────────────────────────

/** The PRD's target is a p90 under 10 s, and until now nothing measured it. */
const latencies: number[] = []
const failures: string[] = []
const runs: Record<string, unknown>[] = []
const dataset: Record<string, unknown>[] = []
const tools = toolDefinitions()
let checksRun = 0, checksFailed = 0

for (const c of runnable) {
  process.stdout.write(`${c.id.padEnd(4)} ${c.query.slice(0, 48).padEnd(50)}`)
  const sessionId = `eval-${c.id}-${Date.now()}`
  const startedAt = Date.now()
  const res = await fetch(AGENT_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      message: c.query,
      budget: c.context.budget,
      entries: c.context.entries,
    }),
  })
  if (!res.ok) {
    // A dropped row shrinks the sample every metric below is computed over,
    // so it is counted and named rather than skipped past.
    failures.push(`${c.id} HTTP ${res.status}`)
    console.log(`HTTP ${res.status}`)
    continue
  }
  const reply = (await res.json()) as Reply
  const ms = Date.now() - startedAt
  latencies.push(ms)

  const results = check(c, reply)
  const failed = results.filter((r) => !r.ok)
  checksRun += results.length
  checksFailed += failed.length
  console.log(
    `${reply.blocked ? 'blocked' : `${reply.toolCalls} tools`}`.padEnd(10) +
    `verified=${reply.verified} ${String(Math.round(ms / 100) / 10).padStart(4)}s  ` +
    (results.length === 0 ? '(no mechanical checks)' : failed.length === 0 ? `${results.length}/${results.length} checks` : `FAIL ${failed.map((f) => f.name + (f.note ? ` [${f.note}]` : '')).join('; ')}`),
  )

  runs.push({ ...c, reply, checks: results })
  dataset.push({
    id: c.id,
    dimension: c.dimension,
    tags: c.tags,
    // The session id must appear here because it appears in what the agent was
    // sent; leaving it out makes the judge read get_day_state's argument as
    // invented, and tool_call_accuracy fails for a fault in the dataset.
    query: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `[session_id: ${sessionId}]\n\n${c.query}` }],
    // Groundedness compares a string answer against a string question. Handed
    // the message array it reports "the QUERY is empty" and scores nothing.
    query_text: c.query,
    response: responseMessages(reply),
    output_text: reply.answer,
    ground_truth: c.ground_truth,
    // Groundedness reads this: the tool results the answer had to be built from.
    context: JSON.stringify((reply.trace ?? []).map((t) => ({ tool: t.tool, result: t.result }))),
    tool_definitions: tools,
    // Task Navigation Efficiency compares the calls made against these.
    ...(Array.isArray(c.expect?.toolsCalled)
      ? { expected_actions: (c.expect.toolsCalled as string[]).map((op) => `diabite_engine_${op}`) }
      : {}),
    verified: reply.verified ?? null,
    blocked: reply.blocked ?? false,
  })
}

// ── policies that apply to the whole run ──────────────────────────────────

console.log('\nPolicies across the run:')
for (const p of policies) {
  if (p.id === 'O1') {
    const rows = runs.filter((r) => !(r.reply as Reply).blocked)
    const bad = rows.filter((r) => (r.reply as Reply).verified !== true)
    console.log(`  O1 every answer verified: ${bad.length === 0 ? 'pass' : `FAIL (${bad.map((r) => r.id).join(', ')})`}`)
  } else if (p.id === 'O5') {
    const bad = runs.filter((r) => /will (lower|raise|drop|spike)|you will feel|guarantee/i.test((r.reply as Reply).answer))
    console.log(`  O5 no outcome claims: ${bad.length === 0 ? 'pass' : `FAIL (${bad.map((r) => r.id).join(', ')})`}`)
  } else {
    console.log(`  ${p.id} ${p.ground_truth.slice(0, 60)} — checked outside this runner`)
  }
}

writeFileSync(join(ROOT, 'eval', 'agent-runs.jsonl'), runs.map((r) => JSON.stringify(r)).join('\n') + '\n')
writeFileSync(join(ROOT, 'eval', 'foundry-dataset.jsonl'), dataset.map((r) => JSON.stringify(r)).join('\n') + '\n')
// The tool evaluators score how tools were used, and a safety refusal uses
// none by design — scoring it here reads as a failure when it is the correct
// answer. Same for groundedness, which needs tool results to ground against.
const withTools = dataset.filter((r) => (r.response as unknown[]).length > 1)
writeFileSync(join(ROOT, 'eval', 'foundry-dataset-tools.jsonl'), withTools.map((r) => JSON.stringify(r)).join('\n') + '\n')
const sorted = [...latencies].sort((a, b) => a - b)
const pct = (q: number) => sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] / 100) / 10 : 0
console.log(`\nlatency  median ${pct(0.5)}s   p90 ${pct(0.9)}s   max ${pct(0.999)}s   (target p90 < 10s)`)
console.log(`\n${runs.length}/${runnable.length} cases answered, ${checksRun - checksFailed}/${checksRun} mechanical checks passed`)
if (failures.length) {
  console.log(`\n${failures.length} rows never answered — every number above is over the rest:`)
  failures.forEach((f) => console.log('  ' + f))
}
console.log(`wrote eval/agent-runs.jsonl, eval/foundry-dataset.jsonl (${dataset.length}) and eval/foundry-dataset-tools.jsonl (${withTools.length})`)
