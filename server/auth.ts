/**
 * Who is asking, from the sign-in token the browser carries.
 *
 * Supabase Auth hands a signed-in person an access token (a JWT). This checks it
 * against the project's published signing keys and returns the person's id. It
 * never throws to the caller, never logs a token, and answers `null` for anything
 * that is not a good token: a missing header, a forged or expired token, another
 * audience, a key that is not ours. If the keys cannot be fetched the answer is
 * also `null`, so a sign-in outage cannot turn into an open door.
 *
 * The Supabase URL is public by design; nothing here is secret.
 */
import type { Request } from 'express'
import { createLocalJWKSet, createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

export interface Person { sub: string; email?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let keys: { url: string; get: JWTVerifyGetKey } | null = null
let lastWarn = 0

/** The key set: Supabase's published JWKS. Tests supply their own, outside production only. */
function keySet(supabaseUrl: string): JWTVerifyGetKey {
  const injected = process.env.NODE_ENV !== 'production' ? process.env.AUTH_JWKS_JSON : undefined
  const id = injected ? `local:${injected.length}` : supabaseUrl
  if (keys && keys.url === id) return keys.get
  const get = injected
    ? createLocalJWKSet(JSON.parse(injected))
    : createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`), { timeoutDuration: 5000, cooldownDuration: 30_000 })
  keys = { url: id, get }
  return get
}

export async function personOf(req: Pick<Request, 'get'>): Promise<Person | null> {
  const supabaseUrl = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
  if (!supabaseUrl) return null
  const header = req.get('authorization') ?? ''
  const m = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(header)
  if (!m) return null
  try {
    const { payload } = await jwtVerify(m[1], keySet(supabaseUrl), {
      issuer: `${supabaseUrl}/auth/v1`,
      audience: 'authenticated',
      algorithms: ['ES256', 'RS256'],
    })
    if (typeof payload.sub !== 'string' || !UUID.test(payload.sub)) return null
    return { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined }
  } catch (e) {
    // A bad token is the ordinary case and is not logged. A failure to reach the keys is not ordinary.
    const code = (e as { code?: string }).code ?? ''
    if (/JWKS|ERR_JOSE_GENERIC|FETCH|TIMEOUT/i.test(code) && Date.now() - lastWarn > 60_000) {
      lastWarn = Date.now()
      console.warn(`sign-in keys unavailable (${code}); every signed-in request is refused until they are`)
    }
    return null
  }
}

/** On when `REQUIRE_SIGN_IN` says so. Read per call so a revision with it off is anonymous again. */
export const signInRequired = (): boolean => /^(on|1|true|yes)$/i.test(process.env.REQUIRE_SIGN_IN ?? '')
