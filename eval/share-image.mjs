/**
 * Regenerates public/share.png, the picture a link preview shows (docs/specs/landing-assets-and-meta.md, section 4):
 * the landing page's receipt card on the Paper background, with the wordmark. It is a screenshot of the real page,
 * not a drawing, so it carries the real numbers. Run it whenever src/data/landing.ts changes.
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
const b = await launch({ port: 9881, width: 1200, height: 630, dpr: 1 })
await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
await b.send('Page.navigate', { url: APP }); await sleep(3500)
await b.ev(`(() => {
  const css = document.createElement('style')
  css.textContent = \`
    .landing > *:not(header):not(main), .landing-signin, .landing main > section:not([aria-labelledby=landing-receipt]) { display: none !important }
    .landing-intro, #landing-receipt { display: none !important }
    .app.landing { max-width: 640px; padding-top: 12px }
    .landing-section { margin-top: 0 }
    .landing header.masthead { padding-bottom: 10px }
    .landing header.masthead .logo { width: 34px; height: 34px }
    .landing header.masthead span.wordmark { font-size: 28px }
    .landing-slip { margin-bottom: 0 }
    html, body { overflow: hidden }
  \`
  document.head.appendChild(css); window.scrollTo(0, 0)
})()`)
await sleep(600)
const h = await b.ev(`document.querySelector('.landing-slip').getBoundingClientRect().bottom + 22`)
console.log('content height', Math.round(h), 'of 630')
const { data } = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } })
writeFileSync(OUT, Buffer.from(data, 'base64'))
console.log('wrote', OUT)
await b.close()
