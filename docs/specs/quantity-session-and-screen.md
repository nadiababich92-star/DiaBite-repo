# Spec — US household measures: the person's units in the session, and what the screens say

*Stage 2, from `docs/engineering/engineering-doc.md` (approved 18 November 2026). Decision of the owner: the engine knows the person's units, passed with the session as the budget and the carbohydrate limit are. Companion specs: `quantity-engine.md` (what `said` and `basis` are), `quantity-agent.md`, `quantity-evals.md`. Read `docs/design.md` (and apply `/design-system`) before any UI code.*

**No migration, nothing in `.env.example`, nothing stored.** `units` is a display preference held in the engine's in-memory session for its one-hour life, never written to disk and never logged. It is not health data.

## Files

| File | Change |
|---|---|
| `src/types.ts` | optional `said`, `basis` on the diary snapshot type; `Units` is already `'imperial' \| 'metric'` on `Profile` |
| `src/lib/agent.ts` | `AskRequest.units`; `ReceiptLine.said`, `ReceiptLine.basis`; the receipt builder copies them from the trace |
| `src/components/AskPage.tsx` | sends `units: profile.units`; the receipt line shows `said` and the "typical size" pill; the portion editor is unchanged |
| `src/components/DiaryPage.tsx`, `src/lib/diary.ts` | the logged snapshot keeps `said`; the Diary prefers it for imperial |
| `server/guard.ts` | `validUnits`; the `/agent/ask` body check (`units`) |
| `server/engine.ts` | `PUT /session/:id` accepts and validates `units` |
| `server/sessions.ts` | `SessionState.units`; `putSession(..., units?)` |
| `server/agent.ts` | `AskRequest.units`; `parkDayState` sends it |
| `docs/design.md` | one sentence under "Portions" (below), written before the CSS |
| `src/styles.css` | nothing new unless the pill needs a rule (it reuses `.pill.none.assumed`'s sibling `.pill.none.typical`: same box, same tokens) |

## 1. `units` through the session

**Browser** (`src/components/AskPage.tsx`, in the object passed to `askAgent`, next to `avoid` and `carbLimit`):

```ts
units: profile.units,   // 'imperial' | 'metric'
```

**`src/lib/agent.ts`**: `AskRequest` gains `units?: 'imperial' | 'metric'`; `askAgent` sends it unchanged.

**`server/guard.ts`**: new

```ts
/** The person's units: one of two words. */
export function validUnits(v: unknown): boolean { return v === 'imperial' || v === 'metric' }
```

and in the `/agent/ask` body check, after `carbLimit`: `if (b.units !== undefined && !validUnits(b.units)) return { field: 'units' }`. A bad value is a 400 with `field: 'units'`, the same shape as `carbLimit` and `avoid`; it does not count against any rate limit beyond the request itself.

**`server/engine.ts`** (`PUT /session/:id`): read `units` from the body; `if (units !== undefined && !validUnits(units)) return res.status(400).json({ error: 'invalid units' })`; pass it to `putSession`.

**`server/sessions.ts`**:

```ts
export interface SessionState { /* existing fields */ units?: 'imperial' | 'metric' }
export function putSession(id, budget, entries, avoid?, carbLimit?, units?): SessionState
```

It lives and dies with the session (the existing sweep and TTL). `dropCarbLimit` does not touch it.

**`server/agent.ts`**: `AskRequest.units?: 'imperial' | 'metric'`; `parkDayState` passes it to `putSession` (local) or in the JSON body of the `PUT` (remote): `JSON.stringify({ budget, entries, avoid, carbLimit, units })`.

**Absent `units`** (an old browser tab, a script, the evals) means `said` is in grams: **nothing that worked before changes**.

## 2. What the screens say

`said` is a string made by the engine (`saidText`); **no component builds a measure or converts a unit for an item that has `said`**.

### Ask: the receipt (`ReceiptView`)

For each line: if the line has `said` (it came from a `quantity`), the receipt prints `said` where it printed the portion; otherwise it prints what it prints today (`portionText(l.portion, l.measure, units, ...)`, the ounce fallback). So:

| Case | Receipt line, imperial | Receipt line, metric |
|---|---|---|
| typed "a cup of rice" (`usda_measure`) | `White rice, cooked 1 cup (158 g)` | `White rice, cooked 158 g` |
| typed "a medium apple", table has medium | `Apple 1 medium (200 g)` | `Apple 200 g` |
| typed "a medium apple", table has only "regular" (`typical`) | `Apple 1 regular (120 g)` + pill **typical size** | `Apple 120 g` + pill **typical size** |
| typed "4 oz of chicken" | `Chicken breast 4 oz (113 g)` | `Chicken breast 113 g` |
| typed "300 g of pasta" | `Pasta 300 g` | `Pasta 300 g` |
| no amount typed (`default`) | `Apple 1 medium (200 g)` when the default is a household measure, else the ounce fallback | grams |

**The pill.** A line with `basis: 'typical'` shows a pill with the text **typical size** after the portion, in the same position and style as the existing `assumed` pill (`<span className="pill none assumed">`): a new class `typical` on the same markup, same tokens (`--text-dim` on the pill surface, the dashed edge), same 44 px rule for anything tappable (the pill is not tappable). Text, not colour alone (`docs/design.md` rule 3).

### Ask: the answer text

The model's "Weights I used" line is built from the same `said` strings (`quantity-agent.md`). The screen shows the answer as it comes; the verifier has already checked its numbers.

### Ask: the portion editor (`PortionEditor`)

Unchanged in behaviour: it steps in grams, or in the measure for a food that has a `stepUnit` (`measureLabel`, `nudgeMeasure`), or shows the ounce fallback beside the grams (live since 18 November). After a person changes a portion, the recount sends **grams** (`servings` for recipes), so the recounted card has no `said`; the existing display rules apply to it. This is intended: the person has now chosen a weight, and the card says it in the form the stepper uses.

### Diary

When an entry is logged from an answer, the snapshot keeps `said` and `basis` beside the existing `measure` (optional fields, so old entries are untouched). In the Diary list (`DiaryPage`):

- imperial and the snapshot has `said`: show `said`;
- otherwise the existing `portionText(...)` with the ounce fallback;
- metric: grams as today, never `said`.

Hand-logged entries (the Add-food form) have no engine and no `said`; they keep the ounce fallback.

### States

| State | What the person sees |
|---|---|
| measure known | the receipt, the answer and the Diary say it in their units |
| typical size | the same, plus the pill **typical size**, and the answer names USDA's typical size |
| **needs a weight** | no receipt and no figures: the agent's one question, "About how many ounces or cups?" (on metric, "About how many grams?"), in the existing answer region as plain text; the input box takes the reply (the existing follow-up path) |
| unknown food, partial meal | unchanged |
| error | the existing messages |

**Phone (375 px):** no element is wider than today's receipt line; the pill wraps under the portion. **Accessibility:** the pill is text; the question is ordinary answer text read in order; the existing focus and live-region behaviour is untouched.

### `docs/design.md`, "Portions" (add one sentence, before the CSS)

> A measure the person typed is said back the way they said it, with the grams beside it (`1 medium (200 g)`); when USDA lists only a "regular" or "whole" for a food, the line says that word and carries the pill **typical size**. The engine writes the words; the screen prints them.

## Verifiable

- **Engine:** `quantity-evals.md` checks Q6 (`said` follows the session's units) and Q10 (a bad `units` is a 400 with `field: 'units'` on `/agent/ask` and on `PUT /session`; absent `units` is metric text).
- **Static render:** `eval/run-engine.ts` renders `ReceiptView`'s line markup (the pattern used for `FigurePair`) for the six cases of the table and reads the text: `said` appears; the pill appears only for `typical`; metric shows no ounces.
- **By eye, on the live app** (this part cannot be automated without a sign-in): Ask "a medium apple" on feet and pounds and on metric; Log it; open the Diary; screenshot at 375 px and at desktop width, in Tape and in Paper.
