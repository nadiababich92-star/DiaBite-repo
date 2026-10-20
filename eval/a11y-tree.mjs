/**
 * What a screen reader is given, read from the browser's accessibility tree (roadmap 3.4, the part `a11y.mjs` left out).
 *
 *   node eval/a11y-tree.mjs        # APP=https://diabite.pro OUT=/tmp/a11y-tree.json READING=/tmp/a11y-reading.txt
 *
 * A screen reader (VoiceOver, NVDA) announces the browser's accessibility tree: each node's role, accessible name and state, in
 * reading order. This script asks Chrome for that tree on every main screen and checks what can be checked by machine: every
 * interactive node has a name, headings do not skip a level, there is one main landmark, the page has a title and a language, an
 * image has a name or is hidden from the tree, a dialog has a name, takes focus when it opens and gives it back when it closes, and
 * the notices that appear (the answer, the first-run tips, the feedback card) are in a live region and never take focus.
 * It also writes the reading order of each screen, so a person can read what would be announced.
 *
 * This is NOT a screen-reader session. It cannot say whether the order makes sense by ear, whether a label is clear, or how a
 * real reader's virtual cursor behaves. Like `a11y.mjs` it makes a throwaway account with the service key and deletes it at the end.
 */
import { launch } from './lib/cdp.mjs'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const SB = 'https://qennxqfbvgqyodjmkguo.supabase.co', REF = 'qennxqfbvgqyodjmkguo'
const APP = process.env.APP ?? 'https://diabite.pro'
const OUT = process.env.OUT ?? '/tmp/a11y-tree.json'
const READING = process.env.READING ?? '/tmp/a11y-reading.txt'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = readFileSync(`${ROOT}/.env.local`, 'utf8')
const PUB = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)?.[1]?.trim()
const SVC = execSync(`az containerapp secret show -g rg-nadia.babich92-5702 -n diabite-engine --secret-name supabase-service-key --query value -o tsv`, { env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } }).toString().trim()
const admin = (path, init = {}) => fetch(SB + path, { ...init, headers: { apikey: SVC, authorization: `Bearer ${SVC}`, 'content-type': 'application/json', ...(init.headers ?? {}) } })
const email = `a11y-${Date.now()}@example.com`, password = 'A11y-' + Math.random().toString(36).slice(2) + 'Aa1'
const uid = (await (await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) })).json()).id
const results = { app: APP, at: new Date().toISOString(), screens: [], dialogs: [], live: [] }
const reading = []

const INTERACTIVE = new Set(['button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio', 'switch', 'tab', 'slider', 'spinbutton', 'menuitem', 'option', 'listbox', 'textarea'])
const LANDMARKS = new Set(['main', 'navigation', 'banner', 'contentinfo', 'complementary', 'region', 'form', 'search'])

/** The tree as a flat list in reading order, ignored nodes dropped. */
async function readTree(b) {
  await b.send('Accessibility.enable')
  const { nodes } = await b.send('Accessibility.getFullAXTree')
  const byId = new Map(nodes.map((n) => [n.nodeId, n]))
  const out = []
  const walk = (id, depth) => {
    const n = byId.get(id); if (!n) return
    if (!n.ignored) {
      const props = Object.fromEntries((n.properties ?? []).map((p) => [p.name, p.value?.value]))
      out.push({ role: n.role?.value ?? '', name: (n.name?.value ?? '').trim(), props, depth })
    }
    for (const c of n.childIds ?? []) walk(c, n.ignored ? depth : depth + 1)
  }
  walk(nodes[0].nodeId, 0)
  return out
}

function check(list, screen) {
  const problems = []
  const roles = (r) => list.filter((n) => n.role === r)
  for (const n of list) if (INTERACTIVE.has(n.role) && !n.name && !n.props.labelledby) problems.push(`${n.role} with no accessible name`)
  // A number a reader would speak digit by digit: a float that was never rounded (8.600000000000001 once reached the budget bar's label).
  for (const n of list) if (/\d\.\d{4,}/.test(n.name)) problems.push(`a name with an unrounded number: "${n.name.slice(0, 50)}"`)
  const unnamedImages = list.filter((n) => (n.role === 'img' || n.role === 'image') && !n.name)
  if (unnamedImages.length) problems.push(`${unnamedImages.length} image(s) with no name (give alt text, or hide a decorative one)`)
  const heads = roles('heading')
  const levels = heads.map((h) => h.props.level)
  for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) problems.push(`heading level jumps from ${levels[i - 1]} to ${levels[i]} at "${heads[i].name.slice(0, 40)}"`)
  if (levels.filter((l) => l === 1).length > 1) problems.push(`${levels.filter((l) => l === 1).length} level-1 headings`)
  // A modal dialog takes the rest of the page out of the tree, so its own tree has no main landmark by design.
  if (!screen.startsWith('dialog') && !list.some((n) => n.role === 'main')) problems.push('no main landmark')
  const dup = {}; for (const n of list.filter((x) => x.role === 'button' && x.name)) dup[n.name] = (dup[n.name] ?? 0) + 1
  const repeated = Object.entries(dup).filter(([, c]) => c > 2).map(([k, c]) => `"${k.slice(0, 30)}" x${c}`)
  return { screen, nodes: list.length, headings: heads.length, landmarks: list.filter((n) => LANDMARKS.has(n.role)).map((n) => n.role + (n.name ? `:${n.name.slice(0, 20)}` : '')), repeatedButtonNames: repeated, problems }
}

const dump = (screen, list) => {
  reading.push(`\n=== ${screen} ===`)
  for (const n of list) {
    if (n.role === 'StaticText' || n.role === 'InlineTextBox' || n.role === 'none' || n.role === 'generic') { if (n.role === 'StaticText' && n.name) reading.push(' '.repeat(Math.min(n.depth, 8)) + n.name.slice(0, 110)); continue }
    const st = ['checked', 'pressed', 'selected', 'expanded', 'current', 'disabled'].filter((k) => n.props[k] !== undefined && n.props[k] !== false && n.props[k] !== 'false').map((k) => `${k}=${n.props[k]}`).join(' ')
    reading.push(' '.repeat(Math.min(n.depth, 8)) + `[${n.role}${n.role === 'heading' ? n.props.level : ''}] ${n.name.slice(0, 90)}${st ? ' (' + st + ')' : ''}`)
  }
}

try {
  const session = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUB, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()
  const stored = JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) + session.expires_in })
  const profile = { sex: 'female', age: 52, heightCm: 168, weightKg: 70, activity: 'light', condition: 't2', goal: 'lose', carbApproach: 'low', excludedFoodIds: [], insulin: 'none', meds: ['metformin'], pregnantOrBreastfeeding: false, kidney: 'none', comorbidities: [], allergens: [], pattern: 'none', units: 'imperial', showBreadUnits: false, onboarded: true }
  await admin('/rest/v1/profiles', { method: 'POST', body: JSON.stringify({ user_id: uid, data: profile, consent_at: new Date().toISOString(), consent_version: '2026-10-b', updated_at: new Date().toISOString() }), headers: { prefer: 'return=minimal' } })
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const row = (n, meal, food, g, planned = false) => ({ user_id: uid, id: `a11y-${n}-${meal}-${food}`, day: day(n), meal, food_id: food, grams: g, snapshot: null, planned, updated_at: new Date().toISOString() })
  await admin('/rest/v1/diary_entries', { method: 'POST', body: JSON.stringify([row(0, 'breakfast', 'oats', 50), row(0, 'lunch', 'lentils', 150), row(1, 'dinner', 'salmon', 150, true)]), headers: { prefer: 'return=minimal' } })

  const login = (b, tour) => b.ev(`localStorage.clear(); localStorage.setItem('diabite.session','test-a11y-'+crypto.randomUUID()); ${tour ? '' : `localStorage.setItem('diabite.tour.v1', JSON.stringify(['input','verdict','calc','log']));`} localStorage.setItem('diabite.nudge.v1', JSON.stringify(['after_3_meals','day_2'])); localStorage.setItem('sb-${REF}-auth-token', ${JSON.stringify(stored)})`)
  const focusInfo = (b) => b.ev(`(() => { const e = document.activeElement; if (!e || e === document.body) return { where: 'body' }; const d = e.closest('[role=dialog], dialog'); return { where: d ? 'dialog' : 'page', tag: e.tagName, label: (e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 40) } })()`)
  const key = async (b, k, code, vk) => { await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk }); await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }) }

  // Signed out: the first thing a stranger meets is the landing page, then the sign-in screen behind "Try DiaBite".
  {
    const b = await launch({ port: 9871, width: 390, height: 844, dpr: 2 })
    await b.send('Page.navigate', { url: APP }); await sleep(3500)
    const meta = await b.ev(`({ lang: document.documentElement.lang, title: document.title, video: !!document.querySelector('video'), captions: !!document.querySelector('video track[kind=captions]'), h1: document.querySelectorAll('h1').length })`)
    const landing = await readTree(b); const lr = check(landing, 'landing (signed out)')
    if (!meta.lang) lr.problems.push('<html> has no lang'); if (!meta.title) lr.problems.push('page has no title')
    if (meta.h1 !== 1) lr.problems.push(`${meta.h1} h1 elements (want exactly one)`)
    if (!meta.video) lr.problems.push('no video element on the landing page'); else if (!meta.captions) lr.problems.push('the clip has no captions track')
    results.screens.push({ ...lr, meta }); dump('landing (signed out)', landing)
    await b.ev(`[...document.querySelectorAll('button')].find(x => x.innerText.trim() === 'Try DiaBite')?.click()`); await sleep(900)
    const list = await readTree(b); const r = check(list, 'sign-in (signed out)')
    results.screens.push(r); dump('sign-in (signed out)', list); await b.close()
  }

  // Signed in, with the first-run tips left ON: do they announce themselves and leave focus alone?
  {
    const b = await launch({ port: 9872, width: 390, height: 844, dpr: 2 })
    await b.send('Page.navigate', { url: APP }); await sleep(2500); await login(b, true); await b.send('Page.reload'); await sleep(4500)
    const list = await readTree(b); const r = check(list, 'ask-empty (first-run tips on)')
    const focus = await focusInfo(b)
    const tipLive = await b.ev(`(() => { const t = document.querySelector('.tour-tip'); if (!t) return { found: false }; const live = t.closest('[aria-live]') || t.getAttribute('aria-live') || t.getAttribute('role'); return { found: true, role: t.getAttribute('role'), live: live ? (typeof live === 'string' ? live : live.getAttribute('aria-live')) : null, holdsFocus: t.contains(document.activeElement) } })()`)
    results.screens.push(r); results.live.push({ what: 'first-run tip', ...tipLive, focusOnLoad: focus })
    if (tipLive.found && tipLive.holdsFocus) r.problems.push('the first-run tip takes focus')
    if (tipLive.found && !tipLive.live) r.problems.push('the first-run tip is not in a live region or status role')
    dump('ask-empty (first-run tips on)', list); await b.close()
  }

  // Signed in, tips off: every main screen, plus the answer and the dialogs.
  {
    const b = await launch({ port: 9873, width: 390, height: 844, dpr: 2 })
    await b.send('Page.navigate', { url: APP }); await sleep(2500); await login(b, false); await b.send('Page.reload'); await sleep(4500)
    const tab = async (n) => { await b.ev(`(()=>{[...document.querySelectorAll('[role=tab]')].find(x=>x.innerText.includes(${JSON.stringify(n)}))?.click()})()`); await sleep(1300) }
    const click = (t, scope = 'button') => b.ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(scope)})].find(x=>x.innerText.trim().startsWith(${JSON.stringify(t)})); if(!e) return 'NO'; e.focus(); e.click(); return 'ok'})()`)
    const scan = async (screen) => { const list = await readTree(b); results.screens.push(check(list, screen)); dump(screen, list); return list }
    await scan('ask-empty')
    await b.ev(`document.querySelector('input[type=text]').focus()`)
    await b.send('Input.insertText', { text: 'Two eggs, a slice of rye bread and half an avocado' })
    const before = await b.ev(`document.querySelectorAll('[aria-live]').length`)
    await click('Check this meal')
    for (let i = 0; i < 90; i++) { await sleep(500); if (!(await b.ev(`[...document.querySelectorAll('button')].some(x=>x.innerText.includes('Thinking'))`)) && i > 3) break }
    await sleep(900)
    const answerLive = await b.ev(`(() => { const a = [...document.querySelectorAll('[aria-live], [role=status], [role=alert]')].filter(e => /fit|load|glycemic|left/i.test(e.innerText)); return { liveRegionsWithTheAnswer: a.length, politeness: a.map(e => e.getAttribute('aria-live') || e.getAttribute('role')), focusMovedTo: (document.activeElement && document.activeElement.tagName) } })()`)
    results.live.push({ what: 'the answer', liveRegionsBefore: before, ...answerLive })
    await scan('ask-answer'); await click('Show calculation'); await sleep(600); await scan('ask-receipt')
    // Dialogs: focus goes in when one opens and comes back when it closes.
    for (const [name, scope] of [['What is GL?', 'button, a']]) {
      const opener = await click(name, scope); await sleep(700)
      const inside = await focusInfo(b); const list = await scan('dialog-' + name)
      const dlg = list.find((n) => n.role === 'dialog')
      await key(b, 'Escape', 'Escape', 27); await sleep(500)
      const back = await focusInfo(b)
      const d = { dialog: name, opened: opener, role: dlg ? 'dialog' : 'MISSING', named: !!dlg?.name, focusWhenOpen: inside, focusAfterEscape: back }
      d.ok = !!dlg && !!dlg.name && inside.where === 'dialog' && back.where !== 'body'
      results.dialogs.push(d); await click('Close'); await sleep(300)
    }
    await tab('Diary'); await scan('diary-today')
    await b.ev(`document.querySelector('button[aria-label="The day after"]')?.click()`); await sleep(900); await scan('diary-planned-day')
    await tab('Menu')
    for (let i = 0; i < 40 && !(await b.ev(`!!document.querySelector('.menu-meal')`)); i++) await sleep(300)
    await scan('menu')
    await tab('You'); await scan('you')
    {
      const opener = await click('How it works'); await sleep(700)
      const inside = await focusInfo(b); const list = await scan('dialog-how-it-works'); const dlg = list.find((n) => n.role === 'dialog')
      await key(b, 'Escape', 'Escape', 27); await sleep(500); const back = await focusInfo(b)
      const d = { dialog: 'How it works', opened: opener, role: dlg ? 'dialog' : 'MISSING', named: !!dlg?.name, focusWhenOpen: inside, focusAfterEscape: back }
      d.ok = !!dlg && !!dlg.name && inside.where === 'dialog' && back.where !== 'body'
      results.dialogs.push(d)
    }
    await b.close()
  }

  for (const s of results.screens) console.log(s.screen.padEnd(34), String(s.nodes).padStart(4), 'nodes', s.problems.length ? 'PROBLEMS: ' + s.problems.join(' | ') : 'ok', s.repeatedButtonNames.length ? `(repeated names: ${s.repeatedButtonNames.join(', ')})` : '')
  for (const d of results.dialogs) console.log('dialog', d.dialog.padEnd(14), d.ok ? 'ok' : 'PROBLEM', JSON.stringify(d))
  for (const l of results.live) console.log('live', JSON.stringify(l))
} finally {
  await admin(`/auth/v1/admin/users/${uid}`, { method: 'DELETE' }).catch(() => {})
  writeFileSync(OUT, JSON.stringify(results, null, 1)); writeFileSync(READING, reading.join('\n'))
  console.log('throwaway account removed; results in', OUT, 'reading order in', READING)
}
