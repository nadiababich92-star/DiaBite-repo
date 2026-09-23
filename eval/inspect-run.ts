/** Per-row evaluator verdicts and reasons, so a score can be read rather than quoted. */
import { AIProjectClient } from '@azure/ai-projects'
import { DefaultAzureCredential } from '@azure/identity'

const [, , evalId, runId] = process.argv
const project = new AIProjectClient(process.env.PROJECT_ENDPOINT!, new DefaultAzureCredential())
const openai = project.getOpenAIClient()

const items = await openai.evals.runs.outputItems.list(runId, { eval_id: evalId, limit: 100 } as never)
for await (const raw of items) {
  const it = raw as { datasource_item?: Record<string, unknown>; results?: { name: string; passed?: boolean; score?: number; reason?: string; sample?: unknown }[] }
  const id = it.datasource_item?.id ?? '?'
  const blocked = it.datasource_item?.blocked
  console.log(`\n──── ${id}${blocked ? '  (blocked)' : ''}`)
  for (const r of it.results ?? []) {
    const reason = (r.reason ?? (r as { sample?: { reason?: string } }).sample?.reason ?? '').replace(/\s+/g, ' ')
    console.log(`  ${r.name.padEnd(20)} ${r.passed ? 'pass' : 'FAIL'} ${r.score ?? ''}  ${reason.slice(0, 190)}`)
  }
}
