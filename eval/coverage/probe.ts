import { loadFoods } from '../../server/foods'
import { openStore } from '../../server/embeddings'
import { resolvePhrases } from '../../server/resolve'
const { records } = loadFoods(); const store = await openStore(records, () => {})
const r = await resolvePhrases(store, process.argv.slice(2), 5)
for (const x of r) console.log(x.phrase, '|', x.confidence, '|', x.clarify ?? '', '\n   ', x.candidates.map((c) => `${c.id} ${c.name} ${c.score}`).join('\n    '))
