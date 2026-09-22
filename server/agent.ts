/**
 * One turn of the DiaBite agent, orchestrated around Foundry Agent Service.
 *
 * What moved here from n8n, and what did not:
 *
 *   n8n Webhook          -> POST /agent/ask on this service
 *   n8n Code "Safety"    -> safetyGate(), still before the model
 *   n8n AI Agent node    -> a Foundry agent: model deployment + system prompt
 *                           + one OpenAPI tool covering all four operations
 *   n8n Simple Memory    -> a Foundry thread, one per conversation
 *   n8n Code "Verifier"  -> verify(), still after the model, unchanged
 *
 * The verifier is the reason this wrapper exists at all. Foundry will happily
 * return the model's prose; the product's claim is that every number in it
 * traces to a tool result, and that check has to run somewhere we control.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { AgentsClient, ToolUtility } from '@azure/ai-agents'
import { DefaultAzureCredential } from '@azure/identity'
import { openApiSpec } from './openapi'
import { safetyGate } from './safety'
import { verify } from './verify'
import { putSession } from './sessions'
import type { DayBudget, MealItemInput } from './contract'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const PROJECT_ENDPOINT = process.env.PROJECT_ENDPOINT ?? ''
const MODEL_DEPLOYMENT = process.env.MODEL_DEPLOYMENT_NAME ?? 'gpt-5-mini'
const AGENT_NAME = process.env.AGENT_NAME ?? 'diabite-agent'
/** Name of the Foundry project connection holding the engine's x-api-key. */
const ENGINE_CONNECTION = process.env.ENGINE_CONNECTION_ID ?? ''
/**
 * Where the engine lives, when it is not this very process. In production the
 * wrapper and the engine are one service and the session store is shared
 * memory; running the wrapper on a laptop against the deployed engine, it is
 * not, and the session has to be parked over HTTP or the agent's
 * get_day_state call meets a 404.
 */
const ENGINE_URL = process.env.ENGINE_URL ?? ''
/** The data-plane API version used for the raw run-steps read below. */
const API_VERSION = process.env.FOUNDRY_API_VERSION ?? '2025-05-01'
const ENGINE_KEY = process.env.ENGINE_API_KEY ?? ''

export const systemPrompt = () => readFileSync(join(ROOT, 'agent', 'system-prompt.md'), 'utf8')

let client: AgentsClient | null = null
function agentsClient(): AgentsClient {
  if (!PROJECT_ENDPOINT) throw new Error('PROJECT_ENDPOINT is not set')
  if (!client) client = new AgentsClient(PROJECT_ENDPOINT, new DefaultAzureCredential())
  return client
}

/** The OpenAPI tool definition: the whole engine, as one tool, four operations. */
export function engineTool() {
  const auth = ENGINE_CONNECTION
    ? { type: 'connection', securityScheme: { connectionId: ENGINE_CONNECTION } }
    : { type: 'anonymous' }
  return ToolUtility.createOpenApiTool({
    name: 'diabite_engine',
    description:
      'The DiaBite nutrition engine. Resolve foods, compute a meal, read the remaining daily budget, and find lower-glycemic-load alternatives.',
    spec: openApiSpec(),
    // The SDK's typing predates the connection auth shape; the service accepts it.
    auth: auth as never,
  })
}

/**
 * Create the agent, or update it in place when it already exists, so the
 * prompt and the tool never drift from this repository.
 */
export async function ensureAgent(): Promise<string> {
  const c = agentsClient()
  const tool = engineTool()
  const definition = {
    name: AGENT_NAME,
    instructions: systemPrompt(),
    tools: [tool.definition],
  }
  for await (const a of c.listAgents()) {
    if (a.name === AGENT_NAME) {
      await c.updateAgent(a.id, definition)
      return a.id
    }
  }
  const created = await c.createAgent(MODEL_DEPLOYMENT, definition)
  return created.id
}

export interface AskRequest {
  /** Conversation id. Also keys the day state and the Foundry thread. */
  sessionId: string
  message: string
  budget?: DayBudget
  entries?: MealItemInput[]
  /** Continue an existing conversation. Omit to start one. */
  threadId?: string
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
  threadId?: string
  runId?: string
  runStatus?: string
}

/**
 * Foundry returns an OpenAPI tool's output as a Python literal — single-quoted
 * strings, True/False/None — not as JSON. Convert it rather than eyeballing a
 * regex: a naive quote swap breaks on any apostrophe, and the recipe names in
 * our own database have them.
 */
function parsePythonish(text: string): unknown {
  try { return JSON.parse(text) } catch { /* not JSON; convert below */ }
  let out = ''
  let inStr = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (ch === '\\') { out += text[i + 1] === "'" ? "'" : ch + text[i + 1]; i++; continue }
      if (ch === "'") { out += '"'; inStr = false; continue }
      if (ch === '"') { out += '\\"'; continue }
      out += ch
      continue
    }
    if (ch === "'") { out += '"'; inStr = true; continue }
    if (/[A-Za-z]/.test(ch)) {
      const word = text.slice(i).match(/^(True|False|None)\b/)
      if (word) { out += { True: 'true', False: 'false', None: 'null' }[word[1] as 'True']; i += word[1].length - 1; continue }
    }
    out += ch
  }
  try { return JSON.parse(out) } catch { return text }
}

const credential = new DefaultAzureCredential()

/**
 * The tool calls and their outputs, read straight from the REST API.
 *
 * Not through the SDK: its typed model for a step of type "openapi" carries
 * only the call's id, dropping the arguments and the output. Those are exactly
 * what the verifier checks the answer against, so the raw response it is.
 */
async function traceOf(threadId: string, runId: string): Promise<ToolCallTrace[]> {
  const token = (await credential.getToken('https://ai.azure.com/.default'))!.token
  const url = `${PROJECT_ENDPOINT}/threads/${threadId}/runs/${runId}/steps?api-version=${API_VERSION}&order=asc`
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`could not read run steps: ${res.status} ${await res.text()}`)
  const body = (await res.json()) as {
    data: { type: string; step_details?: { tool_calls?: { type: string; function?: { name?: string; arguments?: string; output?: string } }[] } }[]
  }

  const trace: ToolCallTrace[] = []
  for (const step of body.data) {
    if (step.type !== 'tool_calls') continue
    for (const call of step.step_details?.tool_calls ?? []) {
      const fn = call.function
      if (!fn) continue
      trace.push({
        tool: fn.name ?? call.type,
        input: fn.arguments ? parsePythonish(fn.arguments) : null,
        result: fn.output ? parsePythonish(fn.output) : null,
      })
    }
  }
  return trace
}

export async function ask(req: AskRequest): Promise<AskResponse> {
  const gate = safetyGate(req.message)
  if (gate.blocked) {
    // No model call at all: the refusal is the product's answer, not a draft.
    return {
      answer: gate.reply!,
      blocked: true,
      blockedRule: gate.rule,
      verified: true,
      unmatchedNumbers: [],
      matchedNumbers: [],
      toolCalls: 0,
      trace: [],
    }
  }

  // Park the day state before the run. The agent is handed the id, never the numbers.
  if (req.budget && req.entries) {
    if (ENGINE_URL) {
      const r = await fetch(`${ENGINE_URL}/session/${encodeURIComponent(req.sessionId)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', ...(ENGINE_KEY ? { 'x-api-key': ENGINE_KEY } : {}) },
        body: JSON.stringify({ budget: req.budget, entries: req.entries }),
      })
      if (!r.ok) throw new Error(`could not park the day state: ${r.status} ${await r.text()}`)
    } else {
      putSession(req.sessionId, req.budget, req.entries)
    }
  }

  const c = agentsClient()
  const agentId = await ensureAgent()
  const threadId = req.threadId ?? (await c.threads.create()).id

  await c.messages.create(
    threadId,
    'user',
    `[session_id: ${req.sessionId}]\n\n${req.message}`,
  )

  const run = await c.runs.createAndPoll(threadId, agentId, {
    pollingOptions: { intervalInMs: 1000 },
  })

  const trace = await traceOf(threadId, run.id)

  let answer = ''
  for await (const m of c.messages.list(threadId, { order: 'desc', limit: 10 })) {
    if (m.role !== 'assistant') continue
    const text = m.content.find((p: { type: string }) => p.type === 'text') as
      | { text: { value: string } }
      | undefined
    if (text) { answer = text.text.value; break }
  }

  const v = verify({
    answer,
    toolResults: trace.map((t) => t.result),
    userText: req.message,
  })

  return {
    answer,
    blocked: false,
    verified: v.ok,
    unmatchedNumbers: v.unmatched,
    matchedNumbers: v.matched,
    toolCalls: trace.length,
    trace,
    threadId,
    runId: run.id,
    runStatus: run.status,
  }
}
