/**
 * The session id the model is told, and the only form of it the tool routes accept from the model.
 *
 * The engine writes `[session_id: …]` into the model's input, and the model passes that id to the tools that read
 * the day (get_day_state, compute_meal, cost_dish, resolve_foods, find_alternatives). Those routes are guarded by the
 * tool key, which says the caller is the agent, not which person's turn it is: a model that was talked into passing
 * another person's id would be handed that person's day. So the id the model is given carries a signature the engine
 * made with the tool key (`<id>.<tag>`), and a tool route takes an id only when the signature on it is its own.
 * A person's id, even a correct one, is useless without the tag; the tag is never written anywhere a person reads
 * (not in the log of a turn, not in the browser's storage).
 *
 * No key configured (local development) means nothing to sign with: the id passes through as it was given. In
 * production the tool routes are closed without a key (engine.ts), so that is never the live case.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

const tagOf = (id: string, key: string) => createHmac('sha256', key).update(`diabite-tool-session|${id}`).digest('base64url').slice(0, 22)

/** The id as the model is to carry it. Ids are `[\w-]+`, so the first dot after one can only be this one. */
export function bindSession(id: string, key: string | undefined = process.env.ENGINE_API_KEY): string {
  return key ? `${id}.${tagOf(id, key)}` : id
}

/** The plain id behind a bound one, or null when the signature is missing or is not this engine's. */
export function unbindSession(value: unknown, key: string | undefined = process.env.ENGINE_API_KEY): string | null {
  if (typeof value !== 'string') return null
  if (!key) return value
  const dot = value.lastIndexOf('.')
  if (dot < 1) return null
  const id = value.slice(0, dot)
  if (!/^[\w-]+$/.test(id)) return null
  const given = Buffer.from(value.slice(dot + 1))
  const want = Buffer.from(tagOf(id, key))
  return given.length === want.length && timingSafeEqual(given, want) ? id : null
}
