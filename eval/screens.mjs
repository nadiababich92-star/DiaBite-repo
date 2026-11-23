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


// A diary history for the throwaway account, so the week and the four-week strip have something to show.
// Rows are shaped like the app's own (src/lib/syncCore.ts toRow) and go away with the account.
const SEED = process.env.SEED
if (SEED === 'full' || SEED === 'thin') {
  const dayAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const rows = []
  const add = (n, meal, food_id, grams, snapshot = null) => rows.push({ user_id: uid, id: `seed-${n}-${meal}-${food_id}`, day: dayAgo(n), meal, food_id, grams, snapshot, updated_at: new Date().toISOString() })
  const threeMeals = (n) => { add(n, 'breakfast', 'egg', 110); add(n, 'lunch', 'egg', 110); add(n, 'dinner', 'egg', 110) }
  if (SEED === 'full') {
    for (const n of [1, 2, 3, 4, 8, 9, 10, 22]) threeMeals(n)       // in range: four this week, three last week, one three weeks ago
    threeMeals(5); add(5, 'dinner', 'rice-white', 400)               // over the budget
    add(6, 'lunch', 'egg', 110)                                      // thin: one meal
    add(23, 'snack', 'branded:seed', 30, { name: 'Granola bar', kcal: 120, carbs: 20, fiber: 1, protein: 2, fat: 4, availableCarbs: 19, gi: null, gl: 0, loadAvailable: false })
  } else {
    for (const n of [1, 3, 5]) add(n, 'lunch', 'egg', 110)           // three days with one meal each
  }
  const r = await admin('/rest/v1/diary_entries', { method: 'POST', body: JSON.stringify(rows), headers: { prefer: 'return=minimal' } })
  console.log(`seeded ${rows.length} diary rows (${SEED}):`, r.status)
}

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
      // The short onboarding (docs/specs/first-session-onboarding-screen.md): one screen. An age under 18 is an exit, and "Change my age" comes back here.
      {
        const headings = () => b.ev(`[...document.querySelectorAll('.onb-card h2')].map((h) => h.innerText.trim()).join('|')`)
        const start = () => b.ev(`[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Start using DiaBite')?.disabled ?? null`)
        const first = await headings(), lockedAtFirst = await start()
        await b.ev(`__setNum('Age', 17)`); await sleep(500)
        const exitText = await b.ev(`document.querySelector('.onb-exit')?.innerText ?? ''`)
        await shot('onboarding-exit-minor')
        await click('Change my age'); await sleep(500)
        const back = await headings()
        const noProgress = await b.ev(`!document.querySelector('.onb-progress')`)
        const ok = /Before we start/.test(first) && lockedAtFirst === true && /not for us to answer/i.test(exitText) && /Before we start/.test(back) && noProgress
        console.log(`  ${ok ? 'PASS' : 'FAIL'}  the short onboarding: one screen, Start locked, an under-18 exit that comes back (${size.name})${ok ? '' : '  → ' + JSON.stringify({ first, lockedAtFirst, exitText: exitText.slice(0, 80), back, noProgress })}`)
        if (!ok) process.exitCode = 1
      }
      await b.ev(`__check('I agree that DiaBite keeps this about me')`)
      await b.ev(`__setNum('Age', 52)`); await sleep(500)
      // the acknowledgement needs ticking before the key works; try until the ask screen is open
      for (let i = 0; i < 8; i++) {
        await b.ev(`__check('I understand this is not medical advice')`); await sleep(300)
        await click('Start using DiaBite'); await sleep(1800)
        if (await b.ev(`!!document.querySelector('.ask-form')`)) break
      }
    }
    await shot('ask-empty')
    // The Ask card, commit 2 (docs/specs/ask-order-and-day-chip.md and ask-evals.md, section 2): the box first and above the tab bar,
    // the budget row under it, and the day chip that opens the picker, closes on a choice and on Escape, with the focus back on it.
    {
      const fits = async () => b.ev(`(() => {
        window.scrollTo(0, 0)
        const input = document.querySelector('.ask-form input'), key = document.querySelector('.ask-form button.primary')
        const nav = document.querySelector('nav.tabs'), navTop = nav && getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect().top : innerHeight
        return { input: Math.round(input.getBoundingClientRect().bottom), key: Math.round(key.getBoundingClientRect().bottom), navTop: Math.round(navTop), ok: input.getBoundingClientRect().bottom <= navTop && key.getBoundingClientRect().bottom <= navTop }
      })()`)
      const sizes = {}
      if (size.name === 'phone') {
        for (const [w, h] of [[375, 667], [390, 844]]) {
          await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: size.dpr, mobile: true }); await sleep(600)
          sizes[`${w}x${h}`] = await fits()
        }
        await b.send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: size.dpr, mobile: true }); await sleep(400)
      } else sizes[size.name] = await fits()
      const layout = await b.ev(`(() => {
        const top = (sel) => document.querySelector(sel)?.getBoundingClientRect().top ?? null
        return { form: top('.ask-form'), budget: top('.ask-budget'), bar: top('.budget-bar'), chip: top('.day-chip'), label: document.querySelector('.ask-budget .label')?.innerText.trim().toLowerCase(), link: document.querySelector('.ask-budget .gl-help')?.innerText.trim(), oldNote: document.body.innerText.includes('Glycemic load (GL) is how much') }
      })()`)
      const chipState = () => b.ev(`(() => { const c = document.querySelector('.day-chip'); return { text: c?.innerText.trim(), open: c?.getAttribute('aria-expanded'), choices: [...document.querySelectorAll('.day-chip-panel .day-picker .chip-toggle')].map((e) => e.innerText.trim()), focus: document.activeElement === c, note: !!document.querySelector('.ask-day-note') } })()`)
      const closed = await chipState()
      await b.ev(`document.querySelector('.day-chip').click()`); await sleep(400)
      const opened = await chipState()
      await b.ev(`[...document.querySelectorAll('.day-chip-panel button')].find((x) => x.innerText.trim() === 'Tomorrow')?.click()`); await sleep(600)
      const tomorrow = { ...(await chipState()), verdictLine: /The verdict is for Tomorrow/.test(await b.ev(`document.querySelector('.ask-day-note')?.innerText ?? ''`)), label: await b.ev(`document.querySelector('.ask-budget .label')?.innerText.trim().toLowerCase()`) }
      await b.ev(`document.querySelector('.day-chip').click()`); await sleep(400)
      await b.ev(`document.querySelector('.day-chip-panel button').focus(); document.querySelector('.day-chip-panel button').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await sleep(400)
      const escaped = await chipState()
      // Back to today, so the answer below is counted against today as before.
      await b.ev(`document.querySelector('.day-chip').click()`); await sleep(300)
      await b.ev(`[...document.querySelectorAll('.day-chip-panel button')].find((x) => x.innerText.trim() === 'Today')?.click()`); await sleep(600)
      await shot('ask-day-chip')
      const ok = Object.values(sizes).every((x) => x.ok)
        && layout.form < layout.budget && layout.budget < layout.bar && layout.bar < layout.chip && layout.label === 'glycemic load left today' && layout.link === 'What is GL?' && !layout.oldNote
        && closed.text === 'Today' && closed.open === 'false' && opened.open === 'true' && ['Today', 'Yesterday', 'Tomorrow', 'Pick a date'].every((c) => opened.choices.includes(c))
        && tomorrow.text === 'Tomorrow' && tomorrow.open === 'false' && tomorrow.verdictLine && tomorrow.label === 'glycemic load left tomorrow'
        && escaped.open === 'false' && escaped.focus
        && (await b.ev(`document.querySelector('.day-chip')?.innerText.trim()`)) === 'Today'
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  the Ask card: the box first and above the tab bar, the budget under it, the day chip opens, closes on a choice and on Escape (${size.name})${ok ? '' : '  → ' + JSON.stringify({ sizes, layout, closed, opened, tomorrow, escaped })}`)
      if (!ok) process.exitCode = 1
    }
    if (await b.ev(`!!document.querySelector('.nudge')`)) { await b.ev(`document.querySelector('.nudge').scrollIntoView({block:'center'})`); await sleep(500); await shot('feedback-card') }
    if (process.env.TOUR === '1') await shot('tour-1')
    await b.ev(`(()=>{const i=document.querySelector('input[type=text]'); i.focus()})()`)
    await b.send('Input.insertText', { text: process.env.QUESTION ?? 'Two eggs, a slice of rye bread and half an avocado' })
    await click('Check this meal')
    for (let i = 0; i < 90; i++) { await sleep(500); if (!(await b.ev(`[...document.querySelectorAll('button')].some(x=>x.innerText.includes('Thinking'))`)) && i > 3) break }
    await sleep(1000)
    await shot('ask-answer')
    // "Change day" under an answer opens the day chip's picker and puts the focus on its first choice; Escape closes it again.
    {
      await b.ev(`[...document.querySelectorAll('.log-day button')].find((x) => x.innerText.trim() === 'Change day')?.click()`); await sleep(900)
      const st = await b.ev(`(() => { const first = document.querySelector('.day-chip-panel button'); return { open: document.querySelector('.day-chip')?.getAttribute('aria-expanded'), first: first?.innerText.trim() ?? null, focused: !!first && document.activeElement === first } })()`)
      await b.ev(`document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await sleep(400)
      const ok = st.open === 'true' && st.focused && (await b.ev(`document.querySelector('.day-chip')?.getAttribute('aria-expanded')`)) === 'false'
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  Change day under an answer opens the picker with the focus on its first choice (${size.name})${ok ? '' : '  → ' + JSON.stringify(st)}`)
      if (!ok) process.exitCode = 1
    }
    // Flat surfaces, one slip (docs/engineering/lighter-surfaces.md): no shadow on cards, keys, outlined buttons, fields or the tab bar; the answer slip keeps
    // its drop shadow; no grain; the marker does not glow; the highlights on the figures are still there; the active tab is underlined, not on a marker.
    {
      const flat = await b.ev(`(() => {
        const shadowed = (sel) => [...document.querySelectorAll(sel)].filter((e) => getComputedStyle(e).boxShadow !== 'none').map((e) => e.className || e.tagName)
        const slip = document.querySelector('.card.answer')
        const carb = document.querySelector('.fig-big.carb .num'), gl = document.querySelector('.fig-big.gl.ok .num')
        const tab = document.querySelector('nav.tabs button[aria-selected="true"]')
        const tabStyle = tab ? getComputedStyle(tab) : null
        const markerProbe = document.createElement('span'); markerProbe.style.background = 'var(--marker)'; document.body.appendChild(markerProbe)
        const marker = getComputedStyle(markerProbe).backgroundColor; markerProbe.remove()
        const opaque = (el) => !!el && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(getComputedStyle(el).backgroundColor)
        return {
          shadowed: [...shadowed('.card:not(.answer)'), ...shadowed('button.primary'), ...shadowed('button.ghost'), ...shadowed('nav.tabs'), ...shadowed('input:not([type=checkbox]):not([type=radio]), select, textarea')],
          slipFilter: slip ? getComputedStyle(slip).filter : 'no slip',
          grain: /svg/.test(getComputedStyle(document.body).backgroundImage),
          glow: [...document.querySelectorAll('.fig-big .num, .ask-budget .value .num')].map((e) => getComputedStyle(e).boxShadow).filter((x) => x !== 'none'),
          carbHighlight: opaque(carb), glHighlight: gl ? getComputedStyle(gl).backgroundColor === marker : 'no fit',
          tab: tabStyle ? { line: tabStyle.textDecorationLine, bg: tabStyle.backgroundColor, ico: getComputedStyle(tab.querySelector('.tab-ico')).backgroundColor, marker } : null,
        }
      })()`)
      const tabOk = flat.tab && /underline/.test(flat.tab.line) && flat.tab.bg !== flat.tab.marker && flat.tab.ico !== flat.tab.marker
      const ok = flat.shadowed.length === 0 && flat.slipFilter !== 'none' && flat.slipFilter !== 'no slip' && !flat.grain && flat.glow.length === 0 && flat.carbHighlight && flat.glHighlight !== false && tabOk
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  flat surfaces, one slip: no shadows, the slip keeps its own, no grain or glow, the highlights stay, the tab is underlined (${size.name})${ok ? '' : '  → ' + JSON.stringify(flat)}`)
      if (!ok) process.exitCode = 1
    }
    // Under an answer, Log it is the one key; Calculation and Portions are quiet links: underlined accent text, 44px, weight 400, with a caret
    // that turns and weight 600 while its panel is open (docs/design.md, Buttons; docs/engineering/lighter-surfaces.md 5.3). The figures are two
    // flat columns with a 1px rule between them.
    {
      const read = `(() => {
        const probe = document.createElement('span'); probe.style.color = 'var(--accent)'; document.querySelector('.act-bar')?.appendChild(probe)
        const accent = probe ? getComputedStyle(probe).color : ''; probe.remove()
        const clear = (c) => /rgba\\(0, 0, 0, 0\\)|transparent/.test(c)
        const all = [...document.querySelectorAll('.act-bar button')]
        const keys = all.filter((k) => !clear(getComputedStyle(k).backgroundColor) || getComputedStyle(k).backgroundImage !== 'none').map((k) => k.innerText.trim())
        const links = all.filter((k) => k.hasAttribute('aria-expanded')).map((k) => { const c = getComputedStyle(k), car = k.querySelector('.act-link-caret'); return { name: k.innerText.trim(), cls: k.className, open: k.getAttribute('aria-expanded') === 'true', color: c.color, line: c.textDecorationLine, weight: c.fontWeight, h: Math.round(k.getBoundingClientRect().height), border: c.borderTopWidth, caret: car ? getComputedStyle(car).transform : null } })
        const cols = [...document.querySelectorAll('.card.answer .fig-pair')].slice(0, 1).flatMap((p) => [...p.querySelectorAll(':scope > .fig-card')].map((f) => { const c = getComputedStyle(f); return { bg: clear(c.backgroundColor), top: c.borderTopWidth, left: c.borderLeftWidth } }))
        return { accent, keys, links, cols }
      })()`
      const before = await b.ev(read)
      await click('Calculation'); await sleep(500)
      const opened = await b.ev(read)
      await click('Calculation'); await sleep(500)
      const closed = await b.ev(read)
      const calc = (r) => r.links.find((k) => k.name === 'Calculation')
      const quiet = (k) => k.cls === 'act-link' && k.color === before.accent && /underline/.test(k.line) && k.h >= 44 && k.border === '0px'
      const linksOk = before.links.length >= 2 && before.links.every(quiet) && before.links.every((k) => k.caret !== null)
      const stateOk = calc(opened)?.open && calc(opened).weight === '600' && calc(opened).caret !== 'none' && !calc(closed)?.open && calc(closed).weight === '400' && calc(closed).caret === 'none'
      const keyOk = before.keys.length === 1 && /^(Log it|Log what was counted|Plan it|Logged|Planned|Sign in to log this)$/.test(before.keys[0])
      const colsOk = before.cols.length === 2 && before.cols.every((c) => c.bg && c.top === '0px') && before.cols[1].left === '1px'
      const ok = linksOk && stateOk && keyOk && colsOk
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  the answer card: Log it the one key, Calculation and Portions quiet links that show an open panel by weight and caret, the figures two flat columns (${size.name})${ok ? '' : '  → ' + JSON.stringify({ before, opened, closed })}`)
      if (!ok) process.exitCode = 1
    }
    if (process.env.PLAN === '1') {
      // The day is chosen at the top of Ask; with an answer on screen it is asked again for that day.
      await b.ev(`document.querySelector('.day-chip')?.click()`); await sleep(400)
      await b.ev(`(()=>{const e=[...document.querySelectorAll('.day-chip-panel button')].find(x=>x.innerText.trim()==='Tomorrow'); e?.click()})()`); await sleep(1500)
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
    await tab('Menu')
    for (let i = 0; i < 40 && !(await b.ev(`!!document.querySelector('.menu-meal')`)); i++) await sleep(300)
    await shot('menu')
    // The day strip says what its numbers are (docs/engineering/menu-day-strip.md): a caption directly before the keys, the group described by it,
    // seven keys that each name the glycemic load, and no overlap. Read from the page, not from the source.
    {
      const strip = await b.ev(`(() => {
        const note = document.querySelector('.day-strip-note'), strip = document.querySelector('.day-strip')
        if (!note || !strip) return { present: false }
        const n = note.getBoundingClientRect(), t = strip.getBoundingClientRect()
        const keys = [...strip.querySelectorAll('button')]
        return { present: true, before: note.nextElementSibling === strip, says: /glycemic load/i.test(note.textContent || ''),
          described: !!note.id && strip.getAttribute('aria-describedby') === note.id, keys: keys.length, labelled: keys.every((k) => /glycemic load/i.test(k.getAttribute('aria-label') || '')),
          clear: n.bottom <= t.top + 0.5 }
      })()`)
      const ok = strip.present && strip.before && strip.says && strip.described && strip.keys === 7 && strip.labelled && strip.clear
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  menu day strip caption (${size.name})${ok ? '' : '  → ' + JSON.stringify(strip)}`)
      if (!ok) process.exitCode = 1
    }
    if (process.env.PLAN === '1') {
      await b.ev(`document.querySelector('.menu-meal button[aria-expanded]')?.click()`); await sleep(600)
      await b.ev(`document.querySelector('.plan-inline')?.scrollIntoView({block:'center'})`); await sleep(400)
      await shot('menu-plan')
    }
    // The Menu's recipe disclosure shows a caret too (the same class).
    const menuCaret = await b.ev(`(() => { const s = document.querySelector('.menu-meal .recipe-more summary'); return s ? getComputedStyle(s, '::after').borderTopStyle : 'no recipe' })()`)
    await tab('Profile'); await shot('you')
    const profileHome = await b.ev(`/home screen/i.test(document.querySelector('main')?.innerText ?? '')`)
    await tab('Settings'); await shot('settings')
    // The home-screen card (docs/engineering/navigation.md): in Settings, inside Help, with a caret; opened, its three lists; never in Profile.
    {
      const nav = await b.ev(`(() => {
        const help = [...document.querySelectorAll('section.card')].find((c) => c.querySelector('h2')?.innerText.trim() === 'Help')
        const det = help?.querySelector('details.recipe-more'), sum = det?.querySelector('summary')
        const caret = sum ? getComputedStyle(sum, '::after') : null
        if (det) det.open = true
        const heads = det ? [...det.querySelectorAll('h3')].map((h) => h.innerText.trim()) : []
        if (det) det.open = false
        return { inHelp: !!det, summary: sum?.innerText.trim() ?? null, caret: caret ? caret.content + ' ' + caret.borderTopStyle : null, heads }
      })()`)
      const ok = nav.inHelp && nav.summary === 'Put DiaBite on your home screen' && nav.caret && !/^none/.test(nav.caret) && /solid/.test(nav.caret)
        && nav.heads.join('|') === 'iPhone or iPad|Android|Computer' && !profileHome && (menuCaret === 'solid' || menuCaret === 'no recipe')
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  the home-screen card is in Settings > Help with a caret, not in Profile; the Menu's recipe shows a caret (${size.name})${ok ? '' : '  → ' + JSON.stringify({ nav, profileHome, menuCaret })}`)
      if (!ok) process.exitCode = 1
    }
    if (process.env.TOUR === '1') { await click('How it works'); await sleep(700); await shot('how-it-works'); await click('Close') }
    if (errs.length) console.log('  script errors:', errs.slice(0, 2))
    await b.close()
  }
} finally {
  // With the service key, not the app's /account route: a local dev server has no such route and the throwaway account would stay.
  await admin(`/auth/v1/admin/users/${uid}`, { method: 'DELETE' }).catch(() => {})
  console.log('throwaway account removed')
}
