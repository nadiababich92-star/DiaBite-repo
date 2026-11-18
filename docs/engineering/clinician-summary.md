# Engineering document — "Summary for my clinician": a printable page of the person's own diary

*Produced by `/engineering-planner` on 18 November 2026 for worklist №20, option B. The previous document (the landing page) is archived as `docs/engineering/landing.md`. Input research: `docs/research-export-for-professionals.md`. **Not yet approved.***

## 1. Summary

**The feature.** A button in Settings, "Summary for my clinician". It opens a page the browser prints to PDF or paper: a chosen period (7, 14 or 28 days) of the person's own diary, day by day, with the person's targets beside it, so a dietitian or physician can read a week in one minute. It is not the data-protection export (that stays as it is); it is the thing a person can actually put in front of a professional.

**The user problem.** PRD, "Trust, safety, data" (E4) gives a one-tap export, and the first outside voices (Demo Day, 6 November) and the 14 November call asked for what a professional can read: today the file is JSON, has no targets, no daily totals, no legend, and hand-logged entries have no food name (`docs/research-export-for-professionals.md`). Today the only way to show a professional a week is a screenshot of the Diary.

**What the owner decided (18 November 2026).**
1. Available to **everyone who has a diary**, signed in or not (the diary is local first; the page is built in the browser).
2. Profile content: **the numbers and targets, plus diagnosis and medicines** (condition, insulin yes or no, medicine classes). No kidney status, no pregnancy flag, no age, weight or other profile fields, no email, no consent record.
3. **Planned meals are not shown at all.**
4. Period **7, 14 or 28 days**, 7 by default.
5. An **optional name field**, typed when printing and not stored.
6. A day is shown as **numbers, and the words "over" or "not over" beside a number**; no "in range", no colour grade. Marks for "carbs only", "estimate", "fewer than 3 meals".
7. **No mock-up first**: build it, show the finished page. (My earlier advice was a mock-up for a clinician before code; the owner chose to build. The consequence is that clinician feedback may mean changes to a finished page, which is cheap here: no server, no table.)

**Success.** (1) A person with a week of entries gets a one-to-two-page document in two taps. (2) Every figure on it equals the figure the Diary shows for that day, checked by a test that computes both from the same entries. (3) Nothing on it is generated, estimated or interpreted by DiaBite beyond the Diary's own arithmetic. (4) A clinician, shown one printed page, can say what is missing; that is the real test, and it waits on a clinician.

## 2. Scope

**In:**
- one pure function that turns the diary, targets and a period into the page's content (`src/lib/clinicianSummary.ts`);
- a full-screen React component rendering it, with a period choice, an optional name, a Print button (`src/components/ClinicianSummary.tsx`);
- a Settings card that opens it, shown whether or not the person is signed in;
- print styles (new, the app has none);
- the checks in `eval/run-engine.ts`.

**Out:**
- any server code, new table, endpoint, agent or prompt change: none is needed, and none is added;
- sharing by link, sending by email, a professional's own account (worklist №21; needs consent, revocation and counsel);
- a PDF file made by the app (the browser's own "Save as PDF" in the print dialog makes the file);
- charts, a glucose line, CGM data (not held);
- planned meals, kidney and pregnancy status, age, weight, height, activity, allergens, eating pattern, comorbidities, the weight goal;
- any statement of what the numbers mean clinically.

**Later:** a clinician's read of the wording and layout (worklist №39, №60); larger type for older readers if asked.

## 3. User flows

```
Settings → card "For your clinician" → [Summary for my clinician]
  → App sets state `summaryOpen` (no request, no route)
  → ClinicianSummary reads `diary`, `profile`, `targets` already in App state
      → buildSummary(diary, profile, targets, today, days)   (pure)
  → person picks 7 / 14 / 28 days, may type a name
  → [Print] → window.print() → the browser's dialog: paper or "Save as PDF"
  → [Close] or Esc returns to Settings
Signed in or out: identical. Offline: identical. No engine, agent, database or network call.
```

## 4. The promise check

Every number on the page is **already computed in the browser by the code the Diary uses**, from each entry's stored engine snapshot or the food table (`viewEntry` in `src/lib/diary.ts`). The page adds nothing but sums and one comparison.

| Number on the page | Where it is computed | Same as the Diary? |
|---|---|---|
| per day: energy (kcal), carbohydrate (g), fibre (g), protein (g), fat (g) | `sumNutrients` over `eaten(entries).map(viewEntry)` | yes: the Diary day card's own sum |
| per day: glycemic load | sum of `viewEntry(e).gl`, one decimal | yes: `weekSummary` rounds the same way |
| targets: kcal, carbohydrate, fibre, protein, fat, GL budget | `calculateTargets(profile)` (`targets` is already in App state) | yes |
| the person's own numbers (per meal, per snack, per day) | `profile.mealCarbsG`, `snackCarbsG`, `dailyCarbsG`, printed as typed, only when set | not shown in the Diary as such |
| "over" or "not over" | day value above target, as the Diary's own `over` flag | yes (`totals.carbs > targets.carbsG`) |
| each meal's items: name, portion, carbohydrate, GL | `viewEntry(e)` | yes |
| days logged, days with a note | counted from the same list | new count, arithmetic only |

**No language model produces, rewrites or sees any text on the page.** The wording is fixed copy in the component. The verifier has nothing to check because no answer text is involved; a test checks the figures against the Diary's functions instead.

**Three ways a figure could mislead a reader, and what the page says about each** (rules 3 and 4 of `CLAUDE.md`, at the level of a page):
1. **A food with no glycemic load** (packaged, restaurant, unrated) adds 0 to GL, which is not "no load". The day shows the GL with the Diary's own note (`noLoadNote`): "N foods have no glycemic load in our data and are not counted, so the real load may be higher". The word beside GL for that day is never "not over"; it is "not complete".
2. **An estimate** (a dish counted from an assumed recipe, `snapshot.assumed`) is marked "estimate" on the item and on the day.
3. **A day with fewer than three meal slots** is marked "fewer than 3 meals logged", so a missing lunch is not read as a low-carbohydrate day. A day with nothing logged is printed as "not logged", never as zero.

**Whose number is whose.** The carbohydrate target is either DiaBite's calculation or the person's own daily number from their doctor. `calculateTargets` already records which (the `own-carbs` constraint); the page says "set by you and your doctor" or "calculated by DiaBite" beside each target, without printing the age and weight the calculation uses.

## 5. Frontend

**Files that change or are added**
- `src/lib/clinicianSummary.ts` (new): `buildSummary(...)`, pure; types `ClinicianSummary`, `SummaryDay`.
- `src/components/ClinicianSummary.tsx` (new): the page.
- `src/components/SettingsPage.tsx`: one more card, one prop (`onClinicianSummary`).
- `src/App.tsx`: `summaryOpen` state; renders `ClinicianSummary` in place of the tabs when open (the pattern of the existing sheets); passes `diary`, `profile`, `targets`.
- `src/styles.css`: the page's styles and a `@media print` block.
- `docs/design.md`: a "Clinician summary" entry and the print rules, written **before** the CSS (design rule 1).
- `eval/run-engine.ts`: the checks in section 10. `eval/smoke.mjs`: the Settings button exists and opens the page.

**The Settings card.** "For your clinician", in `SettingsPage` above Help: one sentence ("A printable page of your last days of eating, with your targets beside them, to show a dietitian or doctor. It uses only what is on this device or in your account, and nothing is sent anywhere.") and the button "Summary for my clinician". Shown to everyone, signed in or out.

**The page, top to bottom (portrait, A4 and Letter)**
1. Title "DiaBite summary", the period ("Nov 11 to Nov 17, 2026, 7 days") and the date printed.
2. A name line: a text input on screen, printed as typed; empty prints as an empty line for a pen. Not stored: component state only.
3. **About this person**, one line: condition (`CONDITION_LABELS`), insulin ("takes insulin" or "does not take insulin": not the product names in the labels), medicine classes by class name ("metformin, GLP-1"). Nothing else from the profile.
4. **Targets**, a small table: energy, carbohydrate, fibre, protein, fat, glycemic-load budget, each with who set it, headed "Targets as of <date printed>". Then the person's own per-meal and per-snack numbers if set.
5. **The days**, a table, one row per logged day, newest first: date, kcal, carbohydrate, fibre, protein, fat, GL, and a notes cell ("over carbohydrate", "estimate", "carbs only: 1 food has no load", "2 of 4 meals"). Runs of days with nothing logged are one line, "Nov 14 to Nov 15: not logged".
6. **Averages** over logged days only, said so: "Average of 5 logged days".
7. **The meals**, per day: each meal slot with its foods, portion (grams, with the household measure if the entry has one), carbohydrate and GL per item; "estimate" on assumed-recipe items. Planned meals are absent.
8. **How to read this**, a fixed paragraph: where the numbers come from, that glycemic load is missing for some foods and the day then says so, that "estimate" means a dish was counted from an assumed recipe, and that DiaBite does not give medical advice. Wording is the owner's, drafted in chat first (section 12).
9. A footer on each printed page: "DiaBite · diabite.pro · printed <date>".

**On screen**: a sticky bar with the period control (7 / 14 / 28, `aria-pressed` buttons like the theme options), the name field, Print and Close. The bar is `no-print`. The page is on a light surface in both colour schemes (a document; a dark page wastes ink).

**States**
- *empty*: no eaten entries in the period: "Nothing logged in the last N days. Log what you eat and come back."; Print disabled.
- *thin*: fewer than 3 days logged: printable, with "Only 2 of 7 days were logged." at the top.
- *partial / unknown*: as in section 4; never hidden.
- *error*: building the page cannot fail on data (every entry goes through `viewEntry`; unreadable rows were dropped on load); a thrown error reaches the existing error boundary, not a half page.
- *loading*: none; synchronous.

**Phone layout (375 px).** Single column; the days table scrolls horizontally inside its card instead of shrinking type below the scale; touch targets 44 px. The printed layout does not depend on screen width.

**Print rules (`@media print`).** Everything but the summary hidden; the bar hidden; black on white, no backgrounds or shadows; table rows do not split across pages. **Colour never carries the meaning**: "over" is a word, so a black-and-white printer loses nothing (design rule 3).

**Accessibility.** A real `<article>` with `<table>`, `<th scope>`, `<caption>`; controls keyboard reachable with the standard focus ring; Esc closes; focus moves in on open and back to the Settings button on close.

**Design system.** Apply `/design-system` first. Tokens only; if a print surface needs a value `docs/design.md` lacks, it is added there first with its dark counterpart.

## 6. Engine and API

**No change.** No endpoint, tool or engine file. `src/lib/profile.ts` and `src/lib/glycemic.ts` are shared with the engine's image and are **read, not edited**; if the build finds it needs to change either, it stops and says so, because that is an engine change with its own `npm run eval`.

## 7. Agents

**No change.** No prompt, tool spec or router change.

## 8. Data

**No new table, column, index or migration.** Nothing new is stored about a person, on the device or on a server: the typed name lives in component state and is gone when the page closes; the period is not remembered.

**What leaves the device:** nothing, until the person prints; then the paper or PDF is theirs and the app cannot limit where it goes. The page holds less than the export on purpose: no email, no consent record, no age, weight, kidney or pregnancy information.

**What a printed page can still reveal:** diagnosis, medicine classes, what the person ate in the period, and the name if typed. That is the minimum the owner chose, and the Settings card says what it is for.

## 9. Safety and responsible AI

- **The rules gate and the model are not involved.** The page contains no advice and says so.
- **What could mislead, and the control:**
  1. A low GL read as a good day when a food had no load → "not complete" wording and the Diary's note.
  2. A missing meal read as low intake or fasting → "fewer than 3 meals" and "not logged" lines.
  3. DiaBite's target read as a prescription → each target says who set it; "How to read this" says the calculation is DiaBite's and the person's own number is theirs.
  4. A person on intensive insulin handing the page over as DiaBite's advice → onboarding already declines this group (A5); if such a profile reaches the page it prints "takes insulin" truthfully, and "How to read this" says DiaBite does not dose or adjust insulin.
  5. A stale target: a period that spans a profile change prints today's targets for every day → "Targets as of <date printed>".
- **A clinician should review** (№39, №60): the "How to read this" wording; the five nutrient columns; whether "over / not over" against a DiaBite-calculated GL budget that no clinician has validated belongs on a page a professional reads; whether diagnosis and medicine classes are what they want to see.
- **Data protection:** nothing new is stored or sent, so no consent text, retention rule or deletion path changes. Whether handing a person a page with their health information needs a notice sentence goes to counsel (№58); I have not decided it.
- **Security surface:** none added: no route, no write, no secret, no storage key. Every string (the typed name, `snapshot.name`) is rendered by React as text, never as HTML.

## 10. Evaluation plan

The app has no component test runner; the repository's pattern is pure functions imported into `eval/run-engine.ts` plus a browser smoke. So the page's logic is one pure function and the checks read its result, not its prose (rule 7).

**Engine checks (`npm run eval`, new block `clinician summary`, in the same change):**
1. **Same as the Diary.** On a fixed diary of twelve entries over seven days (hand-logged, snapshot, an assumed-recipe dish, a food with no load), each day's kcal, carbohydrate, fibre, protein, fat and GL equal `sumNutrients`/`viewEntry` computed directly, and the GL equals `weekSummary(...).days[i].used`.
2. **Planned is absent** from days, totals and meal blocks (mutation: drop the `eaten` filter; the check must fail).
3. **No load is never "not over".** A day with a branded entry carries the note and the word "not complete" even when the sum is under the budget (mutation: ignore `loadAvailable`).
4. **Estimate and thin-day marks** present when the entry says so, absent otherwise.
5. **Period.** 7, 14 and 28 give 7, 14 and 28 calendar days ending today, across a month boundary and a clock change; an entry one day outside is excluded.
6. **Not logged is not zero.** An empty day is in the "not logged" list, not in the table or the averages (mutation: include empty days).
7. **Profile minimum.** The summary object has exactly the approved keys (condition, insulin, medicine classes, targets, the person's own carbohydrate numbers, `printedOn`, `periodDays`) and none of email, age, weight, height, kidney, pregnancy, allergens, comorbidities; a scan of the rendered text for the fixture's email, age and weight finds nothing. This is the data-minimisation promise as a test.
8. **Whose target.** With `dailyCarbsG` set, the carbohydrate target says it is the person's own; unset, calculated.
9. **Name is text.** A name of `<img src=x onerror=alert(1)>` is rendered as text (smoke).

**Smoke (`npm run smoke`):** Settings shows the button for a signed-out person; clicking opens the page; switching to 14 days changes the row count; Print is disabled with an empty diary.

**Visual check:** the printed page at A4 and Letter in Chrome and Safari through print preview and "Save as PDF", on a 7-day and a 28-day diary, in both app themes; the on-screen page at 375 px. Screenshots go in the report.

**Agent evals:** not applicable (no prompt, tool or data change).

## 11. Rollout

1. Build locally; `npm run eval`, `npm run eval:abuse`, `npm run smoke` green; look at the page.
2. Commit locally. **Push and deploy only on the owner's "выкладывай"**, pushing only this feature's commits. `clinicianSummary.ts` is not used by the engine, so the Dockerfile does not change.
3. `npm run deploy`; then ask the live service what it serves (rule 1): fetch the built asset and look for the new copy, and open Settings on `https://diabite.pro` and the print preview.
4. No data change: no `sync-foods`, no revision restart, no agent publish.
5. **Roll back:** revert the commit and redeploy; nothing the feature did is stored anywhere.

## 12. Open questions

**For the owner**
1. **The wording** of "How to read this" and of the Settings card: I draft it in chat before it goes in the file. Whether it says "not a medical device" or only "does not give medical advice" is the FDA position (№57), which is yours until counsel confirms.
2. **Protein and fat columns.** You listed carbohydrate, kcal, fibre and GL; I added protein and fat because the Diary shows them against targets and a dietitian will look for them. Keep, or cut to your four?
3. **Carbohydrate total or available.** The Diary day card compares *total* carbohydrate to the target; each entry line shows *available* (net of fibre). The page follows the day card and prints fibre beside it. Say if you want available instead.
4. **Insulin wording.** "Takes insulin" or "does not take insulin", not the type (basal, mealtime or pump). Say if a clinician should see the type.

**For a clinician (№39, №60)**
5. Whether the nutrient columns and per-meal blocks are what a dietitian or physician reads, and what is missing.
6. Whether "over / not over" against a DiaBite-calculated target and an unvalidated GL budget should appear, or only the person's own numbers.
7. Whether diagnosis and medicine classes help them or they already have them.

**For counsel (№58)**
8. Whether a printable page with health information needs a notice sentence on the Settings card.
