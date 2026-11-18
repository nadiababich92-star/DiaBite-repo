# Spec — Summary for my clinician: the logic (`src/lib/clinicianSummary.ts`)

*Stage 2, from `docs/engineering/engineering-doc.md`, approved by the owner on 18 November 2026 together with its four open questions as proposed (protein and fat kept; total carbohydrate with fibre beside it; "takes insulin" without the type; the "How to read this" wording agreed in chat before it goes into a file). The screen is `docs/specs/clinician-summary-screen.md`; the checks are `docs/specs/clinician-summary-evals.md`.*

**No migration, no endpoint, no agent change, nothing in `.env.example`, no Dockerfile line.** This file is used by the browser only; the engine's image does not copy it. `src/lib/profile.ts`, `src/lib/glycemic.ts`, `src/lib/diary.ts` and `src/lib/history.ts` are **read, not edited**. If the build finds it must edit one of them, stop: `profile.ts` and `glycemic.ts` are shared with the engine and an edit there is an engine change.

## What it is

One pure function. No React, no storage, no clock (the date is a parameter), no network. It turns what the app already holds into the content of the page, and nothing else computes a number for the page.

## Signature

```ts
export type SummaryPeriod = 7 | 14 | 28
export const SUMMARY_PERIODS: SummaryPeriod[] = [7, 14, 28]
export const DEFAULT_PERIOD: SummaryPeriod = 7

export function buildSummary(
  diary: DiaryEntry[],     // the whole diary, planned entries included; the function removes them
  profile: Profile,
  targets: Targets,        // calculateTargets(profile), as App already holds it
  today: string,           // the person's own date, YYYY-MM-DD
  period: SummaryPeriod,
): ClinicianSummary
```

## Types

```ts
export type Verdict = 'over' | 'not over'
export type GlVerdict = 'over' | 'not over' | 'not complete'

export interface SummaryItem {
  name: string                 // viewEntry(e).name, text only
  portion: string              // portionText(v.portion, v.measure, 'imperial') when the entry has a measure, else v.portion
  carbs: number                // TOTAL carbohydrate of the item, nutrients.carbs, 1 decimal (so items add up to the day)
  gl: number | null            // v.gl, 1 decimal; null when v.loadAvailable is false
  estimate: boolean            // snapshot.assumed === true
}

export interface SummaryMeal { meal: MealType; items: SummaryItem[] }

export interface SummaryDay {
  date: string                 // YYYY-MM-DD
  label: string                // "Tue, Nov 17"  (en-US, weekday short, month short, day numeric)
  isToday: boolean             // the row is marked "today, so far"
  kcal: number; carbs: number; fiber: number; protein: number; fat: number   // whole numbers, as the Diary day card prints them
  gl: number                   // 1 decimal, the same rounding as weekSummary(...).days[i].used
  carbsVerdict: Verdict        // sum of total carbohydrate (unrounded) above targets.carbsG
  kcalVerdict: Verdict         // sum of kcal (unrounded) above targets.kcal
  glVerdict: GlVerdict         // see rules
  noLoadFoods: number          // entries with loadAvailable false
  estimate: boolean            // some entry is an assumed-recipe dish
  slots: number                // distinct meal slots with an eaten entry, 1 to 4
  meals: SummaryMeal[]         // in MEAL_ORDER, only slots that have items
}

export interface SummaryTargets {
  kcal: number; carbsG: number; proteinG: number; fatG: number; fiberG: number; glBudget: number
  carbsSetBy: 'person' | 'diabite'   // 'person' iff targets.constraints has id 'own-carbs'
  mealCarbsG: number | null          // profile.mealCarbsG when > 0, else null
  snackCarbsG: number | null
}

export interface SummaryAbout {
  condition: string                  // one of CONDITION_TEXT below
  insulin: 'takes insulin' | 'does not take insulin'
  medicines: string[]                // MEDICINE_TEXT values, in the order of profile.meds, no duplicates
}

export interface ClinicianSummary {
  periodDays: SummaryPeriod
  from: string                       // first day of the period, YYYY-MM-DD
  to: string                         // = today
  printedOn: string                  // = today
  about: SummaryAbout
  targets: SummaryTargets
  loggedDays: number                 // days with at least one eaten entry
  days: SummaryDay[]                 // logged days only, newest first
  notLogged: { from: string; to: string }[]   // runs of days with nothing eaten, newest first, each run one object
  averages: { kcal: number; carbs: number; fiber: number; protein: number; fat: number; gl: number } | null   // over logged days only; null when loggedDays is 0
}
```

**The top-level keys of `ClinicianSummary` are exactly** `periodDays, from, to, printedOn, about, targets, loggedDays, days, notLogged, averages`. A test fixes this list (see the evals spec, check 7). Adding a key is a decision about what a printed page reveals about a person, and belongs to the owner.

## Wording tables (third person; the app's own labels are first person and are not reused)

```ts
CONDITION_TEXT: Record<Condition, string> = {
  t2: 'Type 2 diabetes',
  prediabetes: 'Prediabetes',
  ir: 'Insulin resistance or PMOS (formerly PCOS)',
  t1: 'Type 1 diabetes or LADA',
  gestational: 'Gestational diabetes',
  unsure: 'Not stated',
}
MEDICINE_TEXT: Record<Med, string> = {
  metformin: 'Metformin',
  sulfonylurea: 'Sulfonylurea or glinide',
  sglt2: 'SGLT2 inhibitor',
  glp1: 'GLP-1 or dual agonist',
  other: 'Another glucose-lowering medicine',
}
```
No brand names and no insulin product names are printed. `insulin` is `'takes insulin'` for `basal` and `mealtime_or_pump`, `'does not take insulin'` for `none`; the type is deliberately not printed (owner's decision). `profile.meds` empty gives `medicines: []` and the page prints "No glucose-lowering medicine listed".

## Rules

1. **Eaten only.** Start from `eaten(diary)`; a planned entry never reaches any figure, row, meal block or count.
2. **The period** is `period` calendar days ending on `today`, counted with `addDays` (days, not 24-hour blocks, so a clock change cannot skip or repeat a day): `from = addDays(today, -(period - 1))`, `to = today`. An entry dated outside `[from, to]` is excluded. A future-dated entry is planned and excluded by rule 1 anyway.
3. **Every figure comes from `viewEntry(e)`**: `nutrients` (kcal, carbs, fiber, protein, fat) and `gl`. Day sums use `sumNutrients` over the views' `nutrients`, and `gl` is the sum of `v.gl`. No other source of a figure is allowed. Nothing is looked up, estimated or defaulted here.
4. **Rounding.** `kcal, carbs, fiber, protein, fat` of a day: `Math.round` of the sum (the Diary prints `toFixed(0)`; use the same rounding). `gl` of a day: `Math.round(sum * 10) / 10` (as `summarize` in `history.ts`). Item `carbs` and `gl`: one decimal. Averages: the mean of the *unrounded* daily sums over logged days, then rounded as the day values are.
5. **Verdicts compare the unrounded sum to the target**, as the Diary does (`totals.carbs > targets.carbsG`, `totals.kcal > targets.kcal`): `'over'` when strictly above, else `'not over'`. **Protein, fibre and fat get no verdict**: the Diary never calls them over (protein and fibre are floors), and the page does not either; they print as plain numbers beside their targets.
6. **`glVerdict`.** Let `gl` be the rounded sum. If `gl > targets.glBudget`: `'over'` (a load already above the budget cannot be rescued by an unknown food, as `statusOf` says). Else if `noLoadFoods > 0`: `'not complete'`. Else `'not over'`. A day is **never** `'not over'` on GL when some entry has no load: the entry adds 0 to the sum, which is not the same as no load (CLAUDE.md, rule 4).
7. **Estimate.** `estimate` is true when any eaten entry of the day has `snapshot?.assumed === true`; the item carries its own flag.
8. **Slots.** `slots` is the number of distinct `meal` values among the day's eaten entries. The page says "fewer than 3 meals" when `slots < MIN_SLOTS` (import `MIN_SLOTS` from `history.ts`).
9. **Not logged is not zero.** A day with no eaten entry is not in `days`, is not in the averages, and is covered by `notLogged`: consecutive such days make one `{from, to}` run (a single day is `{from: d, to: d}`). A day with nothing logged is never given figures.
10. **Today is partial.** The day equal to `today` has `isToday: true`; it still counts in `days` and the averages. The page marks the row "today, so far" so a half day is not read as a low day.
11. **Order.** `days` newest first. Within a day, `meals` follow `MEAL_ORDER` (breakfast, lunch, snack, dinner) and items keep the diary's own order.
12. **Targets as given.** `targets.*` are copied from the `Targets` argument unchanged. `carbsSetBy` is `'person'` when `targets.constraints.some((c) => c.id === 'own-carbs')`, else `'diabite'`. `mealCarbsG` and `snackCarbsG` are the profile's numbers when `> 0`, else `null`.
13. **What is never read or returned.** Of `profile` the function reads only `condition`, `insulin`, `meds`, `mealCarbsG`, `snackCarbsG`. It **never** reads or returns age, sex, height, weight, activity, goal, kidney, pregnancy, comorbidities, allergens, `avoided`, `pattern`, excluded foods, `units`, the email or the consent record. **It never returns `targets.constraints` or any `reason` text**: those sentences can name a kidney or pregnancy rule ("your kidney …") and would reveal what the owner decided not to print.
14. **Strings are data.** `name` and `portion` are returned as given and rendered as text by the component; the function does not build HTML.
15. **Total, not available, carbohydrate.** The day card in the Diary compares *total* carbohydrate to the target while each Diary entry line shows *available* carbohydrate. This page uses total everywhere (day, average, item) so the items add up to the day, and prints fibre beside it. The page's column header says "Carbs (total)".

## Verifiable

The checks are in `docs/specs/clinician-summary-evals.md` (1 to 8 import `buildSummary`). A developer can confirm the function by calling it on the fixture in that file and comparing with `weekSummary` and `sumNutrients` directly. Run `npm run eval`; it must stay green and gain the new block `clinician summary`.
