/**
 * Client for the DiaBite agent (the n8n workflow behind one webhook).
 *
 * The frontend sends the message plus today's state; the agent orchestrates
 * the engine tools and returns an answer, the verifier's verdict, and the tool
 * trace. Nothing here computes a number — the trace carries the engine's.
 */
import type { DiaryEntry, Targets } from '../types'

/** Dev: proxied by Vite to the n8n webhook (see vite.config.ts). Prod: set VITE_AGENT_URL. */
const AGENT_URL = import.meta.env.VITE_AGENT_URL ?? '/agent'

export interface AgentRequest {
  sessionId: string
  message: string
  budget: { glBudget: number; carbsG: number; kcal: number }
  entries: { foodId: string; grams?: number; servings?: number }[]
}

export interface TraceStep {
  tool: string
  input: unknown
  result: unknown
}

export interface AgentResponse {
  answer: string
  /** Present on safety-gate refusals. */
  blocked?: boolean
  verified?: boolean
  matchedNumbers?: number[]
  unmatchedNumbers?: number[]
  verifierError?: string | null
  toolCalls?: number
  trace?: TraceStep[]
}

/** Engine ids for diary entries: locally known foods are `seed:<id>`; agent-logged ones already carry theirs. */
export function engineId(entry: DiaryEntry): string {
  return entry.snapshot ? entry.foodId : `seed:${entry.foodId}`
}

export function budgetOf(t: Targets): AgentRequest['budget'] {
  return { glBudget: t.glBudget, carbsG: t.carbsG, kcal: t.kcal }
}

export async function askAgent(req: AgentRequest, signal?: AbortSignal): Promise<AgentResponse> {
  const res = await fetch(AGENT_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })
  if (res.status === 404) throw new Error('The agent is not reachable — is the n8n workflow published?')
  if (!res.ok) throw new Error(`Agent error ${res.status}`)
  const data = (await res.json()) as AgentResponse
  if (typeof data.answer !== 'string') throw new Error('Unexpected reply from the agent')
  return data
}

// ── Reading the trace ───────────────────────────────────────────────────

export interface ReceiptLine {
  foodId: string
  name: string
  portion: string
  availableCarbs: number
  gi: number | null
  gl: number
  kcal: number
  carbs: number
  fiber: number
  protein: number
  fat: number
  grams: number
  servings?: number
}

export interface Receipt {
  lines: ReceiptLine[]
  total: number
  leftBefore: number | null
  leftAfter: number | null
}

interface MealResult {
  items: {
    foodId: string; name: string; grams: number; servings?: number
    kcal: number; carbs: number; fiber: number; protein: number; fat: number
    availableCarbs: number; gi: number | null; gl: number
  }[]
  totals: { gl: number }
}

interface DayStateResult { remaining: { gl: number } }

function unwrap(result: unknown): unknown {
  return Array.isArray(result) && result.length === 1 ? result[0] : result
}

/** Build the receipt from the trace: the last compute_meal call, against get_day_state. */
export function receiptFrom(trace: TraceStep[] | undefined): Receipt | null {
  if (!trace) return null
  const meal = [...trace].reverse().find((t) => t.tool === 'compute_meal')
  if (!meal) return null
  const m = unwrap(meal.result) as MealResult
  if (!m?.items) return null
  const day = trace.find((t) => t.tool === 'get_day_state')
  const d = day ? (unwrap(day.result) as DayStateResult) : null
  const leftBefore = typeof d?.remaining?.gl === 'number' ? d.remaining.gl : null
  const lines: ReceiptLine[] = m.items.map((it) => ({
    foodId: it.foodId, name: it.name,
    portion: it.servings ? `${it.servings} serving${it.servings === 1 ? '' : 's'}` : `${it.grams} g`,
    availableCarbs: it.availableCarbs, gi: it.gi, gl: it.gl,
    kcal: it.kcal, carbs: it.carbs, fiber: it.fiber, protein: it.protein, fat: it.fat,
    grams: it.grams, servings: it.servings,
  }))
  return {
    lines, total: m.totals.gl, leftBefore,
    leftAfter: leftBefore === null ? null : Math.round((leftBefore - m.totals.gl) * 10) / 10,
  }
}
