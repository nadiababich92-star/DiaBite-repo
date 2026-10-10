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
const stored = JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) + session.expires_in })
const rows = async (table) => (await (await admin(`/rest/v1/${table}?user_id=eq.${uid}&select=*`)).json())

async function device(port, label) {
  const b = await launch({ port, width: 390, height: 844, dpr: 1 })
  const errs = []
  b.on('Runtime.exceptionThrown', (p) => errs.push(p.exceptionDetails?.exception?.description?.slice(0, 160) ?? 'exception'))
  await b.send('Page.navigate', { url: APP }); await sleep(2500)
  await b.ev(`localStorage.clear(); localStorage.setItem('sb-${REF}-auth-token', ${JSON.stringify(stored)})`)
  await b.send('Page.reload'); await sleep(3500)
  const text = () => b.ev('document.body.innerText')
  const click = (t) => b.ev(`(()=>{const e=[...document.querySelectorAll('button')].find(x=>x.innerText.trim().startsWith(${JSON.stringify(t)})); if(!e) return 'NO '+${JSON.stringify(t)}; e.click(); return 'ok'})()`)
  return { b, errs, text, click, label }
}

// ── device A: first sign-in, onboarding with consent, one meal logged ───────
const A = await device(9701, 'A')
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
const dt = await B.text()
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
await A.b.send('Page.reload'); await sleep(3500)
await A.b.ev(`[...document.querySelectorAll('[role=tab]')].find(x=>x.innerText.includes('Diary'))?.click()`); await sleep(1200)
const at = await A.text()
check('W8', 'device A after a reload: sees the meal logged on device B as well as its own', /egg/i.test(at) && /yogurt/i.test(at), at.replace(/\n+/g, ' | ').slice(0, 400))

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
console.log(results.every(Boolean) ? '\nrehearsal passed' : '\nrehearsal FAILED')
process.exit(results.every(Boolean) ? 0 : 1)
