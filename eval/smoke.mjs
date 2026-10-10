/**
 * A smoke test of the running service, the way a person meets it.
 *
 *   npm run smoke                       # the live address
 *   npm run smoke -- http://localhost:8787
 *
 * Rule 1 of CLAUDE.md: check the thing, not the tool's report. A deploy that prints "live"
 * proves a process answered /health; it does not prove the page opens, the engine's tools
 * are closed to strangers, the safety rules still answer, or that a person can ask a
 * question and read a verdict. This does all of that in a headless Chrome and exits
 * non-zero if any step fails. It spends two model turns (a fraction of a cent).
 *
 * With sign-in required it can only check the wall, because a stranger cannot sign in.
 */
import { launch } from './lib/cdp.mjs'

const URL_ = (process.argv[2] ?? process.env.SMOKE_URL ?? 'https://diabite-engine.greenglacier-ab5551c6.swedencentral.azurecontainerapps.io').replace(/\/$/, '')
let failed = 0
const check = (id, what, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${what}${ok ? '' : `  → ${detail}`}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── the service, without a browser ────────────────────────────────────────
const health = await (await fetch(`${URL_}/health`)).json().catch(() => ({}))
check('M1', '/health answers ok with a full catalogue', health.ok === true && health.records >= 6000, JSON.stringify(health))

const page = await fetch(`${URL_}/`)
const csp = page.headers.get('content-security-policy') ?? ''
check('M2', 'the page loads with its security headers', page.status === 200 && csp.includes("frame-ancestors 'none'") && !page.headers.get('x-powered-by'), `${page.status} ${csp.slice(0, 60)}`)

const tools = await fetch(`${URL_}/tools/resolve_foods`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"phrases":["rice"]}' })
check('M3', 'the engine\'s tools are closed to a caller with no key', tools.status === 401, String(tools.status))

const del = await fetch(`${URL_}/account`, { method: 'DELETE' })
check('M4', 'DELETE /account with no token is 401', del.status === 401, String(del.status))

const dose = await fetch(`${URL_}/agent/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: `smoke-${Date.now()}`, message: 'how many units of insulin should I take for this meal' }) })
const doseBody = await dose.json().catch(() => ({}))
check('M5', 'a dosing question is refused by the rule, with no sign-in and no model', dose.status === 200 && doseBody.blockedRule === 'dosing', JSON.stringify([dose.status, doseBody.blockedRule]))

const red = await fetch(`${URL_}/agent/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: `smoke-${Date.now()}`, message: 'my glucose is 320 and I am vomiting' }) })
const redBody = await red.json().catch(() => ({}))
check('M6', 'a red-flag message is answered by the rule, never turned away', red.status === 200 && redBody.blockedRule === 'red_flag', JSON.stringify([red.status, redBody.blockedRule]))

// ── the page, as a person ─────────────────────────────────────────────────
const b = await launch({ port: 9500 + Math.floor(Math.random() * 400), width: 900, height: 1100, dpr: 1 })
const errors = []
b.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.text ?? 'exception'))
b.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error') errors.push((p.args?.[0]?.value ?? '').toString().slice(0, 120)) })
try {
  await b.send('Page.navigate', { url: URL_ }); await sleep(2800)
  await b.ev(`
window.__setNum = (labelText, v) => { const el = [...document.querySelectorAll('label.field')].find(l => l.innerText.trim().startsWith(labelText))?.querySelector('input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(el,String(v)); el.dispatchEvent(new Event('input',{bubbles:true})) }
window.__click = (text) => { const el=[...document.querySelectorAll('button')].find(e=>e.innerText.trim().startsWith(text)); if(!el) throw new Error('no button '+text); el.click() }
window.__check = (aria) => document.querySelector('input[aria-label="'+aria+'"]').click()
window.__busy = () => [...document.querySelectorAll('button')].some(x => x.innerText.includes('Thinking'))`)
  const text = async () => b.ev('document.body.innerText')

  if (health.signIn === true) {
    const t = await text()
    check('M7', 'sign-in is required: the first screen is the sign-in screen with the emergency line',
      /Email me a link/.test(t) && /call emergency services/i.test(t) && !/Can I eat this\?/.test(t), t.slice(0, 120))
  } else {
    await b.ev(`__setNum('Age', 52)`); await b.ev(`__click('Continue')`); await sleep(250)
    await b.ev(`__click('Type 2 diabetes')`); await b.ev(`__click('Continue')`); await sleep(250)
    await b.ev(`__click('Continue')`); await sleep(250); await b.ev(`__click('Continue')`); await sleep(250)
    await b.ev(`__check('I understand this is not medical advice')`); await b.ev(`__click('Start using DiaBite')`); await sleep(1200)
    check('M7', 'onboarding completes and the ask screen opens', /What are you\s+about to eat/i.test(await text()), (await text()).slice(0, 120))

    const ask = async (q) => {
      await b.ev(`(()=>{const i=document.querySelector('input[type=text]'); i.focus(); i.select()})()`)
      await b.send('Input.insertText', { text: q })
      const t0 = Date.now()
      await b.ev(`__click('Ask')`)
      for (let i = 0; i < 100; i++) { await sleep(400); if (!await b.ev('__busy()')) break }
      await sleep(500)
      return { text: await text(), secs: (Date.now() - t0) / 1000 }
    }

    const meal = await ask('Burrito bowl with white rice, black beans, chicken and guacamole')
    check('M8', 'a meal gets a verdict, three figures, a verified mark and the calculation',
      /THIS MEAL/i.test(meal.text) && /LEFT AFTER|OVER BY|LEFT SO FAR/i.test(meal.text) && /Verified/.test(meal.text) && /Show calculation/.test(meal.text), meal.text.slice(0, 200))
    check('M9', 'the answer arrives in under 15 seconds', meal.secs < 15, `${meal.secs.toFixed(1)} s`)

    const partial = await ask("A slice of grandma's kugel and two eggs")
    check('M10', 'a meal with an unknown food is never called "fits" and says what is left so far',
      !/FITS\b/i.test(partial.text.split('\n').slice(0, 40).join(' ').replace(/\bdoes not fit\b/gi, '')) && /LEFT SO FAR/i.test(partial.text), partial.text.slice(0, 260))

    await b.send('Page.navigate', { url: `${URL_}/?demo` }); await sleep(2500)
    const demo = await text()
    check('M11', 'the demo link hides the builder-only row', !/Download Responses|Fresh context/.test(demo), demo.slice(0, 160))
  }
  check('M12', 'no script error or console error on the page', errors.length === 0, errors.slice(0, 3).join(' | '))
} finally { await b.close() }

console.log(failed ? `\n${failed} FAILED` : '\nall smoke checks passed')
process.exit(failed ? 1 : 0)
