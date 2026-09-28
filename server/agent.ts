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
import { createReadStream, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { AIProjectClient } from '@azure/ai-projects'
import { DefaultAzureCredential } from '@azure/identity'
import { openApiSpec } from './openapi'
import { safetyGate } from './safety'
import { verify } from './verify'
import type { AvoidList } from './avoid'
import { conversationFor, previousResponseFor, putSession, rememberConversation, rememberResponse } from './sessions'
import type { DayBudget, MealItemInput } from './contract'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const PROJECT_ENDPOINT = process.env.PROJECT_ENDPOINT ?? ''
/**
 * A model per specialist, because the three jobs are not the same job.
 *
 * The router emits one word: nano is enough, and it stops the router
 * competing with the meal agent for the same tokens per minute — which is
 * what made ten of seventy questions fail with 502 in an earlier run.
 * The advisor writes prose with no tools and no numbers. Only the meal agent
 * has to pick four tools in order and keep arithmetic discipline, and it is
 * the one the evaluations validated, so it does not move without a run.
 */
const MODELS: Record<string, string> = {
  triage: process.env.MODEL_TRIAGE ?? 'gpt-54-nano',
  meal: process.env.MODEL_MEAL ?? process.env.MODEL_DEPLOYMENT_NAME ?? 'gpt-5-mini',
  advisor: process.env.MODEL_ADVISOR ?? 'gpt-54-mini',
}
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
 * The content-safety policy each agent version declares; the platform layer.
 *
 * The service wants the policy's full ARM id, not its name, so it is built
 * from the account this project lives in — which the connection id already
 * names, sparing another environment variable to get out of step.
 */
const RAI_POLICY_NAME = process.env.RAI_POLICY ?? 'Microsoft.DefaultV2'
function raiPolicyId(): string | null {
  if (RAI_POLICY_NAME.startsWith('/subscriptions/')) return RAI_POLICY_NAME
  const account = ENGINE_CONNECTION.match(/^(.*\/accounts\/[^/]+)/)?.[1]
  return account ? `${account}/raiPolicies/${RAI_POLICY_NAME}` : null
}

/** Where the advisor's memory of a person's preferences lives. */
export const MEMORY_STORE = process.env.MEMORY_STORE ?? 'diabite-preferences'
/** The knowledge base the advisor may quote from: our own documents, nothing clinical. */
export const KB_NAME = process.env.KB_NAME ?? 'diabite-docs'

/**
 * A memory store for the advisor, created once.
 *
 * Deliberately narrow. Chat summaries are off, so what a person ate and what
 * their numbers were is never written down; only a profile of food
 * preferences, and only for 90 days. The advisor is the one agent with no
 * database and no calculator, so a preference is all it could use anyway —
 * and the diary stays where the PRD put it, in the browser.
 */
export async function ensureMemoryStore(log = console.log): Promise<string> {
  const client = projectClient() as unknown as {
    beta: { memoryStores: { get(name: string): Promise<unknown>; create(name: string, def: unknown, options?: unknown): Promise<unknown> } }
  }
  try {
    await client.beta.memoryStores.get(MEMORY_STORE)
    log(`memory    store "${MEMORY_STORE}" already exists`)
    return MEMORY_STORE
  } catch {
    await client.beta.memoryStores.create(MEMORY_STORE, {
      kind: 'default',
      chat_model: MODELS.advisor,
      embedding_model: process.env.EMBEDDING_DEPLOYMENT ?? 'text-embedding-3-large',
      options: {
        user_profile_enabled: true,
        user_profile_details:
          'Food likes, dislikes, cuisines and cooking habits only. Never store medical information, medications, lab values, weight, or what the person ate.',
        chat_summary_enabled: false,
        procedural_memory_enabled: false,
        default_ttl_seconds: 60 * 60 * 24 * 90,
      },
    }, { description: 'Food preferences only, for the DiaBite advisor. No health data, expires after 90 days.' })
    log(`memory    store "${MEMORY_STORE}" created`)
    return MEMORY_STORE
  }
}

/**
 * The advisor's knowledge base: what this product does, how its targets are
 * computed, where its data comes from, and what it refuses.
 *
 * Our own documents on purpose. Clinical guidelines are not in here and should
 * not be: an advisor quoting ADA standards is giving medical advice, which is
 * the line the safety policy exists to hold.
 */
export async function ensureKnowledgeBase(files: string[], log = console.log): Promise<string | null> {
  const openai = projectClient().getOpenAIClient() as unknown as {
    files: { create(body: unknown): Promise<{ id: string }> }
    vectorStores: {
      list(): Promise<{ data: { id: string; name?: string }[] }>
      create(body: unknown): Promise<{ id: string }>
    }
  }
  const existing = (await openai.vectorStores.list()).data.find((v) => v.name === KB_NAME)
  if (existing) {
    log(`knowledge base "${KB_NAME}" already exists`)
    return existing.id
  }
  const ids: string[] = []
  for (const path of files) {
    const uploaded = await openai.files.create({ file: createReadStream(path), purpose: 'assistants' })
    ids.push(uploaded.id)
  }
  const store = await openai.vectorStores.create({ name: KB_NAME, file_ids: ids })
  log(`knowledge base "${KB_NAME}" created from ${ids.length} files`)
  return store.id
}

/**
 * Publish a new version of each agent from this repository.
 *
 * Versions are immutable, so this is a deploy step rather than something a
 * request does: `agent/provision.ts` calls it after a prompt or the spec
 * changes, and a turn simply references an agent by name.
 */
export async function publishAgentVersion(opts: { memoryStore?: string; kbId?: string } = {}): Promise<Record<Role, string>> {
  TOOLS.meal = [engineTool()]
  // The advisor has no engine and no numbers. What it gets instead: our own
  // documents to ground an explanation, and a memory of what this person likes.
  TOOLS.advisor = [
    ...(opts.kbId ? [{ type: 'file_search', vector_store_ids: [opts.kbId] }] : []),
    ...(opts.memoryStore
      ? [{
          type: 'memory_search_preview',
          memory_store_name: opts.memoryStore,
          // One namespace per conversation id, which is what this product has
          // instead of accounts: memories cannot leak between people, and a
          // scope can be deleted outright when someone asks.
          scope: '{{$conversationId}}',
          search_options: { max_memories: 5 },
        }]
      : []),
  ]
  const out = {} as Record<Role, string>
  for (const role of ['triage', 'meal', 'advisor'] as Role[]) {
    const agent = await projectClient().agents.createVersion(agentName(role), {
      kind: 'prompt',
      // The platform's content filter, declared rather than inherited: an
      // agent version that names its policy cannot quietly lose it. Our own
      // guardrails — the rules before the model and the verifier after it —
      // sit outside this and catch what no generic filter knows, like a
      // question about a carbohydrate ratio.
      ...(raiPolicyId() ? { rai_config: { rai_policy_name: raiPolicyId()! } } : {}),
      model: MODELS[role],
      instructions: systemPrompt(role),
      tools: TOOLS[role],
      reasoning: { effort: REASONING_EFFORT },
      // Carried in the version, not only in our own request. A caller that is
      // not this server — the Foundry workflow, the portal's playground —
      // sends no `tool_choice`, and without it the meal agent answers "I'll
      // check those foods first" having called nothing.
      ...(role === 'meal' ? { tool_choice: 'required' } : {}),
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

/**
 * The advisor's memory namespace for this conversation.
 *
 * The version declares `{{$conversationId}}`, which the portal and the workflow
 * substitute for themselves. This path calls the Responses API directly, where
 * nothing substitutes it and the literal braces are rejected — so the scope is
 * supplied per request, from the session id the browser already uses. One
 * namespace per conversation means memories cannot cross between people, and a
 * person's can be deleted outright.
 */
const memoryScope = (sessionId: string) => sessionId.replace(/[^A-Za-z0-9_\-.%+@/]/g, '-').slice(0, 256)

/**
 * The conversation an advisor turn runs in, created once per session.
 *
 * Tools cannot be overridden on a request that names an agent ("Not allowed
 * when agent is specified"), so the scope cannot be passed per call — the
 * version's `{{$conversationId}}` has to resolve instead, and it only resolves
 * when the turn belongs to a conversation. Hence this: the advisor runs inside
 * one, and its id becomes the namespace for that person's remembered
 * preferences.
 */
async function conversationForSession(sessionId: string): Promise<string | undefined> {
  const existing = conversationFor(sessionId)
  if (existing) return existing
  try {
    const openai = projectClient().getOpenAIClient() as unknown as {
      conversations: { create(body: unknown): Promise<{ id: string }> }
    }
    const c = await openai.conversations.create({ metadata: { session: memoryScope(sessionId) } })
    rememberConversation(sessionId, c.id)
    return c.id
  } catch (e) {
    // Without a conversation the advisor still answers; it just answers
    // without remembering, which is the safer way to fail.
    console.warn(`[memory] no conversation for this turn: ${(e as Error).message.slice(0, 120)}`)
    return undefined
  }
}

/** One request to one agent, waiting out the per-minute token limit. */
async function runAgent(role: Role, input: string, previous?: string, forceTools = false, sessionId?: string): Promise<Turn> {
  const openai = projectClient().getOpenAIClient()
  const conversation = role === 'advisor' && sessionId ? await conversationForSession(sessionId) : undefined
  return (await withRateLimitRetry(() => openai.responses.create(
    {
      input,
      // A conversation and a previous response are two ways of saying the same
      // thing, and the service takes one at a time.
      ...(conversation ? { conversation } : previous ? { previous_response_id: previous } : {}),
    } as never,
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
    const res = await runAgent(role, input, previous, role === 'meal', req.sessionId)

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
