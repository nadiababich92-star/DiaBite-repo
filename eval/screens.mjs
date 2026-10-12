/**
 * Screenshots of every tab, signed in, at laptop and phone size, so a person can look at the app
 * instead of trusting tests that do not see layout.
 *
 *   npm run screens                      # the live app, files in /tmp/diabite-screens
 *   OUT=some/dir APP=http://localhost:5173 npm run screens
 *   QUESTION="A slice of grandma's cholent" npm run screens   # look at the estimate card
 *
 * Like the rehearsal it creates a throwaway account with the service key (read from the Container App
 * secret, never printed), walks onboarding, asks one question, logs the meal, and deletes the account.
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { launch } from './lib/cdp.mjs'
import { execSync } from 'node:child_process'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const SB = 'https://qennxqfbvgqyodjmkguo.supabase.co', REF = 'qennxqfbvgqyodjmkguo'
const APP = process.env.APP ?? 'https://diabite-engine.greenglacier-ab5551c6.swedencentral.azurecontainerapps.io'
const OUT = process.env.OUT ?? '/tmp/diabite-screens'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = readFileSync(`${ROOT}/.env.local`, 'utf8')
const PUB = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)?.[1]?.trim()
const SVC = execSync(`az containerapp secret show -g rg-nadia.babich92-5702 -n diabite-engine --secret-name supabase-service-key --query value -o tsv`, { env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } }).toString().trim()
const admin = (path, init = {}) => fetch(SB + path, { ...init, headers: { apikey: SVC, authorization: `Bearer ${SVC}`, 'content-type': 'application/json', ...(init.headers ?? {}) } })
mkdirSync(OUT, { recursive: true })

const email = `screens-${Date.now()}@example.com`, password = 'Sc-' + Math.random().toString(36).slice(2) + 'Aa1'
const created = await (await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) })).json()
const uid = created.id
const session = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUB, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()
const stored = JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) + session.expires_in })

const SIZES = [{ name: 'laptop', width: 1366, height: 768, dpr: 1 }, { name: 'phone', width: 390, height: 844, dpr: 2 }]
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
    await b.ev(`localStorage.clear(); localStorage.setItem('sb-${REF}-auth-token', ${JSON.stringify(stored)})`)
    await b.send('Page.reload'); await sleep(3500)

    if (idx === 0) {
      // first device: onboarding with consent (the same steps as the rehearsal)
      await b.ev(`window.__setNum = (labelText, v) => { const el = [...document.querySelectorAll('label.field')].find(l => l.innerText.trim().startsWith(labelText))?.querySelector('input'); if (!el) return; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true })) }; window.__check = (txt) => { const c = document.querySelector('input[aria-label="' + txt + '"]') ?? [...document.querySelectorAll('label')].find(l => l.innerText.includes(txt))?.querySelector('input'); if (c && !c.checked) c.click() }`)
      await shot('onboarding')
      await b.ev(`__check('I agree that DiaBite keeps this about me')`)
      await b.ev(`__setNum('Age', 52)`); await click('Continue'); await sleep(700)
      await click('Type 2 diabetes'); await click('Continue'); await sleep(700)
      await click('Continue'); await sleep(700); await click('Continue'); await sleep(700)
      // the last step needs its box ticked before the button works; try until the ask screen is open
      for (let i = 0; i < 8; i++) {
        await b.ev(`__check('I understand this is not medical advice')`); await sleep(300)
        await click('Start using DiaBite'); await sleep(1800)
        if (await b.ev(`!!document.querySelector('.ask-form')`)) break
      }
    }
    await shot('ask-empty')
    await b.ev(`(()=>{const i=document.querySelector('input[type=text]'); i.focus()})()`)
    await b.send('Input.insertText', { text: process.env.QUESTION ?? 'Two eggs, a slice of rye bread and half an avocado' })
    await click('Check this meal')
    for (let i = 0; i < 90; i++) { await sleep(500); if (!(await b.ev(`[...document.querySelectorAll('button')].some(x=>x.innerText.includes('Thinking'))`)) && i > 3) break }
    await sleep(1000)
    await shot('ask-answer')
    // An estimate card (a dish counted from an assumed recipe) also gets its composition editor.
    if (await b.ev(`[...document.querySelectorAll('button')].some(x=>x.innerText.includes('Edit the recipe'))`)) {
      await click('Edit the recipe'); await sleep(800)
      await b.ev(`document.querySelector('.remove-step')?.click()`); await sleep(3500)
      await shot('ask-estimate-edited')
    }
    if (idx === 0) { await click(await b.ev(`[...document.querySelectorAll('button')].some(x=>x.innerText.includes('Log what was counted'))`) ? 'Log what was counted' : 'Log it'); await sleep(4000) }
    await tab('Diary'); await shot('diary')
    await tab('Menu')
    for (let i = 0; i < 40 && !(await b.ev(`!!document.querySelector('.menu-meal')`)); i++) await sleep(300)
    await shot('menu')
    await tab('You'); await shot('you')
    if (errs.length) console.log('  script errors:', errs.slice(0, 2))
    await b.close()
  }
} finally {
  await fetch(`${APP}/account`, { method: 'DELETE', headers: { authorization: `Bearer ${session.access_token}` } }).catch(() => {})
  console.log('throwaway account removed')
}
