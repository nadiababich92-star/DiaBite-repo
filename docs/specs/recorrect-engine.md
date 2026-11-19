# Spec — Correct an assumed weight: what the engine accepts and returns

*Stage 2, from `docs/engineering/engineering-doc.md` (approved 19 November 2026). Companion specs: `recorrect-screen.md` (what the screen sends and prints), `recorrect-evals.md` (the cases). Read `docs/specs/quantity-engine.md` first: `quantity`, `basis`, `said` and `gramsFor` are defined there and are not redefined here.*

**No migration, nothing in `.env.example`, no new route, no prompt change, nothing stored.** `/meal/recompute` already exists; this spec widens what one item may be and what comes back.

## Files

| File | Change |
|---|---|
| `server/guard.ts` | `validateRecompute` accepts `quantity` and `theirs` per item |
| `server/engine.ts` | `POST /meal/recompute` converts quantities, applies `theirs`, returns `said`/`basis`/`units` |
| `server/compute.ts` | `withMeasure` adds `units` to every item |
| `server/contract.ts` | `MealItemInput.theirs?`, `MealItemResult.units?` |
| `server/openapi.ts` | **not touched** (the route is browser-facing, not a model tool); the `compute_meal` description does not change |

## 1. The request

`POST /meal/recompute`, unchanged auth: the sign-in wall, the session claim (`claimSession`), the per-address limit (`chargeRecompute`), and the trusted-key bypass. Body:

```ts
{
  sessionId: string
  items: {
    foodId: string
    // exactly one of the three:
    grams?: number          // as today: 1 to 3000
    servings?: number       // as today: 0.1 to 20
    quantity?: { count: number; unit: QuantityUnit }   // new: what the person typed or the line already had
    theirs?: boolean        // new: this amount is the person's own (see section 3)
  }[]
}
```

**`validateRecompute` (`server/guard.ts`)**, in this order for each item, returning `{ field }` (the existing `Invalid` shape; the route answers `400 { error: 'invalid_request', field }`):

1. `foodId`: unchanged checks (`field: 'items.foodId'`).
2. Exactly one of `grams`, `servings`, `quantity` is present, else `field: 'items.grams'` (the existing field name, kept so an old client's error is the same).
3. `grams` and `servings` bounds unchanged.
4. `quantity`: `quantityError(quantity, foodId)` from `server/quantity.ts` must be `null` (unit in `QUANTITY_UNITS`, count a positive finite number, at most 100, and at most 5,000 for `g`); otherwise `field: 'items.quantity'`.
5. `theirs`, when present, must be a boolean (`field: 'items.theirs'`) and is refused with `servings` (`field: 'items.theirs'`): a recipe counted by serving has no weight to own.
6. The item count cap (`MAX_RECOMPUTE_ITEMS`, 20) and the body check are unchanged.

A request without `quantity` and `theirs` behaves exactly as before (an old browser tab, a script): the same items, the same numbers, no `said`, no `basis`.

## 2. What the handler does

In `server/engine.ts`, after the unchanged sign-in, claim and limit steps:

```ts
const units = getSession(body.sessionId)?.units            // 'imperial' | 'metric' | undefined (absent means grams in the words)
const plan = planQuantities(body.items)                    // quantity -> grams or servings; gramsFor does the conversion
if (plan.needs.length > 0) {
  const n = plan.needs[0]
  return res.status(400).json({ error: 'invalid_request', field: 'items.quantity', foodId: n.foodId, why: n.why, units: n.units })
}
const meal = computeMeal(plan.items)
const items = withSaid(meal.items, plan, units).map((it, i) => applyTheirs(it, body.items[i], units))
```

- The conversion is `gramsFor` (`server/quantity.ts`), the same function `compute_meal` uses. **The browser converts nothing.** An ounce is 28.3495 g in the engine and nowhere else.
- A `quantity` the engine cannot honestly weigh (`needs`: a cup of a food with no cup row, a recipe given in ounces) is a **400** for this call, because this route is not model-facing (model-facing tools keep answering 200 with an `error`). The body names the food, the reason (`why`, the text `gramsFor` returned) and the units that food can be said in (`units`, from `unitsFor`), so the screen can say what to try. Nothing is costed and no day is touched.
- `theirs` is applied last:

```ts
/** The person's own amount: the words keep the unit they typed, the basis says it is theirs. */
function applyTheirs(it: MealItemResult, src: { theirs?: boolean; quantity?: Quantity }, units): MealItemResult {
  if (!src.theirs) return it
  const said = it.said ?? saidText({ grams: it.grams, basis: 'stated', quantity: { count: it.grams, unit: 'g' }, rec: getRecord(it.foodId), units })
  return { ...it, basis: 'stated', said }
}
```

  So `quantity {3,"oz"}, theirs` on an imperial session returns `grams 85`, `basis: 'stated'`, `said: "3 oz (85 g)"` (the engine's words for what was typed, from `withSaid`), and on a metric session `said: "85 g"`. `grams 120, theirs` returns `basis: 'stated'`, `said: "120 g"`. A line sent **without** `theirs` keeps the basis the engine gave it: `typical` and `default` stay assumed, `usda_measure` and `exact_conversion` stay what they are. This is what closes the defect of the plan (section 1): the browser sends an untouched line with the `quantity` it had, so it comes back with the same `basis`.
- Everything after is unchanged: `dayStateFor`, `afterMealFor` (`fits`, `partial`, `carbLimit`), `excludedIn`, `driverOf` (with the minimum load of 5). The verdict word is the engine's `fits`. A partial meal is `fits: null`; a branded or unrated item has `gl: null` and is never "fits": this spec changes weights, not that logic.

## 3. What comes back

The reply is the existing `compute_meal`-shaped object (`items`, `totals`, `formula`, `driver?`, `dayState?`, `afterMeal?`, `excluded?`), and each item carries, in addition to what it carries today:

| Field | When | Meaning |
|---|---|---|
| `quantity` | the item was sent with one | echoed, so the browser can send it again for an untouched line |
| `said` | the item was sent with a `quantity`, or with `theirs` | the engine's words in the session's units (`1 medium (200 g)`, `3 oz (85 g)`, `120 g`) |
| `basis` | same | `usda_measure`, `exact_conversion`, `typical`, `default`, or `stated` |
| `units` | the food has household units beyond weights | `QuantityUnit[]`, from `householdUnitsFor` (absent for a food with only weights and the usual portion, and for a recipe) |
| `measure`, `stepUnit` | as today | unchanged |

`units` is added to **every** item in `withMeasure` (`server/compute.ts`), so a `compute_meal` reply carries it too; it is additive, the agent may ignore it, and `eval:agent` is run to prove nothing moves (see `recorrect-evals.md`).

## 4. Errors

| Status | Body | When |
|---|---|---|
| 400 | `{ error: 'invalid_request', field }` | any validation in section 1 |
| 400 | `{ error: 'invalid_request', field: 'items.quantity', foodId, why, units }` | the engine cannot weigh that quantity for that food |
| 400 | `{ error: 'invalid_request', field: 'items.foodId' }` | a food this build cannot cost (unchanged) |
| 401 / 403 / 429 | unchanged | signed out; session not this person's; rate limit with `Retry-After` |

A correction is one request after the person commits the field, so the request rate is the stepper's; **no new limit**.

## 5. Types (`server/contract.ts`)

```ts
export interface MealItemInput { /* existing */ theirs?: boolean }
export interface MealItemResult { /* existing */ units?: QuantityUnit[] }
```

`theirs` is read only by `/meal/recompute`; `compute_meal` ignores it (the agent never sends it, and `validate` for the tool is unchanged).

## Verifiable

`recorrect-evals.md`, engine block `recorrect`: RC1 to RC10. The fields a check reads are the tool result's: `items[].grams`, `basis`, `said`, `units`, `afterMeal.fits`, `gl`, and the `400` body's `field` and `why`; never the wording of an answer.
