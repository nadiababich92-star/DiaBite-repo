# How a person's daily targets are computed

Every target is a formula with visible inputs, not a model's opinion. The same
inputs always give the same numbers.

## Energy

Basal metabolic rate uses **Mifflin-St Jeor** from sex at birth, age, height
and weight, multiplied by an activity factor (1.2 sedentary to 1.725 very
active). Losing weight applies a 15% deficit, gaining a 10% surplus, and a
floor of 1,200 kcal for women and 1,500 for men applies regardless — below that
a day cannot carry enough protein and micronutrients.

## Carbohydrate, protein, fat, fibre

Carbohydrate is a share of energy set by the chosen approach: moderate ~40%,
low ~26%, very low ~15%. Protein is 1.6 g per kg of body weight when losing
weight and 1.4 g otherwise. Fat takes the remaining calories. Fibre is 14 g per
1,000 kcal.

## The daily glycemic-load budget

Glycemic load is `GI x available carbohydrate / 100`, where available
carbohydrate is total carbohydrate minus fibre. The daily ceiling is derived
from the carbohydrate target at a mean diet GI of about 45 in diabetes and 50
in prediabetes and insulin resistance, capped at 120.

## Rules that change those numbers, and why

- **Chronic kidney disease**: protein capped at 0.8 g/kg; on dialysis raised to
  1.1 g/kg, because dialysis removes amino acids.
- **GLP-1 medication**: protein floor raised to 1.2 g/kg — on a GLP-1 the usual
  problem is eating too little protein, not too much of anything.
- **Age 65 and over**: protein floor of 1.0 g/kg; very low carbohydrate is not
  offered.
- **History of disordered eating**: no calorie deficit, and no "budget
  remaining" framing.
- **BMI under 18.5**: no calorie deficit.
- **Gastroparesis**: fibre target lowered, because the usual "more fibre"
  advice makes symptoms worse.
- **SGLT2 inhibitor, sulfonylurea or basal insulin, gout**: very low
  carbohydrate is blocked or needs a clinician first — ketosis can trigger DKA
  at normal glucose on an SGLT2 inhibitor, and cutting carbohydrate with
  insulin or a sulfonylurea risks a hypo.

Each rule that changed a number is shown to the person in the same screen as
the number, in one sentence.
