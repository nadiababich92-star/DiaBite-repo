/**
 * A quiet music bed made from nothing: a chord a bar, a bass, a soft pluck, a kick on the beat and hats off it,
 * lowered while anyone speaks. Returns floats at `rate`, `seconds` long.   makeBed(seconds, rate, [[from, to], …])
 */
export function makeBed(seconds, rate, talking = []) {
  const N = Math.ceil(seconds * rate), bed = new Float32Array(N), drums = new Float32Array(N)
  const bpm = 112, beat = 60 / bpm, bar = 4 * beat
  const prog = [{ root: 110, pad: [110, 164.81, 220, 261.63], arp: [329.63, 440, 523.25, 659.25] }, { root: 87.31, pad: [87.31, 130.81, 174.61, 220], arp: [349.23, 440, 523.25, 698.46] },
                { root: 130.81, pad: [130.81, 164.81, 196, 261.63], arp: [329.63, 392, 523.25, 659.25] }, { root: 98, pad: [98, 146.83, 196, 246.94], arp: [293.66, 392, 493.88, 587.33] }]
  let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  const tri = (ph) => 2 * Math.abs(2 * (ph - Math.floor(ph + 0.5))) - 1
  const at = (arr, t, n, f) => { const o = Math.round(t * rate); for (let i = 0; i < n && o + i < N; i++) if (o + i >= 0) arr[o + i] += f(i / rate) }
  for (let c = 0; c * bar < seconds + 1; c++) {
    const ch = prog[c % 4], t0 = c * bar
    at(bed, t0 - 0.05, Math.round((bar + 0.4) * rate), (t) => { const env = Math.min(1, t / 0.25) * Math.min(1, (bar + 0.4 - t) / 0.3); let v = 0; for (const f of ch.pad) for (const d of [-0.003, 0.003]) v += tri((t0 + t) * f * (1 + d)); return v * env * 0.016 })
    for (let k = 0; k < 8; k++) {
      const t = t0 + k * beat / 2, off = k % 2, f = ch.arp[[0, 2, 1, 2, 0, 2, 1, 3][k]], bf = ch.root * (k === 3 || k === 7 ? 2 : 1)
      at(bed, t, Math.round(0.35 * rate), (tt) => (Math.sin(2 * Math.PI * f * tt) + 0.3 * Math.sin(4 * Math.PI * f * tt)) * Math.exp(-tt / 0.1) * 0.02 * (off ? 0.7 : 1))
      at(bed, t, Math.round(0.22 * rate), (tt) => (Math.sin(2 * Math.PI * bf * tt) + 0.25 * Math.sin(4 * Math.PI * bf * tt)) * Math.exp(-tt / 0.1) * 0.12)
      if (off) at(drums, t, Math.round(0.05 * rate), (tt) => (rnd() * 2 - 1) * Math.exp(-tt / 0.012) * 0.07)
      else at(drums, t, Math.round(0.25 * rate), (tt) => Math.sin(2 * Math.PI * (45 * tt + 85 * (1 - Math.exp(-tt * 28)) / 28)) * Math.exp(-tt / 0.085) * 0.4)
    }
  }
  let lp = 0; for (let i = 0; i < N; i++) { lp += 0.2 * (bed[i] - lp); bed[i] = lp }
  const talk = new Uint8Array(N); for (const [a, b] of talking) for (let i = Math.max(0, Math.round((a - 0.1) * rate)); i < Math.min(N, Math.round((b + 0.2) * rate)); i++) talk[i] = 1
  const out = new Float32Array(N); let duck = 1
  for (let i = 0; i < N; i++) { const target = talk[i] ? 0.4 : 1; duck += (target - duck) * (target < duck ? 0.0012 * 24000 / rate : 0.0002 * 24000 / rate); const t = i / rate; out[i] = (bed[i] + drums[i] * 0.8) * duck * Math.min(1, t / 0.8) * Math.min(1, Math.max(0, (seconds - t) / 2.5)) }
  return out
}
