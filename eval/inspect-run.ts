/**
 * Per-row evaluator verdicts and reasons, so a score can be read rather than
 * quoted.
 *
 *   npx tsx eval/inspect-run.ts <evalId> <runId> [evaluator]
 *
 * With an evaluator name, only that evaluator's failures are printed, and the
 * reason is printed whole. Truncated to a line it reads as a verdict; a
 * judge's reason is an argument, and the argument is where you find out
 * whether it caught a defect or misread the prompt.
 */
import { AIProjectClient } from '@azure/ai-projects'
import { DefaultAzureCredential } from '@azure/identity'

const [, , evalId, runId, only] = process.argv
const project = new AIProjectClient(process.env.PROJECT_ENDPOINT!, new DefaultAzureCredential())
const openai = project.getOpenAIClient()

const items = await openai.evals.runs.outputItems.list(runId, { eval_id: evalId, limit: 100 } as never)
for await (const raw of items) {
  const it = raw as { datasource_item?: Record<string, unknown>; results?: { name: string; passed?: boolean; score?: number; reason?: string; sample?: unknown }[] }
  const id = it.datasource_item?.id ?? '?'
  const blocked = it.datasource_item?.blocked
  const rows = (it.results ?? []).filter((r) => !only || (r.name === only && !r.passed))
  if (only && rows.length === 0) continue
  console.log(`\n──── ${id}${blocked ? '  (blocked)' : ''}`)
  for (const r of rows) {
    const reason = (r.reason ?? (r as { sample?: { reason?: string } }).sample?.reason ?? '').replace(/\s+/g, ' ')
    console.log(`  ${r.name.padEnd(20)} ${r.passed ? 'pass' : 'FAIL'} ${r.score ?? ''}  ${only ? '\n' + reason : reason.slice(0, 190)}`)
  }
}
