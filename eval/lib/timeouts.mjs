/**
 * Importing this module gives every `fetch` in a script a default timeout (120 seconds, or FETCH_TIMEOUT_MS), unless the call brings its own
 * signal. A service that stopped answering, or a model call that hung, then ends the script with an error that says what timed out, instead
 * of leaving it hanging where nobody sees a red line (rule 1 of CLAUDE.md warns about exactly that: "hangs instead of failing").
 * The calls to `az` have their own `timeout` option; a login that has expired makes `az` wait for a person, and it used to wait for ever.
 */
const real = globalThis.fetch
const ms = Number(process.env.FETCH_TIMEOUT_MS ?? 120_000)
if (!globalThis.__diabiteFetchTimeout) {
  globalThis.__diabiteFetchTimeout = true
  globalThis.fetch = (input, init = {}) => real(input, init?.signal ? init : { ...init, signal: AbortSignal.timeout(ms) })
}
