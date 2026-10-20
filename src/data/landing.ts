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
  /** What is said in the clip, in order (scripts/demo-video/two-rhythms/script.json), also the captions. */
  transcript: [
    "Narrator: Forty million Americans live with diabetes. A hundred and fifteen million adults have prediabetes. And for all of them, every meal is the same question: does this fit my day?",
    "Narrator: Meet Maya, who has insulin resistance, and Daniel, who has type 2 diabetes. Made up, but you know them. She has no time. He has a plan that keeps breaking.",
    "Maya: Wrap and chips. Is that okay? I honestly don't know.",
    "Narrator: Maya has no time to plan, so she guesses. Most tools ask for a life with spare time.",
    "Daniel: Sunday. The whole week, planned.",
    "Narrator: Daniel plans every meal.",
    "Daniel: Wednesday. A late meeting. Pizza.",
    "Narrator: Then life happens, and a broken plan feels like failing.",
    "Narrator: That is why DiaBite exists. Say what you are about to eat. It tells you if it fits what is left of your day, and shows the arithmetic.",
    "Maya: Grilled chicken sandwich and an apple.",
    "Narrator: A few seconds. It fits, but it names a lighter swap, and counts that too.",
    "Maya: Chicken salad instead. Fine.",
    "Narrator: Every number comes from a database. Open the receipt and check it yourself.",
    "Narrator: In the diary, his plan stays, dashed. Only what he really eats counts.",
    "Daniel: Chicken fried rice.",
    "Narrator: A plan that broke is not a failure. It is just Wednesday.",
    "Maya: How many units of insulin before pasta?",
    "Narrator: Some questions it never answers. Doses belong to your care team.",
    "Daniel: Grandma's cholent.",
    "Narrator: And when it does not know a dish, it says so, and calls it an estimate.",
    "Narrator: A quick check on the go. A diary for the days a plan breaks. Free to try at diabite.pro. A reference tool, not medical advice.",
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
