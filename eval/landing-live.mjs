/**
 * The landing receipt against the LIVE service (docs/specs/landing-checks.md, L1, live counterpart).
 *
 * `npm run eval` checks the figures on the landing page against the food files in this checkout. The live catalogue is the
 * Supabase table (CLAUDE.md rule 10), so after a deploy, and after every sync-foods and restart, ask the running engine
 * for the same three portions and compare. No model turn is spent. The engine key is read from the Container App secret
 * and never printed.
 *
 *   node eval/landing-live.mjs        # SERVICE=https://diabite.pro
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SERVICE = (process.env.SERVICE ?? 'https://diabite.pro').replace(/\/$/, '')
const src = readFileSync(join(ROOT, 'src/data/landing.ts'), 'utf8')
// The data file is plain TypeScript; read the numbers out of it rather than importing it (this script has no build step).
const rows = [...src.matchAll(/\{ foodId: '([^']+)', name: '[^']*', grams: ([\d.]+), availableCarbs: ([\d.]+), gi: (null|\d+), gl: ([\d.]+) \}/g)]
  .map((m) => ({ foodId: m[1], grams: +m[2], availableCarbs: +m[3], gi: m[4] === 'null' ? null : +m[4], gl: +m[5] }))
const totalGl = +src.match(/totalGl: ([\d.]+)/)[1]
if (rows.length !== 3) { console.log('FAIL  could not read the three rows from src/data/landing.ts'); process.exit(1) }
const key = execSync('az containerapp secret show -g rg-nadia.babich92-5702 -n diabite-engine --secret-name engine-api-key --query value -o tsv', { env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` }, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
const res = await (await fetch(`${SERVICE}/tools/compute_meal`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key }, body: JSON.stringify({ items: rows.map((r) => ({ foodId: r.foodId, grams: r.grams })) }) })).json()
const r1 = (n) => Math.round(n * 10) / 10
const bad = []
if (res.error || !res.items) bad.push(`the engine said: ${res.error ?? 'no items'}`)
else {
  rows.forEach((row, i) => {
    const it = res.items[i]
    if (r1(it.availableCarbs) !== row.availableCarbs) bad.push(`${row.foodId}: carbs ${row.availableCarbs} on the page, ${r1(it.availableCarbs)} live`)
    if ((it.gi ?? null) !== row.gi) bad.push(`${row.foodId}: GI ${row.gi} on the page, ${it.gi ?? null} live`)
    if (r1(it.gl) !== row.gl) bad.push(`${row.foodId}: load ${row.gl} on the page, ${r1(it.gl)} live`)
  })
  if (r1(res.totals.gl) !== totalGl) bad.push(`meal load ${totalGl} on the page, ${r1(res.totals.gl)} live`)
}
console.log(bad.length ? 'FAIL  the landing receipt is not what the live engine returns:\n  ' + bad.join('\n  ') : `PASS  the landing receipt matches the live engine (meal load ${totalGl})`)
process.exit(bad.length ? 1 : 0)
