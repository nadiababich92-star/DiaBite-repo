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

mkdirSync(OUT, { recursive: true })
const email = `demo-${Date.now()}@example.com`, password = 'Dm-' + Math.random().toString(36).slice(2) + 'Aa1'
const created = await (await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) })).json()
const uid = created.id
const session = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUB, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()
const stored = JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) + session.expires_in })
const FRESH = `localStorage.clear(); localStorage.setItem('sb-${REF}-auth-token', ${JSON.stringify(stored)})`

try {
  // ── 1. Off camera: the demo person's profile, on the server ───────────────
  const setup = await launch({ port: 9810, width: 390, height: 844, dpr: 1 })
  const click = (b, t) => b.ev(`(()=>{const e=[...document.querySelectorAll('button')].find(x=>x.innerText.trim().startsWith(${JSON.stringify(t)})); if(!e) return 'NO'; e.click(); return 'ok'})()`)
  await setup.send('Page.navigate', { url: APP }); await sleep(2500)
  await setup.ev(FRESH); await setup.send('Page.reload'); await sleep(3500)
  await setup.ev(`window.__setNum = (labelText, v) => { const el = [...document.querySelectorAll('label.field')].find(l => l.innerText.trim().startsWith(labelText))?.querySelector('input'); if (!el) return; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true })) }; window.__check = (txt) => { const c = document.querySelector('input[aria-label="' + txt + '"]') ?? [...document.querySelectorAll('label')].find(l => l.innerText.includes(txt))?.querySelector('input'); if (c && !c.checked) c.click() }`)
  await setup.ev(`__check('I agree that DiaBite keeps this about me')`)
  await setup.ev(`__setNum('Age', 52)`); await click(setup, 'Continue'); await sleep(700)
  await click(setup, 'Type 2 diabetes'); await click(setup, 'Continue'); await sleep(700)
  await click(setup, 'Continue'); await sleep(700); await click(setup, 'Continue'); await sleep(700)
  for (let i = 0; i < 8; i++) {
    await setup.ev(`__check('I understand this is not medical advice')`); await sleep(300)
    await click(setup, 'Start using DiaBite'); await sleep(1800)
    if (await setup.ev(`!!document.querySelector('.ask-form')`)) break
  }
  await sleep(1500)
  await setup.close()

  // A demo person's diary: a few weeks of days, so the week and the four-week strip have something to show.
  const dayAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const rows = []
  const add = (n, meal, food_id, grams) => rows.push({ user_id: uid, id: `demo-${n}-${meal}-${food_id}`, day: dayAgo(n), meal, food_id, grams, snapshot: null, updated_at: new Date().toISOString() })
  const goodDay = (n) => { add(n, 'breakfast', 'oats', 50); add(n, 'lunch', 'lentils', 150); add(n, 'dinner', 'salmon', 150); add(n, 'dinner', 'broccoli', 100) }
  const overDay = (n) => { add(n, 'breakfast', 'oats', 80); add(n, 'lunch', 'rice-white', 300); add(n, 'dinner', 'pasta-durum', 250) }
  for (const n of [1, 2, 3, 5, 8, 9, 10, 12, 15, 16, 18, 22, 23, 25]) goodDay(n)
  for (const n of [4, 11]) overDay(n)
  for (const n of [6, 17]) add(n, 'lunch', 'lentils', 150)
  add(0, 'breakfast', 'greekyogurt', 150)   // today, so the day has something in it
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
    if (!e) return null; e.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = e.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } })()`
  const clickOn = async (spec, { wait = 8000 } = {}) => {
    let p = null
    for (let i = 0; i < wait / 200 && !p; i++) { p = await b.ev(target(spec)); if (!p) await sleep(200) }
    if (!p) throw new Error(`nothing to click: ${JSON.stringify(spec)}`)
    await pointAt(p.x, p.y); await ripple(p.x, p.y); await sleep(180)
    await b.ev(`(()=>{const spec=${JSON.stringify(spec)}; const e = spec.sel ? document.querySelector(spec.sel) : [...document.querySelectorAll(spec.scope ?? 'button')].find(x => x.innerText.trim().startsWith(spec.text)); e.click()})()`)
    // Park the pointer beside the button so it does not sit on its label.
    await b.ev(`(()=>{const c=document.getElementById('__cur'); if(c){c.style.transition='left .5s ease,top .5s ease'; c.style.left=(${p.x}+95)+'px'; c.style.top=(${p.y}+45)+'px'}})()`)
    await sleep(350)
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
  await inject()

  // 0. The empty screen and the first tip
  await b.ev(`window.scrollTo(0,0)`)
  let end = say('s0'); await sleep(2500)
  if (!(await b.ev(`!!document.querySelector('.tour-tip')`))) throw new Error('the first tip is not showing: this browser has seen the tips')
  await holdTo(end - 1.2)
  await clickOn({ sel: '.tour-tip button.primary' })

  // 1. A meal in your own words
  end = say('s1a'); await typeIn('Two eggs, a slice of rye bread and half an avocado')
  await clickOn({ text: 'Check this meal' }); await awaitAnswer('.tour-tip')
  await holdTo(end)
  await b.ev(`window.scrollTo(0, 0)`)
  end = say('s1b'); await holdTo(end)
  end = say('s1c'); await holdTo(end); await clickOn({ sel: '.tour-tip button.primary' })
  await sleep(500)
  await clickOn({ text: 'Show calculation' })
  end = say('s1d'); await sleep(1500); await smoothScroll(520, 5000); await holdTo(end)
  await clickOn({ sel: '.tour-tip button.primary' })
  end = say('s1e'); await clickOn({ text: 'Log it' }); await sleep(500)
  await clickOn({ sel: '.tour-tip button.primary' }); await holdTo(end)

  // 2. The diary and the week
  end = say('s2'); await clickOn({ text: 'Diary', scope: '[role=tab]' }); await sleep(1500)
  await b.ev(`document.querySelector('.week-sum')?.scrollIntoView({block:'start'}); window.scrollBy(0,-80)`); await sleep(1500)
  await holdTo(end)

  // 3. A dish it does not have
  await clickOn({ text: 'Ask', scope: '[role=tab]' }); await sleep(1200)
  await b.ev(`window.scrollTo(0,0)`)
  end = say('s3a'); await b.ev(`document.querySelector('.ask-form')?.scrollIntoView({block:'center'})`)
  await typeIn('Cholent with beef, barley, kidney beans and potatoes')
  await clickOn({ text: 'Check this meal' }); await awaitAnswer('section.answer'); await holdTo(end)
  await b.ev(`window.scrollTo(0, 0)`)
  end = say('s3b'); await holdTo(end)
  end = say('s3c'); await clickOn({ text: 'Edit the recipe' }); await sleep(1800)
  await clickOn({ sel: '.remove-step' })
  cutStart()
  for (let i = 0; i < 40; i++) { if (await b.ev(`!!document.querySelector('.stale')`)) break; await sleep(250) }
  await sleep(400); cutEnd()
  await b.ev(`window.scrollTo(0, 0)`); await holdTo(end)

  // 4. Safety
  await b.ev(`window.scrollTo(0,0)`)
  end = say('s4a'); await typeIn('How many units of insulin should I take before pasta?')
  await clickOn({ text: 'Check this meal' }); await sleep(900); await holdTo(end)
  end = say('s4b'); await b.ev(`window.scrollTo(0, 0)`); await holdTo(end)

  // 5. How it is built
  await b.send('Page.navigate', { url: `file://${ROOT}/docs/diabite-trust-page.html` }); await sleep(2500)
  await b.ev(`document.querySelector('.eyebrow')?.scrollIntoView(); document.getElementById('arch-h')?.scrollIntoView({block:'start'}); window.scrollBy(0,-24)`); await sleep(600)
  end = say('s5'); await sleep(4000)
  await smoothScroll(await b.ev(`Math.round(window.scrollY + 380)`), 9000); await holdTo(end)

  // 6. The ask
  await b.send('Page.navigate', { url: 'about:blank' }); await sleep(300)
  await b.send('Page.navigate', { url: `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><meta charset=utf-8><style>
    html,body{margin:0;height:100%;background:#f1ece0;color:#14201a;font-family:'IBM Plex Sans',system-ui,sans-serif}
    main{height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:22px;text-align:center;padding:0 64px}
    h1{font:600 76px/1.1 Georgia,serif;margin:0;letter-spacing:-.02em} h1 b{background:#dcf26b;padding:0 12px;border-radius:6px}
    p{margin:0;font-size:30px;color:#4f5a53;max-width:900px;line-height:1.4} code{font:500 30px 'IBM Plex Mono',ui-monospace,monospace;color:#0e5a3c;background:#fffcf5;border:1px solid #dcd3bf;border-radius:10px;padding:12px 20px}
  </style><main><h1>Dia<b>Bite</b></h1><p>Free to try. It asks for your email, and sends you a code.</p><code>diabite-engine.greenglacier-ab5551c6.swedencentral.azurecontainerapps.io</code><p>If you have type 2 diabetes, prediabetes or insulin resistance, I would like to hear where it breaks.</p></main>`)}` })
  await sleep(1200)
  end = say('s6'); await holdTo(end + 1.5)

  await b.send('Page.stopScreencast')
  const tEnd = now()
  const total = vt()
  writeFileSync(join(REC, 'manifest.json'), JSON.stringify({ t0, tEnd, total, frames, cuts, audio, size: { w: 1366, h: 768, dpr: 1.405 } }, null, 1))
  console.log(`recorded ${frames.length} frames, ${cuts.length} cuts, ${total.toFixed(1)} s of video; script errors: ${errs.length ? errs.slice(0, 2) : 'none'}`)
  await b.close()
} finally {
  await fetch(`${APP}/account`, { method: 'DELETE', headers: { authorization: `Bearer ${session.access_token}` } }).catch(() => {})
  console.log('demo account removed')
}
