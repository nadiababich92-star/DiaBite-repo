/**
 * Push the food index into Supabase.
 *
 *   SUPABASE_DB_URL=postgresql://… npx tsx scripts/sync-foods.ts
 *
 * The repository stays the source of truth: records come from the same loader
 * the engine uses and vectors from the same `embeddings.bin`, so the table is a
 * materialised copy and never a second opinion. Run it after any change to the
 * food data or to the embedding model; it is idempotent, and it deletes rows
 * that no longer exist so a removed food cannot linger in search results.
 *
 * It needs a privileged connection because the table is readable by everyone
 * and writable by nobody: get the URI from Supabase → Project Settings →
 * Database → Connection string → URI, and keep it in .env.local, which is
 * gitignored.
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import postgres from 'postgres'
import { loadFoods } from '../server/foods'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BIN = join(ROOT, 'data', 'recipes-db', 'embeddings.bin')
const IDS = join(ROOT, 'data', 'recipes-db', 'embeddings.ids.json')
const DIM = 384
const BATCH = 200

function connectionString(): string {
  const fromEnv = process.env.SUPABASE_DB_URL
  if (fromEnv) return fromEnv
  const local = join(ROOT, '.env.local')
  if (existsSync(local)) {
    const line = readFileSync(local, 'utf8').split('\n').find((l) => l.startsWith('SUPABASE_DB_URL='))
    if (line) return line.slice('SUPABASE_DB_URL='.length).trim().replace(/^["']|["']$/g, '')
  }
  console.error(
    'SUPABASE_DB_URL is not set.\n' +
    'Supabase → Project Settings → Database → Connection string → URI,\n' +
    'then add it to .env.local as SUPABASE_DB_URL=postgresql://…  (.env.local is gitignored).',
  )
  process.exit(1)
}

const { records } = loadFoods()
if (!existsSync(BIN) || !existsSync(IDS)) {
  console.error(`no embedding index at ${BIN} — run the engine once to build it`)
  process.exit(1)
}
const ids = JSON.parse(readFileSync(IDS, 'utf8')) as string[]
const buf = readFileSync(BIN)
const vectors = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
if (ids.length * DIM !== vectors.length) {
  console.error(`index mismatch: ${ids.length} ids but ${vectors.length / DIM} vectors`)
  process.exit(1)
}
const byId = new Map(records.map((r) => [r.id, r]))
const missing = ids.filter((id) => !byId.has(id))
if (missing.length) {
  console.error(`the index holds ${missing.length} ids the food table does not, e.g. ${missing[0]} — rebuild the index first`)
  process.exit(1)
}

// pgvector accepts its text form; six decimals is well inside float32's precision
// and keeps the statement a third of the size.
const literal = (i: number) =>
  `[${Array.from(vectors.subarray(i * DIM, (i + 1) * DIM), (v) => v.toFixed(6)).join(',')}]`

const sql = postgres(connectionString(), { prepare: false })

try {
  const rows = ids.map((id, i) => {
    const r = byId.get(id)!
    return {
      id,
      kind: r.kind,
      name: r.name,
      category: r.category ?? null,
      gi: r.gi ?? null,
      unit: r.unit ?? null,
      default_portion: r.defaultPortion ?? null,
      aliases: r.aliases ?? [],
      ingredient_names: r.ingredientNames ?? [],
      search_text: r.searchText,
      embedding: literal(i),
    }
  })

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    await sql`
      insert into public.foods ${sql(chunk, 'id', 'kind', 'name', 'category', 'gi', 'unit', 'default_portion', 'aliases', 'ingredient_names', 'search_text', 'embedding')}
      on conflict (id) do update set
        kind = excluded.kind, name = excluded.name, category = excluded.category,
        gi = excluded.gi, unit = excluded.unit, default_portion = excluded.default_portion,
        aliases = excluded.aliases, ingredient_names = excluded.ingredient_names,
        search_text = excluded.search_text, embedding = excluded.embedding,
        updated_at = now()
    `
    process.stdout.write(`\r  upserted ${Math.min(i + BATCH, rows.length)}/${rows.length}`)
  }
  process.stdout.write('\n')

  const [{ count: gone }] = await sql<{ count: number }[]>`
    with removed as (delete from public.foods where id <> all(${ids}) returning 1)
    select count(*)::int as count from removed
  `
  const [{ count: total }] = await sql<{ count: number }[]>`select count(*)::int as count from public.foods`
  console.log(`synced ${rows.length} records${gone ? `, removed ${gone} stale` : ''}; table now holds ${total}`)
} finally {
  await sql.end()
}
