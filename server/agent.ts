/**
 * One turn of the DiaBite agent, orchestrated around Foundry's prompt agents.
 *
 * What each n8n part became:
 *
 *   Webhook              -> POST /agent/ask on this service
 *   Code "Safety"        -> safetyGate(), still before the model
 *   AI Agent node        -> three Foundry prompt agents behind a router
 *   Simple Memory        -> previous_response_id, keyed by session id
 *   Code "Verifier"      -> verify(), still after the model, unchanged
 *
 * The three agents and why they are three:
 *
 *   triage   decides which specialist answers. No tools, a nine-line prompt.
 *   meal     the original agent: four tools, tool_choice required, and the
 *            long prompt about budgets and assumptions.
 *   advisor  no tools and no numbers, for the questions that need neither —
 *            "is brown rice better than white", "did you calculate that".
 *
 * The split came from the evaluation set rather than from a diagram. Forcing
 * a tool call on every turn is what made the single agent answer "is this
 * meal good for my kidneys?" by reciting a budget; and the meal prompt, which
 * has to travel with all four tool round trips, is most of what exhausts the
 * deployment's tokens per minute. An advisor turn now carries neither.
 *
 * The verifier is why this wrapper exists. Foundry will happily return the
 * model's prose; the product's claim is that every number in it traces to a
 * tool result, and that check has to run somewhere we control. When it fails
 * the turn is regenerated once, and failing that the answer is assembled from
 * the tool results directly.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { AIProjectClient } from '@azure/ai-projects'
import { DefaultAzureCredential } from '@azure/identity'
import { openApiSpec } from './openapi'
import { safetyGate } from './safety'
import { verify } from './verify'
import type { AvoidList } from './avoid'
import { previousResponseFor, putSession, rememberResponse } from './sessions'
import type { DayBudget, MealItemInput } from './contract'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const PROJECT_ENDPOINT = process.env.PROJECT_ENDPOINT ?? ''
const MODEL_DEPLOYMENT = process.env.MODEL_DEPLOYMENT_NAME ?? 'gpt-5-mini'
const AGENT_PREFIX = process.env.AGENT_PREFIX ?? 'diabite'
export type Role = 'triage' | 'meal' | 'advisor'
const agentName = (role: Role) => `${AGENT_PREFIX}-${role}`
/** ARM id of the Foundry project connection holding the engine's x-api-key. */
const ENGINE_CONNECTION = process.env.ENGINE_CONNECTION_ID ?? ''
/** Where the engine lives when it is not this very process (local dev). */
const ENGINE_URL = process.env.ENGINE_URL ?? ''
const ENGINE_KEY = process.env.ENGINE_API_KEY ?? ''
/**
 * The question is the most useful field in the log — every food we do not
 * have becomes a candidate for the labelled set, and the eval set grows from
 * what people actually type rather than what we imagined. It is also the one
 * field that describes what someone ate, so it can be switched off.
 */
const LOG_QUESTIONS = process.env.LOG_QUESTIONS !== 'false'
/**
 * How hard the model thinks before it acts. The work here is mostly deciding
 * which tool to call next, which is not where deep reasoning pays: "low"
 * answered the same burrito bowl correctly, with the same four tool calls,
 * four seconds faster. Measured on the case set before it was made the
 * default — see the PRD's latency target.
 */
const REASONING_EFFORT = process.env.REASONING_EFFORT ?? 'low'

export const systemPrompt = (role: Role) => readFileSync(join(ROOT, 'agent', 'prompts', `${role}.md`), 'utf8')

let project: AIProjectClient | null = null
function projectClient(): AIProjectClient {
  if (!PROJECT_ENDPOINT) throw new Error('PROJECT_ENDPOINT is not set')
  if (!project) project = new AIProjectClient(PROJECT_ENDPOINT, new DefaultAzureCredential())
  return project
}

/** The whole engine as one tool, four operations. */
export function engineTool() {
  return {
    type: 'openapi',
    openapi: {
      name: 'diabite_engine',
      description:
        'The DiaBite nutrition engine. Resolve foods, compute a meal, read the remaining daily budget, and find lower-glycemic-load alternatives.',
      spec: openApiSpec(),
      auth: ENGINE_CONNECTION
        ? { type: 'project_connection', security_scheme: { project_connection_id: ENGINE_CONNECTION } }
        : { type: 'anonymous' },
    },
  }
}

/** Only the meal specialist has the engine; the other two have nothing to call. */
const TOOLS: Record<Role, unknown[]> = { triage: [], meal: [], advisor: [] }

/**
 * Publish a new version of each agent from this repository.
 *
 * Versions are immutable, so this is a deploy step rather than something a
 * request does: `agent/provision.ts` calls it after a prompt or the spec
 * changes, and a turn simply references an agent by name.
 */
export async function publishAgentVersion(): Promise<Record<Role, string>> {
  TOOLS.meal = [engineTool()]
  const out = {} as Record<Role, string>
  for (const role of ['triage', 'meal', 'advisor'] as Role[]) {
    const agent = await projectClient().agents.createVersion(agentName(role), {
      kind: 'prompt',
      model: MODEL_DEPLOYMENT,
      instructions: systemPrompt(role),
      tools: TOOLS[role],
      reasoning: { effort: REASONING_EFFORT },
    } as never)
    out[role] = (agent as { version?: string }).version ?? '?'
  }
  return out
}

export interface AskRequest {
  /** Conversation id. Also keys the day state and the continuation. */
  sessionId: string
  message: string
  budget?: DayBudget
  entries?: MealItemInput[]
  /** Allergens and excluded foods; parked with the day state, never shown to the model. */
  avoid?: AvoidList
}

export interface ToolCallTrace {
  tool: string
  input: unknown
  result: unknown
}

export interface AskResponse {
  answer: string
  blocked: boolean
  blockedRule?: string
  verified: boolean
  unmatchedNumbers: number[]
  matchedNumbers: number[]
  toolCalls: number
  trace: ToolCallTrace[]
  responseId?: string
  /** 1 on a first-pass answer, 2 when the regenerate was needed. */
  attempts?: number
  /** True when both attempts failed the verifier and this text came from tool results. */
  templated?: boolean
  /** Which specialist answered, and what the router decided. */
  route?: Role
  routedBy?: 'triage' | 'gate' | 'fallback'
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Run a turn, waiting out the model's per-minute token limit.
 *
 * The deployment allows 50k tokens a minute and a turn spends several
 * thousand — the system prompt and the whole OpenAPI spec travel with every
 * one of the four tool round trips. A burst is enough to go negative, and
 * without this the user gets a 502 for a queue they cannot see. The window is
 * a minute, so waiting is the right move; failing after two is also right,
 * because a third wait is longer than anyone will sit through.
 */
async function withRateLimitRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run()
    } catch (e) {
      const err = e as { status?: number; code?: string; headers?: Record<string, string> }
      const limited = err.status === 429 || err.code === 'rate_limit_exceeded'
      if (!limited || attempt >= 2) throw e
      const reset = Number(err.headers?.['x-ratelimit-reset-tokens'])
      const wait = Number.isFinite(reset) && reset > 0 ? Math.min(reset, 65) * 1000 : (attempt + 1) * 8000
      console.warn(`rate limited, waiting ${Math.round(wait / 1000)}s`)
      await sleep(wait)
    }
  }
}

function parseJson(text: string): unknown {
  try { return JSON.parse(text) } catch { return text }
}

/**
 * Foundry wraps a tool's response twice: the output item holds a JSON object
 * whose `response` is itself the engine's JSON, as a string. Unwrap both so
 * the verifier walks real numbers rather than characters in a blob.
 */
function toolOutput(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  const outer = parseJson(raw)
  if (outer && typeof outer === 'object' && typeof (outer as { response?: unknown }).response === 'string') {
    return parseJson((outer as { response: string }).response)
  }
  return outer
}

interface OutputItem {
  type?: string
  call_id?: string
  name?: string
  arguments?: string
  output?: string
}

/** The tool calls and their results, paired by call id. */
function traceOf(output: unknown[] | undefined): ToolCallTrace[] {
  const calls = new Map<string, ToolCallTrace>()
  const order: string[] = []
  for (const raw of output ?? []) {
    const item = raw as OutputItem
    if (!item.call_id) continue
    if (item.type?.endsWith('_call')) {
      calls.set(item.call_id, { tool: item.name ?? 'unknown', input: parseJson(item.arguments ?? ''), result: null })
      order.push(item.call_id)
    } else if (item.type?.endsWith('_call_output')) {
      const call = calls.get(item.call_id)
      if (call) call.result = toolOutput(item.output)
    }
  }
  return order.map((id) => calls.get(id)!).filter(Boolean)
}

/**
 * One line per turn, for the metrics the PRD asks for: verified rate,
 * unmatched count, share of unknown resolutions, share of clarifying
 * questions, latency p90. It goes to stdout, which on Container Apps means
 * Log Analytics — no extra service, and nothing here is worth a database yet.
 */
function logTurn(req: AskRequest, res: AskResponse, ms: number): void {
  const resolve = res.trace.find((t) => t.tool.endsWith('resolve_foods'))?.result as
    | { results?: { confidence?: string; unknown?: boolean; clarify?: string }[] }
    | undefined
  const phrases = resolve?.results ?? []
  console.log(JSON.stringify({
    evt: 'turn',
    at: new Date().toISOString(),
    session: req.sessionId,
    ...(LOG_QUESTIONS ? { question: req.message } : { questionLength: req.message.length }),
    ms,
    blocked: res.blocked,
    rule: res.blockedRule ?? null,
    route: res.route ?? null,
    routedBy: res.routedBy ?? null,
    verified: res.verified,
    unmatched: res.unmatchedNumbers,
    attempts: res.attempts ?? 0,
    templated: res.templated ?? false,
    tools: res.trace.map((t) => t.tool.replace('diabite_engine_', '')),
    phrases: phrases.length,
    unknownPhrases: phrases.filter((p) => p.unknown).length,
    clarified: phrases.filter((p) => p.clarify).length,
  }))
}

/** The last call to an operation, whatever prefix Foundry gave it. */
function lastCall(trace: ToolCallTrace[], operation: string): ToolCallTrace | undefined {
  return [...trace].reverse().find((t) => t.tool === operation || t.tool.endsWith(`_${operation}`))
}

const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * The answer of last resort, assembled from tool results alone.
 *
 * Reached when the model has twice written a number no tool returned. The
 * product's promise is that every number shown traces to the engine, and the
 * honest way to keep it is to stop asking the model and state the arithmetic
 * plainly. Blunter prose, but every figure is the engine's.
 */
export function templatedAnswer(trace: ToolCallTrace[]): string | null {
  const meal = lastCall(trace, 'compute_meal')?.result as { totals?: { gl: number } } | undefined
  const gl = meal?.totals?.gl
  if (typeof gl !== 'number') return null

  const day = lastCall(trace, 'get_day_state')?.result as { remaining?: { gl: number } } | undefined
  const left = day?.remaining?.gl

  const lines: string[] = []
  if (typeof left === 'number') {
    const after = r1(left - gl)
    lines.push(after >= 0
      ? `**Verdict:** it fits what is left of today's budget.`
      : `**Verdict:** it does not fit what is left of today's budget.`)
    lines.push(`**Numbers:** this meal's glycemic load is ${gl}. You had ${left} left before it, which leaves ${after} after.`)
  } else {
    lines.push(`**Numbers:** this meal's glycemic load is ${gl}.`)
  }

  const alts = (lastCall(trace, 'find_alternatives')?.result as { alternatives?: { name: string; gl: number }[] } | undefined)?.alternatives
  if (alts?.length) lines.push(`**Next action:** ${alts[0].name} would come to ${alts[0].gl} instead.`)

  lines.push("_I could not phrase this in my own words without adding a number the engine did not give me, so these are the engine's figures as they came._")
  return lines.join('\n\n')
}

/** Park the day state where only the engine can read it. */
async function parkDayState(req: AskRequest): Promise<void> {
  if (!req.budget || !req.entries) return
  if (!ENGINE_URL) { putSession(req.sessionId, req.budget, req.entries, req.avoid); return }
  const r = await fetch(`${ENGINE_URL}/session/${encodeURIComponent(req.sessionId)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...(ENGINE_KEY ? { 'x-api-key': ENGINE_KEY } : {}) },
    body: JSON.stringify({ budget: req.budget, entries: req.entries, avoid: req.avoid }),
  })
  if (!r.ok) throw new Error(`could not park the day state: ${r.status} ${await r.text()}`)
}

interface Turn { id?: string; output_text?: string; output?: unknown[] }

/** One request to one agent, waiting out the per-minute token limit. */
async function runAgent(role: Role, input: string, previous?: string, forceTools = false): Promise<Turn> {
  const openai = projectClient().getOpenAIClient()
  return (await withRateLimitRetry(() => openai.responses.create(
    { input, ...(previous ? { previous_response_id: previous } : {}) } as never,
    {
      body: {
        agent_reference: { name: agentName(role), type: 'agent_reference' },
        // Only the meal specialist is made to call something. Every answer it
        // gives is grounded in the engine, so a turn that calls nothing there
        // is a turn that guessed; the advisor has nothing to call at all.
        ...(forceTools ? { tool_choice: 'required' } : {}),
      },
    } as never,
  ))) as unknown as Turn
}

/**
 * Which specialist should answer.
 *
 * The router is an agent rather than a regex because the distinction is about
 * meaning: "rice" is a meal, "is rice bad for me" is not, and they differ by
 * one word. It answers in one word and costs about a second; anything it
 * garbles falls through to the meal specialist, which is the one that can ask
 * a question and the one with the database.
 */
async function route(message: string): Promise<{ role: Role; by: 'triage' | 'fallback' }> {
  try {
    const turn = await runAgent('triage', message)
    const said = (turn.output_text ?? '').toLowerCase()
    if (said.includes('advice')) return { role: 'advisor', by: 'triage' }
    if (said.includes('meal')) return { role: 'meal', by: 'triage' }
    console.warn(`triage said "${said.slice(0, 40)}", defaulting to meal`)
  } catch (e) {
    console.warn('triage failed, defaulting to meal:', (e as Error).message)
  }
  return { role: 'meal', by: 'fallback' }
}

export async function ask(req: AskRequest): Promise<AskResponse> {
  const started = Date.now()
  const res = await answer(req)
  logTurn(req, res, Date.now() - started)
  return res
}

async function answer(req: AskRequest): Promise<AskResponse> {
  const gate = safetyGate(req.message)
  if (gate.blocked) {
    // No model call at all: the refusal is the product's answer, not a draft.
    return {
      answer: gate.reply!, blocked: true, blockedRule: gate.rule,
      verified: true, unmatchedNumbers: [], matchedNumbers: [], toolCalls: 0, trace: [],
      routedBy: 'gate',
    }
  }

  const { role, by } = await route(req.message)
  // Only a meal turn needs the day's budget parked for the engine to read.
  if (role === 'meal') await parkDayState(req)

  let previous = previousResponseFor(req.sessionId)
  let input = `[session_id: ${req.sessionId}]\n\n${req.message}`

  const trace: ToolCallTrace[] = []
  let answer = ''
  let responseId: string | undefined
  let v = { ok: false, matched: [] as number[], unmatched: [] as number[] }
  let attempts = 0

  // One regenerate, then the templated answer. Bounded on purpose: an
  // unbounded "try again" loop is how a wrong number becomes a long wait.
  while (attempts < 2) {
    attempts++
    const res = await runAgent(role, input, previous, role === 'meal')

    responseId = res.id
    previous = res.id
    trace.push(...traceOf(res.output))
    answer = res.output_text ?? ''

    v = verify({ answer, toolResults: trace.map((t) => t.result), userText: req.message })
    if (v.ok) break

    console.warn(`verifier rejected attempt ${attempts}: ${JSON.stringify(v.unmatched)}`)
    input =
      `These numbers in your answer came from nowhere: ${v.unmatched.join(', ')}. ` +
      `Every number you state must appear in a tool result from this conversation. ` +
      `Answer the same question again using only those numbers. Do not calculate anything yourself, ` +
      `and do not mention this correction.`
  }

  let templated = false
  if (!v.ok) {
    const fallback = templatedAnswer(trace)
    if (fallback) {
      answer = fallback
      templated = true
      v = verify({ answer, toolResults: trace.map((t) => t.result), userText: req.message })
    }
  }

  if (responseId) rememberResponse(req.sessionId, responseId)

  return {
    answer, blocked: false,
    verified: v.ok, unmatchedNumbers: v.unmatched, matchedNumbers: v.matched,
    toolCalls: trace.length, trace, responseId, attempts, templated,
    route: role, routedBy: by,
  }
}
