/**
 * Regenerates public/share.png, the picture a link preview shows (docs/specs/landing-assets-and-meta.md, section 4):
 * the landing page's receipt on the dark page, with the wordmark. It is a screenshot of the real page, not a drawing,
 * so it carries the real numbers. Run it whenever src/data/landing.ts changes.
 *
 *   npm run dev   (in another terminal), then:   node eval/share-image.mjs        # APP=http://localhost:5173
 */
import { launch } from './lib/cdp.mjs'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const APP = process.env.APP ?? 'http://localhost:5173'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'share.png')
const CSS = `
  .landing > *:not(header):not(main), .lp-signin, .landing main > section:not(.lp-hero), .lp-hero-text { display: none !important }
  .lp-top { padding-top: 34px; padding-bottom: 6px; justify-content: center }
  .lp-hero { padding: 26px 0 0; justify-content: center }
  .lp-tape-wrap { margin: 0 auto; transform: rotate(0.6deg) }
  .lp-tape { padding-top: 22px; padding-bottom: 26px; gap: 11px }
  .lp-big { font-size: 52px }
  html, body { overflow: hidden }
`
const b = await launch({ port: 9881, width: 1200, height: 630, dpr: 1 })
await b.send('Page.navigate', { url: APP }); await sleep(3500)
await b.ev(`(() => { const css = document.createElement('style'); css.textContent = ${JSON.stringify(CSS)}; document.head.appendChild(css); window.scrollTo(0, 0) })()`)
await sleep(600)
const h = await b.ev(`document.querySelector('.lp-tape-wrap').getBoundingClientRect().bottom + 16`)
console.log('content height', Math.round(h), 'of 630')
const { data } = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } })
writeFileSync(OUT, Buffer.from(data, 'base64'))
console.log('wrote', OUT)
await b.close()
