/**
 * A dress rehearsal of sign-in with a throwaway account: two browsers, one person.
 *
 *   npm run rehearsal            # against the live app
 *   APP=http://localhost:5173 npm run rehearsal
 *
 * It creates a user in Supabase with the service key (read from the Container App secret, never
 * printed), signs in with a password so no email is sent, walks onboarding with consent on one
 * browser, logs a meal, checks the second browser sees profile and diary, logs on the second and
 * checks the first, then deletes the account and checks nothing is left. Run it after any change
 * to sign-in, sync, the profile or the diary, and before switching REQUIRE_SIGN_IN on.
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { launch } from './lib/cdp.mjs'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const SB = 'https://qennxqfbvgqyodjmkguo.supabase.co', REF = 'qennxqfbvgqyodjmkguo'
const APP = process.env.APP ?? 'https://diabite-engine.greenglacier-ab5551c6.swedencentral.azurecontainerapps.io'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = readFileSync(`${ROOT}/.env.local`, 'utf8')
const PUB = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)?.[1]?.trim()
const SVC = execSync(`az containerapp secret show -g rg-nadia.babich92-5702 -n diabite-engine --secret-name supabase-service-key --query value -o tsv`, { env: { ...process.env, PATH: '/opt/homebrew/bin:' + process.env.PATH } }).toString().trim()
const admin = (path, init = {}) => fetch(SB + path, { ...init, headers: { apikey: SVC, authorization: `Bearer ${SVC}`, 'content-type': 'application/json', ...(init.headers ?? {}) } })
const results = []
const check = (id, what, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${what}${ok ? '' : '  → ' + detail}`) }

const email = `rehearsal-${Date.now()}@example.com`, password = 'Rh-' + Math.random().toString(36).slice(2) + 'Aa1'
const created = await (await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) })).json()
const uid = created.id
const session = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUB, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()
check('W0', 'a throwaway account exists and signs in', !!uid && !!session.access_token)
// The throwaway account must not outlive a failed run (W9 tests the app's own delete; this is the net under it, and a 404 is fine).
const cleanup = () => admin(`/auth/v1/admin/users/${uid}`, { method: 'DELETE' }).catch(() => {})
process.on('unhandledRejection', async (e) => { console.error(e); await cleanup(); process.exit(1) })
const stored = JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) + session.expires_in })
const rows = async (table) => (await (await admin(`/rest/v1/${table}?user_id=eq.${uid}&select=*`)).json())

async function device(port, label, { tour = false } = {}) {
  const b = await launch({ port, width: 390, height: 844, dpr: 1 })
  const errs = []
  b.on('Runtime.exceptionThrown', (p) => errs.push(p.exceptionDetails?.exception?.description?.slice(0, 160) ?? 'exception'))
  await b.send('Page.navigate', { url: APP }); await sleep(2500)
  // The first-run tips are marked seen so they never sit over what this script clicks; device A leaves them on once, to check them (W16).
  // Our own sessions carry a `test-` id so the weekly report counts them as tests, not as a person at the app.
  await b.ev(`localStorage.clear(); localStorage.setItem('diabite.session', 'test-rehearsal-' + crypto.randomUUID()); localStorage.setItem('sb-${REF}-auth-token', ${JSON.stringify(stored)}); ${tour ? '' : "localStorage.setItem('diabite.tour.v1', JSON.stringify(['input','verdict','calc','log']));"}`)
  await b.send('Page.reload'); await sleep(3500)
  const text = () => b.ev('document.body.innerText')
  const click = (t) => b.ev(`(()=>{const e=[...document.querySelectorAll('button')].find(x=>x.innerText.trim().startsWith(${JSON.stringify(t)})); if(!e) return 'NO '+${JSON.stringify(t)}; e.click(); return 'ok'})()`)
  return { b, errs, text, click, label }
}

// ── device A: first sign-in, onboarding with consent, one meal logged ───────
const A = await device(9701, 'A', { tour: true })
let t = await A.text()
check('W1', 'device A: a signed-in person with no profile is taken to onboarding, with the consent card', /What DiaBite keeps/.test(t) && /First, the numbers/.test(t), t.slice(0, 160))
await A.b.ev(`window.__setNum = (labelText, v) => { const el = [...document.querySelectorAll('label.field')].find(l => l.innerText.trim().startsWith(labelText))?.querySelector('input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(el,String(v)); el.dispatchEvent(new Event('input',{bubbles:true})) }; window.__check = (aria) => document.querySelector('input[aria-label="'+aria+'"]').click()`)
await A.b.ev(`__check('I agree that DiaBite keeps this about me')`)
await A.b.ev(`__setNum('Age', 52)`); await A.click('Continue'); await sleep(300)
await A.click('Type 2 diabetes'); await A.click('Continue'); await sleep(300)
await A.click('Continue'); await sleep(300); await A.click('Continue'); await sleep(300)
await A.b.ev(`__check('I understand this is not medical advice')`); await A.click('Start using DiaBite'); await sleep(2500)
t = await A.text()
check('W2', 'device A: onboarding completes and the ask screen opens', /What are you\s+about to eat/i.test(t), t.slice(0, 120))
// W16: a brand-new person sees exactly one tip on the empty Ask screen (and none once they skip).
await sleep(1200)
const tips = await A.b.ev(`[...document.querySelectorAll('[aria-label="Tip"]')].map(e => e.innerText.trim().slice(0, 40))`)
check('W16', 'device A: the first Ask screen after onboarding shows exactly one tip, "Say what you ate"', Array.isArray(tips) && tips.length === 1 && /^Say what you ate/.test(tips[0]), JSON.stringify(tips))
await A.click('Skip tips'); await sleep(500)
await sleep(2500)
const prof = await rows('profiles')
check('W3', 'the profile and the consent are stored on the server, for this person only', prof.length === 1 && !!prof[0].consent_at, JSON.stringify(prof.map((r) => Object.keys(r))))
await A.b.ev(`(()=>{const i=document.querySelector('input[type=text]'); i.focus()})()`)
await A.b.send('Input.insertText', { text: 'Two eggs and a slice of rye bread' })
await A.click('Check this meal')
for (let i = 0; i < 90; i++) { await sleep(500); if (!(await A.b.ev(`[...document.querySelectorAll('button')].some(x=>x.innerText.includes('Thinking'))`)) && i > 3) break }
await sleep(800)
console.log('   log:', await A.click('Log it')); await sleep(4000)
const d1 = await rows('diary_entries')
check('W4', 'device A: a logged meal reaches the server (one row per food)', d1.length >= 2, `${d1.length} rows`)

// ── device B: the same person, a fresh browser ──────────────────────────────
const B = await device(9702, 'B')
t = await B.text()
check('W5', 'device B: no onboarding, the ask screen opens at once (the profile came from the server)', /What are you\s+about to eat/i.test(t) && !/What DiaBite keeps/.test(t), t.slice(0, 160))
await B.b.ev(`[...document.querySelectorAll('[role=tab]')].find(x=>x.innerText.includes('Diary'))?.click()`); await sleep(1200)
let dt = ''
for (let i = 0; i < 6; i++) { dt = await B.text(); if (/egg/i.test(dt)) break; await sleep(2000) }
check('W6', 'device B: the Diary shows the meal logged on device A', /egg/i.test(dt), dt.slice(0, 300).replace(/\n+/g, ' | '))
await B.b.ev(`[...document.querySelectorAll('[role=tab]')].find(x=>x.innerText.includes('You'))?.click()`); await sleep(800)
const pt = await B.text()
check('W7', 'device B: the profile page shows the age entered on device A (52)', /52/.test(await B.b.ev(`[...document.querySelectorAll('input')].map(i=>i.value).join(',')`)), pt.slice(0, 80))

// ── B logs a second meal; A reloads and sees both ───────────────────────────
await B.b.ev(`[...document.querySelectorAll('[role=tab]')].find(x=>x.innerText.includes('Ask'))?.click()`); await sleep(600)
await B.b.ev(`(()=>{const i=document.querySelector('input[type=text]'); i.focus()})()`)
await B.b.send('Input.insertText', { text: 'A cup of plain greek yogurt' })
await B.click('Check this meal')
for (let i = 0; i < 90; i++) { await sleep(500); if (!(await B.b.ev(`[...document.querySelectorAll('button')].some(x=>x.innerText.includes('Thinking'))`)) && i > 3) break }
await sleep(800); console.log('   log:', await B.click('Log it')); await sleep(4000)
// The write from B has to reach the server and A has to read it: wait for it, up to 20 seconds, so a slow
// network is not mistaken for a sync that does not work (and a sync that really does not work still fails).
let at = ''
for (let i = 0; i < 8; i++) {
  await A.b.send('Page.reload'); await sleep(3500)
  await A.b.ev(`[...document.querySelectorAll('[role=tab]')].find(x=>x.innerText.includes('Diary'))?.click()`); await sleep(1000)
  at = await A.text()
  if (/egg/i.test(at) && /yogurt/i.test(at)) break
}
check('W8', 'device A after a reload: sees the meal logged on device B as well as its own', /egg/i.test(at) && /yogurt/i.test(at), at.replace(/\n+/g, ' | ').slice(0, 400))

// ── the menu and the diary, signed in: the week stays, a recipe goes into the diary and to the server ─────
const tabA = async (name) => { await A.b.ev(`(()=>{[...document.querySelectorAll('[role=tab]')].find(x=>x.innerText.includes(${JSON.stringify(name)}))?.click()})()`); await sleep(900) }
await tabA('Menu')
for (let i = 0; i < 40 && !(await A.b.ev(`!!document.querySelector('.menu-meal')`)); i++) await sleep(300)
const dish1 = await A.b.ev(`document.querySelector('.menu-meal .name')?.innerText ?? ''`)
await tabA('Diary'); await tabA('Menu'); await sleep(500)
check('W12', 'signed in, the week stays the week across tabs, and the recipes are loaded', dish1 !== '' && dish1 === await A.b.ev(`document.querySelector('.menu-meal .name')?.innerText ?? ''`), dish1)
const before = (await rows('diary_entries')).length
await A.b.ev(`(()=>{[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='I ate this')?.click()})()`); await sleep(5000)
const after = (await rows('diary_entries')).length
check('W13', '"I ate this" on the Menu reaches the account', after > before, `${before} -> ${after}`)
await tabA('Diary')
check('W14', 'bread units are off until switched on', !/Bread units/.test(await A.text()), '')
await tabA('You')
await A.b.ev(`(()=>{const c=[...document.querySelectorAll('.check-row input')].find(i=>/bread units/i.test(i.closest('.check-row').innerText)); c?.click()})()`); await sleep(3500)
await tabA('Diary')
const profRow = (await rows('profiles'))[0]
check('W15', 'switching bread units on shows them, and the choice is kept with the profile', /Bread units/.test(await A.text()) && profRow?.data?.showBreadUnits === true, JSON.stringify(profRow?.data?.showBreadUnits))

// ── the feedback card: asked once after the third meal, never again after "Not now"; a rating reaches the table ─────
{
  const d = new Date(), pad = (n) => String(n).padStart(2, '0'), todayLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const seed = ['breakfast', 'lunch', 'dinner'].map((meal) => ({ user_id: uid, id: `w18-${meal}`, day: todayLocal, meal, food_id: 'egg', grams: 110, snapshot: null, updated_at: new Date().toISOString() }))
  await admin('/rest/v1/diary_entries', { method: 'POST', body: JSON.stringify(seed), headers: { prefer: 'return=minimal,resolution=merge-duplicates' } })
  const cards = () => A.b.ev(`[...document.querySelectorAll('[aria-label="Feedback"]')].map(e => e.innerText.trim().slice(0, 20))`)
  await A.b.send('Page.reload'); await sleep(4500)
  await tabA('Ask'); await sleep(1500)
  const first = await cards()
  check('W18', 'device A: after three meals the Ask screen shows exactly one "How is it going?" card', Array.isArray(first) && first.length === 1 && /^How is it going\?/.test(first[0]), JSON.stringify(first))
  await A.click('Not now'); await sleep(500)
  await A.b.send('Page.reload'); await sleep(4500)
  await tabA('Ask'); await sleep(1500)
  check('W18b', '"Not now" removes the card and it does not come back after a reload', (await cards()).length === 0, JSON.stringify(await cards()))
  // Ask again on purpose: forget that it was asked, rate it, and read the row back from the table.
  const tag = `rehearsal-${Date.now()}`
  await A.b.ev(`localStorage.removeItem('diabite.nudge.v1')`)
  await A.b.send('Page.reload'); await sleep(4500)
  await tabA('Ask'); await sleep(1500)
  await A.b.ev(`document.querySelector('[aria-label="Feedback"] button[aria-label^="4 "]')?.click()`); await sleep(300)
  await A.b.ev(`document.querySelector('[aria-label="Feedback"] textarea')?.focus()`)
  await A.b.send('Input.insertText', { text: tag })
  await A.click('Send'); await sleep(3500)
  const sent = await (await admin(`/rest/v1/feedback?feedback=eq.${tag}&select=rating,context,feedback`)).json()
  check('W19', 'a rating sent from the card writes one feedback row with context after_3_meals', Array.isArray(sent) && sent.length === 1 && sent[0].rating === 4 && sent[0].context === 'after_3_meals', JSON.stringify(sent))
  await admin(`/rest/v1/feedback?feedback=eq.${tag}`, { method: 'DELETE' })
}

// ── planning: a meal planned on one device is planned on the other and counts nowhere until it is eaten ─────
{
  const d = new Date(), pad = (n) => String(n).padStart(2, '0')
  const iso = (off) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + off); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}` }
  const exact = (dev, label) => dev.b.ev(`(()=>{const e=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()===${JSON.stringify(label)}); if(!e) return 'NO'; e.click(); return 'ok'})()`)
  const askOn = async (dev, q) => {
    await dev.b.ev(`[...document.querySelectorAll('[role=tab]')].find(x=>x.innerText.includes('Ask'))?.click()`); await sleep(600)
    await dev.b.ev(`(()=>{const i=document.querySelector('input[type=text]'); i.focus()})()`)
    await dev.b.send('Input.insertText', { text: q })
    await dev.click('Check this meal')
    const waitForAnswer = async () => { for (let i = 0; i < 90; i++) { await sleep(500); if (!(await dev.b.ev(`[...document.querySelectorAll('button')].some(x=>x.innerText.includes('Thinking'))`)) && i > 3) break } await sleep(800) }
    await waitForAnswer()
    // The agent sometimes asks a question first ("which yogurt?") and there is no receipt to log or plan: ask again, up to twice.
    for (let k = 0; k < 2 && !(await dev.b.ev(`!!document.querySelector('.day-picker')`)); k++) {
      await dev.b.ev(`[...document.querySelectorAll('button')].find(x => x.innerText.trim().startsWith('Ask something else'))?.click()`); await sleep(500)
      await dev.b.ev(`(()=>{const i=document.querySelector('input[type=text]'); i.focus(); i.select()})()`)
      await dev.b.send('Input.insertText', { text: q })
      await dev.click('Check this meal'); await waitForAnswer()
    }
  }
  const diaryRows = async () => rows('diary_entries')
  // A: ask, choose Tomorrow, "Plan it".
  await tabA('Ask')
  await askOn(A, 'A cup of plain greek yogurt')
  await exact(A, 'Tomorrow'); await sleep(300)
  const planLabel = await A.b.ev(`[...document.querySelectorAll('button.primary')].map(x=>x.innerText.trim()).join('|')`)
  await exact(A, 'Plan it'); await sleep(4500)
  const plannedRows = (await diaryRows()).filter((r) => r.planned === true && r.day === iso(1))
  check('W17', 'device A: choosing Tomorrow turns the log button into "Plan it" and writes a planned entry for tomorrow', /Plan it/.test(planLabel) && plannedRows.length >= 1, `${planLabel} / ${JSON.stringify(plannedRows.map((r) => [r.day, r.planned]))}`)
  // B: tomorrow in the Diary shows it as planned, and nothing is counted.
  await B.b.send('Page.reload'); await sleep(4000)
  await B.b.ev(`[...document.querySelectorAll('[role=tab]')].find(x=>x.innerText.includes('Diary'))?.click()`); await sleep(1000)
  await B.b.ev(`document.querySelector('button[aria-label="The day after"]')?.click()`); await sleep(1200)
  const bt = await B.text()
  check('W17c', 'device B: the Diary on tomorrow shows the meal as planned, "not counted yet", and nothing eaten', /planned/.test(bt) && /not counted yet/.test(bt) && /Nothing eaten for this day yet/.test(bt), bt.replace(/\n+/g, ' | ').slice(0, 300))
  // A: the Menu plans a meal for today; B marks it eaten and A sees it eaten.
  await tabA('Menu')
  for (let i = 0; i < 40 && !(await A.b.ev(`!!document.querySelector('.menu-meal')`)); i++) await sleep(300)
  await A.b.ev(`document.querySelector('.menu-meal button[aria-expanded]')?.click()`); await sleep(500)
  await exact(A, 'Today'); await sleep(300)
  await exact(A, 'Plan it'); await sleep(4500)
  const todayPlanned = (await diaryRows()).filter((r) => r.planned === true && r.day === iso(0))
  check('W17d', 'device A: "Plan it…" on the Menu with Today writes a planned entry for today', todayPlanned.length >= 1, JSON.stringify(todayPlanned.map((r) => [r.day, r.planned])))
  await B.b.send('Page.reload'); await sleep(4000)
  await B.b.ev(`[...document.querySelectorAll('[role=tab]')].find(x=>x.innerText.includes('Diary'))?.click()`); await sleep(1000)
  const before = (await diaryRows()).filter((r) => r.planned === true && r.day === iso(0)).length
  await B.b.ev(`document.querySelector('.entry.planned button[aria-label^="Ate it"]')?.click()`); await sleep(4500)
  const after = (await diaryRows()).filter((r) => r.planned === true && r.day === iso(0)).length
  check('W17e', 'device B: "Ate it" turns a planned entry into an eaten one on the server', before >= 1 && after === before - 1, `${before} -> ${after}`)
  // Logging for yesterday from an answer: an eaten entry on yesterday.
  await tabA('Ask')
  await askOn(A, 'Two eggs and a slice of rye bread')
  await exact(A, 'Yesterday'); await sleep(300)
  await exact(A, 'Log it'); await sleep(4500)
  const yest = (await diaryRows()).filter((r) => r.day === iso(-1) && r.planned !== true)
  check('W17f', 'device A: logging an answer for Yesterday writes an eaten entry on yesterday', yest.length >= 1, JSON.stringify(yest.map((r) => [r.day, r.planned])))
  // A recipe counted by servings (garlic bread) has a weight of 0 in the answer; the diary table refuses 0 and the whole save with it.
  await tabA('Ask')
  await askOn(A, 'Whole wheat spaghetti with tomato sauce, garlic bread and a glass of water')
  await exact(A, 'Log it'); await sleep(5000)
  const recipeRows = (await diaryRows()).filter((r) => String(r.food_id).startsWith('rec:'))
  const banner = /haven't been saved/.test(await A.text())
  check('W17g', 'device A: a meal with a recipe counted by servings is saved (its weight is the servings, not 0), and no "not saved" banner shows', recipeRows.length >= 1 && recipeRows.every((r) => Number(r.grams) > 0) && !banner, JSON.stringify([recipeRows.map((r) => [r.food_id, r.grams]), banner]))
}

// ── the account can be removed, and takes everything with it ────────────────
await A.b.ev(`[...document.querySelectorAll('[role=tab]')].find(x=>x.innerText.includes('You'))?.click()`); await sleep(800)
const del = await fetch(`${APP}/account`, { method: 'DELETE', headers: { authorization: `Bearer ${session.access_token}` } })
await sleep(1500)
const left = [(await rows('profiles')).length, (await rows('diary_entries')).length]
check('W9', 'DELETE /account removes the person, and through the foreign keys the profile and the diary', del.status === 200 && left[0] === 0 && left[1] === 0, JSON.stringify([del.status, left]))
const gone = await admin(`/auth/v1/admin/users/${uid}`)
check('W10', 'the auth user is gone', gone.status === 404, String(gone.status))
check('W11', 'no script error on either device', A.errs.length === 0 && B.errs.length === 0, JSON.stringify([A.errs.slice(0, 2), B.errs.slice(0, 2)]))
await A.b.close(); await B.b.close()
await cleanup()
console.log(results.every(Boolean) ? '\nrehearsal passed' : '\nrehearsal FAILED')
process.exit(results.every(Boolean) ? 0 : 1)
