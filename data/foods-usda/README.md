# Food coverage layer (USDA FoodData Central)

`foods_usda.json` — 13,169 generic US foods with nutrients per 100 g, household portions,
and a glycemic index assigned by a five-level confidence scheme.

| Source | Foods | Why |
|---|---|---|
| Survey / FNDDS 2021-2023 | 5,431 | "Foods as eaten" in NHANES — what people actually type into a diary, including mixed dishes and restaurant-style items |
| SR Legacy (2018-04) | 7,637 | Base ingredients, referenced by FNDDS recipes |
| Foundation Foods (2025-04-24) | 101 | Newest analytical values |

All three are US Government works in the public domain (fdc.nal.usda.gov).

## GI assignment

Method: Aston LM, Jackson D, Monsheimer S, et al. Developing a methodology for assigning
glycaemic index values to foods consumed across Europe. *Obes Rev* 2010;11(1):92-100.

| Level | Meaning | Foods |
|---|---|---|
| 1 | measured value for this food, ISO 26642:2010-compliant study | 608 |
| 2 | published measured value for this food | 439 |
| 3 | equivalent food, different preparation, **or** computed from the dish's own USDA ingredient breakdown (carbohydrate-weighted mean, Wolever & Jenkins 1986) | 3,160 |
| 4 | estimated from the median of resolved foods in the same USDA category, only where that category is homogeneous (>=5 foods, interquartile spread <=25 GI points) | 2,077 |
| 5 | **not assigned** — Aston's level 5 puts a nominal 70 here; DiaBite leaves it unknown so the agent can say so | 3,148 |
| n/a | <2 g available carbohydrate per 100 g: GI carries no meaning | 3,737 |

Every record carries `gi_basis` in plain English, so any number can be traced to its origin.

Rebuild: `python3 build_foods.py` (expects the three FDC csv bundles unzipped in the path
named at the top of the script). Coverage check: `python3 coverage_test.py`.
