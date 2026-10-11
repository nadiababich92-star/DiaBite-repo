# Spec: weekly menu V1

*From `docs/engineering/engineering-doc.md`, workstream C. Everything here runs in the browser: `src/lib/menu.ts`, `src/components/MenuPage.tsx`, `src/data/dishes.ts`. No model, no engine change.*

## What already exists

The generator already avoids a dish for `REPEAT_GAP = 3` days (a dish can come back on the fourth day), uses 30 dishes, filters by allergens and eating pattern, and the page already has a shopping list aggregated by food. This spec adds what is missing.

## 1. The hidden profiles

`menuHidden(profile): { hidden: boolean; reason?: string }` in `src/lib/menu.ts`:

| Profile | Result |
|---|---|
| `comorbidities` includes `'eatingDisorder'` | hidden |
| `kidney === 'ckd'` or `'dialysis'` | hidden |
| anything else | shown |

`MenuPage` renders, for a hidden profile, a card instead of the plan. **Exact copy:** heading "A weekly menu is not something DiaBite should plan for you." Body: "With what you told us, a fixed plan of meals and calories is better written by your doctor or dietitian. You can still ask about any meal you are thinking of eating." Button: "Ask about a meal" (switches to the Ask tab). No plan is computed for a hidden profile: `generateWeek` is not called, which a test checks.

## 2. "Not yet reviewed" line

For a shown profile, under the heading: "These meals have not been reviewed by a clinician yet. Treat them as ideas, and check anything that matters for your health with your doctor or dietitian." (`.muted`, 14 px.)

## 3. Replace one meal

`regenerateSlot(plan, dayIndex, meal, profile, targets, seed): WeekPlan` in `src/lib/menu.ts`:
- pure and deterministic for a given `seed`; returns a new plan where only `days[dayIndex].meals[meal]`, that day's totals and `gl` change;
- candidates: dishes valid for that meal and the profile's exclusions, **not** the dish being replaced, not already in that day, and not used within `REPEAT_GAP` days either side in the existing plan; if there are none, relax the repeat rule (as the generator does) and say so in the UI: "Few dishes fit what you avoid, so this one may come back soon.";
- the scale is chosen by the same `fitScale` for the same share of the day (`MEAL_SHARE`).

UI: a small ghost button "Replace" on every meal row (44 px target on touch), with an accessible name "Replace <dish name> on <weekday>"; after the change the row's text is announced through a polite live region: "Replaced with <dish name>". The plan lives in component state; the seed for each replacement is `Math.floor(Math.random() * 1e9)` kept in state so the same click path is reproducible in a test.

## 4. Shopping list

Today: `shoppingList(plan)` grouped by category in the table. Add: a checkbox per line (state kept in `localStorage` under `diabite.shopping.v1`, keyed by plan seed and food id, cleared when the plan changes), a "Copy list" button that copies plain text ("Chicken breast, 650 g" per line, grouped by category headings) with a "Copied" confirmation, and the amounts rounded to 5 g (the current exact grams are false precision). No "by store" grouping: PLAN says wait until someone uses the V0 for a week.

## Verifiable

- `npm run eval`, new `menu` section: (a) over 200 seeds no dish appears twice within `REPEAT_GAP` days when the pool allows; (b) `regenerateSlot` changes exactly one slot and the day's totals equal the sum of its meals; (c) the same seed twice gives the same result; (d) `menuHidden` is true for the three profiles and false for ten others including `kidney: 'mentioned'`, gout, gastroparesis; (e) `generateWeek` is never called for a hidden profile (a spy in the component test, or the guard in `MenuPage` read in code review if no component test harness exists).
- The shopping-list text of a fixed seed matches a recorded snapshot.
- Screens: hidden profile (each of the three), shown profile at 375 px, replace on a day with a short pool, dark mode.

## As built, 10 October 2026, evening

- **The week is kept.** The Menu tab is unmounted whenever someone leaves it, and the week used to come from a fresh random number on every return. It is now stored as the seed plus the replacements made since, each with its own seed (`src/lib/menuStore.ts`, `replayWeek` in `src/lib/menu.ts`), and rebuilt exactly, because both generators are deterministic for a seed. It lives only on this device (key `diabite.menu.v1`) and does not sync with an account. If the person's restrictions change, the same seed is rebuilt for the new ones.
- **One day at a time.** Seven day keys with each day's planned load, today pre-selected, and the open day as a card. The accordions are gone.
- **Add to today.** Each planned meal can be put into today's diary at the weights the plan chose, one entry per food, under the meal it was planned for, with an Undo and a link to the diary. It is the local food ids that go in, so the diary prices them as it prices anything hand-logged.
- **Not changed:** the 30 dishes, the repeat gap, the two profiles the plan is hidden for. Using the 1,000 recipes is a separate decision (they have not been reviewed by a dietitian).
- Tested in `npm run eval` (`menu`: the replay equals the walked week, and a stored week with bad replacements or no JSON gives a sane week) and in the smoke test M18 to M21.

## As built, 11 October 2026: the recipe database in the menu

- **969 recipes join the 30 curated dishes.** `scripts/build-menu-recipes.py` reads `data/recipes-db/recipes_db.json` and writes `src/data/menu-recipes.json` (about 700 KB, loaded as a separate chunk when the Menu opens, 122 KB compressed). It chooses and reshapes, and computes nothing: nutrition, glycemic index and load per serving are copied as the recipe build computed them from the ingredient table; the grams of each ingredient are the table's whole-recipe grams divided by the servings. Left out: Dessert, Drinks & Smoothies and Side Dish (a week of those is not a week of meals).
- **Which meal a recipe is for** follows its category: Breakfast is breakfast; Snack & Appetizer is a snack; Salad, Soup & Stew, Poultry, Seafood, Beef/Pork/Lamb and Vegetarian are lunch or dinner; Sandwiches & Wraps are lunch.
- **Portions in quarters.** A recipe is scaled to the meal's energy share between half a serving and two, in steps of a quarter, and its load scales linearly with the portion.
- **What a person avoids.** Allergens and patterns are matched on the recipe's name and ingredient names with the same patterns as everywhere else; a food excluded by hand is looked for by its words (the id's parts and the name's words) in the ingredients and the title. Over-matching is the cheap mistake. Forty weeks per restriction are tested for gluten, vegan, peanuts and tree nuts, and an excluded egg.
- **Variety.** Choosing the single best-fitting dish brought the same dishes back every third day (162 different dishes in forty weeks). The generator now draws among the dishes within a margin of the best score, up to 100, favouring the best, and passes over any dish already on the week for as long as six fresh ones remain. Forty weeks: 318 different dishes, no dish repeated inside a week, calories 1,650 of 1,660 on average, and no day over the glycemic-load budget (the mean day is 18 of 49: the generator is biased low on purpose).
- **The shopping list is one line per food** whichever dish it comes from; under 5 g across the week stays in the recipe.
- **Add to today** puts a recipe into the diary as one entry that carries the numbers it was planned with (a snapshot, as for a meal from an answer), shown with the portion in servings and a "recipe" tag; a curated dish still goes in food by food.
- **A stored week is rebuilt once, differently,** the first time after this change, because the library it is rebuilt from is larger. It is stable after that.
- **Not done:** more American recipes. Writing a first batch of 100 to 150 familiar dishes, composed from the ingredient table and priced by the same build, is the next step (waiting for a yes), and a dietitian's read of whatever the menu offers is WS2.

## Batch of familiar American recipes (11 October)

`data/recipes-db/recipes_12.jsonl` adds 111 recipes (`DB-1001` to `DB-1111`; the first 1,000 ids do not move), drafted from the existing 350-ingredient table only: no new ingredient and no new glycemic index. `build.py` prices them like the rest. `data/recipes-db/preview_batch.py` is a dry run that prices a draft and flags a missing ingredient, a name already taken, a heavy glycemic load or an odd serving before anything is added; `drafts/PREVIEW.txt` is the table the owner saw. Eight near-duplicates of existing dishes were dropped from the draft, and a ninth was dropped and two renamed after the agent eval caught "grilled salmon" answering with a burger recipe: a second almost-identical recipe makes the engine ask "which one?", and a dish that borrows a plain food's name takes its place. Check a batch against plain phrases (`eval/coverage`) before adding it. The menu library grew from 880 to 969 recipes (the catalogue from 6,806 to 6,917 records); `eval/cases.json` has seven `new-recipes` resolve cases. Not yet read by a dietitian (clinical review Q29).
