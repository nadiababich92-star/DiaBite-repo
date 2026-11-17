/**
 * Which text each stored vector was made from.
 *
 * `embeddings.bin` holds one vector per record, and `embeddings.ids.json` says which record each belongs to. Neither says
 * what TEXT the vector was made from, so when a record's `searchText` changed (an alias added, a name reworded) the index
 * was still accepted as "matching" because the id list was the same, and the vector went on describing the old text. On
 * 17 November 48 of 8,659 vectors were found that way, some of them only 0.69 similar to their own current text.
 *
 * `embeddings.text.json` closes that: for every id, a short hash of the exact `searchText` its vector was embedded from,
 * plus the model and dimension. A vector is reused only when its record's current hash equals the stored one; anything else
 * is embedded again. It lives here, apart from embeddings.ts, so the sync script can check it without loading the model.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

export const MODEL = 'Xenova/all-MiniLM-L6-v2'
export const DIM = 384

export interface TextHashes { model: string; dim: number; hashes: Record<string, string> }

export const textHash = (text: string): string => createHash('sha1').update(text).digest('hex').slice(0, 16)

/** The sidecar, or null when there is none or it was written for another model — in both cases nothing can be vouched for. */
export function readTextHashes(path: string): Record<string, string> | null {
  if (!existsSync(path)) return null
  try {
    const t = JSON.parse(readFileSync(path, 'utf8')) as TextHashes
    return t.model === MODEL && t.dim === DIM && t.hashes && typeof t.hashes === 'object' ? t.hashes : null
  } catch { return null }
}

export function serializeTextHashes(records: { id: string; searchText: string }[]): string {
  const hashes: Record<string, string> = {}
  for (const r of records) hashes[r.id] = textHash(r.searchText)
  // one entry per line, so a change to one record is one line in a diff
  return JSON.stringify({ model: MODEL, dim: DIM, hashes }, null, 1)
}

/** Ids whose stored vector was not made from the record's current text (or whose hash is missing). */
export function staleIds(records: { id: string; searchText: string }[], hashes: Record<string, string>): string[] {
  return records.filter((r) => hashes[r.id] !== textHash(r.searchText)).map((r) => r.id)
}
