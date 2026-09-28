# Where the numbers come from

The food database holds 1,436 records in three layers.

- **350 ingredients**: nutrients per 100 g from USDA FoodData Central, glycemic
  index from the International Tables of Glycemic Index (2021, University of
  Sydney).
- **86 seed foods**: published averages for everyday US items the ingredient
  table lacks — white rice, pasta, pizza, bread.
- **1,000 recipes**: nutrients summed from their ingredients; dish glycemic
  index computed as a carbohydrate-weighted mean of ingredient GI
  (Wolever & Jenkins), never estimated.

## What has actually been verified

51 ingredient glycemic-index values have been checked against published tables.
Everything else is marked **unverified** in the app rather than borrowing the
credibility of the ones that were checked. A cross-check of 88 ingredients
found 24 values lower in our table than published figures, 5 higher and 8 with
no published match; those are open work, not settled facts.

## What the database does not cover

Packaged and restaurant foods. The ingredient-first method cannot derive them,
and they need a different source. Asked about one, the product says it does not
have that food instead of guessing.

## How a food is found

Food names are embedded with a sentence-transformer model and matched by
cosine similarity, with an everyday-name layer for phrases like "spaghetti".
A confident match proceeds; a close second asks one clarifying question; a
weak match is reported as unknown. Nothing in this pipeline invents a value:
retrieval chooses a record, and the record carries the numbers.
