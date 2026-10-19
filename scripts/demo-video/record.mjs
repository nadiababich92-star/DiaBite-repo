/**
 * Record the three-minute demo (docs/DEMO_SCRIPT.md) from the live app, in a clean browser, with the waiting cut out.
 *
 *   node scripts/demo-video/tts.mjs          # first: the narration WAVs and their durations, in /tmp/dv
 *   node scripts/demo-video/record.mjs       # this: frames and a manifest, in /tmp/dv/rec
 *   node scripts/demo-video/assemble.mjs     # then: /tmp/dv/demo-3min.mp4
 *
 * What it does, with no account of yours: creates a throwaway demo person with the service key (read from the
 * Container App secret, never printed), walks onboarding once off camera so the profile lives on the server, seeds
 * a diary history for that person (so the week has something to show; the video says it is a demo week), then opens a
 * SECOND clean browser, signs in, and records: the first-run tips are on because that browser has never seen them.
 * Every action waits for the real app; the time spent waiting for a model is cut from the video, and each
 * narration segment is placed on the video's own clock so words and screen stay together. The account is deleted at the end.
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { launch } from '../../eval/lib/cdp.mjs'
import { titleCard, problemCard, endCard, archSlide, evalSlide } from './cards.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..', '..')
const OUT = process.env.OUT ?? '/tmp/dv'
const REC = join(OUT, 'rec')
const APP = process.env.APP ?? 'https://diabite-engine.greenglacier-ab5551c6.swedencentral.azurecontainerapps.io'
const SB = 'https://qennxqfbvgqyodjmkguo.supabase.co', REF = 'qennxqfbvgqyodjmkguo'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const dur = JSON.parse(readFileSync(join(OUT, 'durations.json'), 'utf8'))
const env = readFileSync(`${ROOT}/.env.local`, 'utf8')
const PUB = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)?.[1]?.trim()
const az = (cmd) => execSync(cmd, { env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } }).toString().trim()
const SVC = az(`az containerapp secret show -g rg-nadia.babich92-5702 -n diabite-engine --secret-name supabase-service-key --query value -o tsv`)
const admin = (path, init = {}) => fetch(SB + path, { ...init, headers: { apikey: SVC, authorization: `Bearer ${SVC}`, 'content-type': 'application/json', ...(init.headers ?? {}) } })

// CLIP=1 records the short how-it-works clip for the pitch deck (OUT=/tmp/dvc, narration-clip.json) instead of the full demo story.
const CLIP = process.env.CLIP === '1'
mkdirSync(OUT, { recursive: true })
const email = `demo-${Date.now()}@example.com`, password = 'Dm-' + Math.random().toString(36).slice(2) + 'Aa1'
const created = await (await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) })).json()
const uid = created.id
const session = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUB, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()
const stored = JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) + session.expires_in })
const FRESH = `localStorage.clear(); localStorage.setItem('diabite.session', 'test-demo-' + crypto.randomUUID()); localStorage.setItem('sb-${REF}-auth-token', ${JSON.stringify(stored)}); localStorage.setItem('diabite.nudge.v1', JSON.stringify(['after_3_meals','day_2']))${CLIP ? "; localStorage.setItem('diabite.tour.v1', JSON.stringify(['input','verdict','calc','log']))" : ''}`

try {
  // ── 1. Off camera: only the diary history (onboarding is on camera) ────────
  // A demo person's diary: a few weeks of days before today, so the week and the four-week strip have something to show. Today is empty: breakfast is the first meal.
  const dayAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const rows = []
  const add = (n, meal, food_id, grams) => rows.push({ user_id: uid, id: `demo-${n}-${meal}-${food_id}`, day: dayAgo(n), meal, food_id, grams, snapshot: null, updated_at: new Date().toISOString() })
  const goodDay = (n) => { add(n, 'breakfast', 'oats', 50); add(n, 'lunch', 'lentils', 150); add(n, 'dinner', 'salmon', 150); add(n, 'dinner', 'broccoli', 100) }
  const overDay = (n) => { add(n, 'breakfast', 'oats', 80); add(n, 'lunch', 'rice-white', 300); add(n, 'dinner', 'pasta-durum', 250) }
  for (const n of [1, 2, 3, 5, 8, 9, 10, 12, 15, 16, 18, 22, 23, 25]) goodDay(n)
  for (const n of [4, 11]) overDay(n)
  for (const n of [6, 17]) add(n, 'lunch', 'lentils', 150)
  // The clip has no setup scene: the profile is stored off camera, the same one the setup scene would have made.
  if (CLIP) {
    const profile = { sex: 'female', age: 52, heightCm: 168, weightKg: 70, activity: 'light', condition: 't2', goal: 'lose', carbApproach: 'low', excludedFoodIds: [], insulin: 'none', meds: ['metformin'], pregnantOrBreastfeeding: false, kidney: 'none', comorbidities: [], allergens: [], pattern: 'none', units: 'imperial', showBreadUnits: false, onboarded: true }
    const p = await admin('/rest/v1/profiles', { method: 'POST', body: JSON.stringify({ user_id: uid, data: profile, consent_at: new Date().toISOString(), consent_version: '2026-10-b', updated_at: new Date().toISOString() }), headers: { prefer: 'return=minimal' } })
    console.log('stored the profile:', p.status)
  }
  const seeded = await admin('/rest/v1/diary_entries', { method: 'POST', body: JSON.stringify(rows), headers: { prefer: 'return=minimal' } })
  console.log(`seeded ${rows.length} diary rows:`, seeded.status)

  // ── 2. On camera: a clean browser that has never seen the app ─────────────
  rmSync(REC, { recursive: true, force: true }); mkdirSync(REC, { recursive: true })
  const b = await launch({ port: 9811, width: 1366, height: 768, dpr: 1.405 })
  const errs = []
  b.on('Runtime.exceptionThrown', (p) => errs.push(p.exceptionDetails?.exception?.description?.slice(0, 160) ?? 'exception'))
  // `?demo` hides what is for the builders (the lab row, the tool-call panel); see src/lib/demo.ts.
  await b.send('Page.navigate', { url: `${APP}/?demo` }); await sleep(2500)
  await b.ev(FRESH); await b.send('Page.reload'); await sleep(4000)

  // Screencast frames, kept with the wall-clock time Chrome gave them.
  const frames = []
  b.on('Page.screencastFrame', (p) => {
    const name = `f${String(frames.length).padStart(5, '0')}.jpg`
    writeFileSync(join(REC, name), Buffer.from(p.data, 'base64'))
    frames.push({ name, t: p.metadata.timestamp })
    b.send('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {})
  })

  // The video's own clock: real time minus the spans cut out (a model thinking).
  const now = () => Date.now() / 1000
  const cuts = []
  let open = null
  const cutStart = () => { if (open === null) open = now() }
  const cutEnd = () => { if (open !== null) { cuts.push({ from: open, to: now() }); open = null } }
  let t0 = 0
  const cutBefore = (t) => cuts.reduce((s, c) => s + Math.max(0, Math.min(c.to, t) - c.from), 0) + (open !== null ? Math.max(0, t - open) : 0)
  const vt = () => now() - t0 - cutBefore(now())
  const audio = []
  const say = (id) => { const start = vt(); audio.push({ id, start }); return start + dur[id] }
  const holdTo = async (end) => { while (vt() < end) await sleep(80) }

  const inject = () => b.ev(`(()=>{ if (document.getElementById('__cur')) return;
    const c = document.createElement('div'); c.id = '__cur'; c.style.cssText = 'position:fixed;z-index:99999;width:22px;height:22px;border-radius:50%;background:rgba(14,90,60,.92);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);left:-40px;top:-40px;pointer-events:none;transition:left .65s ease,top .65s ease';
    const r = document.createElement('div'); r.id = '__rip'; r.style.cssText = 'position:fixed;z-index:99998;width:46px;height:46px;border-radius:50%;border:3px solid rgba(14,90,60,.8);pointer-events:none;opacity:0;transform:translate(-50%,-50%) scale(.4);transition:opacity .5s,transform .5s';
    document.body.append(c, r) })()`)
  const pointAt = async (x, y) => {
    await inject()
    await b.ev(`(()=>{const c=document.getElementById('__cur'); c.style.left=(${x}-11)+'px'; c.style.top=(${y}-11)+'px'})()`)
    await sleep(750)
  }
  const ripple = async (x, y) => {
    await b.ev(`(()=>{const r=document.getElementById('__rip'); r.style.transition='none'; r.style.left='${x}px'; r.style.top='${y}px'; r.style.opacity='1'; r.style.transform='translate(-50%,-50%) scale(.4)'; void r.offsetWidth; r.style.transition='opacity .5s,transform .5s'; r.style.opacity='0'; r.style.transform='translate(-50%,-50%) scale(1.5)'})()`)
  }
  // Find a clickable thing (by selector, or by text on a button), move the pointer to it, click it.
  const target = (spec) => `(()=>{
    const spec = ${JSON.stringify(spec)};
    const e = spec.sel ? document.querySelector(spec.sel) : [...document.querySelectorAll(spec.scope ?? 'button')].find(x => x.innerText.trim().startsWith(spec.text));
    if (!e) return null; if (!spec.noScroll) e.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = e.getBoundingClientRect(); if (spec.noScroll && (r.bottom < 0 || r.top > window.innerHeight)) return null; return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(r.height / 2, 40)) } })()`
  const clickOn = async (spec, { wait = 8000 } = {}) => {
    let p = null
    for (let i = 0; i < wait / 200 && !p; i++) { p = await b.ev(target(spec)); if (!p) await sleep(200) }
    if (!p) throw new Error(`nothing to click: ${JSON.stringify(spec)}; the page says: ${(await b.ev('document.body.innerText')).slice(0, 300).replace(/\n+/g, ' | ')}`)
    await pointAt(p.x, p.y); await ripple(p.x, p.y); await sleep(180)
    await b.ev(`(()=>{const spec=${JSON.stringify(spec)}; const e = spec.sel ? document.querySelector(spec.sel) : [...document.querySelectorAll(spec.scope ?? 'button')].find(x => x.innerText.trim().startsWith(spec.text)); e.click()})()`)
    // Park the pointer beside the button so it does not sit on its label.
    await b.ev(`(()=>{const c=document.getElementById('__cur'); if(c){c.style.transition='left .5s ease,top .5s ease'; c.style.left=(${p.x}+95)+'px'; c.style.top=(${p.y}+45)+'px'}})()`)
    await sleep(350)
  }
  // The camera: a gentle drift whose strength can change by scene (cards can take more than the app).
  const zones = []
  const zone = (amp) => zones.push({ at: vt(), amp })
  // The pointer visits what is being spoken about, one place at a time, until the segment ends.
  const wander = async (sels, end) => {
    const left = Math.max(0, end - vt()); if (left < 1) return
    const step = left / sels.length
    for (const sel of sels) {
      const until = vt() + step
      const p = await b.ev(target({ sel, noScroll: true }))
      if (p) await pointAt(p.x, p.y)
      await holdTo(until)
    }
  }
  const typeAge = async (value) => {
    const spec = { sel: 'label.field input' }
    const p = await b.ev(`(()=>{const el=[...document.querySelectorAll('label.field')].find(l=>l.innerText.trim().startsWith('Age'))?.querySelector('input'); if(!el) return null; el.scrollIntoView({block:'center',behavior:'instant'}); const r=el.getBoundingClientRect(); return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`)
    await pointAt(p.x, p.y); await ripple(p.x, p.y)
    await b.ev(`(()=>{const el=[...document.querySelectorAll('label.field')].find(l=>l.innerText.trim().startsWith('Age'))?.querySelector('input'); el.focus(); el.select()})()`)
    // One piece, not a digit at a time: a lone "5" is read as a five-year-old and the app stops with its "for adults" screen.
    await b.send('Input.insertText', { text: String(value) })
    await sleep(300)
  }
  // Scroll steadily for the whole of a narration segment, so the screen is never still while it speaks.
  const driftScroll = async (end, px) => {
    const from = await b.ev(`window.scrollY`), t1 = vt(), len = Math.max(1, end - t1)
    while (vt() < end) {
      const k = Math.min(1, (vt() - t1) / len)
      await b.ev(`window.scrollTo(0, ${from} + ${px} * ${k})`)
      await sleep(70)
    }
  }
  const typeIn = async (text) => {
    const p = await b.ev(target({ sel: 'input[type=text]' }))
    await pointAt(p.x, p.y); await ripple(p.x, p.y)
    await b.ev(`(()=>{const i=document.querySelector('input[type=text]'); i.focus(); i.select()})()`)
    for (const ch of text) { await b.send('Input.insertText', { text: ch }); await sleep(52) }
    await sleep(250)
  }
  // Wait for an answer; keep the first moment of "Thinking…" on screen, then cut the rest out.
  const awaitAnswer = async (needs = 'section.answer') => {
    await sleep(1300)
    cutStart()
    for (let i = 0; i < 240; i++) {
      const busy = await b.ev(`[...document.querySelectorAll('button')].some(x=>x.innerText.includes('Thinking'))`)
      const done = await b.ev(`!!document.querySelector(${JSON.stringify(needs)})`)
      if (!busy && done) break
      await sleep(250)
    }
    await sleep(500)
    cutEnd()
  }
  const smoothScroll = (to, ms) => b.ev(`new Promise(res => { const from = window.scrollY, d = ${to} - from, t = performance.now(); const f = (n) => { const k = Math.min(1, (n - t) / ${ms}); window.scrollTo(0, from + d * (k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2) / 2)); k < 1 ? requestAnimationFrame(f) : res(1) }; requestAnimationFrame(f) })`)

  await b.send('Page.startScreencast', { format: 'jpeg', quality: 82, everyNthFrame: 1 })
  await sleep(1200)
  t0 = now()

  const has = (sel) => () => b.ev(`!!document.querySelector(${JSON.stringify(sel)})`)
  const dataUrl = (html) => `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
  const showCard = async (html) => { await b.send('Page.navigate', { url: dataUrl(html) }); await sleep(1300) }
  const trustPage = `file://${ROOT}/docs/diabite-trust-page.html`
  // Dana is a made-up person, and the corner of the screen says so.
  const setChip = (label) => b.ev(`(()=>{ let c = document.getElementById('__chip'); if (!c) { c = document.createElement('div'); c.id = '__chip';
    c.style.cssText = 'position:fixed;left:44px;bottom:44px;z-index:99997;background:#fffcf5;border:1px solid #dcd3bf;border-radius:14px;padding:10px 14px;font:600 14px/1.35 IBM Plex Sans,system-ui,sans-serif;color:#14201a;box-shadow:0 6px 18px rgba(0,0,0,.14);max-width:270px'; document.body.append(c) }
    c.innerHTML = '<div>Dana <span style="font-weight:400;color:#4f5a53">· 52 · type 2 · metformin</span></div><div style="font-weight:400;color:#4f5a53;font-size:13px">' + ${JSON.stringify(label)} + ' · a made-up person</div>' })()`)
  const openApp = async (label) => { await b.send('Page.navigate', { url: `${APP}/?demo` }); await sleep(3800); await inject(); await setChip(label) }
  const answered = () => b.ev(`!!document.querySelector('section.answer')`)
  // Ask in the box. If the answer is not the one the story needs, ask again inside a cut; what stays on screen is one that is.
  const askUntil = async (text, ok, { tries = 4, typed = true } = {}) => {
    if (typed) await typeIn(text)
    await clickOn({ text: 'Check this meal' }); await awaitAnswer('section.answer')
    for (let k = 0; k < tries && !(await ok()); k++) {
      cutStart()
      await b.ev(`[...document.querySelectorAll('button')].find(x => x.innerText.trim().startsWith('Ask something else'))?.click()`); await sleep(500)
      await b.ev(`(()=>{const i=document.querySelector('input[type=text]'); i.focus(); i.select()})()`)
      await b.send('Input.insertText', { text }); await sleep(300)
      await b.ev(`[...document.querySelectorAll('button')].find(x => x.innerText.trim().startsWith('Check this meal'))?.click()`); await sleep(1500)
      for (let i = 0; i < 240; i++) { const busy = await b.ev(`[...document.querySelectorAll('button')].some(x=>x.innerText.includes('Thinking'))`); if (!busy && (await answered())) break; await sleep(250) }
      await sleep(500); cutEnd()
    }
    if (!(await ok())) throw new Error(`not the answer the story needs: ${text}`)
  }
  let end

  // ── The story: a title, Dana and her problem, the promise ──────────────────
  zone(0.07)
  if (!process.env.SKIP_CARDS) {
  await showCard(titleCard()); end = say('t0'); await holdTo(end + 0.6)
    await showCard(problemCard()); const s1 = vt(); end = say('t1')
    const lit = [0.20, 0.34, 0.52, 0.70, 0.86]
    for (let i = 0; i < lit.length; i++) { await holdTo(s1 + lit[i] * dur.t1); await b.ev(`window.reveal(${i})`) }
    await holdTo(end + 0.4)
    // The promise, as a slide that fills in while it is spoken about.
    await showCard(archSlide()); const s2 = vt(); end = say('t2')
    for (const [i, f] of [[0, 0.0], [1, 0.20], [2, 0.38], [3, 0.56], [4, 0.74], [5, 0.90]]) { await holdTo(s2 + f * dur.t2); await b.ev(`window.reveal(${i})`) }
    await holdTo(end + 0.5)
  }
  zone(0.03)

  if (CLIP) {
    // ── the short clip: breakfast, a no with a swap, a plan, a refused dose question ─────────────
    await openApp('Thursday')
    await b.ev(`window.scrollTo(0, 0)`)
    end = say('k0'); await typeIn('Two eggs, a slice of rye bread and half an avocado')
    await clickOn({ text: 'Check this meal' }); await awaitAnswer('section.answer'); await holdTo(end)
    end = say('k1'); await b.ev(`window.scrollTo(0, 0)`)
    await wander(['.eyebrow-line', '.fig-lead'], vt() + (end - vt()) * 0.4)
    await clickOn({ text: 'Show calculation' }); await sleep(900); await driftScroll(end - 0.6, 380)
    await b.ev(`window.scrollTo(0, 0)`); await clickOn({ text: 'Log' }); await sleep(700)
    end = say('k2'); await b.ev(`window.scrollTo(0, 0)`)
    await askUntil('Spaghetti with tomato sauce, garlic bread and a glass of orange juice', async () => (await b.ev(`!!document.querySelector('.tone-bad')`)) && (await b.ev(`/wap/.test(document.body.innerText)`)))
    await b.ev(`(()=>{ const n = document.querySelector('.a-next'); n?.scrollIntoView({ block: 'center', behavior: 'smooth' }); n?.classList.add('tour-ring') })()`)
    await sleep(900); await wander(['.a-next'], vt() + 2.2)
    await b.ev(`document.querySelector('.a-next')?.classList.remove('tour-ring')`); await b.ev(`window.scrollTo(0, 0)`)
    await askUntil('Whole wheat spaghetti with tomato sauce, garlic bread and a glass of water', async () => (await has('.tone-good')()) || (await has('.tone-change')()))
    await holdTo(end); await b.ev(`window.scrollTo(0, 0)`)
    end = say('k3')
    await clickOn({ text: 'Tomorrow', scope: '.day-picker button' }); await sleep(500)
    await clickOn({ text: 'Plan it' }); await sleep(800)
    await clickOn({ text: 'Diary', scope: '[role=tab]' }); await sleep(1100)
    await clickOn({ sel: 'button[aria-label="The day after"]' }); await sleep(900)
    await b.ev(`window.scrollTo(0, 0)`); await wander(['.planned-line', '.entry.planned'], end)
    await clickOn({ text: 'Ask', scope: '[role=tab]' }); await sleep(800)
    await typeIn('How many units of insulin should I take before pasta?')
    await clickOn({ text: 'Check this meal' }); await sleep(900); await b.ev(`window.scrollTo(0, 0)`)
    end = say('k4'); await wander(['.eyebrow-line', '.answer-text'], end); await holdTo(end + 1.0)
  } else {
  // ── Thursday morning: the setup, on camera ────────────────────────────────
  await openApp('Thursday, 7:40 am')
  await b.ev(`window.scrollTo(0,0)`)
  end = say('o0'); await wander(['.masthead', '.onb-progress', 'h2'], end)
  end = say('o1')
  await clickOn({ text: 'I agree that DiaBite keeps this', scope: 'label' }); await sleep(400)
  await typeAge(52)
  await wander(['h2', 'ul'], end)
  await clickOn({ text: 'Continue' }); await sleep(900)
  end = say('o2')
  await clickOn({ text: 'Type 2 diabetes' }); await sleep(500)
  await clickOn({ text: 'Continue' }); await sleep(900)
  await clickOn({ text: 'Metformin', scope: 'label' }); await sleep(500)
  await wander(['h2', 'label:has(input:checked)'], end)
  await clickOn({ text: 'Continue' }); await sleep(900)
  await clickOn({ text: 'Continue' }); await sleep(900)
  end = say('o3'); await sleep(1500)
  await driftScroll(end - 2.2, 330)
  await clickOn({ text: 'I understand', scope: 'label' }); await sleep(600)
  await clickOn({ text: 'Start using DiaBite' }); await sleep(2200)

  // ── then the first tip, and breakfast ─────────────────────────────────────
  await b.ev(`window.scrollTo(0,0)`)
  end = say('b0'); await sleep(1500)
  if (!(await b.ev(`!!document.querySelector('.tour-tip')`))) throw new Error('the first tip is not showing: this browser has seen the tips')
  await holdTo(end); await clickOn({ sel: '.tour-tip button.primary' })
  end = say('b1a'); await typeIn('Two eggs, a slice of rye bread and half an avocado')
  await clickOn({ text: 'Check this meal' }); await awaitAnswer('.tour-tip'); await holdTo(end)
  await b.ev(`window.scrollTo(0, 0)`)
  end = say('b1b'); await wander(['.eyebrow-line', '.fig-lead', '.verify-row'], end)
  end = say('b1c'); await wander(['.tour-tip h2', '.tour-tip p'], end); await clickOn({ sel: '.tour-tip button.primary' })
  await sleep(500)
  await clickOn({ text: 'Show calculation' })
  end = say('b1d'); await sleep(1200); await driftScroll(end - 0.5, 420)
  await clickOn({ sel: '.tour-tip button.primary' })
  end = say('b1e'); await clickOn({ text: 'Log' }); await sleep(500)
  await clickOn({ sel: '.tour-tip button.primary' }); await holdTo(end)

  // ── Thursday evening: it does not fit, and the app names a swap ───────────
  await setChip('Thursday, 6:45 pm')
  await b.ev(`window.scrollTo(0, 0)`)
  end = say('d0')
  const DINNER = 'Spaghetti with tomato sauce, garlic bread and a glass of orange juice'
  await askUntil(DINNER, async () => (await b.ev(`!!document.querySelector('.tone-bad')`)) && (await b.ev(`/wap/.test(document.body.innerText)`)))
  await holdTo(end); await b.ev(`window.scrollTo(0, 0)`)
  end = say('d1')
  await wander(['.eyebrow-line', '.fig-lead'], vt() + (end - vt()) * 0.5)
  // the swap it names is the point of this scene: bring it into view and ring it
  await b.ev(`(()=>{ const n = document.querySelector('.a-next'); n?.scrollIntoView({ block: 'center', behavior: 'smooth' }); n?.classList.add('tour-ring') })()`)
  await sleep(900); await wander(['.a-next'], end)
  await b.ev(`document.querySelector('.a-next')?.classList.remove('tour-ring')`)
  end = say('d2'); await b.ev(`window.scrollTo(0, 0)`)
  // "Fits" and "Fits with a change" both mean it fits; the second carries a further swap in its Next line.
  await askUntil('Whole wheat spaghetti with tomato sauce, garlic bread and a glass of water', async () => (await has('.tone-good')()) || (await has('.tone-change')()))
  await holdTo(end); await b.ev(`window.scrollTo(0, 0)`)
  end = say('d3'); await wander(['.eyebrow-line', '.fig-lead'], end)

  // ── The same evening: the swap becomes a plan for Friday ──────────────────
  await setChip('Thursday, 6:55 pm')
  await b.ev(`window.scrollTo(0, 0)`)
  end = say('p0')
  await clickOn({ text: 'Tomorrow', scope: '.day-picker button' }); await sleep(600)
  await clickOn({ text: 'Plan it' }); await sleep(900); await holdTo(end)
  end = say('p1')
  await clickOn({ text: 'Diary', scope: '[role=tab]' }); await sleep(1300)
  await clickOn({ sel: 'button[aria-label="The day after"]' }); await sleep(1100)
  await b.ev(`window.scrollTo(0, 0)`)
  await wander(['.planned-line', '.entry.planned', '.entry.planned:nth-child(2)'], end)
  end = say('p2')
  await clickOn({ text: 'Menu', scope: '[role=tab]' })
  for (let i = 0; i < 60 && !(await has('.menu-meal')()); i++) await sleep(300)
  await clickOn({ text: 'Shopping list' }); await sleep(900)
  await b.ev(`document.querySelector('.menu-head')?.scrollIntoView({block:'start'}); window.scrollBy(0, 120)`); await sleep(600)
  await wander(['table', 'table tbody tr:nth-child(1)', 'table tbody tr:nth-child(3)'], end)
  await clickOn({ text: 'Ask', scope: '[role=tab]' }); await sleep(900)

  // ── Thursday night: the question it will not answer ───────────────────────
  await setChip('Thursday, 10:30 pm')
  end = say('i0'); await typeIn('How many units of insulin should I take before pasta?')
  await clickOn({ text: 'Check this meal' }); await sleep(900); await holdTo(end)
  end = say('i1'); await b.ev(`window.scrollTo(0, 0)`); await wander(['.eyebrow-line', '.answer-text'], end)

  // ── Sunday at her grandmother's: a dish the database does not have ────────
  await setChip('Sunday, 1:00 pm')
  await b.ev(`window.scrollTo(0, 0)`)
  end = say('l0')
  const dishCounted = () => b.ev(`[...document.querySelectorAll('button')].some(x => x.innerText.trim().startsWith('Edit the recipe'))`)
  await askUntil('Cholent with beef, barley, kidney beans and potatoes', dishCounted)
  await holdTo(end); await b.ev(`window.scrollTo(0, 0)`)
  end = say('l1'); await wander(['.eyebrow-line', '.answer-text'], end)
  end = say('l2'); await clickOn({ text: 'Edit the recipe' }); await sleep(1800)
  await clickOn({ sel: '.remove-step' })
  cutStart()
  for (let i = 0; i < 40; i++) { if (await b.ev(`!!document.querySelector('.stale')`)) break; await sleep(250) }
  await sleep(400); cutEnd()
  await b.ev(`window.scrollTo(0, 0)`); await wander(['.eyebrow-line', '.fig-lead'], end)

  // ── Her week ───────────────────────────────────────────────────────────────
  await setChip('A demo week')
  end = say('w0'); await clickOn({ text: 'Diary', scope: '[role=tab]' }); await sleep(1500)
  await b.ev(`document.querySelector('.week-sum')?.scrollIntoView({block:'start'}); window.scrollBy(0,-80)`); await sleep(800)
  await wander(['.week-sum', '.week li:nth-child(3)', '.week li:nth-child(6)', '.weeks li:nth-child(1)', '.weeks li:nth-child(2)'], end)

  // ── How we know it works ───────────────────────────────────────────────────
  zone(0.07)
  await showCard(evalSlide()); const s3 = vt(); end = say('e0')
  for (const [i, f] of [[0, 0.0], [1, 0.22], [2, 0.48], [3, 0.70]]) { await holdTo(s3 + f * dur.e0); await b.ev(`window.reveal(${i})`) }
  await holdTo(end + 0.6)

  // ── The ask ────────────────────────────────────────────────────────────────
  zone(0.07)
  await showCard(endCard('diabite.pro'))
  end = say('c0'); await holdTo(end + 1.5)

  }
  await b.send('Page.stopScreencast')
  const tEnd = now()
  const total = vt()
  writeFileSync(join(REC, 'manifest.json'), JSON.stringify({ t0, tEnd, total, frames, cuts, audio, zones, size: { w: 1366, h: 768, dpr: 1.405 } }, null, 1))
  console.log(`recorded ${frames.length} frames, ${cuts.length} cuts, ${total.toFixed(1)} s of video; script errors: ${errs.length ? errs.slice(0, 2) : 'none'}`)
  await b.close()
} finally {
  await admin(`/auth/v1/admin/users/${uid}`, { method: 'DELETE' }).catch(() => {})
  console.log('demo account removed')
}
