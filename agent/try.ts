/** Ad-hoc: run one turn against the Foundry agent and print the result. */
import { ask } from '../server/agent'

const r = await ask({
  sessionId: 'try-' + Date.now(),
  message: process.argv[2] ?? 'I want a bowl of oatmeal with a banana. Can I have it?',
  budget: { glBudget: 48, carbsG: 107, kcal: 1653 },
  entries: [{ foodId: 'seed:rice-white', grams: 180 }, { foodId: 'seed:chicken', grams: 150 }],
})
console.log('--- ANSWER ---\n' + r.answer)
console.log('\nattempts:', r.attempts, '| templated:', r.templated, '| blocked:', r.blocked, '| verified:', r.verified)
console.log('matched:', JSON.stringify(r.matchedNumbers), '| unmatched:', JSON.stringify(r.unmatchedNumbers))
console.log('tool calls:', r.toolCalls)
for (const t of r.trace) {
  const res = JSON.stringify(t.result)
  console.log(`  - ${t.tool}  in=${JSON.stringify(t.input)}  out=${res?.slice(0, 110)}`)
}
