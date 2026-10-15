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
  li em { font-style: normal; background: var(--marker); padding: 0 .15em; border-radius: 5px; }
  @media (prefers-reduced-motion: reduce) { li { transition: none; } }
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
