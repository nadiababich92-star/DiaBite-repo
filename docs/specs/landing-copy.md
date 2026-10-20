# Landing page: the copy and the data file

*Spec for `docs/engineering/engineering-doc.md` (the landing page), sections 4, 5 and 9. Written 20 October 2026. No migration, no new environment variable, no agent change.*

All copy is English, in the product's voice: plain, no emoji, no exclamation marks, no promise of a result, nothing about pricing. The wording below is exact; the component renders these strings and nothing else. Anything that changes after launch changes in `src/data/landing.ts`, not in the component.

## 1. The data file: `src/data/landing.ts`

```ts
export interface LandingRow {
  foodId: string          // an id the engine knows, pinned: the check asks the engine for exactly this
  name: string            // as the engine names it
  grams: number
  availableCarbs: number  // g, available carbohydrate
  gi: number | null       // null shows "–"
  gl: number
}

export const LANDING = {
  /** When the receipt was asked of the running service. Shown to the reader. */
  receiptAsOf: '2026-10-20',
  question: 'Two eggs, a slice of rye bread and half an avocado',
  budgetGl: 45,
  verdict: 'This fits your day.',
  rows: [
    { foodId: 'seed:egg',       name: 'Egg',                            grams: 110, availableCarbs: 0.8,  gi: null, gl: 0   },
    { foodId: 'ing:rye_bread',  name: 'Pumpernickel / whole rye bread', grams: 35,  availableCarbs: 14.2, gi: 50,   gl: 7.1 },
    { foodId: 'ing:avocado',    name: 'Avocado',                        grams: 50,  availableCarbs: 0.9,  gi: 15,   gl: 0.1 },
  ] satisfies LandingRow[],
  totalGl: 7.2,
  leftAfterGl: 37.8,        // budgetGl - totalGl, to one decimal
  records: 8633,            // the size of the catalogue, as in docs/STATUS.md; shown in S5
  /** A dated claim from docs/STATUS.md. Refresh when `npm run eval:agent` is rerun, and say so in STATUS.md. */
  checks: { passed: 204, of: 204, on: '2026-10-15' },
  transcript: [             // the five lines of the clip's narration, scripts/demo-video/narration-clip.json
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
```

The figures were read from the running engine on 20 October 2026 (`compute_meal` for the three rows above: totals `gl` 7.2, per-row `availableCarbs` 0.8, 14.2, 0.9; the same sentence asked of the signed-in agent returned eggs 110 g, rye bread 35 g and half an avocado at 50 g, GL 7.2 and 37.8 left, which is why the avocado is 50 g and not 70). They must be read again, not retyped from this spec, if the file is touched. Check **L1** (see `landing-checks.md`) keeps them true. **Open item for the owner:** confirm that the LinkedIn address above is hers before the page ships; it was copied from the deck.

## 2. The copy, section by section

**S0 · Emergency line** (above everything, a `role="note"` block, the same words as the sign-in screen):
> If you have symptoms such as chest pain, confusion, vomiting or fainting, call emergency services. DiaBite does not give insulin or medication doses.

**S1 · Header:** logo and wordmark; a link-styled button **Sign in**.

**S2 · Hero**
- Eyebrow (label style): `For adults in the US with type 2 diabetes, prediabetes or insulin resistance`
- `h1`: `Can I eat this?`
- Lede: `Describe a meal in your own words. DiaBite says whether it fits what is left of your day, and shows the arithmetic.`
- Primary button: `Try DiaBite`
- Under it (dim): `Free to try. You sign in with your email; there is no password.`
- Status line (dim, small): `Being prepared for its first user sessions. Some things will be wrong.`

**S3 · The clip**
- `h2`: `One minute, start to finish`
- The video (see `landing-assets-and-meta.md`).
- A `details` element, summary `Read the transcript`, containing `LANDING.transcript` as paragraphs.

**S4 · A real answer**
- `h2`: `A real answer, with the receipt`
- Intro: `Asked of the running service on 20 October 2026, with a daily budget of 45 glycemic load. The numbers come from the database, the engine adds them up, and a check confirms every number in the answer appears in what the engine returned.` (The date and the 45 are built from `receiptAsOf` and `budgetGl`, formatted as `20 October 2026`.)
- The slip: the question in quotes; pill `Fits`; the verdict; three figures `This meal` **7.2**, `Before` **45**, `Left after` **37.8**; the table `food · grams · carbs g · GI · load` with the three rows (a dash for a null GI) and the total line `Meal load 7.2`.
- Note: `Weights for the eggs and the avocado were the defaults because none were given, and the answer says so. A dash means the database holds no glycemic index for that food.`

**S5 · The promise**
- `h2`: `Every number is computed, never made up`
- Three short paragraphs (each a `p`, the first words in bold):
  1. `**A model reads the sentence.** It never does the sums.`
  2. `**A database and a calculator do.** Every food is matched against a database of 8,633 records, and the engine adds up carbohydrate, fibre, glycemic index and glycemic load.`
  3. `**Every number is checked** against the calculation before you see it.`
- Then: `When DiaBite does not have a food, it says so and counts the rest. It never counts a different food under its name. A dish it lacks is estimated from typical ingredients and labelled as an estimate.`

**S6 · What it is not**
- `h2`: `What it is not`
- A list of four items:
  - `Not medical advice. It is a reference tool.`
  - `It never gives an insulin or medication dose, and a question about one gets a fixed refusal.`
  - `No clinician has signed it off yet.`
  - `A glycemic index is a published average for a food, not a measurement of your body.`

**S7 · Who built it**
- `h2`: `Built by Nadia Babich`
- `I live with insulin resistance and PCOS, and I got tired of doing the arithmetic at every meal. I work in AI, so I built the tool I wanted.`
- Links: `LinkedIn` (to `links.linkedin`, `rel="noopener"`) and `Write to me` (`links.mail`).
- Nothing about medicines, years, or a diagnosis beyond that one sentence, which the owner approved on 20 October 2026.

**S8 · For clinicians and reviewers**
- `h2`: `For clinicians and reviewers`
- `A router sends each question either to a meal agent that can call the engine's tools, or to an advisor that has no tools and states no numbers. The rules for doses, red flags, prolonged fasting and referral run before any model. Every decision the product makes about a person is written down for review.`
- The dated count, built from `checks`: `204 of 204 behavioural checks passed on the live agent on 15 October 2026.`
- Two links: `The safety case` (`links.safetyCase`) and `Where the food numbers come from` (`links.dataSources`), both `rel="noopener"`.
- `If something in them is wrong, I would like to know.` followed by the `Write to me` link.

**S9 · Footer**
- A second `Try DiaBite` button.
- `What DiaBite keeps about you: your email address, your answers about yourself and your diary, stored in Ireland. You can export or delete them at any time.` (The same facts as the sign-in screen; if that wording changes, this changes with it.)

## 3. Forbidden words (the check in `landing-checks.md`, L2)

The rendered text must not contain, case-insensitively and as whole words or phrases: `lower your`, `reverse`, `cure`, `AI-powered`, `clinically proven`, `WCAG compliant`, `HIPAA`, `FDA approved`, `guarantee`. The text must contain the emergency sentence, `not medical advice`, and `No clinician has signed it off yet`.

## 4. Verify

- Read the page aloud once: every sentence is true today, none promises a result.
- Compare S4 with `compute_meal` (check L1 does it mechanically).
- `grep -n "8,633" src/data/landing.ts src/components/Landing.tsx`: the record count is the same as `docs/STATUS.md` (8,633 on 20 October). If the catalogue size changes, the count in S5 changes with it; keep it in `landing.ts` as `records: 8633` rather than in the component.
