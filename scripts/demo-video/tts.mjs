/**
 * Synthesize every narration segment with Azure Speech (the voice and rate in narration.json), using the signed-in
 * Azure CLI, and write one 24 kHz mono WAV per segment plus durations.json.
 *
 *   node scripts/demo-video/tts.mjs [outDir=/tmp/dv]
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const out = process.argv[2] ?? '/tmp/dv'
mkdirSync(out, { recursive: true })
// NARRATION=narration-clip.json makes the short clip for the pitch deck instead of the full demo.
const n = JSON.parse(readFileSync(join(here, process.env.NARRATION ?? 'narration.json'), 'utf8'))
const token = execSync('az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv', { env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } }).toString().trim()
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const durations = {}
for (const [id, text] of Object.entries(n.segments)) {
  const ssml = `<speak version="1.0" xml:lang="en-US"><voice name="${n.voice}"><prosody rate="${n.rate}">${esc(text)}</prosody></voice></speak>`
  const res = await fetch('https://diabite-resource.cognitiveservices.azure.com/tts/cognitiveservices/v1', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm' },
    body: ssml,
  })
  if (!res.ok) throw new Error(`${id}: ${res.status} ${await res.text()}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(join(out, `${id}.wav`), buf)
  durations[id] = Math.round(((buf.length - 44) / (24000 * 2)) * 100) / 100
  console.log(id.padEnd(4), String(durations[id]).padStart(6), 's  ', text.split(/\s+/).length, 'words')
}
writeFileSync(join(out, 'durations.json'), JSON.stringify(durations, null, 1))
console.log('total narration', Object.values(durations).reduce((a, b) => a + b, 0).toFixed(1), 's')
