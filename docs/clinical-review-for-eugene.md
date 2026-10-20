# DiaBite — clinical review

**For: Eugene Kaganovich, RN, BSN, CDE** · Prepared by Nadia Babich · first sent 8 October 2026, rewritten for the current product on 20 October 2026

This document is every decision DiaBite makes about a person, written down so that someone who does this work every day can tell me where it is wrong. It is not a pitch. Where to start, and what changed since 8 October, is in the covering email; read as much or as little as you have time for.

**How to comment:** select any text and use the comment button, or reply to me
with question numbers. Partial answers are welcome.

---


## What one review has already changed

A physician read an earlier version of this on 2 October. Two things changed the same day, so
they are recorded here rather than left for you to find again:

- **A protein bug.** The reviewer wrote: *"protein needs are greater but many diabetics
  have eGFR levels that could be contradictory."* The reviewer was right, and it was a
  bug rather than a tension: the GLP-1 protein floor ran **after** the kidney
  cap and took a maximum, so a patient with chronic kidney disease on a GLP-1
  was pushed from 0.8 g/kg back up to 1.2 — while the app displayed both
  sentences at once. The kidney number now wins, and the app says the two pull
  against each other and to ask their own clinician. See Q4.
- **Brittle diabetes** joined the conditions, at the reviewer's suggestion. It blocks the
  very-low-carbohydrate option and says plainly that a daily ceiling is an
  average, and an average is the least useful thing for glucose that swings.

The reviewer also asked three questions this document does not yet answer;
they are Q18 to Q20 at the end.

## What the product does, and what it never does

DiaBite answers one question — *can I eat this?* — for adults with type 2
diabetes, prediabetes or insulin resistance in the US. A person describes a
meal in their own words; the app resolves the foods against a database of 8,633
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
>
> *Update, 6 October: a reading of exactly 70 mg/dL (3.9 mmol/L) does not trigger
> the rule, and when I tried that sentence the advice side answered with standard
> fast-carbohydrate advice. So the live question is the boundary: should it stop,
> or should it say that? The rules now also catch readings in mmol/L, readings
> spelled out in words, and "my sugar is low".*
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

Four sample answers are in Appendix A at the end: brown vs white rice,
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
| Coverage | 8,633 records: 364 ingredients and 86 everyday foods curated by hand, 2,000 recipes composed from them, about 4,600 USDA Survey (FNDDS) foods — "foods as eaten" — 754 packaged foods (USDA Branded Foods) and 813 survey foods that have no published glycemic index (pizza, cereal, candy). A food we do not have is named as missing and never costed under a neighbour's name |
| A food with carbohydrate and no published GI | Packaged foods and the 813 "unrated" survey foods are answered with **carbohydrate, fibre and calories** from the data and **never a glycemic load**; a meal containing one is partial and is never called a fit. (An earlier draft kept these out of the database, so a pepperoni pizza came back as "I do not have that food"; that was changed on 9 to 11 October. See Q17 and Q31) |

Records a human has checked are labelled **checked** with a date in the app;
the rest are labelled **unverified**, visibly, on every answer.

> **Q16.** Is the carbohydrate-weighted mean an acceptable way to give a mixed
> dish a GI, given that fat, protein and cooking all move it?
> **Q17.** For packaged foods and other foods with no published GI we now give
> carbohydrate alone and say the glycemic load cannot be computed, rather than
> say nothing at all. That was my decision, made as proposed in the first draft;
> your view could still change it. (Q24 and Q31 ask the same thing from the
> point of view of the person reading the card.)

---

## H. Three questions the first review opened

The same reviewer raised these and they are not settled. They are last because they
are the largest.

> **Q18.** The reviewer wrote: *"calories and counting them have a long history of
> failure."* Our daily ceiling is **derived from the calorie target** —
> carbohydrate is a share of energy, and the load ceiling is a share of
> carbohydrate. So the objection is not beside our design, it is inside it.
> Does a daily load ceiling change what someone eats, or is it the same
> failure in a different unit?
> **Q19.** On a GLP-1: we raise protein and say nothing about lean mass or
> bone. What should a nutrition tool say, if anything, to someone losing
> weight quickly on these drugs?
> **Q20.** The reviewer suggested splitting the targets three ways — overweight,
> prediabetes, established type 2 — rather than treating them as one
> population with a switch. Would that change the numbers, or only the
> wording?

## I. How it behaves when it does not know

A person asks about foods in their own words, so some of them are not in the database. This is the part that has changed most since the first draft.

- **A meal with a food we do not have is never called "fits".** The app costs the rest, says the total is partial, names what is missing, and says *"this already does not fit"* if the part it could cost is over the day's budget. This is decided by the calculation, not by the model.
- **Packaged and "unrated" foods** (an Oreo, a KIND bar, pizza, cereal) get carbohydrate, fibre and calories from the data and no glycemic load, because none is published and we do not estimate one.
- **A dish the database lacks** (a grandmother's cholent, say) can be counted from its own ingredients as an **estimate**: the app lists typical ingredients with assumed weights, finds each in the database, says plainly it is an estimate, and lets the person change any gram. The verdict on an estimate is conditional (*"if yours is like this…"*), never a plain "fits". Every number is still computed by the engine; only the weights are assumptions.

> **Q24. "Carbohydrate, load not available."**
> For a packaged food the card says, in substance: *"I can give you the carbohydrate, not the load. It has no published glycemic index, so DiaBite does not estimate one."* with the label's carbohydrate, fibre and calories for one serving. Can a person with type 2 diabetes use that safely? Does it risk being read as permission to eat the food? Is there something it should add (the serving size on the label, "check the label for your portion"), or leave out?

> **Q25. Partial meals: "I can't judge the day".**
> When part of a meal cannot be scored, the app declines to say it fits and asks about the missing food, or says it already does not fit. Would you rather it showed a *range* (the load of the part it could cost, up to a stated ceiling), or is declining the safer thing for this audience?

> **Q30. An estimate for a dish we do not have.**
> When the database lacks a dish, the app proposes typical ingredients with weights and counts them, and the card says *"Estimate: I counted this from typical ingredients, which may not be yours"* with an editor for the recipe. The verdict on it is conditional, never a plain fit. Is a number you can edit better for this audience than "I do not have it", or does an estimate with assumed weights invite false confidence? Would you want a range instead of a single figure?

> **Q31. Foods that get carbohydrate and no load.**
> Pizza, cereal, candy, packaged foods: the card gives carbohydrate, fibre and calories and says no glycemic index is available (the decision behind Q17). For a person with type 2 diabetes, is carbohydrate without a load more useful than silence, or does it risk reading as permission? (Q24 asks the same of packaged foods; one answer will do for both.)

---

## J. What else a person sees

- **A weekly menu**, with a shopping list. It is hidden, with a short explanation and no plan, for a person who reports a history of disordered eating, chronic kidney disease or dialysis; everyone else sees it with the line *"These meals have not been reviewed by a clinician yet."* It draws on 1,662 recipes whose nutrition and glycemic index were computed from their ingredients, and nobody has read them as a dietitian would.
- **Sign-in.** An emailed link, no password. The profile and diary are held in Ireland, with export and deletion. The first screen carries *"If you have symptoms such as chest pain, confusion, vomiting or fainting, call emergency services. DiaBite does not give insulin or medication doses."*
- **Planning.** A meal can be put on another day, past or future; a planned meal is shown dimmed and marked "planned", and counts in no budget until it is marked eaten.
- **A short explanation of the unit** ("What is GL?"), **a one-sentence disclaimer banner** with the rest one tap away, and **changing a portion** after an answer.

> **Q21. The menu: who should not be shown a plan?**
> I hide it for a history of disordered eating, CKD and dialysis, and show it to everyone else. That is a first guess, not a researched rule. For each of these, should the menu be hidden, shown with a warning, or shown as it is: *"my doctor has mentioned my kidneys"* (not diagnosed), gout, gastroparesis, brittle (unpredictable) diabetes, a GLP-1 user (protein), anyone over 65, anyone on a sulfonylurea? And is there anything else that belongs on the hidden list?

> **Q22. A calorie target for someone with a history of disordered eating.**
> Today onboarding still computes and shows a daily calorie and carbohydrate target to a person who reports a history of disordered eating, with a message to speak to their clinician. Should the app show *any* daily numerical target to that person, or none?

> **Q23. The first thing a signed-out person reads.**
> Because sign-in comes before the first question, someone with an emergency has to get past it. There is one safeguard in the screen and one underneath it. The sign-in screen itself carries, above everything, *"If you have symptoms such as chest pain, confusion, vomiting or fainting, call emergency services. DiaBite does not give insulin or medication doses."* And underneath, the engine answers a message that describes a red flag or asks for a dose with the usual refusal or escalation even when no one is signed in; but the app does not let a signed-out person type, so in practice that second one only protects anything that talks to the engine directly. Is the sentence right? Is a sign-in wall in front of a tool like this acceptable at all, or would you want the first screen to allow a question about a red flag without signing in?

> **Q26. "What is GL?" in two sentences.**
> Next to the main figure there is a link, "What is GL?", that opens: *"Glycemic load puts two things into one number: how fast a food raises blood sugar, and how much carbohydrate is in your portion. Your day has a budget of N. Each meal spends some of it, and the number you see is what is left."* Is that accurate and safe for a person with type 2 diabetes who has never heard the term? Is "how fast a food raises blood sugar" a fair gloss of the glycemic index, and is there a sentence you would add or strike?

> **Q27. A one-sentence disclaimer banner.**
> A banner shows only its first sentence, *"This is a reference tool, not medical advice."*, with the rest one tap away under "Read more" (the numbers are published averages, not for insulin dosing, discuss changes with your clinician). The whole text is also agreed to at the end of onboarding. Is a one-sentence banner with the rest on a tap enough, or must the dosing sentence always be visible?
> **Q28. Changing a portion after the answer.**
> After an answer the person can change any food's weight; the engine counts the meal again and a card above the original answer shows the new figures and a new verdict word taken from the same rule as before (fits, does not fit, or "I can't judge" when a food is missing). The explanation text written for the original portions stays below, marked as the original. Should the app also let someone *add* a food or *remove* one this way, or keep that to a new question? Is "Original answer, before you changed a portion" a clear enough label?

> **Q29. The menu draws on 1,662 recipes.**
> The weekly menu chooses from 30 hand-written dishes and 1,662 recipes (American, Italian, Tex-Mex, Mediterranean, Asian, Middle Eastern and others): every recipe's nutrition, glycemic index and load were computed from its ingredient table, and nobody has read them as a dietitian would. A week still shows "These meals have not been reviewed by a clinician yet". Is that line enough while they are unreviewed, or should a recipe carry a visible "unreviewed" mark until a dietitian has signed off, and is there a category you would take out of the menu altogether (for instance sandwiches and wraps, or soups with starchy thickeners)?
> **Q32. A meal can be planned for another day, and counts only once it is eaten.**
> A person can put a meal on tomorrow, or on a day in the past. A planned meal is shown dimmed, marked "planned", and counts in no budget, no week and no "days in range" until it is marked eaten. Nothing else about the food advice changes. Is there any risk in a person planning a day of meals that the app has not judged as a whole day, and is "planned" clear enough as a word?

---

## What we will do with your answers

Anything you flag becomes a change in the code, a test case in the evaluation
suite, or a documented decision with your objection recorded next to it. The
targets, the blocks and the safety rules are constants in one file; changing
them is minutes of work, and every change is re-tested automatically against
its automated checks: 191 food-resolution cases and 72 safety phrasings run with no model on every change, and 204 behavioural checks run against the live agent.

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

