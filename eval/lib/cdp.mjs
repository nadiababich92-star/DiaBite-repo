// Minimal Chrome DevTools client: no dependencies (Node's built-in WebSocket).
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'

export async function launch({ port = 9333, width = 1280, height = 720, dpr = 1.5 } = {}) {
  const dir = `/tmp/diabite-smoke-profile-${port}`
  rmSync(dir, { recursive: true, force: true })
  const chrome = spawn(process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: 'ignore' })
  let list
  for (let i = 0; i < 50; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (list.find(t => t.type === 'page')) break } catch {}
    await new Promise(r => setTimeout(r, 200))
  }
  const page = list.find(t => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise(r => ws.addEventListener('open', r))
  let id = 0; const pending = new Map(); const handlers = new Map()
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pending.has(d.id)) { const { res, rej } = pending.get(d.id); pending.delete(d.id); d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result) }
    else if (d.method && handlers.has(d.method)) handlers.get(d.method)(d.params)
  })
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })) })
  const on = (m, f) => handlers.set(m, f)
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false })
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? '')); return r.result.value }
  const close = async () => { try { await send('Browser.close') } catch {} ; chrome.kill() }
  return { send, on, ev, close, chrome }
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
