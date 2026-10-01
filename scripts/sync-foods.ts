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
 * It needs a privileged key because the table is readable by everyone and
 * writable by nobody. Either works, and both belong in .env.local, which is
 * gitignored:
 *
 *   SUPABASE_SERVICE_KEY  a secret key (sb_secret_…) — Project Settings → API
 *                         Keys. Writes over PostgREST, no database password.
 *   SUPABASE_DB_URL       a connection string — Project Settings → Database.
 *                         Faster for a full rewrite, and the only way to drop
 *                         stale rows in one statement.
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import postgres from 'postgres'
import { loadFoods } from '../server/foods'

type Row = Record<string, unknown>

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BIN = join(ROOT, 'data', 'recipes-db', 'embeddings.bin')
const IDS = join(ROOT, 'data', 'recipes-db', 'embeddings.ids.json')
const DIM = 384
const BATCH = 200

/** Env first, then .env.local, which is where these live during development. */
function fromEnvOrFile(name: string): string | undefined {
  if (process.env[name]) return process.env[name]
  const local = join(ROOT, '.env.local')
  if (!existsSync(local)) return undefined
  const line = readFileSync(local, 'utf8').split('\n').find((l) => l.startsWith(`${name}=`))
  return line?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '')
}

function credentials(): { dbUrl?: string; restUrl?: string; serviceKey?: string } {
  const dbUrl = fromEnvOrFile('SUPABASE_DB_URL')
  const serviceKey = fromEnvOrFile('SUPABASE_SERVICE_KEY')
  const restUrl = fromEnvOrFile('SUPABASE_URL')
  if (dbUrl || (serviceKey && restUrl)) return { dbUrl, restUrl, serviceKey }
  console.error(
    'No privileged credentials found.\n' +
    'Add ONE of these to .env.local (gitignored):\n' +
    '  SUPABASE_SERVICE_KEY=sb_secret_…   (Project Settings → API Keys) plus SUPABASE_URL\n' +
    '  SUPABASE_DB_URL=postgresql://…     (Project Settings → Database → Connection string)',
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

const creds = credentials()

/** PostgREST upsert, for when only a secret key is at hand. */
async function pushOverRest(rows: Row[]): Promise<void> {
  const { restUrl, serviceKey } = creds
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const res = await fetch(`${restUrl}/rest/v1/foods?on_conflict=id`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: serviceKey!,
        authorization: `Bearer ${serviceKey}`,
        prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(chunk),
    })
    if (!res.ok) throw new Error(`upsert failed: ${res.status} ${(await res.text()).slice(0, 200)}`)
    process.stdout.write(`\r  upserted ${Math.min(i + BATCH, rows.length)}/${rows.length}`)
  }
  process.stdout.write('\n')

  // Stale rows, deleted by the ids that should no longer be there. PostgREST
  // has no "delete where not in this list", so the list is computed here —
  // and it has to be read a page at a time, because an unpaginated select
  // stops at a thousand rows without saying so. Unpaginated, this read saw
  // the first thousand ids, found almost all of them still wanted, deleted
  // nothing, and printed success: 813 withdrawn foods stayed in the table and
  // the engine went on serving them, which is how a pizza the catalogue no
  // longer held came back costed at a glycemic load of zero.
  const have: { id: string }[] = []
  for (let from = 0; ; from += 1000) {
    const page = await fetch(`${restUrl}/rest/v1/foods?select=id&order=id&offset=${from}&limit=1000`, {
      headers: { apikey: serviceKey!, authorization: `Bearer ${serviceKey}` },
    }).then((r) => r.json() as Promise<{ id: string }[]>)
    have.push(...page)
    if (page.length < 1000) break
  }
  const wanted = new Set(rows.map((r) => r.id as string))
  const stale = have.map((r) => r.id).filter((id) => !wanted.has(id))
  for (let i = 0; i < stale.length; i += BATCH) {
    const chunk = stale.slice(i, i + BATCH).map((id) => `"${id}"`).join(',')
    const res = await fetch(`${restUrl}/rest/v1/foods?id=in.(${encodeURIComponent(chunk)})`, {
      method: 'DELETE',
      headers: { apikey: serviceKey!, authorization: `Bearer ${serviceKey}`, prefer: 'return=minimal' },
    })
    if (!res.ok) throw new Error(`delete failed: ${res.status} ${(await res.text()).slice(0, 200)}`)
  }
  console.log(`synced ${rows.length} records${stale.length ? `, removed ${stale.length} stale` : ''} over PostgREST; the table held ${have.length} before`)
}

/**
 * Where a record's numbers come from, and when anyone last checked them.
 *
 * The cross-check file is the only real verification this data has had: 88
 * ingredient GI values compared against published tables. Everything else is
 * unverified, and says so rather than borrowing the credibility of the ones
 * that were checked.
 */
const CROSSCHECK = join(ROOT, 'data', 'recipes-db', 'gi_crosscheck.json')
const checked = new Map<string, string>()
if (existsSync(CROSSCHECK)) {
  const when = new Date(statSync(CROSSCHECK).mtime).toISOString().slice(0, 10)
  for (const row of JSON.parse(readFileSync(CROSSCHECK, 'utf8')) as { key: string; flag: string }[]) {
    if (row.flag === '') checked.set(`ing:${row.key}`, when)
  }
}

function provenance(id: string): { source: string; verified_at: string | null } {
  if (id.startsWith('rec:')) {
    return {
      source: 'Computed from its ingredients: nutrients summed, glycemic index as a carbohydrate-weighted mean (Wolever & Jenkins).',
      verified_at: null,
    }
  }
  if (id.startsWith('seed:')) {
    return { source: 'Seed food table: published averages for everyday US foods.', verified_at: null }
  }
  return {
    source: 'Nutrients from USDA FoodData Central; glycemic index from the International Tables of Glycemic Index (2021).',
    verified_at: checked.get(id) ?? null,
  }
}

const rows: Row[] = ids.map((id, i) => {
  const r = byId.get(id)!
  return {
    id,
    kind: r.kind,
    name: r.name,
    category: r.category ?? null,
    cuisine: r.cuisine ?? null,
    gi: r.gi ?? null,
    unit: r.unit ?? null,
    default_portion: r.defaultPortion ?? null,
    aliases: r.aliases ?? [],
    ingredient_names: r.ingredientNames ?? [],
    search_text: r.searchText,
    per100: r.per100 ?? null,
    per_serving: r.perServing ?? null,
    ...provenance(id),
    embedding: literal(i),
  }
})

if (creds.dbUrl) {
  // The connection string does the whole thing in two statements, including
  // dropping rows that no longer exist.
  const sql = postgres(creds.dbUrl, { prepare: false })
  try {
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH)
      await sql`
        insert into public.foods ${sql(chunk as never[], 'id', 'kind', 'name', 'category', 'cuisine', 'gi', 'unit', 'default_portion', 'aliases', 'ingredient_names', 'search_text', 'per100', 'per_serving', 'source', 'verified_at', 'embedding')}
        on conflict (id) do update set
          kind = excluded.kind, name = excluded.name, category = excluded.category,
          cuisine = excluded.cuisine, gi = excluded.gi, unit = excluded.unit,
          default_portion = excluded.default_portion, aliases = excluded.aliases,
          ingredient_names = excluded.ingredient_names, search_text = excluded.search_text,
          per100 = excluded.per100, per_serving = excluded.per_serving,
          source = excluded.source, verified_at = excluded.verified_at,
          embedding = excluded.embedding, updated_at = now()
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
} else {
  await pushOverRest(rows)
}
