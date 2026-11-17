# Sources for branded and restaurant foods (worklist 19)

Researched 17 November 2026 from the providers' own pages where they would open, otherwise from search summaries (marked). Not legal advice: every licence reading below goes to the legal consultant before anything is stored.

## What the product needs

- A branded or restaurant item is costed for **carbohydrate, fibre and calories only**, with no glycemic load (`gl: null`), and a meal that contains one is **partial and never "fits"** (CLAUDE.md rules 3 and 4).
- A food the source lacks comes back `unknown`, never a neighbour's record.
- Today: 754 USDA branded products chosen by `scripts/build-branded.py` from a wanted list; no barcode field kept; no restaurant items at all. A chain's menu item (a guacamole chicken burrito) is answered `unknown`.

## Branded (packaged) foods

| Source | Licence and cost | Coverage | Fit |
|---|---|---|---|
| **USDA FoodData Central, Branded Foods** | Public domain, CC0 1.0; free | Label data supplied by manufacturers, US market, updated monthly (last entry I found: 20 Aug 2026, v15.4). Each record carries a GTIN/UPC. Size: a USDA slide says 368,000+ products, a third-party page says about 260k; **not confirmed from a primary page** | Already our source. Keeps the rules: no restrictions on storing or mixing |
| **Open Food Facts** | ODbL (attribution **and share-alike**); contents under the Database Contents Licence | Crowd-sourced, worldwide; US coverage and quality uneven (no US figures found) | Share-alike risk: a database that combines OFF data with ours may have to be released as open data. Not recommended for the catalogue |
| **FatSecret Platform** | Basic: free, 5,000 calls/day, attribution, US only, no barcode lookup. **Premier Free**: free for startups under US$1M revenue and under US$1M raised, non-profits, students; unlimited calls, UPC barcode, "custom caching and data storage permissions" (terms not published). Premier: on request, no attribution | US foods; restaurant coverage is claimed on its platform page, **not verified per edition** | Realistic second source for barcodes and restaurants if its storage terms allow what we need |
| **Edamam** | Commercial; terms forbid caching unless Edamam permits it | About 1,000,000 foods incl. about 130,000 branded restaurant items (their page) | Caching ban conflicts with "numbers are computed from our own records" |
| **Nutritionix** | Prices not public (its business page answered HTTP 402). Its FAQ forbids showing one user's cached result to another; a monthly CSV export of the whole database is offered | Largest restaurant and grocery set; UPC lookup | Only via a licence for the export, so a sales conversation and a budget |
| **Spoonacular** | Commercial | Packaged foods and chain menus | If access ends, all data ever obtained must be deleted: not compatible with a stored catalogue |

## Restaurant foods

- **No free, current, complete dataset exists.**
  - **MenuStat** (NYC Health Department) is the only open one. The NYC Open Data copy, "DOHMH MenuStat (Historical)", holds **65,219 rows for 2017 and 2018 only**; its data was last updated on 4 February 2019, and no licence is stated on the dataset. Menus change yearly, so it is seven years old.
  - **`menustat.org` now redirects to an unrelated domain (`lumillamingus.com`).** I did not open it and nothing should link to it.
- **The chains publish the figures themselves.** FDA menu labeling: chains with 20 or more locations must show calories on the menu and give total carbohydrate, fibre, sugars and the other nutrients in writing on request (FDA). Carbohydrate per standard item is therefore public and per chain: the source for a curated list, subject to each site's terms (a legal question).
- **The figure can be wrong, and for a person on insulin or sulfonylureas that matters.** A 2011 JAMA laboratory study of 269 items from 14 chains found 19% of items differed by more than 100 kcal from the stated value, with the largest errors in carbohydrate-rich sides, soups, salads and desserts at sit-down restaurants. Consumer Reports found portions varying widely between locations of one chain. We have also heard a first-hand account of a restaurant's published carbohydrate figure leading to a severe low. A restaurant item must therefore be shown as **the chain's published figure, dated, labelled an estimate, and never "fits"**.

## Recommendation (owner's decisions marked)

1. **Branded: stay on USDA, grow it by demand.** Feed `branded_wanted.txt` from the real "unknown" questions (the 30-day check of worklist 63 already lists them), refresh quarterly from the monthly release, and **keep the GTIN in the record now** so barcode scanning (worklist 25) needs no second load. Do not ingest the whole 260k to 368k: the resolver would start choosing among near-identical names, which is the neighbour problem of rule 3.
2. **Restaurants: a small curated list first.** A new `kind: 'restaurant'`, handled exactly like `branded` (carbohydrate, fibre, calories; `gl: null`; partial; never "fits"), with the chain's own published table as the source, its date, and the wording "the chain's published figure; real portions vary". Start with the 20 to 30 chains testers actually name. About 3 to 5 days, as in the post-course plan.
3. **A commercial source only when money exists.** First ask FatSecret for the written storage terms of **Premier Free** (the app qualifies today); ask Nutritionix for a quote on its CSV export only if the investment closes. Open Food Facts and Spoonacular: no.

**Decisions for Nadia:** (a) a `restaurant` kind with the rules above; (b) whether to apply for FatSecret Premier Free (creating an account is hers to approve); (c) sending the licence readings, and chain-site terms, to the legal consultant with worklist 38 and 58.

## Not verified

- The USDA product count (368,000+ vs about 260,000) and USDA's own accuracy figures: its data-quality PDF could not be read here; no study of carbohydrate error specifically in the branded database turned up (the University of Minnesota's Nutrition Coordinating Center notes brand values do not always match the label).
- Nutritionix and FatSecret Premier prices and storage terms.
- Whether FatSecret's free editions include US restaurant items.

## Sources

- FoodData Central log and documentation: https://fdc.nal.usda.gov/log.htm, https://fdc.nal.usda.gov/GBFPD_Documentation
- NYC Open Data, DOHMH MenuStat (Historical): https://data.cityofnewyork.us/d/qgc5-ecnb
- FDA menu labeling requirements: https://www.fda.gov/food/food-labeling-nutrition/menu-labeling-requirements
- FatSecret editions and terms: https://platform.fatsecret.com/api-editions, https://platform.fatsecret.com/terms
- Open Food Facts licence: https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side
- Nutritionix developer FAQ (as mirrored): https://docx.syndigo.com/developers/docs/faqs
- JAMA 2011 restaurant calorie accuracy study: https://pmc.ncbi.nlm.nih.gov/articles/PMC2838242
