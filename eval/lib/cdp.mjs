// Minimal Chrome DevTools client: no dependencies (Node's built-in WebSocket).
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'

// Every browser this process started. A script that throws, is interrupted or calls process.exit() before its
// own close() used to leave Chrome running for days (one lived 12), so they are killed on the way out.
const launched = new Set()
const killAll = () => { for (const l of launched) { try { l.chrome.kill('SIGKILL') } catch {} try { rmSync(l.dir, { recursive: true, force: true }) } catch {} } launched.clear() }
let hooked = false
function hookExit() {
  if (hooked) return
  hooked = true
  process.on('exit', killAll)
  for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) process.on(sig, () => { killAll(); process.exit(code) })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** A call that gets no answer (the page crashed, navigated away, the socket dropped) fails instead of hanging for ever. */
const CALL_TIMEOUT_MS = 30_000

export async function launch({ port = 9333, width = 1280, height = 720, dpr = 1.5 } = {}) {
  hookExit()
  const dir = `/tmp/diabite-smoke-profile-${port}`
  rmSync(dir, { recursive: true, force: true })
  const chrome = spawn(process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: 'ignore' })
  const entry = { chrome, dir }
  launched.add(entry)
  try {
    let page
    for (let i = 0; i < 75 && !page; i++) {
      try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page') } catch {}
      if (!page) await sleep(200)
    }
    if (!page) throw new Error(`Chrome did not open a page on port ${port} within 15 s`)
    const ws = new WebSocket(page.webSocketDebuggerUrl)
    await Promise.race([
      new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', () => rej(new Error('DevTools socket failed to open'))) }),
      sleep(10_000).then(() => { throw new Error('DevTools socket did not open within 10 s') }),
    ])
    let id = 0; const pending = new Map(); const handlers = new Map()
    const failAll = (why) => { for (const { rej, timer } of pending.values()) { clearTimeout(timer); rej(new Error(why)) } pending.clear() }
    ws.addEventListener('close', () => failAll('DevTools connection closed'))
    ws.addEventListener('error', () => failAll('DevTools connection failed'))
    ws.addEventListener('message', (m) => {
      const d = JSON.parse(m.data)
      if (d.id && pending.has(d.id)) { const { res, rej, timer } = pending.get(d.id); clearTimeout(timer); pending.delete(d.id); d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result) }
      else if (d.method && handlers.has(d.method)) handlers.get(d.method)(d.params)
    })
    const send = (method, params = {}, timeoutMs = CALL_TIMEOUT_MS) => new Promise((res, rej) => {
      const i = ++id
      const timer = setTimeout(() => { pending.delete(i); rej(new Error(`CDP ${method} got no answer in ${timeoutMs / 1000} s`)) }, timeoutMs)
      pending.set(i, { res, rej, timer })
      try { ws.send(JSON.stringify({ id: i, method, params })) } catch (e) { clearTimeout(timer); pending.delete(i); rej(e) }
    })
    const on = (m, f) => handlers.set(m, f)
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false })
    const ev = async (expr, timeoutMs = CALL_TIMEOUT_MS) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, timeoutMs); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? '')); return r.result.value }
    const close = async () => {
      try { await send('Browser.close', {}, 3000) } catch {}
      try { chrome.kill('SIGKILL') } catch {}
      try { ws.close() } catch {}
      launched.delete(entry)
      // The helper processes outlive the browser by a moment and keep writing into the profile.
      await sleep(300)
      try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }) } catch {}
    }
    return { send, on, ev, close, chrome }
  } catch (e) {
    try { chrome.kill('SIGKILL') } catch {}
    launched.delete(entry)
    try { rmSync(dir, { recursive: true, force: true }) } catch {}
    throw e
  }
}

export function startScreencast(b, outDir) {
  rmSync(outDir, { recursive: true, force: true }); mkdirSync(outDir, { recursive: true })
  const frames = []
  b.on('Page.screencastFrame', async (p) => {
    const t = p.metadata.timestamp
    const name = `f${String(frames.length).padStart(5, '0')}.jpg`
    writeFileSync(`${outDir}/${name}`, Buffer.from(p.data, 'base64'))
    frames.push({ name, t })
    b.send('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {})
  })
  return b.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 }).then(() => frames)
}
