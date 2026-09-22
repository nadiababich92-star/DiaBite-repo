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
    ? { type: 'connection', security_scheme: { project_connection_id: ENGINE_CONNECTION } }
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

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return value }
}

/** Pull the tool calls and their outputs out of a finished run, for the verifier and the UI. */
async function traceOf(c: AgentsClient, threadId: string, runId: string): Promise<ToolCallTrace[]> {
  const trace: ToolCallTrace[] = []
  for await (const step of c.runSteps.list(threadId, runId)) {
    const details = step.stepDetails as { type?: string; toolCalls?: unknown[] } | undefined
    if (details?.type !== 'tool_calls' || !Array.isArray(details.toolCalls)) continue
    for (const raw of details.toolCalls) {
      const call = raw as Record<string, any>
      // OpenAPI tool calls carry { openapi: { name, arguments, output } }; function
      // calls carry { function: {...} }. Read whichever is present.
      const body = call.openapi ?? call.openApi ?? call.function ?? call
      trace.push({
        tool: String(body.name ?? call.type ?? 'unknown'),
        input: parseMaybeJson(body.arguments ?? body.input),
        result: parseMaybeJson(body.output ?? body.result),
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
  if (req.budget && req.entries) putSession(req.sessionId, req.budget, req.entries)

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

  const trace = await traceOf(c, threadId, run.id)

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
