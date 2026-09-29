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

/**
 * Upload every dataset before scoring any of it.
 *
 * Scoring a run takes tens of minutes, and uploading the second file only
 * when the first has finished means a run of eval/run-cases.ts in between
 * swaps the data underneath — which is how one comparison here ended up
 * scoring nine rows against the other's seventy.
 */
const uploaded = new Map<string, string>()
async function upload(dataset: string) {
  const file = await openai.files.create({
    file: createReadStream(join(ROOT, 'eval', dataset)),
    purpose: 'evals' as never,
  })
  uploaded.set(dataset, file.id)
  console.log(`uploaded ${dataset} as ${file.id}`)
}

async function score(dataset: string, label: string, criteria: unknown[]) {
  const fileId = uploaded.get(dataset)!
  const evaluation = await openai.evals.create({
    name: `diabite-${label}-${new Date().toISOString().slice(0, 16)}`,
    data_source_config: { type: 'custom', item_schema: { type: 'object' }, include_sample_schema: false } as never,
    testing_criteria: criteria as never,
  })
  const run = await openai.evals.runs.create(evaluation.id, {
    name: label,
    data_source: { type: 'jsonl', source: { type: 'file_id', id: fileId } } as never,
  } as never)
  console.log(`\n${label}: ${dataset}`)

  let status = String(run.status)
  for (let i = 0; i < 180 && !['completed', 'failed', 'canceled'].includes(status); i++) {
    await new Promise((r) => setTimeout(r, 10_000))
    status = String((await openai.evals.runs.retrieve(run.id, { eval_id: evaluation.id })).status)
  }
  const final = await openai.evals.runs.retrieve(run.id, { eval_id: evaluation.id })
  console.log('  status:', final.status)
  console.log('  report:', (final as { report_url?: string }).report_url ?? '(no url)')
  console.log(`  ids: ${evaluation.id} ${run.id}`)

  const items = await openai.evals.runs.outputItems.list(run.id, { eval_id: evaluation.id, limit: 100 } as never)
  const by: Record<string, { pass: number; fail: number; scores: number[]; failed: string[] }> = {}
  for await (const raw of items) {
    const it = raw as { datasource_item?: { id?: string }; results?: { name: string; passed?: boolean; score?: number }[] }
    for (const r of it.results ?? []) {
      const b = (by[r.name] ??= { pass: 0, fail: 0, scores: [], failed: [] })
      if (r.passed) b.pass++
      else { b.fail++; b.failed.push(String(it.datasource_item?.id ?? '?')) }
      if (typeof r.score === 'number') b.scores.push(r.score)
    }
  }
  for (const [name, b] of Object.entries(by)) {
    const mean = b.scores.length ? (b.scores.reduce((s, x) => s + x, 0) / b.scores.length).toFixed(2) : '—'
    console.log(`  ${name.padEnd(20)} ${b.pass}/${b.pass + b.fail} pass   mean ${mean}${b.failed.length ? '   failed: ' + b.failed.join(', ') : ''}`)
  }
}

await upload('foundry-dataset.jsonl')
await upload('foundry-dataset-tools.jsonl')

// Every row can be judged on whether the agent understood the ask and obeyed
// its instructions — including the refusals, where obeying is the whole point.
await score('foundry-dataset.jsonl', 'all', [
  criterion('intent_resolution', 'builtin.intent_resolution', { query: '{{item.query}}', response: '{{item.response}}' }),
  criterion('task_adherence', 'builtin.task_adherence', { query: '{{item.query}}', response: '{{item.response}}' }),
])

// Only rows that used tools can be judged on how they used them.
await score('foundry-dataset-tools.jsonl', 'tools', [
  criterion('tool_call_accuracy', 'builtin.tool_call_accuracy', {
    query: '{{item.query}}', response: '{{item.response}}', tool_definitions: '{{item.tool_definitions}}',
  }),
  criterion('groundedness', 'builtin.groundedness', {
    query: '{{item.query_text}}', response: '{{item.output_text}}', context: '{{item.context}}',
  }),
])
