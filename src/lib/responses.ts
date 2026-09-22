/**
 * Evaluation dataset capture (Lab 3.2).
 *
 * Every successful agent exchange is appended to localStorage and can be
 * exported as `config.json` — the dataset Azure AI Foundry evaluates. The
 * lab's shape is `{ question, response }`; we add `context` (the tool results
 * the answer was built from) so Groundedness has something real to check
 * against, plus `verified` and `blocked` so rows can be filtered by dimension.
 * No server is involved.
 */
import type { AgentResponse } from './agent'

const KEY = 'diabite.responses.v1'

export interface SavedResponse {
  question: string
  response: string
  /** Tool results the answer was grounded in, as JSON text (empty for refusals). */
  context: string
  verified: boolean
  blocked: boolean
  savedAt: string
}

function read(): SavedResponse[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SavedResponse[]) : []
  } catch {
    return []
  }
}

/** Compact the trace to what a grader needs: tool name and its (unwrapped) result. */
function contextOf(reply: AgentResponse): string {
  if (!reply.trace?.length) return ''
  const steps = reply.trace.map((t) => ({
    tool: t.tool,
    result: Array.isArray(t.result) && t.result.length === 1 ? t.result[0] : t.result,
  }))
  return JSON.stringify(steps)
}

/** Append one successful exchange. Returns the new count, or the old one if storage is unavailable. */
export function saveResponse(question: string, reply: AgentResponse): number {
  const all = read()
  all.push({
    question,
    response: reply.answer,
    context: contextOf(reply),
    verified: reply.verified === true,
    blocked: reply.blocked === true,
    savedAt: new Date().toISOString(),
  })
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // storage unavailable: the app still works, the dataset just isn't kept
  }
  return all.length
}

export function savedCount(): number {
  return read().length
}

/** Trigger a browser download of every saved exchange as config.json. */
export function downloadResponses(): void {
  const rows = read().map(({ question, response, context, verified, blocked }) => ({ question, response, context, verified, blocked }))
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'config.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke after the browser has started the download, not before.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
