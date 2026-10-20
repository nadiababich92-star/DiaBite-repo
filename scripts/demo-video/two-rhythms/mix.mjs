/**
 * "Two rhythms", step 5: the sound (voices at their times, a few quiet sounds), captions, and the MP4.
 *   node mix.mjs [dir=/tmp/dv2] [out=/tmp/dv2/two-rhythms.mp4]      (needs /tmp/dv2/out/*.jpg from render-film.mjs)
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const dir = process.argv[2] ?? '/tmp/dv2', outMp4 = process.argv[3] ?? join(dir, 'two-rhythms.mp4')
const TL = JSON.parse(readFileSync(join(dir, 'timeline.json'), 'utf8'))
const SR = 24000, N = Math.ceil((TL.total + 0.5) * SR), mix = new Float32Array(N)
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const put = (arr, at, g = 1) => { const o = Math.round(at * SR); for (let i = 0; i < arr.length && o + i < N; i++) mix[o + i] += arr[i] * g }
const wav = (id) => { const b = readFileSync(join(dir, 'audio', id + '.wav')); const a = new Float32Array((b.length - 44) / 2); for (let i = 0; i < a.length; i++) a[i] = b.readInt16LE(44 + i * 2) / 32768; return a }
const tick = () => { const n = Math.round(0.012 * SR), a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = (rnd() * 2 - 1) * Math.exp(-i / (0.0025 * SR)) * (i % 2 ? 1 : 0.6); return a }
const thump = () => { const n = Math.round(0.28 * SR), a = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const f = 48 + 40 * Math.exp(-i / (0.04 * SR)); ph += 2 * Math.PI * f / SR; a[i] = Math.sin(ph) * Math.exp(-i / (0.07 * SR)) + (rnd() * 2 - 1) * 0.15 * Math.exp(-i / (0.006 * SR)) } return a }
const whoosh = () => { const n = Math.round(0.5 * SR), a = new Float32Array(n); let y = 0; for (let i = 0; i < n; i++) { const p = i / n, c = 0.01 + 0.2 * Math.sin(Math.PI * p) ** 2; y += c * ((rnd() * 2 - 1) - y); a[i] = y * Math.sin(Math.PI * p) * 3 } return a }
const vtt = ['WEBVTT', '']
const ts = (t) => { const m = Math.floor(t / 60), s = (t - m * 60).toFixed(3).padStart(6, '0'); return `${String(m).padStart(2, '0')}:${s}` }
for (const [k, s] of TL.scenes.entries()) {
  for (const l of s.lines) {
    put(wav(l.id), s.start + l.t0)
    const who = { narrator: 'Narrator', maya: 'Maya', daniel: 'Daniel' }[l.who]
    vtt.push(`${ts(s.start + l.t0)} --> ${ts(s.start + l.t1 + 0.2)}`, `<v ${who}>${l.text}`, '')
  }
  for (const [a, b] of s.typing ?? []) for (let t = a + 0.15; t < b - 0.05; t += 0.075 + rnd() * 0.05) put(tick(), s.start + t, 0.16)
  for (const t of s.answerAt ?? []) put(thump(), s.start + t, 0.22)
  if (k > 0) put(whoosh(), s.start - 0.25, 0.10)
}
// a bed with some drive: a chord per bar, bass, pluck, kick, hats and claps that build with the story, ducked while anyone speaks
{
  const bpm = 112, beat = 60 / bpm, bar = 4 * beat
  const prog = [{ root: 110, pad: [110, 164.81, 220, 261.63], arp: [329.63, 440, 523.25, 659.25] }, { root: 87.31, pad: [87.31, 130.81, 174.61, 220], arp: [349.23, 440, 523.25, 698.46] },
                { root: 130.81, pad: [130.81, 164.81, 196, 261.63], arp: [329.63, 392, 523.25, 659.25] }, { root: 98, pad: [98, 146.83, 196, 246.94], arp: [293.66, 392, 493.88, 587.33] }]
  const levels = { counter: 1, meet: 2, 'maya-problem': 1, 'daniel-plan': 1, 'daniel-broke': 1, 'maya-intro': 2 }
  const level = (t) => { const sc = TL.scenes.find((x) => t >= x.start && t < x.start + x.dur) ?? TL.scenes.at(-1); return levels[sc.id] ?? 3 }
  const bed = new Float32Array(N), drums = new Float32Array(N)
  const tri = (ph) => 2 * Math.abs(2 * (ph - Math.floor(ph + 0.5))) - 1
  const at = (arr, t, n, f) => { const o = Math.round(t * SR); for (let i = 0; i < n && o + i < N; i++) arr[o + i] += f(i / SR, i) }
  for (let c = 0; c * bar < TL.total + 1; c++) {
    const ch = prog[c % 4], t0 = c * bar, lv0 = level(t0)
    at(bed, t0 - 0.05, Math.round((bar + 0.4) * SR), (t, i) => { const env = Math.min(1, t / 0.25) * Math.min(1, (bar + 0.4 - t) / 0.3); let v = 0; for (const f of ch.pad) for (const d of [-0.003, 0.003]) v += tri((t0 * SR + i) / SR * f * (1 + d)); return v * env * 0.016 * (lv0 < 2 ? 0.8 : 1.1) })
    for (let k = 0; k < 8; k++) {
      const t = t0 + k * beat / 2, lv = level(t), off = k % 2
      const f = ch.arp[[0, 2, 1, 2, 0, 2, 1, 3][k]]
      at(bed, t, Math.round(0.35 * SR), (tt) => (Math.sin(2 * Math.PI * f * tt) + 0.3 * Math.sin(4 * Math.PI * f * tt)) * Math.exp(-tt / 0.1) * 0.02 * (off ? 0.7 : 1))
      if (lv >= 2) { const bf = ch.root * (k === 3 || k === 7 ? 2 : 1); at(bed, t, Math.round(0.22 * SR), (tt) => (Math.sin(2 * Math.PI * bf * tt) + 0.25 * Math.sin(4 * Math.PI * bf * tt)) * Math.exp(-tt / 0.1) * 0.12) }
      if (lv >= 2 && off) at(drums, t, Math.round(0.05 * SR), (tt) => (rnd() * 2 - 1) * Math.exp(-tt / 0.012) * 0.07)
      if (!off) {   // on the beats
        const b = k / 2
        if (lv >= 1 && (b % 2 === 0 || lv >= 2)) at(drums, t, Math.round(0.25 * SR), (tt) => Math.sin(2 * Math.PI * (45 * tt + 85 * (1 - Math.exp(-tt * 28)) / 28)) * Math.exp(-tt / 0.085) * (lv >= 3 ? 0.55 : 0.4))
        if (lv >= 3 && b % 2 === 1) at(drums, t, Math.round(0.14 * SR), (tt) => (rnd() * 2 - 1) * Math.exp(-tt / 0.03) * 0.2)
      }
    }
  }
  let lp = 0; for (let i = 0; i < N; i++) { lp += 0.2 * (bed[i] - lp); bed[i] = lp }
  const talk = new Float32Array(N); for (const sc of TL.scenes) for (const l of sc.lines) { const a2 = Math.round((sc.start + l.t0 - 0.1) * SR), b2 = Math.round((sc.start + l.t1 + 0.2) * SR); for (let i = Math.max(0, a2); i < Math.min(N, b2); i++) talk[i] = 1 }
  let duck = 1; const sec = TL.total
  for (let i = 0; i < N; i++) { const target = talk[i] ? 0.4 : 1; duck += (target - duck) * (target < duck ? 0.0012 : 0.0002); const t = i / SR; const fade = Math.min(1, t / 0.8) * Math.min(1, Math.max(0, (sec - t) / 2.5)); mix[i] += (bed[i] + drums[i] * 0.8) * duck * fade }
}
let peak = 0; for (const v of mix) peak = Math.max(peak, Math.abs(v)); const g = peak > 0.92 ? 0.92 / peak : 1
const pcm = Buffer.alloc(44 + N * 2); pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 2, 4); pcm.write('WAVEfmt ', 8); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22)
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(N * 2, 40)
for (let i = 0; i < N; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[i] * g)) * 32767), 44 + i * 2)
writeFileSync(join(dir, 'mix.wav'), pcm); writeFileSync(join(dir, 'two-rhythms.vtt'), vtt.join('\n'))
execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '64000', join(dir, 'mix.wav'), join(dir, 'mix.m4a')])
const frames = readdirSync(join(dir, 'out')).filter((f) => f.endsWith('.jpg')).sort()
writeFileSync(join(dir, 'plan.json'), JSON.stringify({ width: 1280, height: 720, fps: TL.fps, dir: join(dir, 'out'), bitrate: 2_600_000, segments: frames.map((file, i) => ({ file, start: i, count: 1 })) }))
const mux = join(dir, 'mux'); execFileSync('swiftc', ['-O', '-o', mux, join(here, '../mux.swift')], { stdio: 'inherit' })
execFileSync(mux, ['video', join(dir, 'plan.json'), join(dir, 'video.mp4')], { stdio: 'inherit' })
execFileSync(mux, ['merge', join(dir, 'video.mp4'), join(dir, 'mix.m4a'), join(dir, 'merged.mp4')], { stdio: 'inherit' })
execFileSync('swiftc', ['-O', '-o', join(dir, 'faststart'), join(here, '../faststart.swift')], { stdio: 'inherit' })
execFileSync(join(dir, 'faststart'), [join(dir, 'merged.mp4'), outMp4], { stdio: 'inherit' })
console.log('peak', peak.toFixed(2), 'gain', g.toFixed(2), '→', outMp4)
