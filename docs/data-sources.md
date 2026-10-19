# DiaBite — data sources and their terms

*Roadmap item 3.6. Written 19 October 2026 from the repository (the `meta` of each data file, `data/foods-usda/README.md`, `data/recipes-db/gi_sources.py`, `package.json` and the installed packages). It states what each source is, what DiaBite takes from it, and what the terms are **as far as they are known**. A line marked **to confirm** is not a legal conclusion: no counsel has read this (the roadmap's use-of-funds table names counsel as a paid item).*

## Food and glycemic-index data

| Source | What DiaBite takes from it | Terms, as known | Status |
|---|---|---|---|
| **USDA FoodData Central**: Survey/FNDDS 2021-2023, SR Legacy (2018), Foundation Foods (2025). `data/foods-usda/foods_usda.json`, 13,169 foods; about 4,600 of them are the coverage layer | Nutrients per 100 g, household portions, food names | US Government works, public domain (`data/foods-usda/README.md`); FoodData Central states its data carries no copyright | Clear. Cite the source on every answer (done: the receipt's source line) |
| **USDA Branded Foods** (`data/foods-usda/branded_common.json`, 754 products; the "unrated" kind adds 813 survey foods with no glycemic index) | Label nutrients and serving sizes; never a glycemic load | Same FoodData Central data; the label data is supplied by manufacturers and published by USDA | Clear for the nutrient data. **To confirm** before commercial use: brand names appear in answers (nominative use) |
| **International tables of glycemic index and glycemic load values 2021** (Atkinson, Brand-Miller, Foster-Powell, Buyken, Goletzke; *Am J Clin Nutr* 2021;114(5):1625-1632) | Published glycemic-index values for foods; `data/gi-evidence/intl_tables_2021.json` holds 4,015 rows extracted from the tables | A journal article and its supplementary tables. DiaBite stores derived values and cites the paper | **To confirm:** the licence of the supplementary tables (copyright holder and whether commercial reuse of the values is allowed). Until then cite, do not republish the rows |
| **University of Sydney glycemic index database** (glycemicindex.com), downloaded 16 September 2026, `data/recipes-db/sydney_gi_db.json`, 4,384 rows | Cross-checking and "medium-confidence evidence" for ingredient glycemic indices (`gi_sources.py`, `gi_crosscheck.json`) | The file's own header: "© University of Sydney … for internal cross-check … not for redistribution in the product" | **A known item, deferred by the owner on 11 October:** ask the University for permission before commercial use. Until then the database file is not shown to users and the product is a demonstration. Name it as a known item on the use-of-funds slide |
| **Aston et al. 2010** (*Obes Rev* 11(1):92-100), the five-level scheme for assigning glycemic index | A method only: how confident an assigned index is (levels 1 to 5; level 5 is left unknown on purpose) | A published method, not data | Clear; cited in the data README |
| **Wolever & Jenkins 1986** | A formula only: the glycemic index of a mixed dish as the carbohydrate-weighted mean of its ingredients | A published method | Clear |
| **Recipes**, `data/recipes-db/recipes_*.jsonl`, 2,000 dishes | Names, ingredient lists, steps; nutrition and glycemic index are computed from the ingredient table, not copied | Written for DiaBite with AI assistance and edited by the owner; not copied from a website or a cookbook | **To confirm by the owner** before launch: that no recipe was taken from a third-party page, and the wording of the "AI-assisted" statement |
| **Hand-curated ingredients** (`data/recipes-db/ingredients.json`, 364) and everyday foods (`src/data/foods.ts`, 86) | USDA nutrients plus a glycemic index chosen from the sources above, with a provenance record in `data/gi-evidence/gi_provenance.json` | Derived from the sources above | As clear as its sources; verifying the 364 indices with a registered dietitian is a paid item |

## Models, libraries and services

| Item | Used for | Terms |
|---|---|---|
| **Xenova/all-MiniLM-L6-v2** (sentence-transformers, in the Hugging Face model hub), run locally in the engine | Choosing which food record a phrase means (embeddings); it never produces a number | Apache-2.0 (the model card) |
| **Azure OpenAI models in Azure AI Foundry** (`gpt-5.4-nano`, `gpt-5.4-mini`) | Reading a sentence and writing the answer around numbers the engine returned | Microsoft's product terms; the project's data stays in the Foundry project. **To confirm** at launch: the data-processing terms for health-related text |
| **Azure Speech** voice `en-US-Emma:DragonHDLatestNeural` | The narration of the demo videos | Microsoft's Speech terms; synthetic voice, disclosed as AI-voiced in the demo script |
| **Supabase** (Postgres, auth, pgvector), EU region (Ireland) | Accounts, profiles, diaries, feedback, the food index | Supabase terms; GDPR applies (see `docs/security/security-plan.md`). **To confirm:** a data-processing agreement at paid scale |
| **Fonts**: IBM Plex Sans and Mono, Literata, from Google Fonts | The interface and the deck | SIL Open Font License 1.1 |
| **npm runtime dependencies**: `react`, `react-dom`, `express`, `cors`, `jose`, `tsx`, `@supabase/supabase-js`, `@azure/ai-agents`, `@azure/ai-projects`, `@azure/identity` | The app and the engine | MIT |
| `@huggingface/transformers`, `openai` | The local embedder, the model client | Apache-2.0 |
| Dev only: `vite`, `@vitejs/plugin-react`, `@types/*` (MIT); `typescript` (Apache-2.0); `postgres` (Unlicense) | Build and scripts | Not shipped to users |

Read from each package's `license` field on 19 October 2026; transitive dependencies were not audited here. `npm audit` is part of the free security pass (roadmap 3.3).

## Figures quoted in the product documents

| Figure | Source | Opened |
|---|---|---|
| 40.1 million Americans with diabetes (12.0%); 115.2 million adults with prediabetes | CDC, *National Diabetes Statistics Report*, updated 16 September 2026 (2023 data) | 8 October 2026 |
| $412.9 billion, the cost of diagnosed diabetes in 2022 | American Diabetes Association, *Diabetes Care* 2023 (47:1:26), "Economic costs of diabetes in the U.S. in 2022" | 8 October 2026 |
| Competitor prices (tracking apps $60 to $80 a year; sensor apps $100+ a month) | A dietitian's market read, 8 October 2026, and the competitor review in the PRD | Not a published source: say "around" if challenged |

## What is not used

Open Food Facts, restaurant menus and brand websites are **not** data sources: a food from a restaurant chain or a brand comes in only through USDA Branded Foods, or not at all (the app then says it does not have the food).

## Before commercial use, in order

1. The University of Sydney permission (deferred by the owner on 11 October).
2. The licence of the International Tables' supplementary tables.
3. The owner's confirmation that every recipe is original.
4. Counsel on the Foundry data-processing terms and the Supabase agreement, together with the privacy policy (roadmap use of funds).
