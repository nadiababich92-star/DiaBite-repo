/**
 * "Two rhythms", step 3: the film as one HTML page you can scrub (window.setTime(t)), plus its timeline.
 *   node scripts/demo-video/two-rhythms/build-film.mjs [dir=/tmp/dv2] [storyboard=<dir of the .dc.html art>]
 * Art: the storyboard frames (inline SVG). The phone on the right plays the frames captured from the live app,
 * time-mapped to the spoken lines: typing is stretched or squeezed to the line, thinking is cut short, the answer holds.
 * Mouths follow the loudness of each character's voice.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const dir = process.argv[2] ?? '/tmp/dv2'
const SUF = process.env.SUF ?? '', ONLY = process.env.ONLY?.split(',')   // ONLY=counter,meet,… SUF=-short: a cut of the film
const board = process.argv[3] ?? process.env.STORYBOARD
if (!board) throw new Error('pass the storyboard folder (the .dc.html files) as the second argument or STORYBOARD')
const S = JSON.parse(readFileSync(join(here, 'script.json'), 'utf8'))
const D = JSON.parse(readFileSync(join(dir, 'audio/durations.json'), 'utf8'))
const M = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
const TXT = Object.fromEntries(S.lines.map((l) => [l.id, l.text]))
const WHO = Object.fromEntries(S.lines.map((l) => [l.id, l.who]))
const LEAD = 0.35, TAIL = 0.35
const sentStarts = (id, from = 0) => {   // when each sentence of a line begins, by its share of the characters
  const parts = TXT[id].split(/(?<=[.?!])\s+/); const n = parts.reduce((a, p) => a + p.length, 0); let c = 0
  return parts.map((p) => { const t = from + D[id] * (c / n); c += p.length; return t })
}

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
const MOUTH = { maya: 32, daniel: 35 }
function wrapChars(svg) {            // every character group: a wrapper the page can bob, and a mouth it can open
  const L = lines(svg)
  for (let i = 0; i < L.length; i++) {
    if (!/^\s*<g transform="translate\(\d+,\d+\) scale\([\d.]+\)"><g>/.test(L[i])) continue
    let e = i + 1; while (!/^\s*<\/g><\/g><\/g>\s*$/.test(L[e])) e++
    const who = L.slice(i, e).join('').includes('#msk') ? 'maya' : 'daniel'
    L[i] = `<g class="bob" data-who="${who}">` + L[i]
    L[e] = `<g class="mouth"><ellipse cx="0" cy="${MOUTH[who]}" rx="6" ry="0.01" fill="#4a1612"/></g>` + L[e] + '</g>'
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
  <text x="60" y="394" font-family="IBM Plex Mono, monospace" font-size="13" letter-spacing="1.5" fill="#a9bbaf">MAYA AND DANIEL</text></svg>`
}
// the title frame, four ways: the numbers, the introduction, the product, (and its labels)
function mainArt({ title = '', sub, band, bandAt, bandW = 440, labels = ['EATS ON THE MOVE', 'LOVES A PLAN'], big = false, marks = null, source = 'MADE-UP PEOPLE', showLabels = true }) {
  let s = wrapChars(svgOf('Main'))
  const by = big ? 164 : 146, bx = 480 - bandW / 2, ty = big ? 199 : 181
  s = s.replace(/(<text x="480" y="84"[^>]*>)[^<]*(<\/text>)/, big ? '<text x="480" y="112" text-anchor="middle" font-family="Literata, Georgia, serif" font-weight="600" font-size="84" letter-spacing="-2" fill="#dcf26b" class="counter">0</text>' : `$1${title}$2`)
  s = s.replace(/(<text x="480" y="120"[^>]*>)[^<]*(<\/text>)/, big ? `<text x="480" y="146" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="14" letter-spacing="2" fill="#a9bbaf">${sub}</text>` : `$1${sub}$2`)
  s = s.replace(/<rect x="318" y="146"[^>]*\/>/, `<rect x="${bx}" y="${by}" width="${bandW}" height="50" rx="10" fill="#dcf26b" transform="rotate(-1.5 480 ${by + 25})"/>`)
  s = s.replace(/<text x="480" y="181"[^>]*>[^<]*<\/text>/, `<text x="480" y="${ty}" text-anchor="middle" font-family="Literata, Georgia, serif" font-weight="600" font-size="28" fill="#0c1b15">${band}</text>`)
  s = s.replace('EATS ON THE MOVE', labels[0]).replace('LOVES A PLAN', labels[1])
  s = s.replace('MADE-UP PEOPLE', source)
  if (!showLabels) s = s.replace(/<text x="250" y="470"[\s\S]*?(<text x="480" y="522"[^>]*>)/, '$1')
  s = s.replace(/<text x="(250|710)" y="(470|496)"([^>]*)>([^<]*)<\/text>/g, (m, x, y, a, t) => { const w = y === '470' ? 120 : Math.round(t.length * 9.2 + 26); return `<rect x="${x - w / 2}" y="${y === '470' ? 444 : 480}" width="${w}" height="${y === '470' ? 36 : 24}" rx="12" fill="#0a1812" opacity="0.92"/>` + m })
  s = rev(s, big ? /<text[^>]*class="counter">0<\/text>\s*<text x="480" y="146"[^>]*>[^<]*<\/text>/ : /<text x="480" y="84"[^>]*>[^<]*<\/text>\s*<text x="480" y="120"[^>]*>[^<]*<\/text>/, 0.3)
  s = rev(s, new RegExp(`<rect x="${bx}" y="${by}"[^>]*\\/>\\s*<text[^>]*>[^<]*<\\/text>`), bandAt)
  s = rev(s, showLabels ? /<text x="250" y="470"[\s\S]*?<text x="480" y="522"[^>]*>[^<]*<\/text>/ : /<text x="480" y="522"[^>]*>[^<]*<\/text>/, 0.8)
  if (marks) s = s.replace('</svg>', `<g class="rev" data-at="${marks}"><text x="140" y="300" font-family="Literata, Georgia, serif" font-weight="600" font-size="80" fill="#dcf26b">?</text><text x="800" y="300" font-family="Literata, Georgia, serif" font-weight="600" font-size="80" fill="#dcf26b">?</text></g></svg>`)
  return s
}
const art = {
  counter: () => mainArt({ big: true, sub: 'AMERICANS WITH DIABETES', band: '115.2 million adults have prediabetes', bandW: 640, bandAt: sentStarts('q-1', LEAD)[1], marks: sentStarts('q-1', LEAD)[2], showLabels: false, source: 'SOURCE: CDC, NATIONAL DIABETES STATISTICS REPORT, 2023 DATA' }),
  meet: () => mainArt({ title: 'Meet Maya and Daniel.', sub: 'MADE UP · BUT YOU KNOW THEM', band: 'Two lives. One question.', bandAt: sentStarts('mt-1', LEAD)[3], labels: ['INSULIN RESISTANCE · NO TIME', 'TYPE 2 · A PLAN THAT BREAKS'], source: ' ' }),
  car: () => clock(wrapChars(stripPhoneAndCaption(svgOf('Maya1'))), '7:42'),
  kitchen: () => clock(wrapChars(stripPhoneAndCaption(svgOf('Daniel1'))), 'SUN 17:30'),
  station: () => clock(wrapChars(stripPhoneAndCaption(svgOf('Maya2'))), '13:10'),
  'kitchen-night': () => clock(wrapChars(stripPhoneAndCaption(svgOf('Daniel2'))), 'WED 20:15'),
  both: bothArt,
  finale: () => {
    let s = wrapChars(svgOf('Finale'))
    const st = sentStarts('fn-1', 0.5)
    s = rev(s, /<text x="480" y="130"[^>]*>A check on the go\.<\/text>/, st[0])
    s = s.replace('<rect x="304" y="156" width="352"', '<rect x="250" y="156" width="460"')
    s = rev(s, /<rect x="250" y="156"[^>]*\/>\s*<text[^>]*>A diary when it works\.<\/text>/, st[1])
    s = rev(s, /<text x="480" y="276"[^>]*>[^<]*<\/text>/, st[1] + 0.4)
    s = s.replace(/(<defs><mask id="fb">[\s\S]*?<text x="582"[^>]*>Bite<\/text>)/, '<g transform="translate(-40,0)">$1</g>')
    s = rev(s, /<defs><mask id="fb">[\s\S]*?Free to try\. You sign in with your email\.<\/text>/, st[2])
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
const line = (id, at, style) => ({ id, who: WHO[id], text: TXT[id], t0: at, t1: at + D[id], style })

const scenes = []
const add = (o) => { scenes.push(o) }
const tp = (id) => Math.min(D[id] + 0.15, 1.9)      // typing is quick: as long as the line, never more than 1.9 s
{ // 1 · the numbers
  const st = sentStarts('q-1', LEAD)
  add({ id: 'counter', art: 'counter', dur: LEAD + D['q-1'] + 0.9 + TAIL, clock: null, phone: [], counter: [LEAD + 0.1, st[1] - 0.15, 40.1, 1, ' million'], lines: [line('q-1', LEAD)] })
}
{ // 2 · meet them
  add({ id: 'meet', art: 'meet', dur: LEAD + D['mt-1'] + 0.8 + TAIL, clock: null, phone: [], lines: [line('mt-1', LEAD)] })
}
{ // 3 · Maya's problem
  const a = LEAD + D['pm-1'] + 0.2, f0 = sentStarts('pm-2', a)[1] - 0.2, end = a + D['pm-2'] + 0.8
  add({ id: 'maya-problem', art: 'station', dur: end + TAIL, clock: ['13:10', '13:10', 99], phone: [{ cap: 'form', t0: f0, t1: end, s0: 0, s1: 1 }],
        lines: [line('pm-1', LEAD, 'think'), line('pm-2', a)] })
}
{ // 4 · Daniel plans
  const t1 = LEAD + D['dp-1'] + 0.15, end = t1 + D['dp-2'] + 0.5
  add({ id: 'daniel-plan', art: 'kitchen', dur: end + TAIL, clock: ['SUN 17:30', 'SUN 17:31', end], phone: [uniform('daniel-week', LEAD, end)], lines: [line('dp-1', LEAD), line('dp-2', t1)] })
}
{ // 5 · the plan breaks
  const t1 = LEAD + D['db-1'] + 0.15, end = t1 + D['db-2'] + 0.7
  add({ id: 'daniel-broke', art: 'kitchen-night', dur: end + TAIL, clock: ['WED 20:15', 'WED 20:15', 99], phone: [], lines: [line('db-1', LEAD), line('db-2', t1)] })
}
{ // 6 · what DiaBite is: Maya says what she is about to eat
  const st = sentStarts('gp-1', LEAD)
  const p = typedCap('maya-morning', st[1] + 0.1, 1.7, 0.5, 99)
  const answerLine = Math.max(p.answerAt, st[2])
  const end = LEAD + D['gp-1'] + 0.8
  p.pieces[2].t1 = end; p.pieces[2].s1 = total('maya-morning')
  add({ id: 'maya-intro', art: 'car', dur: end + TAIL, clock: ['7:42', '7:43', p.answerAt], phone: p.pieces, typing: [p.typing], answerAt: [p.answerAt], lines: [line('gp-1', LEAD)] })
}
{ // 7 · Maya, petrol station and the swap
  const A = typedCap('maya-petrol', LEAD, tp('mp-1'), 0.55, D['mp-2'] + 0.55)
  const B0 = A.end + 0.05
  const B = typedCap('maya-petrol-swap', B0, tp('mp-3'), 0.5, 2.2)
  add({ id: 'maya-petrol', art: 'station', dur: B.end + TAIL, clock: ['13:10', '13:11', B0], phone: [...A.pieces, ...B.pieces], typing: [A.typing, B.typing], answerAt: [A.answerAt, B.answerAt],
        lines: [line('mp-1', LEAD), line('mp-2', A.answerAt + 0.15), line('mp-3', B0 + 0.05)] })
}
{ // 8 · the receipt
  const end = LEAD + D['rc-1'] + 0.9
  add({ id: 'receipt', art: 'both', dur: end + TAIL, clock: null, phone: [uniform('maya-receipt', LEAD, end)], lines: [line('rc-1', LEAD)] })
}
{ // 9 · Daniel logs what happened
  const pl = { cap: 'daniel-diary-planned', t0: LEAD - 0.1, t1: LEAD + D['dd-0'] + 0.2, s0: frames('daniel-diary-planned')[0].t, s1: total('daniel-diary-planned') }
  const R0 = pl.t1 + 0.05
  const R = typedCap('daniel-rice', R0, tp('dd-1'), 0.55, 2.4)
  const lg = { cap: 'daniel-diary-logged', t0: R.end + 0.05, t1: R.end + 0.05 + D['dd-2'] + 0.9, s0: frames('daniel-diary-logged')[0].t, s1: total('daniel-diary-logged') }
  add({ id: 'daniel-wed', art: 'kitchen-night', dur: lg.t1 + TAIL, clock: ['WED 20:15', 'WED 20:16', R0], phone: [pl, ...R.pieces, lg], typing: [R.typing], answerAt: [R.answerAt],
        lines: [line('dd-0', LEAD), line('dd-1', R0 + 0.02), line('dd-2', lg.t0 + 0.1)] })
}
{ // 10 · the dose question
  const p = typedCap('maya-dose', LEAD, tp('ds-1'), 0.5, D['ds-2'] + 0.7)
  add({ id: 'maya-dose', art: 'station', dur: p.end + TAIL, clock: ['13:12', '13:13', p.answerAt], phone: p.pieces, typing: [p.typing], answerAt: [p.answerAt],
        lines: [line('ds-1', LEAD), line('ds-2', p.answerAt + 0.15)] })
}
{ // 11 · the cholent
  const p = typedCap('daniel-cholent', LEAD, tp('ch-1'), 0.6, D['ch-2'] + 0.8)
  add({ id: 'daniel-cholent', art: 'kitchen', dur: p.end + TAIL, clock: ['SUN 13:00', 'SUN 13:01', p.answerAt], phone: p.pieces, typing: [p.typing], answerAt: [p.answerAt],
        lines: [line('ch-1', LEAD), line('ch-2', p.answerAt + 0.15)] })
}
{ // 12 · finale
  add({ id: 'finale', art: 'finale', dur: 0.5 + D['fn-1'] + 2.0, clock: null, phone: [], lines: [line('fn-1', 0.5)] })
}
if (ONLY) scenes.splice(0, scenes.length, ...scenes.filter((x) => ONLY.includes(x.id)))
let at = 0; for (const s of scenes) { s.start = Math.round(at * 1000) / 1000; at += s.dur }

// the shape of each mouth, 24 times a second, read from the voice itself: closed in the gaps, a slit for hissing sounds,
// round for low "o/u" sounds, wide for bright "e/i" sounds, open for the rest (a rough guess, not phoneme data)
const vis = {}
for (const s of scenes) for (const l of s.lines) {
  if (l.who === 'narrator') continue
  const b = readFileSync(join(dir, 'audio', l.id + '.wav')), n = (b.length - 44) / 2, w = 1000, fr = []
  let lp = 0, prev = 0
  for (let i = 0; i < n; i += w) {
    let q = 0, ql = 0, zc = 0, c = 0
    for (let j = i; j < Math.min(n, i + w); j++) { const v = b.readInt16LE(44 + j * 2) / 32768; lp += 0.17 * (v - lp); q += v * v; ql += lp * lp; if ((v > 0) !== (prev > 0)) zc++; prev = v; c++ }
    fr.push({ e: Math.sqrt(q / c), low: Math.sqrt(ql / c), z: zc / c })
  }
  const top = [...fr.map((f) => f.e)].sort((x, y) => x - y)[Math.floor(fr.length * 0.9)] || 1
  const shape = fr.map((f) => {
    const lv = Math.min(1, f.e / top) ** 0.6
    if (f.e < 0.15 * top) return [5, 0.01]
    if (f.z > 0.28) return [7.2, 0.9 + 0.7 * lv]
    const r = f.low / f.e
    return r > 0.9 ? [3.8, 1.5 + 3 * lv] : r < 0.6 ? [8, 1 + 1.6 * lv] : [6, 1.5 + 3.4 * lv]
  })
  vis[l.id] = shape.map((v, i) => { const p = shape[i - 1] ?? v; return [Math.round((v[0] * 0.65 + p[0] * 0.35) * 10) / 10, Math.round((v[1] * 0.65 + p[1] * 0.35) * 10) / 10] })
}
const timeline = { fps: 24, total: Math.round(at * 100) / 100, scenes, vis }
writeFileSync(join(dir, `timeline${SUF}.json`), JSON.stringify(timeline))

// ---------- page ----------
const formRows = ['Food name *', 'Brand', 'Serving size', 'Number of servings', 'Weight (g)', 'Meal type', 'Time eaten', 'Calories', 'Carbohydrate (g)', 'Fibre (g)', 'Sugars (g)', 'Notes']
const formMock = `<div class="formmock"><div class="fm-in"><div class="fm-h">Log food</div>${formRows.map((r) => `<div class="fm-r"><span>${r}</span><b></b></div>`).join('')}<div class="fm-b">Save entry</div></div></div>`
const phoneHtml = (s) => {
  if (!s.phone.length) return ''
  const caps = [...new Set(s.phone.map((p) => p.cap))]
  const imgs = caps.filter((c) => c !== 'form').map((c) => frames(c).map((f, i) => `<img class="f" data-cap="${c}" data-i="${i}" src="${f.file}" alt="">`).join('')).join('')
  return `<div class="phone"><div class="screen">${imgs}${caps.includes('form') ? formMock : ''}</div></div>`
}
const bubbles = (s) => s.lines.filter((l) => l.who !== 'narrator').map((l) => {
  const b = bubbleAt[s.art]; const nm = l.who === 'maya' ? 'MAYA' : 'DANIEL'
  return `<div class="bubble ${b.tail} ${l.who} ${l.style ?? ''}" style="left:${b.left}px;top:${b.top}px;width:${b.w}px;${b.tx ? `--tx:${b.tx}px` : ''}" data-t0="${l.t0}" data-t1="${l.t1}"><i>${nm}</i>${l.text}</div>`
}).join('')
const subs = (s) => ['finale', 'counter', 'meet'].includes(s.art) ? '' : s.lines.filter((l) => l.who === 'narrator').map((l) => `<div class="sub" data-t0="${l.t0}" data-t1="${l.t1}"><i>NARRATOR</i>${l.text}</div>`).join('')
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Two rhythms</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,600;7..72,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
html,body{margin:0;background:#0a1812;overflow:hidden}
#stage{position:relative;width:1280px;height:720px;overflow:hidden;background:#0a1812;font-family:'IBM Plex Sans',sans-serif}
.scene{position:absolute;inset:0;opacity:0;pointer-events:none}
.scene>svg{position:absolute;inset:0;width:1280px;height:720px;transform-origin:30% 50%}
.phone{position:absolute;left:868px;top:30px;width:372px;height:660px;border-radius:50px;background:#14281f;border:4px solid #2a4235;box-sizing:border-box;box-shadow:0 24px 60px #0007;padding:14px;opacity:0}
.screen{position:relative;width:100%;height:100%;border-radius:36px;overflow:hidden;background:#0a1812}
.screen img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;visibility:hidden}
.formmock{position:absolute;inset:0;background:#f1f1f1;color:#333;font:14px 'IBM Plex Sans',sans-serif;visibility:hidden;overflow:hidden}
.fm-h{background:#4b5563;color:#fff;padding:20px 16px 14px;font-weight:600;font-size:18px}
.fm-r{padding:12px 16px 4px}.fm-r span{display:block;font-size:12px;color:#666;margin-bottom:4px}.fm-r b{display:block;height:34px;border:1px solid #bbb;border-radius:4px;background:#fff}
.fm-b{margin:18px 16px 40px;background:#9aa3ad;color:#fff;text-align:center;padding:12px;border-radius:4px;font-weight:600}
.bubble{position:absolute;box-sizing:border-box;background:#fffcf5;color:#14201a;border-radius:22px;padding:26px 22px 18px;font:600 25px/1.3 Literata,Georgia,serif;opacity:0;box-shadow:0 8px 24px #0006}
.bubble i,.sub i{position:absolute;top:8px;left:22px;font:500 11px 'IBM Plex Mono',monospace;letter-spacing:1.6px;color:#5e6861;font-style:normal}
.bubble.maya{border:4px solid #dcf26b}.bubble.daniel{border:4px solid #f2c879}
.bubble.think{border-style:dashed}
.bubble.down::after{content:'';position:absolute;bottom:-26px;left:var(--tx,60px);border:14px solid transparent;border-top:22px solid #fffcf5;border-bottom:0;margin-left:-14px;height:0}
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
const imgs = Object.fromEntries(TL.scenes.map((s) => [s.id, [...els[s.id].querySelectorAll('.f')]]))
function frameIndex(cap, st) { const f = FR[cap]; let k = 0; for (let i = 0; i < f.length; i++) if (f[i].t <= st + 1e-6) k = i; return k }
const srcT = (q, L) => q.s0 + (q.s1 - q.s0) * clamp((L - q.t0) / (q.t1 - q.t0))
window.setTime = (T) => {
  for (const s of TL.scenes) {
    const el = els[s.id], L = T - s.start, on = L >= 0 && L < s.dur
    el.style.opacity = on ? 1 : 0; el.style.zIndex = on ? 5 : 0
    if (!on) continue
    el.querySelector(':scope>svg').style.transform = 'scale(' + (1 + 0.07 * L / s.dur) + ')'
    const ph = el.querySelector('.phone')
    if (ph) {
      const p = ease((L - (s.phone[0].t0 - 0.35)) / 0.55); const hit = (s.answerAt ?? []).reduce((m, a) => (L >= a && L - a < 0.3 ? 1 - ease((L - a) / 0.3) : m), 0)
      ph.style.opacity = p; ph.style.transform = 'translateY(' + (50 * (1 - p)) + 'px) scale(' + (1 + 0.05 * hit) + ')'
      let k = 0; s.phone.forEach((q, i) => { if (q.t0 <= L) k = i })
      const q = s.phone[k], prev = k > 0 && s.phone[k - 1].cap !== q.cap ? s.phone[k - 1] : null
      const fade = prev ? clamp((L - q.t0) / 0.3) : 1
      const show = (cap, st, o) => {
        if (cap === 'form') { const f = el.querySelector('.formmock'); f.style.visibility = 'visible'; f.style.opacity = o; f.querySelector('.fm-in').style.marginTop = (-380 * clamp((L - q.t0) / (q.t1 - q.t0))) + 'px'; return }
        const m = imgs[s.id].find((i) => i.dataset.cap === cap && +i.dataset.i === frameIndex(cap, st)); m.style.visibility = 'visible'; m.style.opacity = o
      }
      imgs[s.id].forEach((i) => { i.style.visibility = 'hidden'; i.style.opacity = 1 }); const fm = el.querySelector('.formmock'); if (fm) fm.style.visibility = 'hidden'
      if (prev && fade < 1) show(prev.cap, prev.s1, 1)
      show(q.cap, srcT(q, L), fade)
    }
    el.querySelectorAll('.bubble').forEach((b) => { const a = +b.dataset.t0, z = +b.dataset.t1 + 0.3; const v = L >= a && L < z; b.style.opacity = v ? clamp((L - a) / 0.12) * (1 - clamp((L - z + 0.15) / 0.15)) : 0; b.style.transform = 'scale(' + (0.92 + 0.08 * ease((L - a) / 0.18)) + ')'; b.style.transformOrigin = '0 60%' })
    el.querySelectorAll('.sub').forEach((b) => { const a = +b.dataset.t0, z = +b.dataset.t1 + 0.3; b.style.opacity = L >= a - 0.05 && L < z ? clamp((L - a + 0.05) / 0.12) * (1 - clamp((L - z + 0.15) / 0.15)) : 0 })
    el.querySelectorAll('.rev').forEach((r) => { const q = ease((L - +r.dataset.at) / 0.35); r.style.opacity = q; r.style.transform = 'translateY(' + (12 * (1 - q)) + 'px)' })
    const cn = el.querySelector('.counter'); if (cn && s.counter) cn.textContent = (s.counter[2] * ease((L - s.counter[0]) / (s.counter[1] - s.counter[0]))).toFixed(s.counter[3]) + s.counter[4]
    el.querySelectorAll('.bob').forEach((b, n) => {
      const who = b.dataset.who, l = s.lines.find((x) => x.who === who && L >= x.t0 && L < x.t1), sp = !!l
      const y = sp ? Math.sin(T * 14 + n) * 1.6 - 1.0 : Math.sin(T * 2.4 + n * 2) * 1.2
      b.style.transform = 'translateY(' + y.toFixed(2) + 'px)'
      const [rx, ry] = l ? (TL.vis[l.id][Math.floor((L - l.t0) * TL.fps)] ?? [5, 0.01]) : [5, 0.01]
      const m = b.querySelector('.mouth ellipse'); m.setAttribute('rx', rx); m.setAttribute('ry', ry)
    })
    const ck = el.querySelector('.clock'); if (ck && s.clock) ck.textContent = L >= s.clock[2] ? s.clock[1] : s.clock[0]
  }
  const sc0 = TL.scenes.find((s) => T >= s.start && T < s.start + s.dur); document.getElementById('made').style.opacity = sc0 && !['counter', 'meet', 'finale'].includes(sc0.id) ? 1 : 0
  let wx = -101; for (const s of TL.scenes.slice(1)) { const b = s.start, d = T - b; if (d > -0.16 && d < 0.16) wx = d < 0 ? -101 + 101 * ease((d + 0.16) / 0.16) : 101 * clamp(d / 0.16) }
  document.getElementById('wipe').style.transform = 'translateX(' + wx + '%)'
}
window.ready = Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => 0))]).then(() => true)
setTime(0)
</script></body></html>`
writeFileSync(join(dir, `film${SUF}.html`), html)
console.log('timeline', timeline.total, 's;', scenes.map((s) => `${s.id} ${s.start}+${s.dur.toFixed(1)}`).join(' | '))
