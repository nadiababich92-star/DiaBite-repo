/**
 * "Two rhythms", step 1: film the live app, scene by scene, as the two made-up people use it.
 *
 *   node scripts/demo-video/two-rhythms/capture.mjs [outDir=/tmp/dv2]      # APP=https://diabite.pro
 *
 * Two throwaway accounts (Maya, Daniel) get real profiles, so every number on screen is the engine's answer for
 * that profile and nothing is typed in by hand. The browser is phone-sized; each scene is a list of screenshots
 * with the time they were taken, which the animation (render.mjs) plays back inside a phone. Both accounts and
 * their rows are deleted at the end. Session ids are `test-demo-…`, so none of this counts as a person in the report.
 */
import { launch } from '../../../eval/lib/cdp.mjs'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const SB = 'https://qennxqfbvgqyodjmkguo.supabase.co', REF = 'qennxqfbvgqyodjmkguo'
const APP = (process.env.APP ?? 'https://diabite.pro').replace(/\/$/, '')
const OUT = process.argv[2] ?? '/tmp/dv2'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const env = readFileSync(`${ROOT}/.env.local`, 'utf8')
const PUB = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)?.[1]?.trim()
const SVC = execSync('az containerapp secret show -g rg-nadia.babich92-5702 -n diabite-engine --secret-name supabase-service-key --query value -o tsv', { env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } }).toString().trim()
const admin = (path, init = {}) => fetch(SB + path, { ...init, headers: { apikey: SVC, authorization: `Bearer ${SVC}`, 'content-type': 'application/json', ...(init.headers ?? {}) } })

const base = { excludedFoodIds: [], insulin: 'none', pregnantOrBreastfeeding: false, kidney: 'none', comorbidities: [], allergens: [], pattern: 'none', units: 'imperial', showBreadUnits: false, onboarded: true }
const PEOPLE = {
  maya: { ...base, sex: 'female', age: 34, heightCm: 168, weightKg: 66, activity: 'moderate', condition: 'ir', goal: 'maintain', carbApproach: 'low', meds: [] },
  daniel: { ...base, sex: 'male', age: 52, heightCm: 178, weightKg: 88, activity: 'light', condition: 't2', goal: 'lose', carbApproach: 'low', meds: ['metformin'] },
}
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()

const made = []
async function account(who) {
  const email = `demo-${who}-${Date.now()}@example.com`, password = 'D-' + Math.random().toString(36).slice(2) + 'Aa1'
  const uid = (await (await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) })).json()).id
  made.push(uid)
  const session = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUB, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()
  await admin('/rest/v1/profiles', { method: 'POST', body: JSON.stringify({ user_id: uid, data: PEOPLE[who], consent_at: new Date().toISOString(), consent_version: '2026-10-b', updated_at: new Date().toISOString() }), headers: { prefer: 'return=minimal' } })
  if (who === 'daniel') {
    // The plan that will not survive Wednesday: a dinner planned for today, counting nowhere until eaten.
    await admin('/rest/v1/diary_entries', { method: 'POST', body: JSON.stringify([{ user_id: uid, id: 'demo-planned-dinner', day: today, meal: 'dinner', food_id: 'salmon', grams: 150, snapshot: null, planned: true, updated_at: new Date().toISOString() }]), headers: { prefer: 'return=minimal' } })
  }
  return { uid, stored: JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) + session.expires_in }) }
}

const manifest = {}
const marks = {}   // per scene: when the typing ended, when the button was pressed, when the answer was on screen
let port = 9921
async function film(who, acct, run) {
  const b = await launch({ port: port++, width: 360, height: 660, dpr: 2 })
  const ev = b.ev
  await b.send('Page.navigate', { url: APP }); await sleep(2500)
  await ev(`localStorage.clear(); localStorage.setItem('diabite.session','test-demo-'+crypto.randomUUID()); localStorage.setItem('diabite.tour.v1', JSON.stringify(['input','verdict','calc','log'])); localStorage.setItem('diabite.nudge.v1', JSON.stringify(['after_3_meals','day_2'])); localStorage.setItem('sb-${REF}-auth-token', ${JSON.stringify(acct.stored)})`)
  await b.send('Page.reload'); await sleep(4500)
  let scene = null, t0 = 0, n = 0
  const T = {
    begin(name) { scene = name; manifest[name] = []; marks[name] = {}; t0 = Date.now(); n = 0; mkdirSync(join(OUT, name), { recursive: true }) },
    async shot() { const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 86 }); const file = `${scene}/${String(n++).padStart(3, '0')}.jpg`; writeFileSync(join(OUT, file), Buffer.from(r.data, 'base64')); manifest[scene].push({ file, t: (Date.now() - t0) / 1000 }) },
    async hold(frames = 3, gap = 250) { for (let i = 0; i < frames; i++) { await T.shot(); await sleep(gap) } },
    async type(text, cps = 14) { await ev(`(() => { const i = document.querySelector('.ask-form input'); i.focus(); i.select() })()`); await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }); await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }); await T.shot()
      for (let i = 0; i < text.length; i++) { await b.send('Input.insertText', { text: text[i] }); await sleep(1000 / cps); if (i % 2 === 1 || i === text.length - 1) await T.shot() }
      marks[scene].typed = (Date.now() - t0) / 1000 },
    click: (t, scope = 'button') => ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(scope)})].find(x => x.innerText.trim().startsWith(${JSON.stringify(t)})); if (!e) return 'NO'; e.click(); return 'ok' })()`),
    async tab(name) { await T.click(name, '[role=tab]'); await sleep(1300) },
    async answer(maxWait = 90) {
      marks[scene].click = (Date.now() - t0) / 1000
      await T.click('Check this meal')
      for (let i = 0; i < maxWait * 3; i++) { await sleep(330); const busy = await ev(`[...document.querySelectorAll('button')].some(x => x.innerText.includes('Thinking'))`); if (i % 3 === 0) await T.shot(); if (!busy && i > 3) break }
      await sleep(600)
      await ev(`(document.querySelector('.answer, .tone-blocked, .tone-ask') || document.body).scrollIntoView({block:'start'}); window.scrollBy(0,-10)`)
      await sleep(500)
      marks[scene].answer = (Date.now() - t0) / 1000
    },
    sleep, ev,
  }
  try { await run(T) } finally { await b.close() }
}

try {
  rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true })
  const maya = await account('maya'), daniel = await account('daniel')

  await film('maya', maya, async (T) => {
    T.begin('maya-morning'); await T.hold(3); await T.type('coffee with milk and a banana'); await T.answer(); await T.hold(4)
    T.begin('maya-receipt'); await T.click('Show calculation'); await T.sleep(900); await T.ev(`document.querySelector('.receipt')?.scrollIntoView({block:'start'})`); await T.sleep(600); await T.hold(4)
  })
  await film('maya', maya, async (T) => {
    T.begin('maya-petrol'); await T.hold(2); await T.type('a grilled chicken sandwich and an apple'); await T.answer(); await T.hold(4)
    await T.ev(`window.scrollTo(0,0)`); await T.sleep(400)
    T.begin('maya-petrol-swap'); await T.hold(2); await T.type('a chicken salad sandwich and an apple'); await T.answer(); await T.hold(4)
  })
  await film('maya', maya, async (T) => {
    T.begin('maya-dose'); await T.hold(2); await T.type('How many units of insulin should I take before pasta?'); await T.answer(); await T.hold(4)
  })

  await film('daniel', daniel, async (T) => {
    T.begin('daniel-week'); await T.tab('Menu'); await T.hold(3); await T.ev(`window.scrollBy(0, 360)`); await T.sleep(500); await T.hold(3)
    await T.ev(`window.scrollTo(0,0)`); await T.sleep(300)
    T.begin('daniel-diary-planned'); await T.tab('Diary'); await T.ev(`document.querySelector('.day, .card')?.scrollIntoView({block:'start'}); window.scrollBy(0,-10)`); await T.sleep(500); await T.hold(4)
    T.begin('daniel-rice'); await T.tab('Ask'); await T.hold(2); await T.type('chicken fried rice'); await T.answer(); await T.hold(3)
    await T.click('Log it'); await T.sleep(1500); await T.hold(2)
    T.begin('daniel-diary-logged'); await T.tab('Diary'); await T.sleep(600); await T.ev(`window.scrollTo(0,0)`); await T.sleep(500); await T.hold(3)
    await T.ev(`window.scrollBy(0, 420)`); await T.sleep(500); await T.hold(3)
  })
  await film('daniel', daniel, async (T) => {
    T.begin('daniel-cholent'); await T.hold(2); await T.type("grandma's cholent"); await T.answer(); await T.hold(4)
  })
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ scenes: manifest, marks }, null, 1))
  console.log(Object.entries(manifest).map(([k, v]) => `${k}: ${v.length} frames, ${v.at(-1)?.t.toFixed(1)} s, marks ${JSON.stringify(marks[k])}`).join('\n'))
} finally {
  for (const uid of made) await admin(`/auth/v1/admin/users/${uid}`, { method: 'DELETE' }).catch(() => {})
  console.log('the two demo accounts are removed')
}
