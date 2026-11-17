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
import { DIM, MODEL, readTextHashes, serializeTextHashes, textHash } from './index-hash'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')
env.cacheDir = join(ROOT, '.cache', 'transformers')


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
const TEXT = join(ROOT, 'data', 'recipes-db', 'embeddings.text.json')

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

/**
 * Load the persisted index, embedding again only what no longer matches.
 *
 * A stored vector is reused when its id is in the file AND the hash of the text it was made from (embeddings.text.json)
 * equals the hash of the record's current `searchText`. A record whose text changed is embedded again; one that is new is
 * embedded; one taken out or moved simply is not copied. Everything else is byte-for-byte what was in the file, so adding
 * or rewording one food cannot change how the others are found (rebuilding all of them moved two near-tied foods past each
 * other on 17 November). Before this, the file was accepted whenever its id list matched, and 48 vectors had drifted from
 * their text without anything noticing.
 *
 * With no hash file (an index written before it existed) nothing can be vouched for: a file whose ids match is loaded as it
 * is, with a warning, and any other change rebuilds everything and writes the hash file.
 */
export async function loadOrBuildIndex(records: FoodRecord[], log = console.log, files: { bin: string; ids: string; text: string } = { bin: BIN, ids: IDS, text: TEXT }): Promise<VectorStore> {
  const wantIds = records.map((r) => r.id)
  let stored: { pos: Map<string, number>; vectors: Float32Array; ids: string[] } | null = null
  if (existsSync(files.bin) && existsSync(files.ids)) {
    const ids = JSON.parse(readFileSync(files.ids, 'utf8')) as string[]
    const buf = readFileSync(files.bin)
    const vectors = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
    if (vectors.length === ids.length * DIM) stored = { pos: new Map(ids.map((id, i) => [id, i])), vectors, ids }
  }
  const hashes = readTextHashes(files.text)
  const sameIds = !!stored && stored.ids.length === wantIds.length && stored.ids.every((id, i) => id === wantIds[i])

  if (stored && !hashes) {
    if (sameIds) {
      log(`vector index loaded: ${stored.ids.length} vectors — NOT checked against the records' text, there is no ${files.text.split('/').pop()}`)
      return new MemoryVectorStore(stored.ids, stored.vectors)
    }
    stored = null   // nothing in the file can be vouched for: embed everything and write the hashes
  }

  const t0 = Date.now()
  const vectors = new Float32Array(records.length * DIM)
  const todo: number[] = []
  records.forEach((r, i) => {
    const at = stored?.pos.get(r.id)
    if (stored && hashes && at !== undefined && hashes[r.id] === textHash(r.searchText)) vectors.set(stored.vectors.subarray(at * DIM, (at + 1) * DIM), i * DIM)
    else todo.push(i)
  })
  if (todo.length === 0 && sameIds) {
    log(`vector index loaded: ${wantIds.length} vectors`)
    return new MemoryVectorStore(wantIds, vectors)
  }
  const BATCH = 32
  for (let b = 0; b < todo.length; b += BATCH) {
    const chunk = todo.slice(b, b + BATCH)
    const vs = await embed(chunk.map((i) => records[i].searchText))
    vs.forEach((v, j) => vectors.set(v, chunk[j] * DIM))
  }
  writeFileSync(files.bin, Buffer.from(vectors.buffer))
  writeFileSync(files.ids, JSON.stringify(wantIds))
  writeFileSync(files.text, serializeTextHashes(records))
  const kept = records.length - todo.length
  log(`vector index ${kept ? `updated: ${todo.length} embedded, ${kept} kept` : 'built'}: ${records.length} vectors in ${Date.now() - t0} ms`)
  return new MemoryVectorStore(wantIds, vectors)
}
