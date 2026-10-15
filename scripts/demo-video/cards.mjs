// The cards of the story that are not the app: a title, the problem told through Dana, and the closing address.
// Colour and type come from docs/design.md (Paper). `reveal(n)` lights the n-th line of the problem card.
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;600&family=Literata:opsz,wght@7..72,400;7..72,600&display=swap" rel="stylesheet">`
const BASE = `<meta charset="utf-8">${FONTS}<style>
  :root { --bg:#f1ece0; --surface:#fffcf5; --border:#dcd3bf; --text:#14201a; --dim:#4f5a53; --accent:#0e5a3c; --marker:#dcf26b; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text); font-family: 'IBM Plex Sans', system-ui, sans-serif; }
  .mark b { background: var(--marker); padding: 0 .18em; border-radius: 6px; font-weight: 600; }
</style>`

export const titleCard = () => `<!doctype html>${BASE}<style>
  main { height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 28px; text-align: center; padding: 0 90px; }
  .mark { font: 600 64px/1 'Literata', Georgia, serif; letter-spacing: -.02em; }
  h1 { font: 600 112px/1.05 'Literata', Georgia, serif; letter-spacing: -.025em; margin: 0; }
  p { margin: 0; font-size: 32px; color: var(--dim); max-width: 1000px; line-height: 1.4; }
</style><main><div class="mark">Dia<b>Bite</b></div><h1>Can I eat this?</h1><p>An AI nutrition copilot for adults with type 2 diabetes, prediabetes or insulin resistance.</p></main>`

export const problemCard = () => `<!doctype html>${BASE}<style>
  main { height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 36px; padding: 0 150px; }
  .dana { display: flex; align-items: center; gap: 22px; }
  .avatar { width: 84px; height: 84px; border-radius: 50%; background: var(--accent); color: #fffcf5; display: grid; place-items: center; font: 600 44px 'Literata', Georgia, serif; }
  .who b { display: block; font: 600 40px/1.1 'Literata', Georgia, serif; }
  .who span { font-size: 22px; color: var(--dim); }
  ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 24px; }
  li { font: 400 38px/1.25 'Literata', Georgia, serif; letter-spacing: -.01em; opacity: 0; transform: translateY(10px); transition: opacity .6s, transform .6s, color .6s; max-width: 1400px; }
  li.on { opacity: 1; transform: none; }
  li.past { opacity: .42; }
  li em { font-style: normal; padding: 0 .15em; border-radius: 5px; background: linear-gradient(var(--marker), var(--marker)) no-repeat left / 0% 100%; }
  li.on em { animation: sweep 1.6s ease forwards .4s; } li.past em { background-size: 100% 100%; }
  @keyframes sweep { to { background-size: 100% 100%; } }
  .avatar { animation: pulse 3.2s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(14,90,60,.35) } 50% { box-shadow: 0 0 0 16px rgba(14,90,60,0) } }
  @media (prefers-reduced-motion: reduce) { li { transition: none; } li.on em { animation: none; background-size: 100% 100%; } .avatar { animation: none; } }
</style><main>
  <div class="dana"><div class="avatar">D</div><div class="who"><b>Dana, 52</b><span>teaches middle school in Columbus · type 2 diabetes since July · takes metformin · a made-up person</span></div></div>
  <ol>
    <li>After the diagnosis, a list: <em>allowed</em> and <em>forbidden</em> foods.</li>
    <li>Her real question: “I’m about to eat this. Can I? How much? With what?”</li>
    <li>Five to seven times a day: the aisle, the menu, the fridge at eleven at night.</li>
    <li>A list can’t answer it. A calorie app costs three to five minutes a meal.</li>
    <li>Real life is a burrito bowl and a snack in the car.</li>
  </ol>
</main><script>
  window.reveal = (n) => { const items = [...document.querySelectorAll('li')]; items.forEach((li, i) => { li.classList.toggle('on', i === n); li.classList.toggle('past', i < n) }) }
</script>`

export const endCard = (address) => `<!doctype html>${BASE}<style>
  main { height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 24px; text-align: center; padding: 0 64px; }
  h1 { font: 600 76px/1.1 'Literata', Georgia, serif; margin: 0; letter-spacing: -.02em; }
  p { margin: 0; font-size: 30px; color: var(--dim); max-width: 900px; line-height: 1.4; }
  code { font: 500 30px 'IBM Plex Mono', ui-monospace, monospace; color: var(--accent); background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 20px; }
</style><main><h1 class="mark">Dia<b>Bite</b></h1><p>Free to try. It asks for your email, and sends you a code.</p><code>${address}</code><p>If you have type 2 diabetes, prediabetes or insulin resistance, I would like to hear where it breaks.</p></main>`

// A slide is one screen that fills in step by step as it is spoken about: no scrolling a page.
const SLIDE = `<style>
  main { height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 34px; padding: 0 120px; }
  .eyebrow { font: 600 22px 'IBM Plex Sans', sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #5e6861; }
  h1 { font: 600 62px/1.1 'Literata', Georgia, serif; letter-spacing: -.02em; margin: 0; max-width: 1500px; }
  .step { opacity: 0; transform: translateY(14px); transition: opacity .7s, transform .7s; }
  .step.on { opacity: 1; transform: none; }
  @media (prefers-reduced-motion: reduce) { .step { transition: none; } }
</style>`

export const archSlide = () => `<!doctype html>${BASE}${SLIDE}<style>
  .flow { display: grid; grid-template-columns: 1fr 64px 1fr 64px 1fr 64px 1fr; align-items: stretch; gap: 0; }
  .box { background: var(--surface); border: 1px solid var(--border); border-radius: 22px; padding: 26px 26px 28px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 10px 24px -14px rgba(70,50,20,.4); }
  .box b { font: 600 34px/1.1 'Literata', Georgia, serif; } .box span { font-size: 22px; line-height: 1.4; color: var(--dim); }
  .box .tag { font: 600 17px 'IBM Plex Sans'; letter-spacing: .1em; text-transform: uppercase; color: var(--accent); }
  .arrow { display: grid; place-items: center; font: 400 44px 'IBM Plex Sans'; color: #5e6861; }
  .promise { font: 600 36px/1.25 'Literata', Georgia, serif; background: var(--marker); display: inline-block; padding: 10px 22px; border-radius: 12px; align-self: flex-start; }
</style><main>
  <div class="eyebrow step" data-s="0">How it is built</div>
  <h1 class="step" data-s="0">A model reads. An engine counts. A verifier checks.</h1>
  <div class="flow">
    <div class="box step" data-s="1"><span class="tag">1 · The sentence</span><b>Safety rules first</b><span>Dosing, red flags and fasting are caught by plain rules before any model runs.</span></div>
    <div class="arrow step" data-s="2">→</div>
    <div class="box step" data-s="2"><span class="tag">2 · Azure AI Foundry</span><b>Three agents</b><span>One routes. One costs meals with tools. One advises, with no tools and no numbers.</span></div>
    <div class="arrow step" data-s="3">→</div>
    <div class="box step" data-s="3"><span class="tag">3 · The engine</span><b>Does the arithmetic</b><span>From eight thousand foods and two thousand recipes. Every number is computed here.</span></div>
    <div class="arrow step" data-s="4">→</div>
    <div class="box step" data-s="4"><span class="tag">4 · The verifier</span><b>Checks every number</b><span>A number no tool returned is never shown.</span></div>
  </div>
  <div class="promise step" data-s="5">The model never produces a nutrition number.</div>
</main><script>window.reveal = (n) => document.querySelectorAll('.step').forEach((e) => e.classList.toggle('on', +e.dataset.s <= n))</script>`

export const evalSlide = () => `<!doctype html>${BASE}${SLIDE}<style>
  .row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
  .big { background: var(--surface); border: 1px solid var(--border); border-radius: 22px; padding: 28px 30px 30px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 10px 24px -14px rgba(70,50,20,.4); }
  .big .n { font: 500 84px/1 'IBM Plex Mono', ui-monospace, monospace; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
  .big .l { font: 600 26px/1.25 'Literata', Georgia, serif; } .big .d { font-size: 21px; color: var(--dim); line-height: 1.4; }
  .fault { background: var(--surface); border-left: 8px solid #9e3025; border-radius: 6px 22px 22px 6px; padding: 24px 30px; display: flex; flex-direction: column; gap: 8px; }
  .fault b { font: 600 30px 'Literata', Georgia, serif; } .fault span { font-size: 24px; line-height: 1.45; color: var(--dim); }
  .fault em { font-style: normal; background: var(--marker); padding: 0 .2em; border-radius: 4px; color: var(--text); }
</style><main>
  <div class="eyebrow step" data-s="0">How we know it works</div>
  <h1 class="step" data-s="0">Tested on every change. Scored by a second model.</h1>
  <div class="row">
    <div class="big step" data-s="1"><div class="n">204 / 204</div><div class="l">Behavioural checks</div><div class="d">Run against the deployed agent: tools called, numbers verified, refusals where required.</div></div>
    <div class="big step" data-s="2"><div class="n">74 / 75</div><div class="l">Groundedness</div><div class="d">A second model in Azure AI Foundry: the answer says only what the tools returned.</div></div>
    <div class="big step" data-s="2"><div class="n">86 / 86</div><div class="l">Intent resolution</div><div class="d">The answer addresses what was asked.</div></div>
  </div>
  <div class="fault step" data-s="3"><b>The one miss was a real fault</b><span>Two hard candies were counted as <em>320 g</em>. We fixed the portion and added a test, so it cannot come back.</span></div>
</main><script>window.reveal = (n) => document.querySelectorAll('.step').forEach((e) => e.classList.toggle('on', +e.dataset.s <= n))</script>`
