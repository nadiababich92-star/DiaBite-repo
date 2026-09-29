# What DiaBite does, and what it will not do

DiaBite answers one question for people with type 2 diabetes, prediabetes or
insulin resistance: *can I eat this, how much, and with what?* It turns a
sentence about a meal into grams and glycemic load, holds a daily budget, and
shows the arithmetic behind every number.

## What it does

- Reads a meal written in plain language and resolves each food to a record in
  a verified database.
- Computes carbohydrate, available carbohydrate (total minus fibre), glycemic
  index and glycemic load for the meal, and compares it against what is left of
  the day's budget.
- Offers lower-load alternatives at the same portion size, filtered by the
  allergies and exclusions the person gave at onboarding.
- Shows the full calculation and every tool call behind an answer.

## What it will not do

- **No insulin or medication dosing.** Not units, not carb ratios, not
  correction factors, not timing. These are refused and referred to the
  person's care team, without exception.
- **No diagnosis, and no treatment advice.** It is a reference tool, not
  medical advice, and says so before any number.
- **No numbers it did not compute.** The model never produces a nutritional
  figure; a verifier rejects any answer containing a number no tool returned.
- **No guessing at unknown food.** A food that is not in the database is named
  as unknown rather than swapped for something similar.

## Who it is not for

People on mealtime insulin or an insulin pump, pregnancy and breastfeeding,
children under 18, and anyone whose therapy is dosed against carbohydrate.
Onboarding detects these and says plainly that this is the wrong tool, rather
than serving them badly.
