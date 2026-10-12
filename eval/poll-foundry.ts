/**
 * Wait for Foundry evaluation runs to finish and print the score of each evaluator.
 *
 *   PROJECT_ENDPOINT=... npx tsx eval/poll-foundry.ts <evalId>:<runId> [<evalId>:<runId> ...]
 *
 * eval/run-foundry.ts only queues the runs and prints their ids; this reads them back. Per-row reasons
 * come from eval/inspect-run.ts.
 */
import { AIProjectClient } from '@azure/ai-projects'
import { DefaultAzureCredential } from '@azure/identity'

const pairs = process.argv.slice(2).map((a) => a.split(':') as [string, string])
if (!pairs.length || !process.env.PROJECT_ENDPOINT) { console.error('usage: PROJECT_ENDPOINT=... poll-foundry.ts <evalId>:<runId> ...'); process.exit(2) }
const openai = new AIProjectClient(process.env.PROJECT_ENDPOINT, new DefaultAzureCredential()).getOpenAIClient()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Run {
  status: string
  result_counts?: { total: number; passed: number; failed: number; errored: number }
  per_testing_criteria_results?: { testing_criteria: string; passed: number; failed: number }[]
  report_url?: string
}

const pending = new Set(pairs.map((p) => p.join(':')))
const done = new Map<string, Run>()
for (let i = 0; i < 360 && pending.size; i++) {
  for (const key of [...pending]) {
    const [evalId, runId] = key.split(':')
    // Right after a run is queued the history service can answer 400 for a minute or so; that is a wait, not a failure.
    const run = await (openai.evals.runs.retrieve(runId, { eval_id: evalId } as never) as Promise<unknown>).then((r) => r as Run, () => null)
    if (run && ['completed', 'failed', 'canceled'].includes(run.status)) { pending.delete(key); done.set(key, run) }
  }
  if (pending.size) await sleep(20_000)
}
for (const [key, run] of done) {
  const c = run.result_counts
  console.log(`\n${key}  ${run.status}  ${c ? `${c.passed} passed, ${c.failed} failed, ${c.errored} errored of ${c.total}` : ''}`)
  for (const r of run.per_testing_criteria_results ?? []) console.log(`  ${r.testing_criteria.padEnd(22)} ${r.passed}/${r.passed + r.failed}`)
  if (run.report_url) console.log(`  report: ${run.report_url}`)
}
if (pending.size) console.log(`\nstill running: ${[...pending].join(', ')}`)
