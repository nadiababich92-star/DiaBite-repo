/**
 * "Two rhythms", step 3: the film as one HTML page you can scrub (window.setTime(t)), plus its timeline.
 *   node scripts/demo-video/two-rhythms/build-film.mjs [dir=/tmp/dv2] [storyboard=<dir of the .dc.html art>]
 * Art: the six storyboard frames (inline SVG). The phone on the right plays the frames captured from the live app,
 * time-mapped to the spoken lines: typing is stretched or squeezed to the line, thinking is cut short, the answer holds.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const dir = process.argv[2] ?? '/tmp/dv2'
const board = process.argv[3] ?? process.env.STORYBOARD
if (!board) throw new Error('pass the storyboard folder (the .dc.html files) as the second argument or STORYBOARD')
const S = JSON.parse(readFileSync(join(here, 'script.json'), 'utf8'))
const D = JSON.parse(readFileSync(join(dir, 'audio/durations.json'), 'utf8'))
const M = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))

// ---------- art ----------
const svgOf = (name) => readFileSync(join(board, `${name}.dc.html`), 'utf8').match(/<svg[\s\S]*<\/svg>/)[0]
const lines = (s) => s.split('\n')
function stripPhoneAndCaption(svg) {
  const L = lines(svg)
  const p = L.findIndex((l) => l.includes('<!-- the phone'))
  if (p >= 0) { let e = p + 1; while (!/^  <\/g>\s*$/.test(L[e])) e++; L.splice(p, e - p + 1) }
  const c = L.findIndex((l) => l.includes('<rect x="40" y="478"'))
  if (c >= 0) L.splice(c, 2)
  return L.join('\n')
}
function wrapChars(svg) {            // every character group gets a wrapper that the page can bob
  const L = lines(svg)
  for (let i = 0; i < L.length; i++) {
    if (!/^\s*<g transform="translate\(\d+,\d+\) scale\([\d.]+\)"><g>/.test(L[i])) continue
    let e = i + 1; while (!/^\s*<\/g><\/g><\/g>\s*$/.test(L[e])) e++
    const who = L.slice(i, e).join('').includes('#msk') ? 'maya' : 'daniel'
    L[i] = `<g class="bob" data-who="${who}">` + L[i]; L[e] = L[e] + '</g>'
    i = e
  }
  return L.join('\n')
}
const tag = (svg) => svg.replace(/ · MADE UP</, '<')
const clock = (svg, from) => tag(svg).replace(new RegExp(`(<text[^>]*)>${from}</text>`), '$1 class="clock">__CLOCK__</text>')
function rev(svg, re, at) { if (!re.test(svg)) throw new Error('reveal not found: ' + re); return svg.replace(re, (m) => `<g class="rev" data-at="${at}">${m}</g>`) }

// the two characters of the receipt scene, lifted from the finale (without the phones in their hands)
function bothArt() {
  const F = lines(svgOf('Finale'))
  const grab = (startRe) => { const i = F.findIndex((l) => startRe.test(l)); let e = i + 1; while (!/^\s*<\/g><\/g><\/g>\s*$/.test(F[e])) e++; return F.slice(i, e + 1).join('\n') }
  const maya = grab(/translate\(170,300\) scale\(1\.25\)/).replace('translate(170,300) scale(1.25)', 'translate(150,262) scale(1)')
  const dan = grab(/translate\(790,300\) scale\(1\.25\)/).replace('translate(790,300) scale(1.25)', 'translate(410,262) scale(1)')
  return `<svg viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg"><rect width="960" height="540" fill="#0a1812"/><rect y="400" width="960" height="140" fill="#12291f"/>
  <rect x="40" y="40" width="520" height="340" rx="26" fill="#12291f"/>
  <text x="300" y="104" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-weight="500" font-size="20" letter-spacing="3" fill="#dcf26b">SHOW CALCULATION</text>
  <text x="300" y="140" text-anchor="middle" font-family="Literata, Georgia, serif" font-weight="600" font-size="26" fill="#fffcf5">Line by line, from the database</text>
  ${wrapChars(maya)}\n${wrapChars(dan)}
  <text x="60" y="394" font-family="IBM Plex Mono, monospace" font-size="13" letter-spacing="1.5" fill="#a9bbaf">MAYA AND DANIEL · MADE UP</text></svg>`
}
const art = {
  open: () => {
    let s = svgOf('Main'); s = wrapChars(s)
    s = rev(s, /<text x="480" y="84"[^>]*>[^<]*<\/text>\s*<text x="480" y="120"[^>]*>[^<]*<\/text>/, 0.5)
    s = s.replace('<rect x="318" y="146" width="324"', '<rect x="290" y="146" width="380"')
    s = rev(s, /<rect x="290" y="146"[^>]*\/>\s*<text[^>]*>That is what DiaBite is for\.<\/text>/, 0.5 + 6.3 * D['open-1'] / 8.58)
    s = rev(s, /<text x="250" y="470"[\s\S]*?MADE-UP PEOPLE<\/text>/, 1.2)
    return s
  },
  car: () => clock(wrapChars(stripPhoneAndCaption(svgOf('Maya1'))), '7:42'),
  kitchen: () => clock(wrapChars(stripPhoneAndCaption(svgOf('Daniel1'))), 'SUN 17:30'),
  station: () => clock(wrapChars(stripPhoneAndCaption(svgOf('Maya2'))), '13:10'),
  'kitchen-night': () => clock(wrapChars(stripPhoneAndCaption(svgOf('Daniel2'))), 'WED 20:15'),
  both: bothArt,
  finale: () => {
    let s = wrapChars(svgOf('Finale'))
    const T = D['fn-1']
    s = rev(s, /<text x="480" y="130"[^>]*>A check on the go\.<\/text>/, 0.6)
    s = s.replace('<rect x="304" y="156" width="352"', '<rect x="250" y="156" width="460"')
    s = rev(s, /<rect x="250" y="156"[^>]*\/>\s*<text[^>]*>A diary when it works\.<\/text>/, 0.6 + 0.30 * T)
    s = rev(s, /<text x="480" y="276"[^>]*>[^<]*<\/text>/, 0.6 + 0.30 * T + 0.5)
    s = s.replace(/(<defs><mask id="fb">[\s\S]*?<text x="582"[^>]*>Bite<\/text>)/, '<g transform="translate(-40,0)">$1</g>')
    s = rev(s, /<defs><mask id="fb">[\s\S]*?Free to try\. You sign in with your email\.<\/text>/, 0.6 + 0.62 * T)
    return s
  },
}
const bubbleAt = {   // 1280×720 px: where a character's line sits, and which way its tail points
  car: { left: 80, top: 160, w: 430, tail: 'down', tx: 300 },
  kitchen: { left: 410, top: 170, w: 330, tail: 'left' },
  'kitchen-night': { left: 410, top: 170, w: 330, tail: 'left' },
  station: { left: 480, top: 110, w: 260, tail: 'left' },
}

// ---------- timeline ----------
const LEAD = 0.5, TAIL = 0.45
const frames = (cap) => M.scenes[cap]
const total = (cap) => frames(cap).at(-1).t
function typedCap(cap, t0, type, think, hold) {   // typing → squeezed thinking → the answer plays at real speed, then holds
  const k = M.marks[cap]; const T = total(cap)
  return {
    pieces: [{ cap, t0, t1: t0 + type, s0: 0, s1: k.typed }, { cap, t0: t0 + type, t1: t0 + type + think, s0: k.typed, s1: k.answer },
             { cap, t0: t0 + type + think, t1: t0 + type + think + hold, s0: k.answer, s1: T }],
    typing: [t0, t0 + type], answerAt: t0 + type + think, end: t0 + type + think + hold,
  }
}
const uniform = (cap, t0, t1) => ({ cap, t0, t1, s0: frames(cap)[0].t, s1: total(cap) })

const scenes = []
const add = (o) => { scenes.push(o) }
const line = (id, who, text, at, dur) => ({ id, who, text, t0: at, t1: at + dur })

{ // open
  const dur = LEAD + D['open-1'] + 1.2
  add({ id: 'open', art: 'open', dur, clock: null, phone: [], lines: [line('open-1', 'narrator', S.scenes[0].lines[0].text, LEAD, D['open-1'])] })
}
{ // Maya, morning
  const a = typedCap('maya-morning', LEAD, D['mm-1'], 1.0, 0)
  const hold = D['mm-2'] + 0.7; const p = typedCap('maya-morning', LEAD, D['mm-1'], 1.0, hold)
  add({ id: 'maya-morning', art: 'car', dur: p.end + TAIL, clock: ['7:42', '7:43', p.answerAt], phone: p.pieces, typing: [p.typing], answerAt: [p.answerAt],
        lines: [line('mm-1', 'maya', S.scenes[1].lines[0].text, LEAD, D['mm-1']), line('mm-2', 'narrator', S.scenes[1].lines[1].text, p.answerAt + 0.3, D['mm-2'])] })
}
{ // Daniel, Sunday plan
  const t1 = LEAD + D['dw-1'] + 0.3, end = t1 + D['dw-2'] + 0.8
  add({ id: 'daniel-week', art: 'kitchen', dur: end + TAIL, clock: ['SUN 17:30', 'SUN 17:31', end], phone: [uniform('daniel-week', LEAD, end)],
        lines: [line('dw-1', 'daniel', S.scenes[2].lines[0].text, LEAD, D['dw-1']), line('dw-2', 'narrator', S.scenes[2].lines[1].text, t1, D['dw-2'])] })
}
{ // Maya, petrol station
  const A = typedCap('maya-petrol', LEAD, 2.4, 0.9, D['mp-2'] + 0.8)
  const B0 = A.end + 0.25
  const B = typedCap('maya-petrol-swap', B0, 2.0, 0.8, 3.2)
  add({ id: 'maya-petrol', art: 'station', dur: B.end + TAIL, clock: ['13:10', '13:11', B0], phone: [...A.pieces, ...B.pieces], typing: [A.typing, B.typing], answerAt: [A.answerAt, B.answerAt],
        lines: [line('mp-1', 'maya', S.scenes[3].lines[0].text, LEAD, D['mp-1']), line('mp-2', 'narrator', S.scenes[3].lines[1].text, A.answerAt + 0.2, D['mp-2']), line('mp-3', 'maya', S.scenes[3].lines[2].text, B0 + 0.1, D['mp-3'])] })
}
{ // Daniel, Wednesday
  const pl = { cap: 'daniel-diary-planned', t0: 0.4, t1: 3.6, s0: frames('daniel-diary-planned')[0].t, s1: total('daniel-diary-planned') }
  const R = typedCap('daniel-rice', 3.7, 2.4, 0.9, 3.0)
  const lg = { cap: 'daniel-diary-logged', t0: R.end + 0.1, t1: R.end + 2.9, s0: frames('daniel-diary-logged')[0].t, s1: total('daniel-diary-logged') }
  add({ id: 'daniel-wed', art: 'kitchen-night', dur: lg.t1 + 0.5 + TAIL, clock: ['WED 20:15', 'WED 20:16', 3.7], phone: [pl, ...R.pieces, lg], typing: [R.typing], answerAt: [R.answerAt],
        lines: [line('dd-1', 'daniel', S.scenes[4].lines[0].text, LEAD, D['dd-1']), line('dd-2', 'narrator', S.scenes[4].lines[1].text, R.end + 0.2, D['dd-2'])] })
}
{ // the receipt
  const end = LEAD + D['rc-1'] + 1.0
  add({ id: 'receipt', art: 'both', dur: end + TAIL, clock: null, phone: [uniform('maya-receipt', LEAD, end)], lines: [line('rc-1', 'narrator', S.scenes[5].lines[0].text, LEAD, D['rc-1'])] })
}
{ // the dose question
  const p = typedCap('maya-dose', LEAD, 2.6, 0.7, D['ds-2'] + 0.7)
  add({ id: 'maya-dose', art: 'station', dur: p.end + TAIL, clock: ['13:12', '13:13', p.answerAt], phone: p.pieces, typing: [p.typing], answerAt: [p.answerAt],
        lines: [line('ds-1', 'maya', S.scenes[6].lines[0].text, LEAD, D['ds-1']), line('ds-2', 'narrator', S.scenes[6].lines[1].text, p.answerAt + 0.2, D['ds-2'])] })
}
{ // the cholent
  const p = typedCap('daniel-cholent', LEAD, 1.6, 0.8, D['ch-2'] + 0.7)
  add({ id: 'daniel-cholent', art: 'kitchen', dur: p.end + TAIL, clock: ['SUN 13:00', 'SUN 13:01', p.answerAt], phone: p.pieces, typing: [p.typing], answerAt: [p.answerAt],
        lines: [line('ch-1', 'daniel', S.scenes[7].lines[0].text, LEAD, D['ch-1']), line('ch-2', 'narrator', S.scenes[7].lines[1].text, p.answerAt + 0.2, D['ch-2'])] })
}
{ // finale
  add({ id: 'finale', art: 'finale', dur: 0.6 + D['fn-1'] + 2.0, clock: null, phone: [], lines: [line('fn-1', 'narrator', S.scenes[8].lines[0].text.replace('diabite dot pro', 'diabite.pro'), 0.6, D['fn-1'])] })
}
let at = 0; for (const s of scenes) { s.start = Math.round(at * 1000) / 1000; at += s.dur }
const timeline = { fps: 24, total: Math.round(at * 100) / 100, scenes }
writeFileSync(join(dir, 'timeline.json'), JSON.stringify(timeline, null, 1))

// ---------- page ----------
const phoneHtml = (s) => {
  if (!s.phone.length) return ''
  const caps = [...new Set(s.phone.map((p) => p.cap))]
  const imgs = caps.map((c) => frames(c).map((f, i) => `<img class="f" data-cap="${c}" data-i="${i}" src="${f.file}" alt="">`).join('')).join('')
  return `<div class="phone"><div class="screen">${imgs}</div></div>`
}
const bubbles = (s) => s.lines.filter((l) => l.who !== 'narrator').map((l) => {
  const b = bubbleAt[s.art]; const nm = l.who === 'maya' ? 'MAYA' : 'DANIEL'
  return `<div class="bubble ${b.tail} ${l.who}" style="left:${b.left}px;top:${b.top}px;width:${b.w}px;${b.tx ? `--tx:${b.tx}px` : ''}" data-t0="${l.t0}" data-t1="${l.t1}"><i>${nm}</i>${l.text}</div>`
}).join('')
const subs = (s) => s.art === 'open' || s.art === 'finale' ? '' : s.lines.filter((l) => l.who === 'narrator').map((l) => `<div class="sub" data-t0="${l.t0}" data-t1="${l.t1}"><i>NARRATOR</i>${l.text}</div>`).join('')
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Two rhythms</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,600;7..72,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
html,body{margin:0;background:#0a1812;overflow:hidden}
#stage{position:relative;width:1280px;height:720px;overflow:hidden;background:#0a1812;font-family:'IBM Plex Sans',sans-serif}
.scene{position:absolute;inset:0;opacity:0;pointer-events:none}
.scene>svg{position:absolute;inset:0;width:1280px;height:720px;transform-origin:30% 50%}
.phone{position:absolute;left:868px;top:30px;width:372px;height:660px;border-radius:50px;background:#14281f;border:4px solid #2a4235;box-sizing:border-box;box-shadow:0 24px 60px #0007;padding:14px}
.screen{position:relative;width:100%;height:100%;border-radius:36px;overflow:hidden;background:#0a1812}
.screen img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;visibility:hidden}
.bubble{position:absolute;box-sizing:border-box;background:#fffcf5;color:#14201a;border-radius:22px;padding:26px 22px 18px;font:600 25px/1.3 Literata,Georgia,serif;opacity:0;box-shadow:0 8px 24px #0006}
.bubble i,.sub i{position:absolute;top:8px;left:22px;font:500 11px 'IBM Plex Mono',monospace;letter-spacing:1.6px;color:#5e6861;font-style:normal}
.bubble.maya{border:4px solid #dcf26b}.bubble.daniel{border:4px solid #f2c879}
.bubble.down::after{content:'';position:absolute;bottom:-26px;left:var(--tx,60px);border:14px solid transparent;border-top:14px solid #fffcf5;border-bottom:0;margin-left:-14px;height:0;border-top-width:22px}
.bubble.left::after{content:'';position:absolute;left:-26px;top:70px;border:14px solid transparent;border-right:22px solid #fffcf5;border-left:0}
.sub{position:absolute;left:53px;bottom:26px;width:700px;box-sizing:border-box;background:#14281f;border-radius:16px;padding:28px 22px 14px;color:#fffcf5;font:600 22px/1.32 Literata,Georgia,serif;opacity:0}
.sub i{color:#a9bbaf}
.rev{opacity:0}
#made{position:absolute;left:53px;top:14px;font:500 11px 'IBM Plex Mono',monospace;letter-spacing:1.6px;color:#84998c;z-index:6;opacity:0}
#wipe{position:absolute;inset:0;background:#dcf26b;transform:translateX(-101%);z-index:50}
#wipe::after{content:'';position:absolute;right:0;top:0;bottom:0;width:70px;background:#0a1812;opacity:.25;transform:skewX(-8deg)}
</style></head><body><div id="stage">
${scenes.map((s) => `<div class="scene" id="sc-${s.id}">${art[s.art]().replace('__CLOCK__', s.clock?.[0] ?? '')}${phoneHtml(s)}${bubbles(s)}${subs(s)}</div>`).join('\n')}
<div id="made">MAYA AND DANIEL ARE MADE-UP PEOPLE</div><div id="wipe"></div></div>
<script>
const TL = ${JSON.stringify(timeline)}, FR = ${JSON.stringify(M.scenes)}
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), ease = (x) => 1 - Math.pow(1 - clamp(x), 3)
const els = Object.fromEntries(TL.scenes.map((s) => [s.id, document.getElementById('sc-' + s.id)]))
function frameIndex(cap, st) { const f = FR[cap]; let k = 0; for (let i = 0; i < f.length; i++) if (f[i].t <= st + 1e-6) k = i; return k }
let shown = {}
window.setTime = (T) => {
  for (const s of TL.scenes) {
    const el = els[s.id], L = T - s.start, on = L >= 0 && L < s.dur
    el.style.opacity = on ? 1 : 0; el.style.zIndex = on ? 5 : 0
    if (!on) continue
    el.querySelector(':scope>svg').style.transform = 'scale(' + (1 + 0.03 * L / s.dur) + ')'
    const ph = el.querySelector('.phone')
    if (ph) {
      const p = ease(L / 0.55); ph.style.opacity = p; ph.style.transform = 'translateY(' + (50 * (1 - p)) + 'px)'
      let piece = s.phone[0]; for (const q of s.phone) if (q.t0 <= L) piece = q
      const st = piece.s0 + (piece.s1 - piece.s0) * clamp((L - piece.t0) / (piece.t1 - piece.t0))
      const key = piece.cap + ':' + frameIndex(piece.cap, st)
      if (shown[s.id] !== key) {
        el.querySelectorAll('.f').forEach((i) => { i.style.visibility = 'hidden' })
        el.querySelector('.f[data-cap="' + piece.cap + '"][data-i="' + frameIndex(piece.cap, st) + '"]').style.visibility = 'visible'; shown[s.id] = key
      }
    }
    el.querySelectorAll('.bubble').forEach((b) => { const a = +b.dataset.t0, z = +b.dataset.t1 + 0.3; const v = L >= a && L < z; b.style.opacity = v ? clamp((L - a) / 0.12) * (1 - clamp((L - z + 0.15) / 0.15)) : 0; b.style.transform = 'scale(' + (0.92 + 0.08 * ease((L - a) / 0.18)) + ')'; b.style.transformOrigin = '0 60%' })
    el.querySelectorAll('.sub').forEach((b) => { const a = +b.dataset.t0, z = +b.dataset.t1 + 0.3; b.style.opacity = L >= a - 0.05 && L < z ? clamp((L - a + 0.05) / 0.12) * (1 - clamp((L - z + 0.15) / 0.15)) : 0 })
    el.querySelectorAll('.rev').forEach((r) => { const q = ease((L - +r.dataset.at) / 0.35); r.style.opacity = q; r.style.transform = 'translateY(' + (12 * (1 - q)) + 'px)' })
    const talking = (who) => s.lines.some((l) => l.who === who && L >= l.t0 && L < l.t1)
    el.querySelectorAll('.bob').forEach((b, n) => {
      const sp = talking(b.dataset.who); const y = sp ? Math.sin(T * 14 + n) * 2.2 - 1.5 : Math.sin(T * 2.4 + n * 2) * 1.2
      b.style.transform = 'translateY(' + y.toFixed(2) + 'px)'
    })
    const ck = el.querySelector('.clock'); if (ck && s.clock) ck.textContent = L >= s.clock[2] ? s.clock[1] : s.clock[0]
  }
  const sc0 = TL.scenes.find((s) => T >= s.start && T < s.start + s.dur); document.getElementById('made').style.opacity = sc0 && !['open', 'finale'].includes(sc0.id) ? 1 : 0
  let wx = -101; for (const s of TL.scenes.slice(1)) { const b = s.start, d = T - b; if (d > -0.22 && d < 0.22) wx = d < 0 ? -101 + 101 * ease((d + 0.22) / 0.22) : 101 * clamp(d / 0.22) }
  document.getElementById('wipe').style.transform = 'translateX(' + wx + '%)'
}
window.ready = Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => 0))]).then(() => true)
setTime(0)
</script></body></html>`
writeFileSync(join(dir, 'film.html'), html)
console.log('timeline', timeline.total, 's;', scenes.map((s) => `${s.id} ${s.start}+${s.dur.toFixed(1)}`).join(' | '))
