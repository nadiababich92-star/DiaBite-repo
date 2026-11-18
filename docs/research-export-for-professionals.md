# What "Export my data" gives a professional

Worklist №20, from the 14 November call (item 4: check exactly which personal data the export gives to a professional).
Read from the code on 18 November 2026: `src/components/AccountBlock.tsx`, `src/lib/sync.ts` (`exportAccount`),
`src/lib/syncCore.ts` (`AccountExport`, `toRow`), `src/types.ts` (`Profile`, `DiaryEntry`), the `accounts` migration.
Nothing was changed. No file was exported from a real account.

## What the button does

Settings, "Export my data". The browser reads the person's own two tables (`profiles`, `diary_entries`) with their
session, row-level security keeps it to their rows, pages past 1,000, and saves one file, `diabite-export-<date>.json`.
There is no server code and no layout: it is a data-protection export (PRD E4), made for the person, not for a reader.

## What is in the file

| Block | Fields |
|---|---|
| Envelope | `exportedAt`, the sign-in **email**, the consent record (time and version of the text accepted) |
| Profile (all 27 fields) | sex, age, height, weight, activity, goal; **condition** (type 1/2, prediabetes, IR, gestational, unsure); **insulin** use; **medicine classes** (metformin, sulfonylurea, SGLT2, GLP-1, other); **pregnant or breastfeeding**; **kidney status**; comorbidities; allergens; meats avoided; eating pattern; the person's own carbohydrate numbers (per meal, per snack, per day); excluded food ids; units and display settings |
| Diary, one object per entry | date, meal, `foodId`, grams, `planned` flag, and for entries logged from an answer a `snapshot`: name, kcal, carbohydrate, fibre, protein, fat, available carbohydrate, GI, GL, `loadAvailable`, servings, `assumed`, household measure |

So the file holds everything the app knows about the person's health, in one place, with the email beside it.

## What a professional cannot get from it

1. **No targets.** Daily kcal, carbohydrate, protein, fat, fibre and the GL ceiling are computed in the app from the
   profile and are not in the file. A reader would have to re-derive them with our formulas.
2. **No day view.** No daily totals, no "left after", no verdict, no weekly summary, and no statement of which days count as
   in range. Everything has to be added up from entries.
3. **Entries that are hard to read.** An entry logged by hand has an internal `foodId` and no `snapshot`, so it has a
   gram weight and no food name or nutrient numbers in the file. Entries from an answer have a name and numbers but the
   file does not say they are estimates unless `assumed` is read.
4. **No legend.** Nothing explains `gl`, `loadAvailable: false` (a food with no glycemic load, shown as 0) or `planned`
   (not eaten). A reader who sums `gl` would count planned meals and zero-load foods wrongly.
5. **Not what the person said.** The typed question and the answer text are not stored with the entry.
6. **JSON.** A dietitian or physician will not open it. A person who wants to show a professional their week has to
   screenshot the Diary.

## What is held about the person and is not in the export

- **The turn log** on the server: typed questions kept 30 days with a session id (the consent line says so).
- **The advisor's memory** in Foundry: food preferences, keyed by session.
- **Feedback rows**, with an optional email.

The export covers the two account tables only. Whether the turn log and the memory can be tied to an account and so
exported or deleted on request is a data-protection question for counsel (worklist №58), not a code change to decide here.

## Where the file goes after it is saved

The person chooses. The app cannot encrypt it, redact it or limit who reads it, and the file includes the email, the
diagnosis, the medicine classes and, if set, the pregnancy flag. Sending it to a professional by ordinary email is the
person's call, but the app today offers them no smaller version to send.

## What a professional actually needs (to be confirmed with one)

Not confirmed with any clinician; this is the list to ask them, not a decision.

- A period (the last 7 or 14 days) and **per day**: carbohydrate, kcal, fibre, and GL if the person counts it; each against the person's number.
- Meals listed with food names and amounts, **eaten and planned apart**, estimates marked.
- Which numbers are the person's own (from their doctor) and which are DiaBite's calculation.
- Nothing else: no email, no consent record, and the medical profile only as far as the reader needs.

## Options (owner's decision)

| | What | Cost | Risk |
|---|---|---|---|
| A | Leave the export as it is (data-protection only) and say so in the Settings text | none | the real need (show a professional) stays unmet |
| B | Add a second button, **"Summary for my clinician"**: a printable page (the browser prints it to PDF) for a chosen period, built from the same numbers the Diary already shows, no email, no profile beyond the person's own carbohydrate numbers | about 2 to 3 days with tests, no server code, no new table | what the summary says about a person is a clinical choice; the wording needs a clinician's read |
| C | Share by link or into a professional's account | needs accounts for professionals, consent, revocation | belongs to №21 and to counsel; not a first step |

I recommend B, after a clinician has seen a mock-up and said what they need (the list above). It adds no new number: every
figure is already computed in the Diary, so the promise (computed, not generated) is untouched.

## Also worth fixing in the existing export (small, no clinical content)

- Add a one-line legend inside the file (`planned`, `loadAvailable`, units).
- Put the food name into hand-logged entries when exporting, from the food table the app already has.

Both change what the file says, not what is stored. They wait for the owner's yes.
