/**
 * Captions and a poster for a recorded clip, from the same manifest the video was made from, so the words on the screen
 * are the words of the narration and start when the voice does.
 *
 *   NARRATION=narration-gi-gl.json node scripts/demo-video/captions.mjs <outDir> <captionsFile.vtt> <posterFile.jpg> [posterSegment=g2] [posterOffsetSeconds=2]
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const [, , OUT, VTT, POSTER, posterSeg = 'g2', posterOff = '2'] = process.argv
const m = JSON.parse(readFileSync(join(OUT, 'rec', 'manifest.json'), 'utf8'))
const dur = JSON.parse(readFileSync(join(OUT, 'durations.json'), 'utf8'))
const n = JSON.parse(readFileSync(join(here, process.env.NARRATION ?? 'narration.json'), 'utf8'))

const ts = (t) => { const ms = Math.round(t * 1000); const p = (x, w = 2) => String(x).padStart(w, '0'); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}.${p(ms % 1000, 3)}` }
// One cue per sentence, its time shared out by length, never over two lines of about 50 characters.
const wrap = (s) => { const out = []; let line = ''; for (const w of s.split(' ')) { if ((line + ' ' + w).trim().length > 50 && line) { out.push(line); line = w } else line = (line + ' ' + w).trim() } if (line) out.push(line); return out.join('\n') }
const cues = []
for (const a of m.audio) {
  const text = n.segments[a.id]; if (!text) continue
  let sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g)?.map((x) => x.trim()) ?? [text]
  // A sentence too long for two lines is cut at the comma nearest its middle.
  sentences = sentences.flatMap((x) => {
    if (x.length <= 95) return [x]
    const commas = [...x.matchAll(/, /g)].map((c) => c.index + 1)
    if (!commas.length) return [x]
    const at = commas.reduce((b, c) => (Math.abs(c - x.length / 2) < Math.abs(b - x.length / 2) ? c : b))
    return [x.slice(0, at).trim(), x.slice(at).trim()]
  })
  const total = sentences.reduce((s, x) => s + x.length, 0)
  let t = a.start
  for (const s of sentences) { const d = (dur[a.id] * s.length) / total; cues.push({ from: t, to: t + d - 0.05, text: wrap(s) }); t += d }
}
writeFileSync(VTT, 'WEBVTT\n\n' + cues.map((c, i) => `${i + 1}\n${ts(c.from)} --> ${ts(c.to)}\n${c.text}\n`).join('\n'))
console.log(`${cues.length} cues -> ${VTT}`)

// The poster: the frame on screen `posterOff` seconds into a segment, on the video's clock (the cuts taken out).
const cutBefore = (t) => m.cuts.reduce((s, c) => s + Math.max(0, Math.min(c.to, t) - c.from), 0)
const kept = m.frames.filter((f) => f.t >= m.t0 && !m.cuts.some((c) => f.t >= c.from && f.t < c.to)).map((f) => ({ name: f.name, v: f.t - m.t0 - cutBefore(f.t) }))
const want = m.audio.find((a) => a.id === posterSeg).start + Number(posterOff)
const frame = kept.reduce((best, f) => (Math.abs(f.v - want) < Math.abs(best.v - want) ? f : best))
copyFileSync(join(OUT, 'rec', frame.name), POSTER)
console.log(`poster ${frame.name} -> ${POSTER}`)
