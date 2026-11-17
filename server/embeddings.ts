/**
 * Embeddings and the vector index behind resolve_foods and find_alternatives.
 *
 * The embedder runs a small sentence model locally (no key, no network after the
 * first download). The store is an in-memory cosine index over ~1,350 vectors —
 * small enough that brute force beats any ANN structure. `VectorStore` is the
 * seam: swap MemoryVectorStore for pgvector or Qdrant without touching callers.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'
import { adoptCatalogue, type FoodRecord } from './foods'
import { PgVectorStore, pgConfigFromEnv } from './pg-store'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')
env.cacheDir = join(ROOT, '.cache', 'transformers')

const MODEL = 'Xenova/all-MiniLM-L6-v2'
const DIM = 384

let extractor: Promise<FeatureExtractionPipeline> | null = null

async function getExtractor() {
  if (!extractor) extractor = pipeline('feature-extraction', MODEL, { dtype: 'fp32' })
  return extractor
}

export async function embed(texts: string[]): Promise<Float32Array[]> {
  const ex = await getExtractor()
  const out = await ex(texts, { pooling: 'mean', normalize: true })
  const flat = out.data as Float32Array
  return texts.map((_, i) => flat.slice(i * DIM, (i + 1) * DIM))
}

export interface SearchHit { id: string; score: number }

/**
 * Where vectors live.
 *
 * Async because one implementation is a database: the in-memory one answers
 * immediately and simply resolves.
 */
export interface VectorStore {
  search(query: Float32Array, k: number, filter?: (id: string) => boolean): Promise<SearchHit[]>
  vectorOf(id: string): Promise<Float32Array | undefined>
}

export class MemoryVectorStore implements VectorStore {
  private index = new Map<string, number>()
  constructor(readonly ids: string[], readonly vectors: Float32Array) {
    ids.forEach((id, i) => this.index.set(id, i))
  }

  async vectorOf(id: string) {
    const i = this.index.get(id)
    return i === undefined ? undefined : this.vectors.subarray(i * DIM, (i + 1) * DIM)
  }

  async search(query: Float32Array, k: number, filter?: (id: string) => boolean): Promise<SearchHit[]> {
    const hits: SearchHit[] = []
    for (let i = 0; i < this.ids.length; i++) {
      const id = this.ids[i]
      if (filter && !filter(id)) continue
      const off = i * DIM
      let dot = 0
      for (let d = 0; d < DIM; d++) dot += query[d] * this.vectors[off + d]
      hits.push({ id, score: dot })
    }
    hits.sort((a, b) => b.score - a.score)
    return hits.slice(0, k)
  }
}

const BIN = join(ROOT, 'data', 'recipes-db', 'embeddings.bin')
const IDS = join(ROOT, 'data', 'recipes-db', 'embeddings.ids.json')

/** Load the persisted index if it matches the current records, else build and persist it. */
/**
 * The store the engine will use.
 *
 * The embedded index is built or loaded either way — it is the fallback, and it
 * costs 2 MB in the image. If a Supabase project is configured and answers a
 * probe, queries go there; if it does not, the engine says so once and runs on
 * the embedded index, which is the same data.
 */
export async function openStore(records: FoodRecord[], log = console.log): Promise<VectorStore> {
  const memory = await loadOrBuildIndex(records, log)
  const cfg = pgConfigFromEnv()
  if (!cfg) return memory
  const pg = new PgVectorStore(cfg, memory, log)
  if (!(await pg.check())) return memory

  // The catalogue comes from the same place as the vectors, or from neither:
  // a build searching the database's ids against the image's records is the
  // mismatch that skips foods silently.
  try {
    await adoptCatalogue(await pg.catalogue(), log)
  } catch (e) {
    log(`[foods] could not read the catalogue (${(e as Error).message}) — keeping the one from the image`)
  }
  log('vector search: Supabase pgvector, with the embedded index as fallback')
  return pg
}

export async function loadOrBuildIndex(records: FoodRecord[], log = console.log, files: { bin: string; ids: string } = { bin: BIN, ids: IDS }): Promise<VectorStore> {
  const wantIds = records.map((r) => r.id)
  let reuse = 0   // how many leading records already have their vector in the file
  let cached: Float32Array | null = null
  if (existsSync(files.bin) && existsSync(files.ids)) {
    const ids = JSON.parse(readFileSync(files.ids, 'utf8')) as string[]
    const buf = readFileSync(files.bin)
    const vectors = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
    if (ids.length === wantIds.length && ids.every((id, i) => id === wantIds[i])) {
      log(`vector index loaded: ${ids.length} vectors`)
      return new MemoryVectorStore(ids, vectors)
    }
    // Records added at the END of the catalogue (a new kind of food is appended) keep every vector already in the file:
    // rebuilding all of them moves two near-tied foods past each other (it did, on 17 November, for "Potato, boiled" and
    // "chick-fil-a sandwich"), so adding a food must not change how the others are found. Any other change (a record
    // removed, moved or renamed in the list) still rebuilds everything.
    if (ids.length < wantIds.length && vectors.length === ids.length * DIM && ids.every((id, i) => id === wantIds[i])) { reuse = ids.length; cached = vectors }
  }
  const t0 = Date.now()
  const vectors = new Float32Array(records.length * DIM)
  if (cached) vectors.set(cached)
  const BATCH = 32
  for (let i = reuse; i < records.length; i += BATCH) {
    const chunk = records.slice(i, Math.min(i + BATCH, records.length))
    const vs = await embed(chunk.map((r) => r.searchText))
    vs.forEach((v, j) => vectors.set(v, (i + j) * DIM))
  }
  writeFileSync(files.bin, Buffer.from(vectors.buffer))
  writeFileSync(files.ids, JSON.stringify(wantIds))
  log(`vector index ${reuse ? `extended by ${records.length - reuse} (${reuse} kept)` : 'built'}: ${records.length} vectors in ${Date.now() - t0} ms`)
  return new MemoryVectorStore(wantIds, vectors)
}
