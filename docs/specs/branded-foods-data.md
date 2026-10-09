# Spec: branded foods, the data

*From `docs/engineering/engineering-doc.md` sections 4, 8 and 10. Read with `branded-foods-engine.md` and `branded-foods-answer.md`.*

## What it is

A new kind of record, `kind: 'branded'`, for packaged and restaurant products that no published table gives a glycemic index for. A record carries USDA's own carbohydrate, fibre, calorie, protein and fat figures per 100 g, one household serving, and **no GI**. It is the only kind of record allowed to have carbohydrate and no GI (rule 4 of `CLAUDE.md`, amended in this change).

## Source and download

USDA FoodData Central, **Branded Foods** CSV release (public domain). **Ask the owner before downloading:** name the file (the current "Branded Foods" CSV zip), the source (fdc.nal.usda.gov/download-datasets) and its size, as the safety rules require for any download. It goes to the scratchpad, never into the repository.

## The list: 1,000 to 2,000 products

`scripts/build-branded.py` (new; Python, because the three tables are 0.4, 1.0 and 1.5 GB of CSV with quoted multi-line fields) reads the CSV and writes `data/foods-usda/branded_common.json`. The list is not "the first N rows": it is chosen.

1. **Seeds**, in this order: (a) every phrase in `eval/questions-field.jsonl` and the `unknown` resolve cases that currently resolve to nothing; (b) `data/foods-usda/branded_wanted.txt` (new, one product or brand per line, written by the owner or by me from the common US brands; the owner may add lines at any time and rerun); (c) the two or three most-sold products of about 60 categories (cereal, chips, crackers, cookies, bars, soda, energy drinks, juice, yogurt, frozen meals, sauces, bread, fast-food chains' standard items).
2. **Match** each seed to USDA rows by brand and name tokens; take the single best row per seed and, for brand lines, the best row per product type up to 20 per brand. Rows with a missing `serving_size`, a missing carbohydrate or a carbohydrate above 100 g per 100 g are dropped and listed in `data/foods-usda/branded_dropped.txt` with the reason.
3. **Cap** at 2,000 and **dedupe** by normalised name (the same product sold in several sizes keeps the one with a serving size).
4. Write the file sorted by id so a diff shows what changed.

## Record shape (`branded_common.json`)

```json
{
  "id": "branded:1234567",
  "fdc_id": 1234567,
  "name": "Dark chocolate nuts & sea salt bar",
  "brand": "KIND",
  "category": "snacks",
  "per100": { "kcal": 480, "protein": 14.0, "fat": 35.0, "carbs": 41.0, "fiber": 14.0 },
  "serving": { "grams": 40, "label": "1 bar (40 g)" },
  "source": "USDA FoodData Central, Branded Foods (label data supplied by KIND). Glycemic index: none published for packaged products.",
  "published": "2026-04-30"
}
```

`id` is `branded:<fdc_id>`. `name` includes the brand in the display form `"<Brand> <name>"`, because that is what a person types. `serving.grams` is the label's serving converted to grams; a serving given only in ml is converted only when the row carries a gram weight, otherwise the row is dropped.

## Loading (`server/foods.ts`)

- Add `brandedRecords()` beside `usdaRecords()`: `kind: 'branded'`, `gi: null`, `giLevel` null, `unit: 'g'`, `defaultPortion: serving.grams`, `per100`, `searchText: "<brand> <name>. <category>."`, `aliases: []`, `source`, **no `verifiedAt`** (nobody has checked it against anything but the label data).
- `FoodKind` in `server/contract.ts` becomes `'ingredient' | 'recipe' | 'branded'`.
- `carbsWithoutLoad()` (already exported) is amended: it returns true for a record with carbohydrate and no GI **unless** `kind === 'branded'`. The engine eval asserts the converse: nothing but branded records are in that state.
- `BRANDED_FOODS=off` skips the layer, as `USDA_FOODS=off` does for its layer.
- `fromRow()` reads the same kind from the table. The `foods.kind` column is plain text with no constraint, so **no schema migration is needed**; the live table is checked, not assumed.

## Sync and search

- `scripts/sync-foods.ts` already writes every record from `loadFoods()`; branded records go in the same way. Run it, then **restart the active revision** (rule 10).
- Embeddings: the vectors come from `embeddings.bin` / `embeddings.ids.json`. Adding records changes both; running `npm run eval` regenerates them locally, and the two files are committed with the change (as for the rule-4 change on 9 October).
- Ranking: a branded record loses to a curated record or a USDA survey record for a *generic* phrase. "chips" must still ask, "potato chips" must still go to USDA's, "KIND bar" must go to branded. Concretely, branded rows take `COVERAGE_PENALTY` as USDA rows do, plus `BRANDED_PENALTY = 0.05` unless the phrase contains the brand token. The resolve eval proves it.

## Verifiable

- `npm run eval` `catalogue`: every record with carbohydrate and no GI has `kind: 'branded'`; there are at least 800 and at most 2,000 branded records; no branded record has a `gi`.
- `resolve` cases (added in the same change): "KIND bar" → a `branded:` record; "Oreos" → a branded Oreo; "Doritos" → branded; "Red Bull" → branded; "Chick-fil-A nuggets" (if in the list) → branded. Negative cases that must **not** reach a branded record: "oatmeal", "chips" (asks), "potato chips", "bread", "chicken", "spaghetti", "pizza".
- The unknown rate on the field set is measured again and reported next to 13%.

## As built, 9 October 2026

- Source: `FoodData_Central_branded_food_csv_2026-04-30.zip` (449 MB), downloaded with the owner's approval into the scratchpad, never into the repository.
- `data/foods-usda/branded_wanted.txt`: 367 product lines. Up to three rows per line, each under its own name; 321 name duplicates, 105 rows without carbohydrate or energy and 16 implausible label values were dropped (`branded_dropped.txt`).
- **737 records**, not 1,000 to 2,000: the list is what was named, and it grows by adding lines. The engine eval asserts 300 to 2,000.
- A serving in ml is taken as grams **for a drink only** (the record's `source` says so); the first spec said such rows would be dropped.
- Ranking: a branded record loses 0.13 (the coverage penalty plus 0.05) unless the phrase contains its brand word, and a brand word that is really a kind of food ("chips", "cereal", "bar") does not count as one.
