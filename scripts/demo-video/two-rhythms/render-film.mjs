/**
 * "Two rhythms", step 4: frames of the film page to JPEGs.
 *   node render-film.mjs [dir=/tmp/dv2] [--at=1.2,5,9]      (a few stills, to /tmp/dv2/stills)
 *   node render-film.mjs [dir=/tmp/dv2]                      (every frame at 24 fps, to /tmp/dv2/out)
 */
import { launch } from '../../../eval/lib/cdp.mjs'
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
const args = process.argv.slice(2)
const dir = args.find((a) => !a.startsWith('--')) ?? '/tmp/dv2'
const at = args.find((a) => a.startsWith('--at='))?.slice(5).split(',').map(Number)
const TL = JSON.parse(readFileSync(`${dir}/timeline.json`, 'utf8'))
const b = await launch({ port: 9344, width: 1280, height: 720, dpr: 1 })
try {
  await b.send('Page.navigate', { url: `file://${dir}/film.html` })
  await new Promise((r) => setTimeout(r, 1500))
  await b.ev('window.ready')
  const out = at ? `${dir}/stills` : `${dir}/out`
  rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true })
  const times = at ?? Array.from({ length: Math.ceil(TL.total * TL.fps) }, (_, i) => i / TL.fps)
  let n = 0
  for (const t of times) {
    await b.ev(`setTime(${t})`)
    const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: at ? 85 : 88 })
    writeFileSync(`${out}/${String(n++).padStart(5, '0')}.jpg`, Buffer.from(r.data, 'base64'))
    if (!at && n % 200 === 0) console.log(n, '/', times.length)
  }
  console.log('frames', n, '→', out)
} finally { await b.close() }
