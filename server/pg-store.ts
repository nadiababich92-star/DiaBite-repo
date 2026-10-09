/**
 * The food index in Postgres, with the embedded index as the floor.
 *
 * Why at all, when 1,436 vectors search in five milliseconds in memory: the
 * table can be updated without rebuilding the image, which matters because
 * food coverage is the thing that will change most often; and the filters that
 * used to run in application code after over-fetching can run in the query.
 *
 * Why with a fallback: a free Supabase project pauses after a week of quiet,
 * and a paused database on demo day would mean no answers at all. The embedded
 * index ships in the image regardless, so a slow or sleeping database costs a
 * few hundred milliseconds and nothing else. Every fallback is logged — a
 * silent fallback would mean we never learn the database is down.
 */
import type { SearchHit, VectorStore } from './embeddings'

const DIM = 384

export interface PgStoreConfig {
  url: string
  key: string
  /**
   * Past this, the query is abandoned and the in-memory index answers.
   * Measured cross-region: median 72 ms, worst seen 415 ms, so the default
   * leaves room for a cold connection without waiting on a sleeping project.
   */
  timeoutMs?: number
}

export function pgConfigFromEnv(): PgStoreConfig | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
  return url && key ? { url, key } : null
}

export class PgVectorStore implements VectorStore {
  private failures = 0
  constructor(private cfg: PgStoreConfig, private fallback: VectorStore, private log = console.log) {}

  private async rpc<T>(fn: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.cfg.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: this.cfg.key,
        authorization: `Bearer ${this.cfg.key}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.cfg.timeoutMs ?? 1500),
    })
    if (!res.ok) throw new Error(`${fn}: ${res.status} ${(await res.text()).slice(0, 120)}`)
    return (await res.json()) as T
  }

  /** pgvector's text form, and what the RPC expects back. */
  private literal = (v: Float32Array) => `[${Array.from(v, (x) => x.toFixed(6)).join(',')}]`

  private fell(where: string, e: unknown) {
    this.failures++
    // Once per outage, not once per query: a sleeping project would otherwise
    // fill the log and hide everything else in it.
    if (this.failures === 1 || this.failures % 50 === 0) {
      this.log(`[pg-store] ${where} fell back to the embedded index (${this.failures}): ${(e as Error).message}`)
    }
  }

  async search(query: Float32Array, k: number, filter?: (id: string) => boolean): Promise<SearchHit[]> {
    try {
      // Filtering by predicate stays in the caller: the rules behind it —
      // allergens, "not the food we are replacing" — are the engine's, and a
      // round trip is not worth splitting them across two languages. The query
      // over-fetches a little so a filtered-out row does not shorten the list.
      const rows = await this.rpc<{ id: string; score: number }[]>('match_foods', {
        query_embedding: this.literal(query),
        match_count: filter ? Math.min(200, k * 4) : k,
      })
      const hits = rows.filter((r) => !filter || filter(r.id)).slice(0, k)
      this.failures = 0
      return hits
    } catch (e) {
      this.fell('search', e)
      return this.fallback.search(query, k, filter)
    }
  }

  async vectorOf(id: string): Promise<Float32Array | undefined> {
    try {
      const text = await this.rpc<string | null>('food_embedding', { food_id: id })
      if (!text) return undefined
      const nums = text.replace(/^\[|\]$/g, '').split(',').map(Number)
      if (nums.length !== DIM) throw new Error(`expected ${DIM} dimensions, got ${nums.length}`)
      this.failures = 0
      return Float32Array.from(nums)
    } catch (e) {
      this.fell('vectorOf', e)
      return this.fallback.vectorOf(id)
    }
  }

  /**
   * Every record, without the vectors — 1,436 rows of JSON, one request.
   *
   * The embeddings stay out of it: they are 2 MB of float text that the engine
   * already has in the image, and it needs them only to search, which the
   * database does.
   */
  async catalogue(): Promise<unknown[]> {
    const cols = 'id,kind,name,category,cuisine,gi,unit,default_portion,aliases,ingredient_names,search_text,per100,per_serving,source,verified_at'
    // PostgREST caps a response at 1,000 rows and says nothing about it, which
    // is how a 1,436-record catalogue quietly became 1,000. Pages until a page
    // comes back short.
    const PAGE = 1000
    const all: unknown[] = []
    // A proxy that ignores Range would hand back the same full page forever; the cap
    // (100,000 rows) is far beyond any catalogue and turns that into an error.
    for (let from = 0; ; from += PAGE) {
      if (from >= 100 * PAGE) throw new Error('catalogue: more than 100 pages, is Range being ignored?')
      const res = await fetch(`${this.cfg.url}/rest/v1/foods?select=${cols}&order=id`, {
        headers: {
          apikey: this.cfg.key,
          authorization: `Bearer ${this.cfg.key}`,
          range: `${from}-${from + PAGE - 1}`,
        },
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) throw new Error(`catalogue: ${res.status} ${(await res.text()).slice(0, 120)}`)
      const page = (await res.json()) as unknown[]
      all.push(...page)
      if (page.length < PAGE) return all
    }
  }

  /** One query at startup, so a broken configuration is loud rather than gradual. */
  async check(): Promise<boolean> {
    try {
      const probe = new Float32Array(DIM)
      probe[0] = 1
      const rows = await this.rpc<{ id: string }[]>('match_foods', { query_embedding: this.literal(probe), match_count: 1 })
      return rows.length > 0
    } catch (e) {
      this.log(`[pg-store] unreachable at startup, using the embedded index: ${(e as Error).message}`)
      return false
    }
  }
}
