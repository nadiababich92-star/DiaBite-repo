/**
 * One turn of the DiaBite agent, orchestrated around Foundry's prompt agents.
 *
 * What each n8n part became:
 *
 *   Webhook              -> POST /agent/ask on this service
 *   Code "Safety"        -> safetyGate(), still before the model
 *   AI Agent node        -> a Foundry prompt agent: model deployment, the same
 *                           system prompt, one OpenAPI tool with four operations
 *   Simple Memory        -> previous_response_id, keyed by session id
 *   Code "Verifier"      -> verify(), still after the model, unchanged
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
import { previousResponseFor, putSession, rememberResponse } from './sessions'
import type { DayBudget, MealItemInput } from './contract'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const PROJECT_ENDPOINT = process.env.PROJECT_ENDPOINT ?? ''
const MODEL_DEPLOYMENT = process.env.MODEL_DEPLOYMENT_NAME ?? 'gpt-5-mini'
const AGENT_NAME = process.env.AGENT_NAME ?? 'diabite-agent-v2'
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

export const systemPrompt = () => readFileSync(join(ROOT, 'agent', 'system-prompt.md'), 'utf8')

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

/**
 * Publish a new version of the agent from this repository.
 *
 * Versions are immutable, so this is a deploy step rather than something a
 * request does: `agent/provision.ts` calls it after the prompt or the spec
 * changes, and a turn simply references the agent by name.
 */
export async function publishAgentVersion(): Promise<string> {
  const agent = await projectClient().agents.createVersion(AGENT_NAME, {
    kind: 'prompt',
    model: MODEL_DEPLOYMENT,
    instructions: systemPrompt(),
    tools: [engineTool()],
  } as never)
  return (agent as { version?: string }).version ?? '?'
}

export interface AskRequest {
  /** Conversation id. Also keys the day state and the continuation. */
  sessionId: string
  message: string
  budget?: DayBudget
  entries?: MealItemInput[]
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
  if (!ENGINE_URL) { putSession(req.sessionId, req.budget, req.entries); return }
  const r = await fetch(`${ENGINE_URL}/session/${encodeURIComponent(req.sessionId)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...(ENGINE_KEY ? { 'x-api-key': ENGINE_KEY } : {}) },
    body: JSON.stringify({ budget: req.budget, entries: req.entries }),
  })
  if (!r.ok) throw new Error(`could not park the day state: ${r.status} ${await r.text()}`)
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
    }
  }

  await parkDayState(req)

  const openai = projectClient().getOpenAIClient()
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
    const res = (await openai.responses.create(
      { input, ...(previous ? { previous_response_id: previous } : {}) } as never,
      {
        body: {
          agent_reference: { name: AGENT_NAME, type: 'agent_reference' },
          // Every answer this product gives is grounded in the engine, so a
          // turn that calls nothing is a turn that guessed. Without this the
          // model happily replies "let me check that for you" and stops.
          tool_choice: 'required',
        },
      } as never,
    )) as unknown as { id?: string; output_text?: string; output?: unknown[] }

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
  }
}
