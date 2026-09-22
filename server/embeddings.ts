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
import type { FoodRecord } from './foods'

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

export interface VectorStore {
  search(query: Float32Array, k: number, filter?: (id: string) => boolean): SearchHit[]
  vectorOf(id: string): Float32Array | undefined
}

export class MemoryVectorStore implements VectorStore {
  private index = new Map<string, number>()
  constructor(readonly ids: string[], readonly vectors: Float32Array) {
    ids.forEach((id, i) => this.index.set(id, i))
  }

  vectorOf(id: string) {
    const i = this.index.get(id)
    return i === undefined ? undefined : this.vectors.subarray(i * DIM, (i + 1) * DIM)
  }

  search(query: Float32Array, k: number, filter?: (id: string) => boolean): SearchHit[] {
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
export async function loadOrBuildIndex(records: FoodRecord[], log = console.log): Promise<VectorStore> {
  const wantIds = records.map((r) => r.id)
  if (existsSync(BIN) && existsSync(IDS)) {
    const ids = JSON.parse(readFileSync(IDS, 'utf8')) as string[]
    if (ids.length === wantIds.length && ids.every((id, i) => id === wantIds[i])) {
      const buf = readFileSync(BIN)
      const vectors = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
      log(`vector index loaded: ${ids.length} vectors`)
      return new MemoryVectorStore(ids, vectors)
    }
  }
  const t0 = Date.now()
  const vectors = new Float32Array(records.length * DIM)
  const BATCH = 32
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH)
    const vs = await embed(chunk.map((r) => r.searchText))
    vs.forEach((v, j) => vectors.set(v, (i + j) * DIM))
  }
  writeFileSync(BIN, Buffer.from(vectors.buffer))
  writeFileSync(IDS, JSON.stringify(wantIds))
  log(`vector index built: ${records.length} vectors in ${Date.now() - t0} ms`)
  return new MemoryVectorStore(wantIds, vectors)
}
