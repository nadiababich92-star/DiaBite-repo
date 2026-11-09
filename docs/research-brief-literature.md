# Five clinical decisions to check against the literature

*9 November 2026. For a literature-search tool (it answers one question at a time, reads papers and cites them). Each block below is self-contained: paste one at a time. The source of each decision is `docs/CLINICAL_REVIEW.md`, and the numbers were checked against `src/lib/profile.ts` on this date.*

**How to use the answers.** The tool is a scout, not a reviewer. Open every paper it cites and read the abstract before quoting anything. Take what it finds to the physicians as *questions with papers attached*, not as decisions. Check in particular that a study is about **adults with type 2 diabetes or prediabetes**, not type 1, children or another country's care system.

**The line to add to every question** (it keeps the answers usable):

> Separate what US guidelines (ADA, Academy of Nutrition and Dietetics) recommend from what individual studies show. For every study give the year, the design (randomised trial, meta-analysis, cohort, survey), the number of participants and the population. Say where the evidence conflicts or is thin, and say plainly when you cannot find at least five relevant papers. Do not give advice to an individual patient.

---

## 1. A daily glycemic-load ceiling

**What the app does.** Each person gets a daily glycemic-load (GL) ceiling, and every meal is judged against what is left of it. The ceiling is derived, not measured: `GL ceiling = daily carbohydrate target (g) × target mean glycemic index ÷ 100`, with a target mean GI of 45 for diabetes and 50 for prediabetes and insulin resistance, capped at 120. For example a 1,653 kcal day with 26% of calories from carbohydrate is 107 g, which gives a ceiling of 48 GL.

**Question.** In adults with type 2 diabetes or prediabetes, is there evidence for a *daily* glycemic-load target, and for what value of mean dietary GI or total daily GL improves HbA1c or fasting glucose? Do any guidelines or trials give a daily GL or mean GI target? Are 45 and 50 defensible, and is a cap of 120 GL a day?

## 2. How much carbohydrate, and how it is spread over the day

**What the app does.** Daily carbohydrate is a share of daily energy: 40% on "moderate", 26% on "low", 15% on "very low". Energy comes from the Mifflin-St Jeor equation times an activity factor, minus 15% to lose weight. The app today gives one **daily** ceiling and does not look at how carbohydrate is spread across meals.

**Question.** For adults with type 2 diabetes or prediabetes, what does the evidence say about (a) the share of energy from carbohydrate (about 26 to 40%) and its effect on HbA1c and weight, and (b) **distributing carbohydrate evenly across meals compared with a daily total**: is there evidence that the distribution matters for glycaemia in people not on insulin? What per-meal carbohydrate ranges do US guidelines or diabetes education programmes teach for type 2 diabetes?

## 3. Protein targets, kidney caps and GLP-1 medicines

**What the app does.** Protein is 1.6 g per kg of body weight when losing weight and 1.4 g per kg otherwise. It is capped at 0.8 g per kg with chronic kidney disease (and 1.0 g per kg if the person mentions kidney trouble without a diagnosis), raised to 1.1 g per kg on dialysis, floored at 1.2 g per kg on a GLP-1 medicine, and floored at 1.0 g per kg from age 65. If a kidney cap and the GLP-1 floor both apply, the cap wins and the app states the conflict.

**Question.** For adults with type 2 diabetes, is 1.4 to 1.6 g per kg of protein defensible, or too high? What do guidelines say for chronic kidney disease when the stage or eGFR is **unknown**? What protein advice exists for people losing weight quickly on GLP-1 receptor agonists, including lean-mass loss?

## 4. Very low carbohydrate: which medicines and conditions should block it

**What the app does.** "Very low carb" (15% of calories) is blocked, with the reason shown, for anyone who reports an SGLT2 inhibitor, a sulfonylurea or basal insulin, gout, a history of disordered eating, or age 65 and over. It is allowed with metformin. Other standing advice is shown without changing the numbers.

**Question.** For adults with type 2 diabetes, what is the evidence and what do guidelines or regulators say about very low carbohydrate or ketogenic diets together with (a) SGLT2 inhibitors (euglycaemic ketoacidosis), (b) sulfonylureas or insulin (hypoglycaemia), (c) metformin, (d) gout, (e) older age? Is *blocking* supported, or is a warning enough? Is there a medicine or condition missing from this list?

## 5. A mixed dish's glycemic index, and foods with no published index

**What the app does.** A recipe's glycemic index is the carbohydrate-weighted mean of its ingredients' indices. A food with carbohydrate but **no published glycemic index** is counted for carbohydrate, fibre and calories only, its glycemic load is shown as "not available", and a meal containing one is never judged as fitting.

**Question.** How accurate is estimating the glycemic index of a mixed meal or recipe as the carbohydrate-weighted mean of its ingredients' indices, given that fat, protein, fibre and cooking change the response? Is there evidence on how large the error is? When a food has no published index, is it better to give carbohydrate alone, or to estimate an index from similar foods?

---

## What to bring back

For each block: the two or three papers that matter most (not a list of twenty), what they say in one sentence, and the sentence in our design they confirm or contradict. Write the result into `docs/CLINICAL_REVIEW.md` next to the matching question (Q1 to Q20), so a physician reading the pack sees the evidence next to the question.
