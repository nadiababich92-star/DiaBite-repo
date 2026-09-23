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
 */
import { readFileSync, writeFileSync } from 'node:fs'
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
const runnable = cases.filter((c) => !c.query.startsWith('<'))
const policies = cases.filter((c) => c.query.startsWith('<'))

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

const runs: Record<string, unknown>[] = []
const dataset: Record<string, unknown>[] = []
const tools = toolDefinitions()
let checksRun = 0, checksFailed = 0

for (const c of runnable) {
  process.stdout.write(`${c.id.padEnd(4)} ${c.query.slice(0, 48).padEnd(50)}`)
  const res = await fetch(AGENT_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId: `eval-${c.id}-${Date.now()}`,
      message: c.query,
      budget: c.context.budget,
      entries: c.context.entries,
    }),
  })
  if (!res.ok) { console.log(`HTTP ${res.status}`); continue }
  const reply = (await res.json()) as Reply

  const results = check(c, reply)
  const failed = results.filter((r) => !r.ok)
  checksRun += results.length
  checksFailed += failed.length
  console.log(
    `${reply.blocked ? 'blocked' : `${reply.toolCalls} tools`}`.padEnd(10) +
    `verified=${reply.verified} attempts=${reply.attempts ?? '-'}  ` +
    (results.length === 0 ? '(no mechanical checks)' : failed.length === 0 ? `${results.length}/${results.length} checks` : `FAIL ${failed.map((f) => f.name + (f.note ? ` [${f.note}]` : '')).join('; ')}`),
  )

  runs.push({ ...c, reply, checks: results })
  dataset.push({
    id: c.id,
    dimension: c.dimension,
    tags: c.tags,
    query: [{ role: 'system', content: systemPrompt }, { role: 'user', content: c.query }],
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
console.log(`\n${runs.length} cases, ${checksRun - checksFailed}/${checksRun} mechanical checks passed`)
console.log('wrote eval/agent-runs.jsonl and eval/foundry-dataset.jsonl')
