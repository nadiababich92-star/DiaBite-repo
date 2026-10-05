# DiaBite — clinical review

**For: Dr Dan Nadeau** · Prepared by Nadia Babich · 5 October 2026

Thank you, I appreciate it. It is long, so here is how to read it in the time you actually have.

DiaBite answers one question — *can I eat this?* — for adults with type 2 diabetes, prediabetes or insulin resistance in the US. Someone describes a meal in their own words; the app matches the foods against a database of 6,054 records, computes carbohydrate, fibre, glycemic index and glycemic load with a deterministic engine, and says whether the meal fits what is left of their day. It never gives a dose, never diagnoses, and never lets a language model produce a number.

**In my first message I named three things I cannot check myself.** They are the ones I would most like you to go at, and they are Q3, Q4 and Q7:

- **Q3 and Q4 — protein.** 1.6 g/kg while someone is losing weight (above the range usually quoted for type 2 diabetes), a cap of 0.8 g/kg for anyone who reports chronic kidney disease **without my knowing their eGFR or stage**, and a floor of 1.2 g/kg on a GLP-1. Another reviewer found that these last two collided, which I have fixed; section "What one review has already changed" says how.
- **Q7 — the glycemic-load ceiling.** The daily limit is something I constructed: carbohydrate target times a target mean diet GI, divided by 100. It is not from a guideline, and I do not know whether it is defensible or only looks precise.

**If you have a little longer**, add **Q12**, because you will have an opinion on it that I do not: when someone states a glucose under 70, the app stops the conversation and says to seek help. It deliberately does not tell them to take fast-acting carbohydrate. I am not sure that is right.

Your specialty line puts nutrition next to endocrinology, so if a question does not apply to how you practise, skip it; if one seems to be missing, tell me which.

**How to comment:** select any text and use the comment button, or reply to me with question numbers. Partial answers are welcome, and one line is worth more to me than silence.

---


## What one review has already changed

Dr James LaSalle read this on 2 October. Two things changed the same day, so
they are recorded here rather than left for you to find again:

- **A protein bug.** He wrote: *"protein needs are greater but many diabetics
  have eGFR levels that could be contradictory."* He was right, and it was a
  bug rather than a tension: the GLP-1 protein floor ran **after** the kidney
  cap and took a maximum, so a patient with chronic kidney disease on a GLP-1
  was pushed from 0.8 g/kg back up to 1.2 — while the app displayed both
  sentences at once. The kidney number now wins, and the app says the two pull
  against each other and to ask their own clinician. See Q4.
- **Brittle diabetes** joined the conditions, at his suggestion. It blocks the
  very-low-carbohydrate option and says plainly that a daily ceiling is an
  average, and an average is the least useful thing for glucose that swings.

He also asked three questions this document does not yet answer; they are
Q18 to Q20 at the end.

## What the product does, and what it never does

DiaBite answers one question — *can I eat this?* — for adults with type 2
diabetes, prediabetes or insulin resistance in the US. A person describes a
meal in their own words; the app resolves the foods against a database of 6,054
records, computes carbohydrate, fibre, glycemic index and glycemic load with a
deterministic engine, and says whether the meal fits what is left of their day.

**It never:** gives an insulin or medication dose, changes a prescription,
diagnoses, promises an outcome, or computes a number with a language model.
Every number shown is produced by the engine and machine-checked against that
engine's output before display; a disclaimer precedes any number.

**Where a language model is used:** reading what the person wrote, choosing
which database records they meant, and writing the sentence around the numbers.

---

## A. Who we turn away

Three profiles get a plain "this is not for you" and no targets at all.

| Profile | What we say |
|---|---|
| Under 18 | Paediatric diabetes is managed differently, with growth and puberty in the picture — use the plan the paediatric team gave |
| Pregnant or breastfeeding, or gestational diabetes | Carbohydrate needs rise rather than fall; targets belong with an OB or diabetes educator |
| Mealtime insulin or an insulin pump | The numbers that matter are ratios and correction factors, and this app must never touch those |

Kidney disease, disordered eating and a history of it do **not** exit; they
change the numbers instead (section B) and trigger a referral message.

> **Q1.** Are these the right three exits, and is anyone missing? We have gone
> back and forth on type 1 without a pump — currently allowed, with the more
> cautious settings.
> **Q2.** Should a history of disordered eating be an exit rather than an
> adjustment?

---

## B. The daily targets

Computed in the browser, shown with every constraint that changed them and why.

### Energy

| Step | What we do |
|---|---|
| Resting energy | Mifflin-St Jeor. "Prefer not to say" takes the midpoint of the two sex constants |
| Activity | ×1.2 sedentary, ×1.375 light, ×1.55 moderate, ×1.725 high |
| Goal | −15% to lose, +10% to gain, maintenance otherwise |
| No deficit when | BMI under 18.5, or a history of disordered eating (maintenance instead, and no "budget left" framing) |
| Floor | 1,200 kcal for women, 1,500 for men, whatever the arithmetic says |

### Macronutrients

| Target | Rule |
|---|---|
| Carbohydrate | 40% of calories on "moderate", 26% on "low", 15% on "very low" |
| Protein | 1.6 g/kg when losing weight, 1.4 g/kg otherwise |
| — kidney disease | capped at 0.8 g/kg; 1.0 g/kg if they mention kidney trouble without a diagnosis; **raised** to 1.1 g/kg on dialysis |
| — on a GLP-1 | floor of 1.2 g/kg, because the risk becomes too little protein rather than too much food — **unless a kidney answer caps it lower, in which case the cap wins and the tension is stated** |
| — age 65+ | floor of 1.0 g/kg |
| Fat | whatever calories remain, never below 30 g |
| Fibre | 14 g per 1,000 kcal; capped at 15 g with gastroparesis |

> **Q3.** Is 1.6 g/kg while losing weight defensible for this population, or too
> high? It is above the range usually quoted for type 2 diabetes.
> **Q4.** We cap protein at 0.8 g/kg for anyone who reports chronic kidney
> disease, **without knowing their eGFR or stage**. Is a single cap acceptable,
> or does an unstaged cap do more harm than good? And now that the kidney cap
> beats the GLP-1 floor rather than the other way round, is *keeping the lower
> number and naming the conflict* the right resolution — or should the app
> decline to set a protein target at all when both are true?
> **Q5.** Are 1,200 and 1,500 kcal the right floors, and should they scale with
> body size rather than sex?
> **Q6.** Fibre at 14 g/1,000 kcal — right target, right units?

---

## C. The glycemic-load budget (the least standard thing we do)

This is our own construction and the part we would most like challenged.

The app gives each person a **daily glycemic-load ceiling**, and every meal is
judged against what is left of it. It is derived, not measured:

```
GL budget = carbohydrate target (g) × target mean diet GI ÷ 100,   capped at 120
target mean diet GI = 45 for diabetes (and when the type is unconfirmed)
                      50 for prediabetes and insulin resistance
```

So a 1,653 kcal low-carb day gives 107 g of carbohydrate, and at a mean GI of
45 that becomes a ceiling of **48 GL for the day**.

Per meal we band the load as low / medium / high, and the day's consumed load
is banded against the daily ceiling.

> **Q7.** Is a daily glycemic-load ceiling a defensible way to steer eating in
> type 2 diabetes, or does it invite precision nobody should claim?
> **Q8.** Are 45 and 50 sensible targets for a mean diet GI, and is 120 the
> right absolute cap?
> **Q9.** If you would not use GL this way, what would you put in its place
> that is still computable from a food database — available carbohydrate
> alone?

---

## D. What we refuse to let someone choose

"Very low carb" (15% of calories) is blocked, with the reason shown, when the
person reports:

| Condition | Our reasoning |
|---|---|
| An SGLT2 inhibitor | Ketosis can trigger euglycaemic DKA; the FDA label warns of it |
| A sulfonylurea or basal insulin | Cutting carbohydrate this far risks hypoglycaemia unless the dose changes, which only their clinician can do |
| Gout | Ketosis raises urate |
| A history of disordered eating | We do not offer the most restrictive option |
| Age 65+ | Protein and micronutrient intake usually suffer |

We also show standing advice without changing numbers: keep carbohydrate steady
meal to meal on insulin or a sulfonylurea; do not fast or go ketogenic on an
SGLT2 inhibitor; sodium under 2,300 mg with hypertension; saturated fat under
10% of calories with established cardiovascular disease.

> **Q10.** Is blocking, rather than warning, the right call for each of these?
> **Q11.** Is there a medication or condition we let through that should be
> blocked — metformin with a very low carbohydrate intake, for instance?

---

## E. The safety rules

These run **before** the language model, as plain pattern matching, so no
prompt can talk the product out of them.

| Rule | Fires on | What the user gets |
|---|---|---|
| Dosing | Any question about insulin units, doses, carb ratios, correction factors | Refusal and a referral to their care team |
| Red flag | Confusion, fainting, chest pain, vomiting; a stated glucose ≥ 300 or < 70 mg/dL | "Seek help now", and the conversation about food stops |
| Prolonged fast | Statements about not eating for a long period | A referral, no meal talk |
| Referral | Pregnancy, kidney disease, disordered eating raised in conversation | Says our targets were never derived for this, and to ask a clinician who knows them |

> **Q12.** Are ≥ 300 and < 70 mg/dL the right thresholds to stop the
> conversation, and is stopping the right response at 70 rather than telling
> the person to take fast-acting carbohydrate? We deliberately do not give
> hypoglycaemia instructions — please tell us if that is the wrong call.
> **Q13.** Is there a symptom or phrase that must stop the conversation and
> currently does not?

---

## F. What the advice side may say

A second agent answers general questions ("is brown rice better than white
rice?"). Its rules: **no numbers at all** — no GI, no grams, no calories,
because a number there would be one nobody checked; no dosing; no diagnosis; no
promised outcomes; and pregnancy, kidney disease and disordered eating are
declared out of scope with a referral.

It may compare foods **in direction without quantity** — that white rice raises
glucose faster than pearl barley, that fibre and fat slow a rise, that a food
eaten after protein lands differently.

Four sample answers are attached separately for your read: brown vs white rice,
why morning glucose runs high, whether to stop eating fruit, and whether keto
is sensible in type 2 diabetes.

> **Q14.** Is "direction without quantity" a safe line to draw?
> **Q15.** In the four sample answers, is anything said that a clinician would
> not say?

---

## G. Where the food numbers come from

| | |
|---|---|
| Nutrients | USDA FoodData Central; a seed table of published averages for everyday US foods |
| Glycemic index | International Tables of Glycemic Index and Glycemic Load Values (2021) |
| Available carbohydrate | total carbohydrate − fibre |
| Glycemic load | GI × available carbohydrate ÷ 100 |
| A recipe's GI | carbohydrate-weighted mean of its ingredients (Wolever & Jenkins) |
| Coverage | 6,054 records, in three layers: 351 ingredients and ~85 everyday foods curated by hand, 1,000 recipes composed from them, and 4,618 USDA Survey (FNDDS) foods — "foods as eaten" — added on 1 October. **13% of the food phrases in our test set still resolve to nothing**, almost all of them branded: Oreos, a KIND bar, a Starbucks frappuccino |
| A food we cannot cost | A record with no published GI and real carbohydrate in it is **kept out of the database entirely**, because our arithmetic would otherwise report its glycemic load as zero. That is why a pepperoni pizza comes back as "I do not have that food" rather than as a number — see Q17 |

Records a human has checked are labelled **checked** with a date in the app;
the rest are labelled **unverified**, visibly, on every answer.

> **Q16.** Is the carbohydrate-weighted mean an acceptable way to give a mixed
> dish a GI, given that fat, protein and cooking all move it?
> **Q17.** For branded foods with no published GI, is it better to give
> carbohydrate alone and say the glycemic load cannot be computed, or to say
> nothing at all? This decision is open and your answer would settle it.

---

## H. Three questions the first review opened

Dr LaSalle raised these and they are not settled. They are last because they
are the largest.

> **Q18.** He wrote: *"calories and counting them have a long history of
> failure."* Our daily ceiling is **derived from the calorie target** —
> carbohydrate is a share of energy, and the load ceiling is a share of
> carbohydrate. So the objection is not beside our design, it is inside it.
> Does a daily load ceiling change what someone eats, or is it the same
> failure in a different unit?
> **Q19.** On a GLP-1: we raise protein and say nothing about lean mass or
> bone. What should a nutrition tool say, if anything, to someone losing
> weight quickly on these drugs?
> **Q20.** He suggested splitting the targets three ways — overweight,
> prediabetes, established type 2 — rather than treating them as one
> population with a switch. Would that change the numbers, or only the
> wording?

## What we will do with your answers

Anything you flag becomes a change in the code, a test case in the evaluation
suite, or a documented decision with your objection recorded next to it. The
targets, the blocks and the safety rules are constants in one file; changing
them is minutes of work, and every change is re-tested automatically against
203 behavioural checks.

If there is one thing on this list you would fix first, that is the thing we
would most like to know.


---

# Appendix A — four answers, as the product gave them


Produced by the running product. Nothing is edited. The advice side of DiaBite states no numbers at all — not even a glycemic index — because a number there would be one nobody checked.

## Is brown rice better than white rice?

Usually, yes: brown rice is a better choice than white rice for blood sugar because it keeps the bran and fibre, so it tends to raise glucose more slowly. White rice is more refined and usually lands faster.

That said, the best choice depends on the whole meal and your own response. Rice eaten with protein, vegetables, and healthy fat often affects blood sugar less than rice eaten alone.

If you want, tell me the rice dish and portion and I can help you compare it with other options.

## Why is my blood sugar highest in the morning?

Blood sugar is often highest in the morning because your body releases hormones overnight that tell the liver to put extra glucose into the blood. This is called the dawn phenomenon.

It can also happen if:
- you ate late or had a high-carb evening snack
- you had poor sleep or stress
- your body is becoming more insulin resistant, which means your cells respond less well to insulin

If morning highs are frequent, your care team can help look for the pattern and what is driving it. If you have confusion, fainting, chest pain, vomiting, or a very high or very low reading, seek help now.

## Should I stop eating fruit?

Usually, no. Fruit can fit well with type 2 diabetes, prediabetes, and insulin resistance. Whole fruit is usually a better choice than juice or dried fruit because the fibre helps slow the rise in blood glucose. Pair fruit with protein or fat, like yogurt, nuts, or cheese, if you notice it hits you hard on its own.

It’s a good idea to limit fruit juice, smoothies, and fruit canned in syrup.

If you have kidney disease, are pregnant or breastfeeding, or have a history of disordered eating, please check with a clinician who knows your situation.

## Is keto sensible for type 2 diabetes?

Keto can be sensible for some people with type 2 diabetes, but it is not the best fit for everyone.

It may help some people reduce blood sugar swings because it cuts carbs sharply, but it can also be hard to follow, and it can be risky if you use diabetes medicines that can cause low blood sugar. If you have kidney disease, are pregnant or breastfeeding, or have a history of disordered eating, it is not a good DIY choice.

A safer way to decide is to review your medicines and goals with your diabetes care team. If you want, I can help compare keto with a less strict lower-carb approach.

