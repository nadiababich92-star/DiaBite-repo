/**
 * A free accessibility pass on the live app (roadmap 3.4): axe-core on every screen, light and dark, at a phone and a laptop;
 * reflow at 320 px and at 200% zoom (a 1280 px window at 640 px); and a keyboard walk (is every control reached by Tab, and does
 * each show a focus indicator). Self-assessed: automated checks find about a third of the problems, so this is a floor.
 *
 *   npm pack axe-core@4.10.2 (in /tmp/axe), then:   node eval/a11y.mjs          # APP=https://diabite.pro OUT=/tmp/a11y.json AXE=/tmp/axe/package/axe.min.js
 *
 * Like the rehearsal it makes a throwaway account with the service key (read from the Container App secret, never printed), gives it a
 * profile and a small diary with a planned meal, asks one real question per run, and deletes the account at the end.
 */
import { launch } from './lib/cdp.mjs'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const SB = 'https://qennxqfbvgqyodjmkguo.supabase.co', REF = 'qennxqfbvgqyodjmkguo'
const APP = process.env.APP ?? 'https://diabite.pro'
const OUT = process.env.OUT ?? '/tmp/a11y.json'
const AXE = readFileSync(process.env.AXE ?? '/tmp/axe/package/axe.min.js', 'utf8')
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = readFileSync(`${ROOT}/.env.local`, 'utf8')
const PUB = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)?.[1]?.trim()
const SVC = execSync(`az containerapp secret show -g rg-nadia.babich92-5702 -n diabite-engine --secret-name supabase-service-key --query value -o tsv`, { env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } }).toString().trim()
const admin = (path, init = {}) => fetch(SB + path, { ...init, headers: { apikey: SVC, authorization: `Bearer ${SVC}`, 'content-type': 'application/json', ...(init.headers ?? {}) } })
const email = `a11y-${Date.now()}@example.com`, password = 'A11y-' + Math.random().toString(36).slice(2) + 'Aa1'
const uid = (await (await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) })).json()).id
const results = { app: APP, at: new Date().toISOString(), axeVersion: '4.10.2', runs: [], reflow: [], keyboard: [] }
try {
  const session = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUB, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()
  const stored = JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) + session.expires_in })
  const profile = { sex: 'female', age: 52, heightCm: 168, weightKg: 70, activity: 'light', condition: 't2', goal: 'lose', carbApproach: 'low', excludedFoodIds: [], insulin: 'none', meds: ['metformin'], pregnantOrBreastfeeding: false, kidney: 'none', comorbidities: [], allergens: [], pattern: 'none', units: 'imperial', showBreadUnits: false, onboarded: true }
  await admin('/rest/v1/profiles', { method: 'POST', body: JSON.stringify({ user_id: uid, data: profile, consent_at: new Date().toISOString(), consent_version: '2026-10-b', updated_at: new Date().toISOString() }), headers: { prefer: 'return=minimal' } })
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const row = (n, meal, food, g, planned = false) => ({ user_id: uid, id: `a11y-${n}-${meal}-${food}`, day: day(n), meal, food_id: food, grams: g, snapshot: null, planned, updated_at: new Date().toISOString() })
  await admin('/rest/v1/diary_entries', { method: 'POST', body: JSON.stringify([row(0, 'breakfast', 'oats', 50), row(0, 'lunch', 'lentils', 150), row(-1, 'dinner', 'salmon', 150), row(1, 'dinner', 'salmon', 150, true)]), headers: { prefer: 'return=minimal' } })

  const axeRun = (b) => b.ev(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, first: (v.nodes[0]?.target ?? []).join(' ').slice(0, 120) })))`)
  // axe-core's own colour-contrast rule reported "inapplicable" in this headless setup even on a page with planted faults, so the contrast
  // of text is checked here directly: the computed text colour against the nearest opaque ancestor background (a gradient or an image
  // is counted as "unknown", not as a pass). 4.5:1, or 3:1 for large text (24 px, or 18.66 px bold).
  const CONTRAST = `(() => {
    const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
    const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
    const over = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 })
    const bgOf = (el) => { const layers = []; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== 'none') return { unknown: true }; const c = parse(s.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a === 1) break } } let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base); return base }
    const bad = [], unknown = []; let checked = 0
    for (const el of document.body.querySelectorAll('*')) {
      const has = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0)
      if (!has) continue
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) === 0) continue
      if (el.closest('[inert], [aria-hidden=true]')) continue
      const fg = parse(s.color); const bg = bgOf(el)
      if (!fg || bg.unknown) { unknown.push(el.tagName + '.' + String(el.className).slice(0, 30)); continue }
      const f = over({ ...fg, a: fg.a * (parseFloat(s.opacity) || 1) }, bg)
      const l1 = lum(f), l2 = lum(bg); const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
      const size = parseFloat(s.fontSize), bold = parseInt(s.fontWeight) >= 700
      const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5
      checked++
      if (ratio < need) bad.push({ id: 'text-contrast', impact: 'serious', help: ratio.toFixed(2) + ':1 needs ' + need, nodes: 1, first: el.tagName + '.' + String(el.className).slice(0, 40) + ' "' + el.innerText.trim().slice(0, 30) + '"' })
    }
    return { bad, unknown: unknown.length, checked }
  })()`
  const injectAxe = (b) => b.ev(AXE)
  let port = 9851
  for (const size of [{ name: 'phone', w: 390, h: 844, dpr: 2 }, { name: 'laptop', w: 1366, h: 768, dpr: 1 }]) {
    for (const scheme of ['light', 'dark']) {
      const b = await launch({ port: port++, width: size.w, height: size.h, dpr: size.dpr })
      await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] })
      const tab = async (n) => { await b.ev(`(()=>{[...document.querySelectorAll('[role=tab]')].find(x=>x.innerText.includes(${JSON.stringify(n)}))?.click()})()`); await sleep(1300) }
      const click = (t, scope = 'button') => b.ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(scope)})].find(x=>x.innerText.trim().startsWith(${JSON.stringify(t)})); if(!e) return 'NO'; e.click(); return 'ok'})()`)
      const label = `${size.name}-${scheme}`
      const scan = async (screen) => {
        await injectAxe(b)
        const v = await axeRun(b)
        const c = await b.ev(CONTRAST); v.push(...c.bad.slice(0, 8)); results.contrastChecked = (results.contrastChecked ?? 0) + c.checked; results.contrastUnknown = (results.contrastUnknown ?? 0) + c.unknown
        results.runs.push({ run: label, screen, violations: v })
        console.log(label.padEnd(12), screen.padEnd(22), v.length ? v.map((x) => `${x.id}(${x.nodes})`).join(' ') : 'no violations')
      }
      await b.send('Page.navigate', { url: APP }); await sleep(2500)
      await b.ev(`localStorage.clear(); localStorage.setItem('diabite.session','test-a11y-'+crypto.randomUUID()); localStorage.setItem('diabite.tour.v1', JSON.stringify(['input','verdict','calc','log'])); localStorage.setItem('diabite.nudge.v1', JSON.stringify(['after_3_meals','day_2'])); localStorage.setItem('sb-${REF}-auth-token', ${JSON.stringify(stored)})`)
      await b.send('Page.reload'); await sleep(4500)
      await scan('ask-empty')
      // a real answer
      await b.ev(`(()=>{const i=document.querySelector('input[type=text]'); i.focus()})()`)
      await b.send('Input.insertText', { text: 'Two eggs, a slice of rye bread and half an avocado' })
      await click('Check this meal')
      for (let i = 0; i < 90; i++) { await sleep(500); if (!(await b.ev(`[...document.querySelectorAll('button')].some(x=>x.innerText.includes('Thinking'))`)) && i > 3) break }
      await sleep(900)
      await scan('ask-answer')
      await click('Show calculation'); await sleep(600); await scan('ask-receipt')
      await click('What is GL?', 'button, a'); await sleep(600); await scan('dialog-what-is-gl')
      await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(400)
      await click('Close'); await sleep(300)
      await tab('Diary'); await scan('diary-today')
      await b.ev(`document.querySelector('button[aria-label="The day after"]')?.click()`); await sleep(900); await scan('diary-planned-day')
      await tab('Menu')
      for (let i = 0; i < 40 && !(await b.ev(`!!document.querySelector('.menu-meal')`)); i++) await sleep(300)
      await scan('menu')
      await click('Shopping list'); await sleep(500); await scan('menu-shopping-list')
      await tab('You'); await scan('you')
      await click('How it works'); await sleep(600); await scan('dialog-how-it-works'); await click('Close'); await sleep(300)
      await b.close()
    }
  }

  // Reflow (WCAG 1.4.10, 320 px) and 200% zoom (1.4.4: a 1280 px window shown at 640 px), light theme.
  for (const view of [{ name: '320 px wide', w: 320, h: 640 }, { name: '200% zoom (1280 px at 640 px)', w: 640, h: 600 }]) {
    const b = await launch({ port: port++, width: view.w, height: view.h, dpr: 2 })
    await b.send('Page.navigate', { url: APP }); await sleep(2500)
    await b.ev(`localStorage.clear(); localStorage.setItem('diabite.session','test-a11y-'+crypto.randomUUID()); localStorage.setItem('diabite.tour.v1', JSON.stringify(['input','verdict','calc','log'])); localStorage.setItem('diabite.nudge.v1', JSON.stringify(['after_3_meals','day_2'])); localStorage.setItem('sb-${REF}-auth-token', ${JSON.stringify(stored)})`)
    await b.send('Page.reload'); await sleep(4500)
    const tab = async (n) => { await b.ev(`(()=>{[...document.querySelectorAll('[role=tab]')].find(x=>x.innerText.includes(${JSON.stringify(n)}))?.click()})()`); await sleep(1300) }
    for (const screen of ['Ask', 'Diary', 'Menu', 'You']) {
      await tab(screen)
      if (screen === 'Menu') for (let i = 0; i < 40 && !(await b.ev(`!!document.querySelector('.menu-meal')`)); i++) await sleep(300)
      const m = await b.ev(`({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, wide: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(e).position !== 'fixed').slice(0, 3).map(e => e.tagName + '.' + (e.className || '').toString().slice(0, 30)) })`)
      const ok = m.scrollW <= m.innerW + 1
      results.reflow.push({ view: view.name, screen, ok, ...m })
      console.log(view.name.padEnd(30), screen.padEnd(8), ok ? 'no horizontal scroll' : `HORIZONTAL SCROLL ${m.scrollW} > ${m.innerW} ${m.wide.join(',')}`)
    }
    await b.close()
  }

  // The keyboard: Tab through each screen at laptop size.
  {
    const b = await launch({ port: port++, width: 1366, height: 768, dpr: 1 })
    await b.send('Page.navigate', { url: APP }); await sleep(2500)
    await b.ev(`localStorage.clear(); localStorage.setItem('diabite.session','test-a11y-'+crypto.randomUUID()); localStorage.setItem('diabite.tour.v1', JSON.stringify(['input','verdict','calc','log'])); localStorage.setItem('diabite.nudge.v1', JSON.stringify(['after_3_meals','day_2'])); localStorage.setItem('sb-${REF}-auth-token', ${JSON.stringify(stored)})`)
    await b.send('Page.reload'); await sleep(4500)
    const tab = async (n) => { await b.ev(`(()=>{[...document.querySelectorAll('[role=tab]')].find(x=>x.innerText.includes(${JSON.stringify(n)}))?.click()})()`); await sleep(1300) }
    for (const screen of ['Ask', 'Diary', 'Menu', 'You']) {
      await tab(screen)
      if (screen === 'Menu') for (let i = 0; i < 40 && !(await b.ev(`!!document.querySelector('.menu-meal')`)); i++) await sleep(300)
      await b.ev(`document.activeElement?.blur(); window.scrollTo(0,0); document.body.focus()`)
      const controls = await b.ev(`[...document.querySelectorAll('button, a[href], input, select, textarea, summary, [role=tab], [tabindex]:not([tabindex="-1"])')].filter(e => !e.disabled && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden').length`)
      const seen = new Map(); let noIndicator = []
      for (let i = 0; i < controls + 6; i++) {
        await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }); await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
        await sleep(40)
        const f = await b.ev(`(() => { const e = document.activeElement; if (!e || e === document.body) return null; const s = getComputedStyle(e); const sig = e.tagName + '|' + (e.getAttribute('aria-label') || e.innerText || e.getAttribute('placeholder') || '').trim().slice(0, 30) + '|' + [...document.querySelectorAll(e.tagName)].indexOf(e); return { sig, indicator: (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none' } })()`)
        if (f) { if (!seen.has(f.sig)) seen.set(f.sig, f.indicator); if (!f.indicator) noIndicator.push(f.sig) }
      }
      const r = { screen, controls, reached: seen.size, withoutIndicator: [...new Set(noIndicator)].slice(0, 6) }
      results.keyboard.push(r)
      console.log('keyboard', screen.padEnd(8), `${r.reached} of ${r.controls} controls reached by Tab`, r.withoutIndicator.length ? `no visible focus on: ${r.withoutIndicator.join('; ')}` : 'focus visible on all')
    }
    await b.close()
  }
} finally {
  await admin(`/auth/v1/admin/users/${uid}`, { method: 'DELETE' }).catch(() => {})
  writeFileSync(OUT, JSON.stringify(results, null, 1))
  console.log('throwaway account removed; results in', OUT)
}
