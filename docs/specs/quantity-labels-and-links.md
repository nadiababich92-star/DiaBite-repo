# Spec — US household measures: reading USDA's labels, and tying more of our foods to USDA records

*Stage 2, from `docs/engineering/engineering-doc.md` (approved 18 November 2026). Decision of the owner: **a rule accepts the close links; she reads the doubtful ones**, and nothing is applied without that. Companion specs: `quantity-engine.md` (uses `readPortion`), `quantity-defaults.md`, `quantity-evals.md`.*

**No migration, nothing in `.env.example`.** One data file changes (`data/recipes-db/portion_mapping.json`); it reaches production only after `npx tsx scripts/sync-foods.ts` **and** a restart of the active revision (CLAUDE.md rule 10).

## Files

| File | Change |
|---|---|
| `server/foods.ts` | **`readPortion(label, grams, recordName)`** replaces `MEASURE_LABEL`; `householdMeasure` and `stepUnit` read rows through it |
| `scripts/export-usda-links.py` | candidates now come from **all three** USDA datasets (survey, SR Legacy, Foundation); adds the `decision` column; keeps earlier decisions when it rewrites the CSV |
| `data/recipes-db/usda-links.csv` | gains `decision` (`yes`, `no`, blank) and `auto` (`yes` when the rule accepts it) |
| `scripts/apply-portion-links.py` | **new**: the only writer of `portion_mapping.json` |
| `scripts/map-portions.py` | **retired as a writer**: it keeps writing `portion_mapping_draft.json` and the markdown draft and **stops** writing `portion_mapping.json` |
| `data/recipes-db/portion_mapping.json` | new entries from the script; never deleted by it |

## 1. `readPortion(label, grams, recordName)`

The USDA tables the catalogue already holds have **26,977 household rows** in **2,143 label shapes** (`data/foods-usda/foods_usda.json`: 7,378 rows on SR Legacy records, 5,394 on survey records, 35 on Foundation records). Today `MEASURE_LABEL` accepts only a bare unit word, so most of the survey tables are invisible. `readPortion` reads the leading unit word and keeps the rest as a qualifier.

```ts
export interface PortionRow {
  unit: 'cup' | 'tbsp' | 'tsp' | 'fl oz' | 'oz' | 'lb' | 'slice' | 'piece' | 'small' | 'medium' | 'large' | 'whole'
  size?: 'small' | 'medium' | 'large'     // only for slice
  qualifier: string                       // '' for a plain row; "chopped", "cooked", "mashed"... otherwise
  word: string                            // the word to say: "cup", "medium", "regular", "slice"
  grams: number
  label: string                           // USDA's own label, kept for provenance and display
}
export function readPortion(label: string, grams: number, recordName: string): PortionRow | null
```

`null` means the row is not used. A row is also dropped if `!(grams > 0)` or it fails `plausibleUnit` (the existing guard: an "oz" row is only one ounce if it weighs 27 to 29.5 g; a "fl oz" row 26 to 34 g; USDA writes "4 oz" as "oz" with the weight of four).

**The leading count.** A label begins with a count or none: `1`, `1/2`, `2` or nothing (`"tbsp"`, `"cup"`; SR rows come without it). **Only a count of 1 or no count is used**; a row that states a larger count (`"2 slices"`, `"4 oz"`) is dropped unless its unit is `oz` and `plausibleUnit` already accepts it.

### Label forms, as they occur, and what each reads to

Counts are the number of rows of that shape in the local file (`n`).

| Label shape (examples) | n | Reads to | Qualifier | Used by `gramsFor` |
|---|---|---|---|---|
| `cup`, `1 cup` | 4,509 | `cup`, word `cup` | `''` | yes |
| `cup (8 fl oz)`, `cup, nfs`, `cup (1 NLEA serving)` | 199 / 87 / 98 | `cup` | `''` for `(8 fl oz)` and `nfs`; **`NLEA`** for the serving one | yes, except NLEA |
| `cup, cooked` / `cup, cooked, diced` / `cup, chopped` / `diced` / `shredded` / `mashed` / `slices` / `cubed` / `melted` | 107 / 116 / 62 / 56 / 61 / 68 / 64 | `cup` | the words after the comma | **no** (a qualified cup weighs differently; kept for later) |
| `tbsp`, `tablespoon`, `1 tablespoon` | 536 + 390 | `tbsp`, word `tbsp` | `''` | yes |
| `tsp`, `teaspoon` | 167 + | `tsp` | `''` | yes |
| `fl oz`, `1 fl oz` | 920 | `fl oz` | `''` | yes |
| `fl oz (nfs)` | 120 | `fl oz` | `''` | yes |
| `fl oz (no ice)`, `fl oz (with ice)` | 126 / 113 | `fl oz` | `ice` | no |
| `oz`, `1 oz` | 3,143 | `oz` | `''` | yes, with `plausibleUnit` |
| `oz, cooked`, `oz, dry, yields`, `oz yields` | 110 / 57 / 124 | `oz` | the words | no |
| `lb` | 280 | `lb` | `''` | yes |
| `slice`, `1 slice` | 310 | `slice`, no size | `''` | yes |
| `medium or regular slice` | 72 | `slice`, size `medium` | `''` | yes |
| `large or thick slice` | 89 | `slice`, size `large` | `''` | yes |
| `small or thin/very thin slice` | 68 | `slice`, size `small` | `''` | yes |
| `slice, crust not eaten`, `slice, snack-size` | 65 / | `slice` | the words | no |
| `piece`, `1 piece` | 319 | `piece` | `''` | yes |
| `medium`, `1 medium` | 256 | `medium`, word `medium` | `''` | yes |
| `small`, `1 small` | 240 | `small` | `''` | yes |
| `large`, `1 large` | 399 | `large` | `''` | yes |
| `regular`, `1 regular` | 143 | `whole`, word `regular` | `''` | yes (`typical`) |
| `whole`, `1 whole` | 61 | `whole`, word `whole` | `''` | yes (`typical`) |
| `fruit`, `1 fruit` | many | `whole`, word `fruit` | `''` | yes (`typical`) |
| `item`, `1 item` | 60 | `whole`, word `item` | `''` | yes (`typical`) |
| `egg`, `1 egg`, `1 banana`, `1 regular carrot`, any `1 <word>` where `<word>` is a word of `recordName` | 113 + | `whole`, word as written | `''` | yes (`typical`) |
| `extra large`, `miniature`, `miniature/slider`, `miniature/bite size` | | none | | no |
| `cubic inch`, `surface inch`, `linear inch`, `Guideline amount ...`, `single serving ...`, `serving`, `calorie package`, `package (N oz)`, `can (N oz)`, `bottle (N fl oz)`, `jar`, `bar`, `packet`, `pouch`, `drink`, `scoop`, `sandwich`, `steak`, `fillet`, `patty`, `roast`, `chop`, `unit (yield ...)`, `piece, cooked, excluding refuse (yield ...)` | thousands | none | | no |

**Whole-class rows are capped at 600 g** (a "1 breast" of 1,769 g on a whole turkey breast, or a whole pineapple, is not what anyone means by one of it): above that the row is not used. **A candidate whose USDA name has a preparation word ours lacks ("cooked") is not auto-accepted**, and neither is one with more than two unexplained extra words (a variety such as "golden delicious").

**Why a qualified row is never matched in this version:** a person who says "a cup of rice" and a table that lists "cup, cooked" and "cup, dry" would be matched to the wrong one half the time; the plain "cup" rows are enough for the foods we map, and `readPortion` keeps the qualifier so the next version can match "a cup of chopped onion" to "cup, chopped".

### Regression rule (nothing a person sees today may change)

Before and after the change, for every record in the catalogue and every weight in `{ 5, 10, ..., 1500 }` g, `householdMeasure(rows, grams)` and `stepUnit(rows, grams)` return **the same value** for every row that `MEASURE_LABEL` accepted before. The only allowed differences are **new** measures from rows that were invisible. The check lists every record whose result changed; the build reports the count and reads a sample of 30 before it merges. (See `quantity-evals.md`, check Q7.)

## 2. Links: which USDA record's household rows a food of ours takes

`portion_mapping.json` maps one of our food keys (`ing:<id>`, `seed:<id>`) to one USDA record and keeps that record's rows. Today it has 186 entries; `data/recipes-db/usda-links.csv` lists all 450 of our curated foods: 186 `applied`, 232 `candidate`, 32 `none`.

### `scripts/export-usda-links.py` (changes)

1. **Candidate pool**: `survey_fndds`, `sr_legacy` and `foundation` records that have `per100.kcal`. (Today only the last two, which is why apples, bananas, onions have no candidate with rows.)
2. **Score** unchanged: nutrient `distance` plus `name_overlap`; the best record per food by `distance − 0.5 × name_overlap`.
3. **A candidate is only a candidate if it has at least one usable row** (`readPortion` not null) for a unit in `QUANTITY_UNITS`.
4. **`auto`** column: `yes` when **all** of: `distance <= 0.25`; `name_overlap >= 0.6`; the USDA name contains no word from the **modifier deny list** that our name does not also contain: `sweet, juice, milk, powder, dried, dry, canned, frozen, babyfood, baby, toddler, infant, flour, oil, sauce, soup, broth, cooked-with, fried, breaded, pickled, jam, jelly, syrup, nectar, smoothie, formula, bar, chips, cereal, snack`. (This is what keeps a sweet potato from being offered for a potato at distance 0.11, and orange juice from standing for an orange.) Otherwise `auto` is blank.
5. **`decision`**: blank on a first run. The script **reads the previous CSV first** and carries every `decision` and `auto` over by `key`, so the owner's reading is never lost when the table is regenerated. A food whose best candidate changed since she decided is marked `decision = ""` and the changed record is named in a new column `changed_since_decision`.
6. Output: unchanged columns plus `auto`, `decision`, `changed_since_decision`.

### `scripts/apply-portion-links.py` (new; the only writer of the mapping)

```
python3 scripts/apply-portion-links.py            # applies and prints what it did
python3 scripts/apply-portion-links.py --dry-run  # prints what it would do, writes nothing
```

1. Reads `usda-links.csv` and `portion_mapping.json`.
2. **Applies** a row when (`decision == yes`) **or** (`decision` blank and `auto == yes`). **Never** applies a row with `decision == no`, and never a `candidate` whose `decision` is blank and `auto` blank.
3. For each applied row writes `foods[<key>] = { fdc_id, usda_name, measures: [usable rows as { label, grams }], accepted_by }` where `accepted_by` is `"rule: distance<=0.25, overlap>=0.6"` or `"owner, <date>"` (the date the script ran, when `decision == yes`).
4. **Never deletes or rewrites** an existing entry that has an `accepted_by` of its own (the entries made by hand on 18 November: egg, bread, oats, cucumber, strawberries, blueberries). If an existing entry would change, the script lists it in `would_change` and leaves it.
5. Writes `portion_mapping.json` with `meta.rule` updated to describe both paths, and prints counts: applied by rule, applied by decision, skipped (`no`), skipped (no decision), unchanged.
6. Exits non-zero if a `fdc_id` is not in `data/foods-usda/foods_usda.json`.

### `scripts/map-portions.py` (retired as a writer)

Remove the lines that write `portion_mapping.json` (the `approved` block and its `write_text`); keep the draft output (`portion_mapping_draft.json`, the markdown). Add a docstring line: "This script drafts; `scripts/apply-portion-links.py` applies." Reason: running it would overwrite `portion_mapping.json` and drop every entry accepted by hand (it did not know the 18 November ones).

### The owner's reading

After the script has produced the first CSV with the new pool, the build reports: how many foods are `auto = yes` (applied without her), and how many are neither `auto` nor decided. **She reads only the `candidate` rows with `auto` blank, sorted by `distance` ascending**, marking `yes` or `no` in the `decision` column. The first batch to read is the **default-portion list** (`quantity-defaults.md`), about 30 foods, because those move numbers a person sees.

## Verifiable

- `npm run eval`: the `mapped` and `measure` blocks still pass; the new block `labels` (`quantity-evals.md`, Q5 to Q7) reads each label form in the table above to the intended `PortionRow` and checks the regression rule.
- `python3 scripts/apply-portion-links.py --dry-run` prints the counts before anything is written; the diff of `portion_mapping.json` is read before the commit.
- After deploy and sync: the live engine's `compute_meal` for each newly mapped food at one household unit returns the USDA row's grams (checked for five foods chosen across the new links).
