/**
 * "Two rhythms", step 2: say every line, each in its own voice (Azure Speech, the signed-in Azure CLI).
 *   node scripts/demo-video/two-rhythms/tts.mjs [outDir=/tmp/dv2]
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const out = join(process.argv[2] ?? '/tmp/dv2', 'audio'); mkdirSync(out, { recursive: true })
const S = JSON.parse(readFileSync(join(here, 'script.json'), 'utf8'))
const token = execSync('az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv', { env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } }).toString().trim()
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const durations = {}
for (const l of S.lines) {
  const v = S.voices[l.who]
  const ssml = `<speak version="1.0" xml:lang="en-US"><voice name="${v.name}"><prosody rate="${v.rate}">${esc(l.text.replace('diabite.pro', 'diabite dot pro'))}</prosody></voice></speak>`
  const res = await fetch('https://diabite-resource.cognitiveservices.azure.com/tts/cognitiveservices/v1', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm' }, body: ssml })
  if (!res.ok) throw new Error(`${l.id}: ${res.status} ${await res.text()}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(join(out, `${l.id}.wav`), buf)
  durations[l.id] = Math.round(((buf.length - 44) / (24000 * 2)) * 100) / 100
  console.log(l.id.padEnd(6), l.who.padEnd(9), String(durations[l.id]).padStart(5), 's')
}
writeFileSync(join(out, 'durations.json'), JSON.stringify(durations, null, 1))
console.log('total speech', Object.values(durations).reduce((a, b) => a + b, 0).toFixed(1), 's')
