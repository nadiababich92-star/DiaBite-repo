/**
 * What the landing page says that can go stale (docs/specs/landing-copy.md).
 *
 * The receipt is a real answer of the app (what the agent returned for this sentence on 20 October: eggs 110 g, rye bread 35 g,
 * half an avocado at 50 g), copied here, never computed in the browser and never produced by a
 * model. `npm run eval` fails if the engine no longer gives these figures (the `landing` block in eval/run-engine.ts), and
 * `node eval/landing-live.mjs` asks the live service after a deploy. If a figure here changes, regenerate public/share.png
 * (the receipt card as a picture) and the og:image:alt line in index.html.
 */
export interface LandingRow {
  foodId: string          // an id the engine knows, pinned: the check asks the engine for exactly this
  name: string            // as the engine names it
  grams: number
  availableCarbs: number  // g
  gi: number | null       // null is shown as a dash
  gl: number
}

export const LANDING = {
  receiptAsOf: '2026-10-20',
  question: 'Two eggs, a slice of rye bread and half an avocado',
  budgetGl: 45,
  verdict: 'This fits your day.',
  rows: [
    { foodId: 'seed:egg', name: 'Egg', grams: 110, availableCarbs: 0.8, gi: null, gl: 0 },
    { foodId: 'ing:rye_bread', name: 'Pumpernickel / whole rye bread', grams: 35, availableCarbs: 14.2, gi: 50, gl: 7.1 },
    { foodId: 'ing:avocado', name: 'Avocado', grams: 50, availableCarbs: 0.9, gi: 15, gl: 0.1 },
  ] satisfies LandingRow[],
  totalGl: 7.2,
  leftAfterGl: 37.8,
  records: 8633,
  /** A dated claim from docs/STATUS.md. Refresh when `npm run eval:agent` is rerun, and say so in STATUS.md. */
  checks: { passed: 204, of: 204, on: '2026-10-15' },
  /** The five lines of the clip's narration (scripts/demo-video/narration-clip.json), also the captions. */
  transcript: [
    'This is DiaBite. You type a meal the way you would say it.',
    'The engine finds each food and does the arithmetic. It fits, and the receipt shows every number.',
    'An evening meal that does not fit does not just get a no. It names a swap, and the engine counts it. Now it fits.',
    'A meal can also be planned for another day. A plan counts nowhere until it is eaten.',
    'And a dose question is refused at once, before any model sees it.',
  ],
  links: {
    linkedin: 'https://www.linkedin.com/in/nadia-babich',
    safetyCase: 'https://github.com/nadiababich92-star/DiaBite-repo/blob/main/docs/safety-case.md',
    dataSources: 'https://github.com/nadiababich92-star/DiaBite-repo/blob/main/docs/data-sources.md',
    mail: 'mailto:nadia.babich92@gmail.com',
  },
} as const

/** 20 October 2026, from an ISO date; no locale surprises. */
export const longDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${y}`
}
