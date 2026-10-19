# DiaBite — a safety case in two pages

*Roadmap item 3.5. Written 19 October 2026. It says what protects a person, what has been shown, and what has **not** been reviewed. It is self-assessed: no clinician has signed off on the product and none is named as having reviewed it.*

## What DiaBite is, and what it refuses to be

An information tool for adults in the US with type 2 diabetes, prediabetes or insulin resistance. A person says what they are about to eat; the app says whether it fits what is left of their day and shows the arithmetic. It **never gives a dose, never changes a medicine, never diagnoses**. It is not for people under 18, who are pregnant or breastfeeding, who have gestational diabetes, or who use mealtime insulin or an insulin pump, and it says so plainly. A banner, "This is a reference tool, not medical advice", stays on every screen.

## Three layers, in the order a question meets them

**1. Rules before any model** (`server/safety.ts`, plain pattern matching, no model, no network). A refusal that depends on a model behaving is not a refusal, so these run first and no prompt can talk them out of it:

| Rule | Catches | The person gets |
|---|---|---|
| Dosing | Insulin by name or brand, units of a dose, bolus, carb ratio, correction factor, in common spellings, spaced or full-width letters | A refusal and a pointer to their care team |
| Red flag | Fainting, chest pain, confusion, vomiting, dizziness, ketones; a glucose of 300 mg/dL or more or under 70 (mmol/L converted, number words read); "my sugar is low" | "Seek help now"; the food conversation stops |
| Prolonged fast | Not eating for a long time | A referral, no meal talk |
| Referral | Pregnancy, kidney disease, disordered eating | The targets were never derived for this; ask a clinician |

The rules run **before the rate limits**, so nobody describing a red flag is told to wait. Evidence: 72 safety phrasings run with no model on every change (72 of 72 on 19 October); each phrasing that ever got past a rule is kept as a test. A security audit on 5 and 6 October found 9 of 21 dangerous phrasings getting through (insulin by brand, spelled-out and mmol/L readings, symptoms without a keyword); all were closed on 8 October and checked against the live service. A refusal takes under half a second in the app.

**2. Numbers that were computed, never generated.** A model reads the sentence; a deterministic engine does the arithmetic from food data (`docs/data-sources.md`); a **verifier** compares every number in the written answer with the tool results and blocks one that no tool returned. If a number cannot be traced the answer is regenerated once, then replaced by one built only from tool output. A food the database lacks is never costed under a neighbour's name: it is named as unknown and asked about; a meal with a missing food is costed without it, labelled partial and **never called a fit**; a dish counted from its ingredients is an **estimate**, never a plain fit; foods with no glycemic index (pizza, candy, packaged foods) show carbohydrate and never an invented load. The advisor, which answers general questions, has no tools and **states no numbers at all**. Evidence: 204 of 204 behavioural checks on the deployed agent (15 October); model-graded Azure AI Foundry runs on 12 October (intent resolution 86 of 86, groundedness 74 of 75; the one real fault, two hard candies counted as 320 g, was a data fault and was fixed); the verifier's probes, 18 of 18.

**3. Limits built into the targets themselves** (`src/lib/profile.ts`). Very low carbohydrate is blocked, with the reason shown, for an SGLT2 inhibitor, a sulfonylurea or basal insulin, gout, a history of disordered eating, age 65 or over, and brittle diabetes. A kidney-disease protein cap of 0.8 g per kg beats the protein floor for people on GLP-1 drugs, and the app says the two pull against each other (found by a physician's review on 2 October: the floor had quietly undone the cap). The weekly menu is hidden for kidney disease, dialysis and a history of an eating disorder, and says plainly that its meals have not been reviewed by a clinician.

## What is not guarded, and why we say so

- **A low glucose reading.** Under 70 the app stops the food conversation and says to seek help; it does not tell the person to take fast-acting carbohydrate. Whether that is right is **open question Q12** for the clinicians.
- **The daily glycemic-load ceiling is our own construction**, derived from the calorie target and a target mean glycemic index, not a published guideline (Q7 to Q9, Q18). It is the part a clinician is most asked to challenge.
- **Kidney disease is capped without a stage** (Q4); an unstaged cap may do more harm than none.
- **Gout and gastroparesis** change what is advisable but do not hide the menu or block other features; gout blocks only very low carbohydrate. A clinician's view is needed.
- **GLP-1 drugs and lean mass:** the app raises the protein target and says nothing about lean mass or bone (Q19).
- **Languages other than English.** The rules are English only, on purpose: the market is the US.
- **What the advisor says in words.** It states no numbers, but it can still be wrong about direction; the verifier checks numbers, not claims.
- **Copy and consent.** Every sentence about a person is unreviewed by a clinician, and the consent text is a draft that no counsel has read. The FDA general-wellness position has not been confirmed by counsel.

## What happens when something is wrong

A harm failure (a wrong dose, a missed red flag, a refusal that did not refuse) blocks a release and moves the whole plan back a stage. Every phrase that breaks the product, from a test or from a person, becomes a permanent test the same week. The clinical review pack lists every decision the product makes about a person in twenty questions (`docs/CLINICAL_REVIEW.md`); the plan is to ask the physicians who hold it for a short, honest note on what each did and did not look at. **That note would not be a sign-off, and the product never says "reviewed by".**
