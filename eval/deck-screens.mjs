/**
 * Screenshots of every tab, signed in, at laptop and phone size, so a person can look at the app
 * instead of trusting tests that do not see layout.
 *
 *   npm run screens                      # the live app, files in /tmp/diabite-screens
 *   OUT=some/dir APP=http://localhost:5173 npm run screens
 *   QUESTION="A slice of grandma's cholent" npm run screens   # look at the estimate card
 *   TOUR=1 npm run screens                                      # leave the first-run tips on and photograph them
 *   PLAN=1 npm run screens                                      # plan the meal for tomorrow and photograph the day picker, a planned row and the Menu's planner
 *   PAPER=1 npm run screens                                     # the same screens in the light look (Paper); the default is Tape
 *   SEED=full|thin|empty npm run screens                       # give the account a diary history to look at the week
 *
 * Like the rehearsal it creates a throwaway account with the service key (read from the Container App
 * secret, never printed), walks onboarding, asks one question, logs the meal, and deletes the account.
 */
import './lib/timeouts.mjs'  // a default timeout on every fetch
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { launch } from './lib/cdp.mjs'
import { bindSession } from '../server/bind'
import { execSync } from 'node:child_process'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const SB = 'https://qennxqfbvgqyodjmkguo.supabase.co', REF = 'qennxqfbvgqyodjmkguo'
const APP = process.env.APP ?? 'https://diabite-engine.greenglacier-ab5551c6.swedencentral.azurecontainerapps.io'
const OUT = process.env.OUT ?? '/tmp/diabite-screens'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = readFileSync(`${ROOT}/.env.local`, 'utf8')
const PUB = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)?.[1]?.trim()
const SVC = execSync(`az containerapp secret show -g rg-nadia.babich92-5702 -n diabite-engine --secret-name supabase-service-key --query value -o tsv`, { timeout: 60_000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } }).toString().trim()
const admin = (path, init = {}) => fetch(SB + path, { ...init, headers: { apikey: SVC, authorization: `Bearer ${SVC}`, 'content-type': 'application/json', ...(init.headers ?? {}) } })
mkdirSync(OUT, { recursive: true })

const email = `screens-${Date.now()}@example.com`, password = 'Sc-' + Math.random().toString(36).slice(2) + 'Aa1'
const created = await (await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) })).json()
const uid = created.id
const session = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUB, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()
const stored = JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) + session.expires_in })


try {
// Demo history: every number in a snapshot is what the live engine computed for that meal, not typed here.
const KEY = execSync(`az containerapp secret show -g rg-nadia.babich92-5702 -n diabite-engine --secret-name engine-api-key --query value -o tsv`, { timeout: 60_000, env: { ...process.env, PATH: '/opt/homebrew/bin:' + process.env.PATH } }).toString().trim()
const sid = bindSession('deck-' + crypto.randomUUID(), KEY)
const engine = async (path, body) => (await fetch('https://diabite.pro' + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': KEY }, body: JSON.stringify({ sessionId: sid, ...body }) })).json()
// The history is logged the way a person on feet and pounds would have: the engine says each weight in cups and ounces.
await fetch('https://diabite.pro/session/' + sid.split('.')[0], { method: 'PUT', headers: { 'content-type': 'application/json', 'x-api-key': KEY }, body: JSON.stringify({ budget: { glBudget: 45, carbsG: 101, kcal: 1553 }, entries: [], units: 'imperial' }) })
const top = async (phrase) => (await engine('/tools/resolve_foods', { phrases: [phrase] })).results[0].candidates[0].id
const ID = { egg: 'seed:egg', rye: 'ing:rye_bread', avocado: 'ing:avocado', chicken: 'seed:chicken', rice: 'seed:rice-white', apple: 'seed:apple', banana: 'seed:banana', beans: 'ing:black_beans',
  oats: await top('oatmeal'), salmon: await top('salmon'), broccoli: await top('broccoli') }
console.log('foods', JSON.stringify(ID))
const snap = async (foodId, quantity) => {
  const r = await engine('/tools/compute_meal', { items: [{ foodId, quantity }] })
  const it = r.items?.[0]; if (!it) throw new Error('no item for ' + foodId + ' ' + JSON.stringify(r))
  return { grams: it.grams, snapshot: { name: it.name, kcal: it.kcal, carbs: it.carbs, fiber: it.fiber, protein: it.protein, fat: it.fat, availableCarbs: it.availableCarbs, gi: it.gi, gl: it.gl, loadAvailable: it.loadAvailable !== false, ...(it.measure?.text ? { measure: it.measure.text } : {}), ...(it.said ? { said: it.said } : {}), ...(it.basis ? { basis: it.basis } : {}) }, foodId }
}
const q = (count, unit) => ({ count, unit })
const DAYS = {
  steady: [['breakfast', 'egg', q(2, 'default')], ['breakfast', 'rye', q(1, 'slice')], ['lunch', 'chicken', q(4, 'oz')], ['lunch', 'broccoli', q(3, 'oz')], ['lunch', 'rice', q(0.5, 'cup')], ['snack', 'apple', q(1, 'medium')], ['dinner', 'salmon', q(4, 'oz')], ['dinner', 'broccoli', q(3, 'oz')], ['dinner', 'beans', q(0.5, 'cup')]],
  heavy: [['breakfast', 'oats', q(1, 'cup')], ['breakfast', 'banana', q(1, 'whole')], ['lunch', 'rice', q(1.5, 'cup')], ['lunch', 'chicken', q(4, 'oz')], ['snack', 'banana', q(1, 'whole')], ['dinner', 'rice', q(1, 'cup')], ['dinner', 'chicken', q(6, 'oz')]],
  light: [['lunch', 'chicken', q(4, 'oz')], ['lunch', 'rice', q(1, 'cup')]],
}
const ORDER = ['steady', 'steady', 'heavy', 'steady', 'light', 'steady', 'heavy', 'steady', 'steady', 'heavy', 'steady', 'steady', 'light', 'steady']
const cache = new Map()
const dayAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const rows = []
for (const [i, kind] of ORDER.entries()) {
  if (i === 6) continue   // one day nothing logged: the summary says so
  for (const [meal, f, qty] of DAYS[kind]) {
    const k = f + JSON.stringify(qty); if (!cache.has(k)) cache.set(k, await snap(ID[f], qty))
    const s = cache.get(k)
    rows.push({ user_id: uid, id: `deck-${i}-${meal}-${f}`, day: dayAgo(i + 1), meal, food_id: s.foodId, grams: s.grams, snapshot: s.snapshot, updated_at: new Date().toISOString() })
  }
}
const seeded = await admin('/rest/v1/diary_entries', { method: 'POST', body: JSON.stringify(rows), headers: { prefer: 'return=minimal' } })
console.log(`seeded ${rows.length} diary rows:`, seeded.status)
} catch (e) { await admin(`/auth/v1/admin/users/${uid}`, { method: 'DELETE' }).catch(() => {}); console.log('throwaway account removed after an error'); throw e }

// SIZE=phone (or laptop) shoots one size alone, onboarding included: the first size run always walks it.
const SIZES = [{ name: 'laptop', width: 1366, height: 768, dpr: 1 }, { name: 'phone', width: 390, height: 844, dpr: 2 }].filter((s) => !process.env.SIZE || s.name === process.env.SIZE)
let port = 9801
try {
  for (const [idx, size] of SIZES.entries()) {
    const b = await launch({ port: port++, width: size.width, height: size.height, dpr: size.dpr })
    const errs = []
    b.on('Runtime.exceptionThrown', (p) => errs.push(p.exceptionDetails?.exception?.description?.slice(0, 160) ?? 'exception'))
    const shot = async (name) => {
      const r = await b.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      writeFileSync(`${OUT}/${size.name}-${name}.png`, Buffer.from(r.data, 'base64'))
      console.log('  saved', `${size.name}-${name}.png`)
    }
    const tab = async (n) => { await b.ev(`(()=>{[...document.querySelectorAll('[role=tab]')].find(x=>x.innerText.includes(${JSON.stringify(n)}))?.click()})()`); await sleep(1200) }
    const click = (t) => b.ev(`(()=>{const e=[...document.querySelectorAll('button')].find(x=>x.innerText.trim().startsWith(${JSON.stringify(t)})); if(!e) return 'NO '+${JSON.stringify(t)}; e.click(); return 'ok'})()`)
    console.log(size.name)
    await b.send('Page.navigate', { url: APP }); await sleep(2500)
    // The first-run tips are marked seen unless TOUR=1, so they never sit over what this script clicks.
    await b.ev(`localStorage.clear(); localStorage.setItem('diabite.session', 'test-screens-' + crypto.randomUUID()); ${process.env.PAPER === '1' ? "localStorage.setItem('diabite.theme', 'paper');" : ''} localStorage.setItem('sb-${REF}-auth-token', ${JSON.stringify(stored)}); ${process.env.TOUR === '1' ? '' : "localStorage.setItem('diabite.tour.v1', JSON.stringify(['input','verdict','calc','log']));"}`)
    await b.send('Page.reload'); await sleep(3500)

    if (idx === 0) {
      // first device: onboarding with consent (the same steps as the rehearsal)
      await b.ev(`window.__setNum = (labelText, v) => { const el = [...document.querySelectorAll('label.field')].find(l => l.innerText.trim().startsWith(labelText))?.querySelector('input'); if (!el) return; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true })) }; window.__check = (txt) => { const c = document.querySelector('input[aria-label="' + txt + '"]') ?? [...document.querySelectorAll('label')].find(l => l.innerText.includes(txt))?.querySelector('input'); if (c && !c.checked) c.click() }`)
      await shot('onboarding')
      await b.ev(`__check('I agree that DiaBite keeps this about me')`)
      await click('ft / lb'); await b.ev(`__setNum('Age', 52)`); await click('Continue'); await sleep(700)
      await click('Type 2 diabetes'); await click('Continue'); await sleep(700)
      await click('Continue'); await sleep(700); await shot('onboarding-diet'); await b.ev(`[...document.querySelectorAll('h3')].find(h=>h.innerText.startsWith('Meats'))?.scrollIntoView({block:'center'})`); await sleep(500); await shot('onboarding-diet-meats'); await click('Continue'); await sleep(700)
      // the last step needs its box ticked before the button works; try until the ask screen is open
      for (let i = 0; i < 8; i++) {
        await b.ev(`__check('I understand this is not medical advice')`); await sleep(300)
        await click('Start using DiaBite'); await sleep(1800)
        if (await b.ev(`!!document.querySelector('.ask-form')`)) break
      }
    }
    await shot('ask-empty')
    if (await b.ev(`!!document.querySelector('.nudge')`)) { await b.ev(`document.querySelector('.nudge').scrollIntoView({block:'center'})`); await sleep(500); await shot('feedback-card') }
    if (process.env.TOUR === '1') await shot('tour-1')
    await b.ev(`(()=>{const i=document.querySelector('input[type=text]'); i.focus()})()`)
    await b.send('Input.insertText', { text: process.env.QUESTION ?? 'A cup of white rice, a medium apple and 4 oz of grilled chicken breast' })
    await click('Check this meal')
    for (let i = 0; i < 90; i++) { await sleep(500); if (!(await b.ev(`[...document.querySelectorAll('button')].some(x=>x.innerText.includes('Thinking'))`)) && i > 3) break }
    await sleep(1000)
    await shot('ask-answer')
    if (process.env.PLAN === '1') {
      // The day is chosen at the top of Ask; with an answer on screen it is asked again for that day.
      await b.ev(`(()=>{const e=[...document.querySelectorAll('.ask-day button')].find(x=>x.innerText.trim()==='Tomorrow'); e?.click()})()`); await sleep(1500)
      for (let i = 0; i < 90; i++) { await sleep(500); if (!(await b.ev(`[...document.querySelectorAll('button')].some(x=>x.innerText.includes('Thinking'))`))) break }
      await b.ev(`document.querySelector('.log-day')?.scrollIntoView({block:'center'})`); await sleep(400)
      await shot('ask-plan')
    }
    if (process.env.TOUR === '1') {
      // tips 2, 3 and 4 hang on the answer: photograph each, then press its button
      for (const n of [2, 3, 4]) {
        await sleep(900)
        await shot(`tour-${n}`)
        await b.ev(`document.querySelector('.tour-tip button.primary')?.click()`)
      }
    }
    // An estimate card (a dish counted from an assumed recipe) also gets its composition editor.
    if (await b.ev(`[...document.querySelectorAll('button')].some(x=>x.innerText.includes('Recipe'))`)) {
      await click('Recipe'); await sleep(800)
      await b.ev(`document.querySelector('.remove-step')?.click()`); await sleep(3500)
      await shot('ask-estimate-edited')
    }
    if (process.env.PLAN === '1') {
      await click('Plan it'); await sleep(3500)
      await tab('Diary')
      await b.ev(`document.querySelector('button[aria-label="The day after"]')?.click()`); await sleep(1000)
      await shot('diary-planned')
      await b.ev(`document.querySelector('button[aria-label="The day before"]')?.click()`); await sleep(500)
    } else if (idx === 0) { await click(await b.ev(`[...document.querySelectorAll('button')].some(x=>x.innerText.includes('Log what was counted'))`) ? 'Log what was counted' : 'Log it'); await sleep(4000) }
    await tab('Diary'); await shot('diary')
    if (await b.ev(`!!document.querySelector('.week-sum')`)) {
      await b.ev(`document.querySelector('.week-sum').scrollIntoView({block:'start'}); window.scrollBy(0,-90)`); await sleep(600)
      await shot('diary-week')
    }
    await tab('Settings'); await sleep(800)
    await b.ev(`document.querySelector('#open-clinician-summary')?.scrollIntoView({block:'center'})`); await sleep(500); await shot('settings-card')
    await b.ev(`document.querySelector('#open-clinician-summary')?.click()`); await sleep(1500)
    await shot('clinician-summary')
    { const m = await b.send('Page.getLayoutMetrics'); const h = Math.ceil(m.cssContentSize?.height ?? m.contentSize.height)
      const r = await b.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: size.width, height: Math.min(h, 6000), scale: 1 } })
      writeFileSync(`${OUT}/${size.name}-clinician-summary-full.png`, Buffer.from(r.data, 'base64')); console.log('  saved', `${size.name}-clinician-summary-full.png`) }
    await b.ev(`(()=>{const e=[...document.querySelectorAll('button')].find(x=>/^(Back|Close|Done)/.test(x.innerText.trim())); e?.click()})()`); await sleep(800)
    await tab('Menu')
    for (let i = 0; i < 40 && !(await b.ev(`!!document.querySelector('.menu-meal')`)); i++) await sleep(300)
    await shot('menu')
    if (process.env.PLAN === '1') {
      await b.ev(`document.querySelector('.menu-meal button[aria-expanded]')?.click()`); await sleep(600)
      await b.ev(`document.querySelector('.plan-inline')?.scrollIntoView({block:'center'})`); await sleep(400)
      await shot('menu-plan')
    }
    await tab('Profile'); await shot('you')
    await tab('Settings'); await shot('settings')
    if (process.env.TOUR === '1') { await click('How it works'); await sleep(700); await shot('how-it-works'); await click('Close') }
    if (errs.length) console.log('  script errors:', errs.slice(0, 2))
    await b.close()
  }
} finally {
  // With the service key, not the app's /account route: a local dev server has no such route and the throwaway account would stay.
  await admin(`/auth/v1/admin/users/${uid}`, { method: 'DELETE' }).catch(() => {})
  console.log('throwaway account removed')
}
