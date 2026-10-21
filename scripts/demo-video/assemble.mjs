/**
 * Turn the recording into the finished video: drop the frames inside the cuts, put the rest on a 30 fps clock, mix the
 * narration segments onto that same clock, and mux both with scripts/demo-video/mux.swift.
 *
 *   node scripts/demo-video/assemble.mjs [outDir=/tmp/dv]      →  /tmp/dv/demo-3min.mp4
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { makeBed } from './bed.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = process.argv[2] ?? '/tmp/dv'
const REC = join(OUT, 'rec')
const m = JSON.parse(readFileSync(join(REC, 'manifest.json'), 'utf8'))
// W, H and BITRATE (bits a second) can be set for a smaller copy: DECK=1 makes the 960x540, 380 kbit/s one the deck's clip needs.
const DECK = process.env.DECK === '1'
const FPS = 30, W = Number(process.env.W ?? (DECK ? 960 : 1920)), H = Number(process.env.H ?? (DECK ? 540 : 1080)), RATE = 24000
const BITRATE = Number(process.env.BITRATE ?? (DECK ? 380_000 : 2_800_000))
const NAME = DECK ? 'demo-deck.mp4' : 'demo-3min.mp4'

// 1. Frames on the video's clock; anything inside a cut, or before the start, is dropped.
const cutBefore = (t) => m.cuts.reduce((s, c) => s + Math.max(0, Math.min(c.to, t) - c.from), 0)
const inCut = (t) => m.cuts.some((c) => t >= c.from && t < c.to)
const kept = m.frames.filter((f) => f.t >= m.t0 && !inCut(f.t)).map((f) => ({ name: f.name, v: f.t - m.t0 - cutBefore(f.t) })).sort((a, b) => a.v - b.v)
const total = m.total + 0.2
const n = Math.ceil(total * FPS)
const segments = []
let j = 0
for (let k = 0; k < n; k++) {
  const time = k / FPS
  while (j + 1 < kept.length && kept[j + 1].v <= time) j++
  const name = kept[j].name
  const last = segments[segments.length - 1]
  if (last && last.file === name) last.count++
  else segments.push({ file: name, start: k, count: 1 })
}
// The camera: a slow drift so a screen that is holding still never looks frozen. Its strength follows the scenes
// (a card takes more than the app, whose edges carry tips and the persona chip), eased over a second between them.
// The app's edges carry the tips and the persona chip, so its zones are kept gentle whatever the recording asked for.
const zones = ((m.zones ?? []).length ? m.zones : [{ at: 0, amp: 0.02 }]).map((z) => ({ ...z, amp: z.amp < 0.05 ? 0.02 : z.amp }))
const ampAt = (t) => {
  let a = zones[0].amp
  for (let i = 0; i < zones.length; i++) {
    if (t >= zones[i].at) { const prev = i ? zones[i - 1].amp : zones[0].amp; const k = Math.min(1, (t - zones[i].at) / 1.0); a = prev + (zones[i].amp - prev) * k }
  }
  return a
}
const cam = Array.from({ length: n }, (_, k) => {
  const t = k / FPS
  const s = 1 + ampAt(t) * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 15))
  const fx = 0.5 + 0.1 * Math.sin((2 * Math.PI * t) / 27)
  const fy = 0.4 + 0.08 * Math.sin((2 * Math.PI * t) / 21 + 1)
  return [Math.round(s * 10000) / 10000, Math.round(fx * 1000) / 1000, Math.round(fy * 1000) / 1000]
})
writeFileSync(join(OUT, 'plan.json'), JSON.stringify({ width: W, height: H, fps: FPS, dir: REC, segments, cam, bitrate: BITRATE }))

// 2. One WAV with every narration segment placed where its words belong.
const wavData = (buf) => { let p = 12; while (p < buf.length) { const id = buf.toString('ascii', p, p + 4), size = buf.readUInt32LE(p + 4); if (id === 'data') return buf.subarray(p + 8, p + 8 + size); p += 8 + size } throw new Error('no data chunk') }
const samples = Math.ceil((total + 0.5) * RATE)
const mix = new Int16Array(samples)
for (const a of m.audio) {
  const pcm = wavData(readFileSync(join(OUT, `${a.id}.wav`)))
  const off = Math.round(a.start * RATE)
  for (let i = 0; i < pcm.length / 2 && off + i < samples; i++) mix[off + i] = Math.max(-32768, Math.min(32767, mix[off + i] + pcm.readInt16LE(i * 2)))
}
if (process.env.BED !== '0') {   // a quiet bed under the voice, lowered while it speaks
  const dur = JSON.parse(readFileSync(join(OUT, 'durations.json'), 'utf8'))
  const bed = makeBed(total + 0.5, RATE, m.audio.map((a) => [a.start, a.start + dur[a.id]]))
  for (let i = 0; i < samples; i++) mix[i] = Math.max(-32768, Math.min(32767, mix[i] + Math.round(bed[i] * 32767)))
}
const header = Buffer.alloc(44)
header.write('RIFF', 0); header.writeUInt32LE(36 + samples * 2, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16)
header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34)
header.write('data', 36); header.writeUInt32LE(samples * 2, 40)
writeFileSync(join(OUT, 'mix.wav'), Buffer.concat([header, Buffer.from(mix.buffer)]))

// 3. Build (arguments as an array: the project path has spaces).
const run = (cmd, ...args) => execFileSync(cmd, args, { stdio: 'inherit' })
run('swiftc', '-O', '-o', `${OUT}/mux`, join(here, 'mux.swift'))
run(`${OUT}/mux`, 'video', `${OUT}/plan.json`, `${OUT}/video.mp4`)
run('afconvert', '-f', 'm4af', '-d', 'aac@44100', '-b', DECK ? '64000' : '96000', `${OUT}/mix.wav`, `${OUT}/mix.m4a`)
run(`${OUT}/mux`, 'merge', `${OUT}/video.mp4`, `${OUT}/mix.m4a`, `${OUT}/${NAME}`)
console.log(`${OUT}/${NAME}  ${total.toFixed(1)} s, ${segments.length} distinct frames`)
