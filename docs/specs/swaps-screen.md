# Spec — Swaps worth making: what the screen does

*Stage 2, from `docs/engineering/engineering-doc.md` (approved 23 November 2026). Companion specs: `swaps-engine.md`, `swaps-agent.md`, `swaps-evals.md`. Read `docs/design.md` before any UI code (`/design-system`): **this change adds no screen, no component, no colour, no size and no CSS.** `docs/design.md` needs **no new section**: the swap line, the "Accept the swap" key and its states are already in "The answer" and are not altered.*

**No migration, nothing stored on a server beyond one boolean in the engine's session memory (`swaps-engine.md`, section 6). No new environment variable.**

## Files

| File | Change |
|---|---|
| `src/lib/swap.ts` | `SwapOffer` gains `kind` and `label`; `swapNamedIn` recognises a smaller portion |
| `src/components/AskPage.tsx` | `acceptSwap` handles a portion (same food, new weight); the request carries `portionSwaps` |
| `src/lib/agent.ts` | `AskRequest.portionSwaps?: false`; `Alternative`-shaped fields on the trace type |

## 1. What the person sees

Unchanged: under the **Next** line, one key, **Accept the swap**, when the Next line names an alternative the engine returned. What changes is what that line can name and what the key does for a smaller portion:

| The agent's Next line (the engine's `label` is quoted) | The key | After a tap |
|---|---|---|
| "Swap the banana for the pear (118 g)." | **Accept the swap** | the banana line is replaced by the pear at 118 g; the meal is counted again by `/meal/recompute` (as today) |
| "Have half the banana (59 g) instead." | **Accept the swap** | the banana line stays the banana at 59 g; the meal is counted again; the receipt line says the weight the engine used |
| a Next line that names nothing the engine returned | no key | — |

**Copy:** the key keeps its four texts exactly as they are today (`Accept the swap`, `Counting again…`, `Swap accepted`, `Try the swap again`) and the two notes (`The new count is above.`, `Couldn't count that. Your original answer is unchanged.`). A smaller portion is still "the swap": nothing in the interface says "reduce", "less" or "cut down" in its own voice; the only such words are the engine's `label` in the agent's sentence, and the owner's rule against a prohibition-voice (feedback of 6 November) applies to the sentence the agent writes (`swaps-agent.md`).

## 2. `src/lib/swap.ts`

```ts
export interface SwapOffer {
  id: string
  name: string
  unit: 'g' | 'serving'
  portion: number
  /** NEW. 'portion' means less of the food being replaced. Absent is 'swap' (an older engine). */
  kind?: 'swap' | 'portion'
  /** NEW. The engine's own phrase for the option, e.g. "half the banana (59 g)". */
  label?: string
}
```

`swapNamedIn(next, meal)` keeps its contract (the sentence only says which; the food, the weight and every number come from the engine) and gains one path:

1. For an alternative with `kind === 'portion'`: it is named when the Next line, lower-cased, contains the `label` **with its parenthesis removed** (`half the banana`), or contains the fraction word (`half`, `three quarters`) **and** the plain name of the food being replaced, **or** contains the grams (`59 g`, `59g`, `59 grams`) **and** that plain name. This path does **not** apply the rule that drops an offer whose name is inside the replaced food's name (that rule exists so "potato, scalloped" is not taken for "mashed potato"; a portion is, by definition, the replaced food).
2. For `kind` absent or `'swap'`: exactly today's logic (`lastIndexOf` of the plain name, the replaced food excluded, latest mention wins).
3. When both a portion and a swap are named, the one mentioned **last** wins (the sentence "instead of the pear, have half the banana" is the portion).

## 3. `src/components/AskPage.tsx`

`acceptSwap(alt)` today finds the line by `alternativesFor.foodId` and sets `swap = { index, id: alt.id, name, unit, portion, replaced }`. For a portion `alt.id === alternativesFor.foodId` (same food): the code that applies `swap` already replaces the line's `foodId`, `unit` and `portion`; **no new branch is needed there**, but two checks are added:

- the line is replaced even though `id` equals the replaced line's `foodId` (a guard today may treat "same id" as "nothing to do": read the code and remove that guard for `kind === 'portion'`);
- the receipt's note for the replaced line reads the engine's recount, not the sentence.

`recompute` sends `{ items: [{ foodId, grams | servings }] }` as today; a portion is `{ foodId: alt.id, grams: alt.portion }` (ingredient) or `{ foodId: alt.id, servings: alt.portion }` (recipe).

**The request.** Where the ask body is built (`AskPage.tsx`, near `...(carbLimit.g > 0 ? { carbLimit: … } : {})`):

```ts
...(menuHidden(profile) ? { portionSwaps: false as const } : {}),
```

`menuHidden` is imported from `src/lib/menu`. Nothing is sent when it is false.

## 4. `src/lib/agent.ts`

`AskRequest` gains `portionSwaps?: false` with the comment *"Set only when the person's profile hides the weekly menu: the engine then offers no smaller portion. Parked with the day, memory only, never named."* The trace type that reads `compute_meal` results gains the new `Alternative` fields (`kind`, `gain`, `fitsMeal`, `label`, `grams`, `servings`, `portionOf`, `fraction`), all optional.

## 5. States

| State | What the person sees |
|---|---|
| the meal fits | no swap, no key (as today) |
| the meal does not fit and the engine returned a swap | the Next line names it, the key |
| the meal does not fit and **nothing worth swapping** | the Next line says no swap was worth making and states what is left of the day (the agent's wording, `swaps-agent.md`); no key |
| the portion offered, the person has an eating-disorder history | never offered (the engine was told `portionSwaps: false`) |
| accepting: counting / accepted / failed | unchanged texts and behaviour |
| offline, 502, rate limit | the existing messages |

**Phone (375 px) and accessibility:** nothing moves; the Next line is longer by at most the parenthesis of the label, and wraps as it does today; the key is the same 44 px target; the live region is the answer's own.

## Verifiable

`swaps-evals.md`: SW12 (the key offered for `half the banana`, not for a Next line naming nothing, and the old cases of `swapNamedIn` unchanged), a static render of the answer with a portion offer, and by eye on the live app at 375 px and desktop width, Tape and Paper, with a banana that does not fit; the console is read.
