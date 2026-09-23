/**
 * Score the dataset with Foundry's built-in evaluators.
 *
 *   npx tsx eval/run-foundry.ts
 *
 * The judge is a model deployment in the same project; the system under test
 * is the agent that produced eval/foundry-dataset.jsonl. Judge and subject are
 * the same family here, which is worth remembering when reading the scores.
 */
import { createReadStream } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { AIProjectClient } from '@azure/ai-projects'
import { DefaultAzureCredential } from '@azure/identity'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const JUDGE = process.env.JUDGE_DEPLOYMENT ?? 'gpt-5-mini'

const project = new AIProjectClient(process.env.PROJECT_ENDPOINT!, new DefaultAzureCredential())
const openai = project.getOpenAIClient()

const criterion = (name: string, evaluator: string, mapping: Record<string, string>) => ({
  type: 'azure_ai_evaluator',
  name,
  evaluator_name: evaluator,
  initialization_parameters: { deployment_name: JUDGE },
  data_mapping: mapping,
})

const file = await openai.files.create({
  file: createReadStream(join(ROOT, 'eval', 'foundry-dataset.jsonl')),
  purpose: 'evals' as never,
})
console.log('dataset uploaded:', file.id)

const evaluation = await openai.evals.create({
  name: `diabite-agent-${new Date().toISOString().slice(0, 16)}`,
  data_source_config: { type: 'custom', item_schema: { type: 'object' }, include_sample_schema: false } as never,
  testing_criteria: [
    criterion('intent_resolution', 'builtin.intent_resolution', { query: '{{item.query}}', response: '{{item.response}}' }),
    criterion('task_adherence', 'builtin.task_adherence', { query: '{{item.query}}', response: '{{item.response}}' }),
    criterion('tool_call_accuracy', 'builtin.tool_call_accuracy', {
      query: '{{item.query}}', response: '{{item.response}}', tool_definitions: '{{item.tool_definitions}}',
    }),
    criterion('groundedness', 'builtin.groundedness', {
      query: '{{item.query}}', response: '{{item.output_text}}', context: '{{item.context}}',
    }),
  ] as never,
})
console.log('evaluation created:', evaluation.id)

const run = await openai.evals.runs.create(evaluation.id, {
  name: 'run-1',
  data_source: { type: 'jsonl', source: { type: 'file_id', id: file.id } } as never,
} as never)
console.log('run started:', run.id, '\n')

let status = run.status
for (let i = 0; i < 120 && !['completed', 'failed', 'canceled'].includes(String(status)); i++) {
  await new Promise((r) => setTimeout(r, 10_000))
  const cur = await openai.evals.runs.retrieve(run.id, { eval_id: evaluation.id })
  if (cur.status !== status) { status = cur.status; console.log('  status:', status) }
  const counts = (cur as { result_counts?: Record<string, number> }).result_counts
  if (counts) process.stdout.write(`\r  passed ${counts.passed ?? 0} / failed ${counts.failed ?? 0} / errored ${counts.errored ?? 0} of ${counts.total ?? '?'}   `)
}
console.log('\n')

const final = await openai.evals.runs.retrieve(run.id, { eval_id: evaluation.id })
console.log('final status:', final.status)
console.log('report:', (final as { report_url?: string }).report_url ?? '(no url)')
console.log(JSON.stringify((final as { result_counts?: unknown }).result_counts, null, 1))

const items = await openai.evals.runs.outputItems.list(run.id, { eval_id: evaluation.id, limit: 100 } as never)
const byCriterion: Record<string, { pass: number; fail: number; scores: number[] }> = {}
for await (const it of items) {
  for (const r of ((it as { results?: { name: string; passed?: boolean; score?: number }[] }).results ?? [])) {
    const b = (byCriterion[r.name] ??= { pass: 0, fail: 0, scores: [] })
    r.passed ? b.pass++ : b.fail++
    if (typeof r.score === 'number') b.scores.push(r.score)
  }
}
console.log('\n=== by criterion ===')
for (const [name, b] of Object.entries(byCriterion)) {
  const mean = b.scores.length ? (b.scores.reduce((s, x) => s + x, 0) / b.scores.length).toFixed(2) : '—'
  console.log(`  ${name.padEnd(22)} pass ${b.pass}/${b.pass + b.fail}   mean score ${mean}`)
}
