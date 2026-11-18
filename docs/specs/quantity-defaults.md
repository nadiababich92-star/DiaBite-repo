# Spec — US household measures: default portions in household units

*Stage 2, from `docs/engineering/engineering-doc.md` (approved 18 November 2026, section 8). The owner approved changing about thirty default portions **on condition that this list is shown to her again, with the grams from the mapped USDA record, before any default moves.** This spec is that list. **No default changes until she says yes to it**, row by row if she wants. Companion specs: `quantity-labels-and-links.md` (the measures the defaults point at), `quantity-evals.md`.*

**No migration, nothing in `.env.example`.** A change to a default portion reaches production only after `npx tsx scripts/sync-foods.ts` and a restart of the active revision (CLAUDE.md rule 10).

## What a default is, and where it lives

A default portion is what a food costs when the person gave no amount ("an apple", "eggs"), and what "two eggs" multiplies (`quantity: { count: 2, unit: 'default' }`, by the engine). A food has up to two records and so up to two defaults:

| Family | Where the default is set | Who else reads it |
|---|---|---|
| `seed:<id>` (the 86 everyday foods) | `src/data/foods.ts`, the food's `portion: { label, grams }` | the engine **and** the browser (the Add-food form and hand-logged entries); the Dockerfile copies this file into the engine image |
| `ing:<id>` (the 364 curated ingredients) | `INGREDIENT_PORTION_G` in `server/foods.ts` (an id absent from it defaults to **100 g**) | the engine; the recipes keep their own grams |

**A change is made in both families, or the same words give two different numbers** (today "an apple" is 180 g as an everyday food and 100 g as an ingredient). Where a family is not listed in the table below it is unchanged.

When a `portion.label` is changed, the label becomes the household word (`medium`, `large`, `slice`, `cup`, `oz`), because the Add-food form shows it.

## The list

*Grams are read from the household rows of the USDA records in `data/foods-usda/foods_usda.json` (survey "foods as eaten" tables unless a row is marked SR), not typed from memory. "Today" is what `loadFoods()` returns now. A row marked **no change** has no household row in the local USDA file, or its default already is the household amount; it is listed so the list reads as a whole.*

| Food | Records and what each is today | Proposed | Grams from | Change |
|---|---|---|---|---|
| apple | `seed:apple` 180 g; `ing:apple` 100 g | **1 medium** | FNDDS `Apple, raw` (2709215): medium **200 g** | 180 → 200 (+11%); 100 → 200 (+100%) |
| banana | `seed:banana` 120 g | **1 medium** | FNDDS `Banana, raw` (2709224): "1 banana" **126 g** (word "banana") | 120 → 126 (+5%). `ing:banana` stays 100 g ("small amount", used in recipes) |
| orange | `seed:orange` 160 g; `ing:orange` 100 g | **1 whole (fruit)** | FNDDS `Orange, raw` (2709171): "1 fruit" **154 g** | 160 → 154 (−4%); 100 → 154 (+54%) |
| peach | `seed:peach` 150 g; `ing:peach` 100 g | **1 whole (fruit)** | FNDDS `Peach, raw` (2709249): "1 fruit" **150 g** | seed no change; 100 → 150 |
| bell pepper | `seed:bellpepper` 120 g; `ing:bell_pepper` 100 g | **1 regular** | FNDDS `Peppers, sweet, green, raw` (2709800): "1 regular" **120 g** | seed no change; 100 → 120 |
| tomato | `seed:tomato` 120 g; `ing:tomato` 100 g | **1 whole** | FNDDS `Tomatoes, raw` (2709719): "1 whole" **125 g** | 120 → 125 (+4%); 100 → 125 |
| cucumber | `seed:cucumber` 120 g; `ing:cucumber` 100 g | **1 cup** | mapped already (cup **120 g**) | seed no change; 100 → 120 |
| avocado | `seed:avocado` 70 g; `ing:avocado` 100 g | **1/2 whole** | FNDDS `Avocado, raw` (2709223): "1 fruit" 150 g, so **75 g** | 70 → 75 (+7%); 100 → 75 (−25%) |
| strawberries | `seed:strawberry` 150 g; `ing:strawberries` 100 g | **1 cup** | mapped already (cup **150 g**) | seed no change; 100 → 150 |
| blueberries | `seed:blueberry` 100 g; `ing:blueberries` 100 g | **2/3 cup** | mapped already (cup 150 g) | no change |
| onion | `seed:onion` 80 g; `ing:onion` 100 g | **no change** | a "whole" onion is 148 g; nobody eats that as a portion | no change (removed from the earlier list) |
| carrot, raw | `seed:carrot-raw` 80 g | **no change** | FNDDS "1 regular carrot" is 60 g; 80 g is a small handful | no change |
| egg | `seed:egg` 55 g; `ing:egg` 50 g | **1 large** | mapped (large **50 g**) | 55 → 50 (−9%); `ing:egg` already 50 |
| rye bread | `seed:bread-rye` 35 g; `ing:rye_bread` 35 g | **1 slice** | FNDDS `Bread, rye` (2707755): "medium or regular slice" **32 g** | 35 → 32 (−9%) |
| white bread | `seed:bread-white` 30 g; `ing:white_bread` 29 g | **1 slice** | mapped (slice **29 g**) | 30 → 29; `ing` no change |
| whole-wheat and sprouted bread | `ing:whole_grain_bread` 35 g; `seed:bread-sprout` 35 g; `ing:ezekiel_bread` 34 g | **no change** | FNDDS whole wheat lists only a small (24 g) and a thin slice; no regular row | no change |
| chicken breast | `seed:chicken` 150 g; `ing:chicken_breast` 100 g | **4 oz cooked** | exact: 4 × 28.3495 = **113.4 g** | 150 → 113 (−24%); 100 → 113 (+13%) |
| turkey breast | `seed:turkey` 150 g; `ing:turkey_breast` 100 g | **4 oz cooked** | exact **113.4 g** | 150 → 113 (−24%); 100 → 113 |
| salmon, shrimp, lean beef | `seed:salmon`, `seed:shrimp`, `seed:beef` 150 g; `ing:salmon` 100 g; `ing:shrimp` 100 g; `ing:beef_sirloin` 100 g | **3 oz cooked** | exact: 3 × 28.3495 = **85.0 g** | 150 → 85 (**−43%**); 100 → 85 (−15%). *The largest drop in the list; she may prefer 4 oz for salmon.* |
| hard cheese | `seed:cheese` 30 g | **1 oz** | exact **28.3 g** | 30 → 28 (−5%); `ing:cheddar` and its siblings already 28 |
| peanut butter | `ing:peanut_butter` 32 g | **2 tbsp** | FNDDS `Peanut butter` (2707537): "1 tablespoon" 16 g, so **32 g** | no change in grams; gains the measure |
| milk | `seed:milk` 200 g; `ing:milk` 246 g | **1 cup** | mapped (cup **246 g**) | 200 → 246 (+23%); `ing` no change |
| cooked rice | `seed:rice-white` 180 g; `ing:white_rice` 158 g | **1 cup** | mapped (cup **158 g**) | 180 → 158 (−12%); `ing` no change. **The earlier plan's "1/2 cup" is withdrawn:** the owner chose a cup on 18 November (worklist 65). |
| oatmeal, cooked | `seed:oats` 200 g | **1 cup** | mapped (cup **234 g**) | 200 → 234 (+17%) |
| rolled oats, dry | `ing:rolled_oats` 40 g | **no change** | mapped (cup 81 g: 40 g is 1/2 cup) | no change |
| cooked pasta | `seed:pasta-durum`, `seed:pasta-whole` 180 g; `ing:white_pasta`, `ing:whole_wheat_pasta` 100 g | **no change** | no household row in the local USDA file | no change until a row is mapped |
| Greek yogurt | `seed:greekyogurt` 150 g; `ing:greek_yogurt` 100 g | **no change** | no Greek-yogurt record with a row was found | no change |
| potato, sweet potato | `seed:potato-boil` 150 g; `ing:potato_baked` 100 g; `seed:sweetpotato` 150 g | **no change** | no "medium" row for potato; the sweet potato's rows are small 60, large 180, cup 200 | no change |

**Rows that change a number a person sees:** every row whose last column shows an arrow. **Rows that only gain a measure** (peanut butter, blueberries, cucumber and strawberries on the everyday side) change no number. The rest are "no change".

### What a person sees

A person who types "an apple" now gets 200 g instead of 180 g (the calories and the load are computed by the engine, not stated here), so the carbohydrate and the glycemic load follow the weight: +11% for the apple, **−43% for a salmon, shrimp or beef default**. The answer says what it used ("1 medium (200 g)"), which is the point of the feature. No eval case may pin a verdict to the old defaults.

## How the change is made

1. Make the household rows exist first (`quantity-labels-and-links.md`): map the foods in the table to the records in the "Grams from" column; these are the rows the owner reads first.
2. Edit `src/data/foods.ts` (`portion`) and `INGREDIENT_PORTION_G` in `server/foods.ts` for the rows marked as changing. Add the new `ing:` ids to `INGREDIENT_PORTION_G` with a comment that names the USDA row and the date.
3. `npm run eval`. **The cases that assert a default** (`eval/cases.json`, `engine.portion`, 48 entries read by `portionMisses` in `eval/run-engine.ts`): `ing:egg` 50, the bread rows, the rice, bean and spice rows are unaffected by this list **except** any entry whose id appears in the table above; those expected grams are re-derived **from the table above**, never copied from the failing output. The range checks near `defaultPortion` in `eval/run-engine.ts` (spoonful foods, the pizza slice) are not touched by this list; if one fails, the default was moved wrongly.
4. The agent cases that cost a default (any case whose query names one of these foods with no amount) are rerun by the full `npm run eval:agent`; a mechanical check that depended on the old weight is re-derived the same way.
5. `npx tsx scripts/sync-foods.ts`, restart the active revision, ask the running service (rule 1): `compute_meal` for each changed food with `quantity: { count: 1, unit: 'default' }` returns the proposed grams.

## Verifiable

- `quantity-evals.md`, check Q9: for each changed food, `computeItem({ foodId })` returns the proposed grams exactly, and `gramsFor(record, { count: 1, unit: <household unit> })` returns the same grams within 3% (the default **is** the household measure).
- The table above is the expected value for each; the check reads it from `eval/cases.json` (`engine.defaults`), which this spec's rows are copied into once she has said yes.
- Nothing else in the catalogue changes: a check compares every other record's `defaultPortion` before and after.
