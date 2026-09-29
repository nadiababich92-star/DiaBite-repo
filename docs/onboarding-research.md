# DiaBite onboarding — data research

*What we must know about a person to compute safe daily targets and rank recipes for them; how the answer changes by type of diabetes and by comorbidity; and how to ask for it in under three minutes.*

Scope assumed (confirmed 2026-09-17): the engine (a) filters and ranks recipes by carbohydrate, GI/GL and exclusions, and (b) computes daily targets — energy, carbohydrate, protein, fat, fibre, glycemic-load budget. It does **not** compute insulin doses. Market: US. Core audience: type 2 diabetes, prediabetes, insulin resistance. Everything else in this document is about detecting who falls *outside* that audience, or whose targets must be modified before they are shown.

Clinical anchors: ADA *Standards of Care in Diabetes* (2025), ADA nutrition consensus report (Evert et al., 2019), KDIGO 2022 diabetes-in-CKD guideline, AHA/ACC dietary guidance, DRI values. Prevalence figures are CDC National Diabetes Statistics Report unless noted. This is product research, not clinical advice — every threshold below should be reviewed by the dietitian/clinician advisor before launch.

---

## Key findings

1. **The current profile (sex, age, height, weight, activity, condition, goal, carb approach, exclusions) is enough to compute *a* number but not a *safe* number.** Two inputs are missing that change what we are allowed to recommend: **medications** (insulin, sulfonylureas, SGLT2 inhibitors, GLP-1 agonists) and **kidney function** (CKD affects about 1 in 3 adults with diabetes and caps protein at 0.8 g/kg — the opposite of what most "low-carb" advice pushes). These two are the highest-value additions to onboarding.

2. **"Type of diabetes" is the wrong primary branching variable; "what treatment are you on" is the right one.** Nutrition guidance for T2D, prediabetes and IR is essentially the same eating pattern with different intensity. What actually changes the rules is whether the person can go hypoglycaemic (insulin/sulfonylurea), can develop ketoacidosis on a very-low-carb diet (SGLT2i), or is eating far less than before (GLP-1). Type matters mainly to detect out-of-scope users: T1D/LADA on multiple daily injections or a pump, gestational diabetes, type 3c after pancreatic disease.

3. **Onboarding must be two-tier: a 90-second core that unlocks the product, and a "safety and precision" layer that can be deferred but is nudged hard.** Users can reliably answer the core questions and can usually name their medicines by brand; they cannot reliably report eGFR, HbA1c or potassium. Ask for labs as optional numbers with "I don't know" as a first-class answer, never as a gate.

---

## 1. What the engine computes, and what each output depends on

| Output | Formula / rule today | Inputs required | Inputs that *modify* it |
|---|---|---|---|
| Energy (kcal) | Mifflin-St Jeor × activity factor ± goal delta | sex, age, height, weight, activity, goal | GLP-1 use (appetite ↓, don't chase the number); age ≥ 65 (floor, no aggressive deficit); BMI < 18.5 or eating-disorder history (no deficit); pregnancy/breastfeeding (out of scope); bariatric surgery (very different regimen) |
| Carbohydrate (g) | share of energy by approach (40 / 26 / 15 %) | energy, carb approach | insulin or sulfonylurea (very-low-carb only with clinician sign-off — hypo risk); SGLT2i (very-low-carb / keto contraindicated — euglycaemic DKA); gout (ketosis raises urate); pregnancy (≥ 175 g/day minimum); older adults (avoid < 130 g without supervision) |
| Protein (g) | fixed share of energy | energy | **CKD stage 3+: cap 0.8 g/kg/day (KDIGO 2022), dialysis 1.0–1.2**; age ≥ 65: floor 1.0–1.2 g/kg for sarcopenia; GLP-1: floor ~1.0–1.5 g/kg to protect lean mass; bariatric: 60–80 g/day floor |
| Fat (g) | remainder | energy | ASCVD / dyslipidaemia: saturated fat < 10 % energy (ADA), < 6 % if LDL-lowering is the goal (AHA); MASLD: same plus fructose limits; gastroparesis: low fat |
| Fibre (g) | 14 g per 1 000 kcal (ADA) | energy | gastroparesis: **remove** the floor, low-residue; IBS on low-FODMAP: source restrictions; CKD stage 4–5 with high K: fibre from low-K sources |
| GL budget | derived from carb target | carb target | none — but the *ranking* changes: HTN → sodium weight, CKD → K/P weight, gout → purine weight |
| Recipe eligibility | exclusions list | allergens, dislikes | celiac (strict GF), lactose intolerance, religious/ethical patterns, FDA top-9 allergens, potassium/phosphorus ceilings (CKD), sodium ceiling (HTN, HF, CKD) |

**Gap to close in `Profile`:** medications (by class), comorbidities (checklist), kidney function (stage or eGFR, optional), pregnancy/breastfeeding flag, eating pattern, allergens as a structured list (not just food ids), and an explicit "insulin regime" question that drives the T1D exit (PRD A5).

---

## 2. Data to collect — by tier

### Tier 0 — required to compute anything (core onboarding, ~90 s)

| Field | Why | How to ask (US wording) | Validation |
|---|---|---|---|
| Sex at birth | Mifflin-St Jeor constant | "Sex assigned at birth (used only for the energy formula)" + "prefer not to say" → use average of both constants | — |
| Age | BMR, older-adult rules | date of birth or age | 18–100; < 18 → stop (paediatric diabetes is a different clinical field) |
| Height, weight | BMR, BMI, per-kg protein | ft/in and lb by default, metric toggle | height 120–220 cm; weight 35–300 kg; BMI < 18.5 → no deficit + gentle message |
| Activity | TDEE factor | four-level picker with plain examples ("desk job, no workouts") | — |
| Condition | scope, tone, thresholds | "Which best describes you?" T2D / prediabetes / insulin resistance or PCOS / type 1 or LADA / gestational / other / not sure | T1/LADA → medication question decides exit; gestational → exit; "other" → free text + generic conservative targets |
| Goal | energy delta | lose / maintain / gain | "gain" + BMI ≥ 30 → confirm |
| Medical disclaimer acknowledgement | PRD A4 | non-dismissible | must be true |

### Tier 1 — safety gates (must ask before showing targets; can be one screen)

| Field | Why it changes the answer | Ask as |
|---|---|---|
| **Insulin** — none / basal only (long-acting once a day) / mealtime or pump | Mealtime insulin or pump → the person is dosing insulin against carbs; app must exit dosing-adjacent features (PRD A5). Basal-only T2D is in scope but has hypo risk on carb restriction. | "Do you take insulin?" with the three options and brand hints (Lantus, Basaglar, Tresiba, Toujeo = basal; Humalog, Novolog, Fiasp, Lyumjev, pump = mealtime) |
| **Sulfonylurea / meglitinide** (glipizide, glimepiride, glyburide, repaglinide) | Hypoglycaemia risk rises when carbs fall; very-low-carb should be blocked or clinician-confirmed; keep carbs consistent meal to meal | checkbox with generic + brand names |
| **SGLT2 inhibitor** (Jardiance, Farxiga, Invokana, Steglatro, Inpefa) | FDA-labelled risk of euglycaemic DKA; ketogenic / very-low-carb eating is a documented trigger. Block "very low", warn on "low", advise against fasting. | checkbox |
| **GLP-1 / dual agonist** (Ozempic, Wegovy, Mounjaro, Zepbound, Trulicity, Rybelsus, Victoza, Saxenda) | Intake drops 20–30 %; risk is under-eating protein and micronutrients, not over-eating carbs. Prioritise protein, smaller meals, lower fat (nausea), hydration. Don't nag about hitting the kcal number. | checkbox |
| Metformin | No dietary restriction; long-term B12 depletion → flag B12-rich foods. Also the most common answer, so it makes the list feel complete. | checkbox |
| Other glucose-lowering (DPP-4, TZD, acarbose) | Minor. Acarbose: hypo must be treated with glucose, not sucrose — only relevant if we ever surface hypo advice. | "something else" |
| **Pregnant, planning, or breastfeeding** | GDM and pregnancy in T2D need a ≥ 175 g/day carb minimum, distributed carbs, ketone avoidance, and clinical supervision. Out of scope → exit with referral. | yes/no; female only, age 18–50 |
| **Kidney disease** — none / "my doctor mentioned my kidneys" / CKD stage known / dialysis | Protein cap, sodium ≤ 2 g, potassium and phosphorus screening of recipes. ~1 in 3 adults with diabetes has CKD, most don't know it. | tiered question; eGFR optional numeric later |
| History of eating disorder | No kcal deficit, no "budget remaining" framing, hide GL ceilings; ADA recommends screening for disordered eating in diabetes. | single opt-in question, plain language |

### Tier 2 — comorbidity checklist (one screen, multi-select, "none of these" prominent)

Ordered by prevalence in the T2D population and by how much each changes the diet:

| Comorbidity | Approx. reach in T2D (US) | Dietary rule the engine must apply |
|---|---|---|
| Hypertension | roughly 2 in 3 | Sodium ≤ 2 300 mg, 1 500 mg if BP uncontrolled (AHA); DASH-style weighting (potassium, magnesium) unless CKD |
| Overweight / obesity | ~ 9 in 10 | 500–750 kcal/day deficit; ADA floor 1 200–1 500 (women) / 1 500–1 800 (men); ≥ 5 % loss improves glycaemia, ≥ 15 % may induce remission |
| Dyslipidaemia / ASCVD (heart attack, stent, stroke) | majority | Saturated fat < 10 % (< 6 % for LDL lowering), no trans fat, soluble fibre, plant sterols; caution: very-low-carb raises LDL in a subset |
| MASLD / MASH (fatty liver) | ~ 2 in 3 with T2D | 7–10 % weight loss, minimise added fructose and sugar-sweetened drinks, alcohol ≤ minimal, Mediterranean pattern; coffee is fine |
| CKD (any stage) | ~ 1 in 3 | see Tier 1 |
| Heart failure | ~ 1 in 5 over 65 | Sodium ≤ 2 000 mg, fluid guidance (out of scope — flag only) |
| Gout | elevated | Limit purine-dense foods (organ meat, some seafood), fructose, beer; block very-low-carb (ketosis raises urate) |
| Gastroparesis | 5–10 % long-standing diabetes | Small frequent meals, **low fat, low fibre**, well-cooked; the general "more fibre" rule is harmful here |
| Celiac disease | ~ 1 % T2D, ~ 6 % T1D | Strict gluten-free filter — wheat, barley, rye, most oats, hidden sources (soy sauce, malt) |
| PCOS | common in IR audience | Same IR pattern; often the diagnosis behind "insulin resistance"; add fertility/pregnancy-planning branch |
| Hypothyroidism | common | Minor; energy needs slightly lower if untreated — no engine rule, keep note |
| GERD | common with obesity | Smaller meals, avoid late eating; recipe tags (acidic, spicy, high fat) |
| IBS | ~ 1 in 10 general pop. | Low-FODMAP conflicts with legumes/onion-heavy diabetic recipes; fibre source matters |
| Lactose intolerance | high in Black, Hispanic, Asian US populations | Dairy filter (distinct from milk allergy) |
| Bariatric surgery (past) | growing | Protein-first 60–80 g, no sugar (dumping), tiny portions, supplements — largely out of scope, flag |
| Osteoporosis | older women | Calcium/vitamin D — recipe tags only |
| Depression / anxiety | ~ 1 in 4 | No engine rule; affects tone, nudges, and eating-disorder screening |

### Tier 3 — precision boosters (optional, "add later", never gate)

| Field | What it improves | Notes |
|---|---|---|
| Most recent HbA1c | Tone and urgency of targets; the "why" copy; later — personalised GL budget | People know roughly ("about 7") — accept ranges. Not needed for arithmetic today. |
| Fasting glucose / CGM or meter use | Enables a future feedback loop (post-meal response) — the differentiator against ZOE-style products | Ask "Do you check your glucose?" never / fingerstick / CGM (Dexcom, Libre) |
| eGFR, potassium, LDL, blood pressure | Turn tiered comorbidity answers into numeric constraints | Optional numeric with units; "I don't know" |
| Waist circumference | Better IR proxy than BMI | optional |
| Meal timing / shift work / fasting practices | Menu generation, when to place carbs | Include Ramadan / intermittent fasting: contraindicated with SU/insulin/SGLT2i without adjustment |
| Alcohol use | Hypo risk with insulin/SU, calories, MASLD | frequency picker |
| Cooking time, budget, household size, cuisine | Recipe ranking and menu — not clinical | defer to first menu generation |

### What **not** to collect

Insulin doses, correction factors, carb ratios (dosing-adjacent, PRD A5). Full medication lists with doses (we only need classes). Free-text diagnoses that the engine can't act on. Government IDs, insurance. Anything we can't turn into a rule — every question must map to a row in section 1 or to a filter.

---

## 3. How nutrition differs by type of diabetes

The eating *pattern* is shared; the *constraints* differ.

### Type 2 diabetes (in scope; ~ 90–95 % of US diabetes, 38 million adults)
- ADA: no single ideal carbohydrate percentage; Mediterranean, DASH, plant-based and low-carb patterns are all acceptable; individualise.
- Weight loss is the primary lever: ≥ 5 % improves glycaemia, ≥ 15 % (early in disease) can induce remission (DiRECT, ADA).
- Carbohydrate quality over quantity: fibre ≥ 14 g/1 000 kcal, whole grains, legumes, non-starchy vegetables; minimise added sugar and refined grains; water over sugar-sweetened drinks.
- Low- and very-low-carb patterns reduce HbA1c short-term (6–12 months) but require medication adjustment if on insulin/SU/SGLT2i and are not recommended in pregnancy, CKD, or eating disorders.
- Terminology check for the engine: in the ADA 2019 consensus, **low-carb = 26–45 % of energy**, **very-low-carb = 20–50 g/day (≈ < 10 %)**. Our "low = 26 %" sits at the bottom edge of "low" and "very low = 15 %" is a middle ground the literature doesn't use. Suggest relabelling: moderate ≈ 40 %, low ≈ 30 %, very low ≈ 50 g/day fixed grams rather than a percentage.

### Prediabetes (in scope; ~ 98 million US adults, ~ 80 % unaware)
- Goal is prevention, not glycaemic control: DPP evidence — 7 % weight loss + 150 min/week activity cuts progression by ~ 58 %.
- Same food pattern as T2D, less intensity; no medication gates except metformin (occasionally GLP-1 for obesity).
- Tone matters: people don't feel sick; "budget" framing works less than "small swaps".

### Insulin resistance / PCOS / MASLD without diabetes (in scope)
- Not a diagnosis with its own guideline; treat as prediabetes-pattern plus the specific comorbidity rule (PCOS → often planning pregnancy → branch; MASLD → fructose/alcohol).
- Low-GL emphasis has the best evidence here; weight loss of 5–10 % improves insulin sensitivity.
- Many in this segment are self-diagnosed via a "high fasting insulin" or HOMA-IR — accept "my doctor said" without demanding a value.

### Type 1 diabetes and LADA (out of scope — must detect)
- Nutrition is carbohydrate *counting* to match insulin, not carbohydrate *restriction*; insulin-to-carb ratio and correction factor drive every meal; hypo treatment is 15 g fast glucose, recheck in 15 min.
- Roughly 1 in 10 adults diagnosed as "type 2" actually has LADA and will move to insulin within years — so the T1 exit must trigger on **mealtime insulin or pump**, not on the self-reported type.
- Celiac (~ 6 %) and autoimmune thyroid disease are much more common in T1D.
- Product rule (PRD A5): if mealtime insulin / pump → clear statement, no targets, no logging of "remaining carbs".

### Gestational diabetes and pregnancy with diabetes (out of scope — must detect)
- Minimum 175 g carbohydrate, 71 g protein, 28 g fibre per day (DRI); carbs distributed over 3 meals + 2–3 snacks; avoid ketosis; no weight-loss targets.
- Any weight-loss or carb-restriction recommendation here is harmful → exit with referral to OB/CDCES.

### Type 3c / pancreatogenic (out of scope — flag)
- Follows pancreatitis, pancreatectomy, cystic fibrosis, pancreatic cancer; often misdiagnosed as T2D (estimated up to 8–9 % of diabetes in some cohorts).
- Exocrine insufficiency → fat malabsorption, enzyme replacement; brittle glucose, high hypo risk; alcohol abstinence; low-carb dangerous.
- Detect with "Have you had pancreatitis or pancreas surgery?" in the comorbidity list → conservative targets, no restriction, advise specialist.

### MODY (monogenic; rare, ~ 1–2 %)
- Nutrition depends on subtype: GCK-MODY needs no treatment; HNF1A/HNF4A are sulfonylurea-sensitive → hypo rules apply. Handled entirely by the medication questions — no need to ask.

### Steroid-induced / secondary diabetes
- Afternoon–evening hyperglycaemia pattern with morning steroids; carbs better placed at breakfast. Ask "Do you take prednisone or other steroids regularly?" only if we ever do meal-timing; otherwise treat as T2D.

---

## 4. Medication × diet interaction summary (engine rules)

| Medication class | Hypo risk | Ketoacidosis risk on very-low-carb | Rule |
|---|---|---|---|
| Insulin — mealtime or pump | High | — | Exit (A5) |
| Insulin — basal only | Moderate | Low | Allow moderate/low; very-low only with "I've discussed with my clinician"; show hypo warning copy |
| Sulfonylurea / meglitinide | Moderate–high | — | Same as basal insulin; add "keep carbs similar meal to meal" |
| SGLT2 inhibitor | Low | **Yes (FDA warning)** | Block very-low; warn on low; warn against fasting/skipped meals and on sick days |
| GLP-1 / GIP-GLP-1 | Low (alone) | — | Protein floor 1.0–1.5 g/kg, smaller portions, lower-fat recipes, kcal target advisory not a goal |
| Metformin | Low | — | None; B12 note |
| DPP-4, TZD, acarbose | Low | — | None |
| None (diet-managed / prediabetes) | — | — | All approaches allowed |

Combinations stack: SGLT2i + insulin is common and the strictest case in scope.

---

## 5. Recommended onboarding flow

Budget: < 3 minutes (PRD Flow 1). Seven screens, three of which are single-tap.

1. **Basics** — sex at birth, age, height, weight (imperial default), activity. *~ 40 s.*
2. **Your diagnosis** — one choice: T2D / prediabetes / IR or PCOS / T1D or LADA / gestational / not sure. Add "when were you diagnosed?" (year, optional — recent T2D is the remission window). *~ 15 s.*
3. **Your medicines** — multi-select with brand names and pill/pen icons; "none" and "not sure" visible. Insulin sub-question appears inline if insulin selected. *~ 30 s.* → Exit screens: mealtime insulin/pump, pregnancy.
4. **Other conditions** — multi-select, ordered as in Tier 2; "none of these" first-class. Kidney item expands to stage / "doctor mentioned" / dialysis. *~ 25 s.*
5. **Goal and approach** — goal (lose/maintain/gain) and carb approach, with the **default pre-selected by rules** (e.g. SGLT2i → "moderate" selected, "very low" disabled with reason). Eating pattern chips: Mediterranean, vegetarian, vegan, halal, kosher, no preference. *~ 20 s.*
6. **Foods to avoid** — FDA top-9 allergens as chips (milk, egg, fish, shellfish, tree nuts, peanuts, wheat, soy, sesame), plus gluten-free, lactose-free, dislikes search. *~ 20 s.*
7. **Disclaimer + targets** — non-dismissible acknowledgement, then targets with derivation and *which rule modified what* ("Protein capped at 0.8 g/kg because you told us about kidney disease"). *~ 20 s.*

Deferred (nudged in the first week, each one screen): HbA1c, glucose monitoring, eGFR/labs, alcohol, meal timing, cooking preferences.

**Branch logic (executable summary):**

```
age < 18                      → exit: not for minors
pregnant / breastfeeding      → exit: see OB / CDCES
insulin = mealtime | pump     → exit: A5 copy
condition = t1 & insulin=none → treat as "not sure": conservative moderate, ask to confirm
bariatric surgery             → conservative, no deficit, flag
eating disorder history       → no deficit, hide budgets
BMI < 18.5                    → no deficit
age >= 65                     → kcal floor, protein 1.0–1.2 g/kg, no very-low
CKD (any)                     → protein 0.8 g/kg (dialysis 1.0–1.2), Na ≤ 2 g, K/P recipe screen
SGLT2i                        → very-low blocked, low warned
insulin basal | SU            → very-low needs confirmation, hypo copy
GLP-1                         → protein floor, small-meal ranking, kcal advisory
HTN | HF                      → Na ≤ 2 300 (1 500 if uncontrolled / HF 2 000)
ASCVD | dyslipidaemia         → sat fat ≤ 10 % (6 % option), LDL note on very-low
MASLD                         → fructose/SSB/alcohol rules
gout                          → purine filter, very-low blocked
gastroparesis                 → fibre floor removed, low-fat, small meals
celiac                        → strict GF filter (beyond "wheat" allergen)
```

---

## 6. What users can actually answer (research assumptions to validate)

No interviews have been run yet; these are working hypotheses from clinical-practice literature and comparable products (MySugr, Glucose Goddess, Levels, Noom, ZOE), to be tested in five moderated sessions.

- People know their **medicines by brand**, rarely by class → always show brands.
- People know their **type** if it's T1 or gestational; a large share of "T2" are unaware of LADA or 3c → medication question is the safety net, not the type.
- **HbA1c** recall is approximate; **eGFR / potassium** recall is poor → optional, ranged, never gating.
- **"Insulin resistance"** users are frequently self-identified via PCOS, weight-loss clinics or social media → accept without proof, message as prediabetes.
- Comorbidity checklists get skipped when long → keep to ~ 12 items, put "none of these" at the top, allow editing later from the targets screen.
- Any question about eating disorders or mental health needs a "why we ask" line and a skip option, or completion rates fall.

**Sessions to run before Week 4 demo:** 5 users (2 T2D on ≥ 1 medication, 1 prediabetes, 1 PCOS/IR, 1 T2D + CKD or HTN). Tasks: complete onboarding aloud; explain each target back to the moderator; find the medication they take. Success: < 3 minutes, zero wrong medication class, user can restate why protein/carbs are what they are.

---

## 7. Privacy and regulatory notes (US)

- A direct-to-consumer app is generally **not** a HIPAA covered entity, but health data is covered by the **FTC Health Breach Notification Rule**, **Washington My Health My Data Act**, and state privacy laws (CCPA/CPRA sensitive data). Practical implications: explicit consent for health data at onboarding, data minimisation (collect only what maps to a rule — section 2), easy deletion, no sale/sharing of health data.
- Not a medical device as long as the app provides general wellness / dietary guidance and does not calculate or recommend drug doses (FDA General Wellness and CDS guidance). Insulin dosing, hypo treatment protocols and "sick day rules" stay out — this is why the A5 exit exists.
- Disclaimer must precede any number.

---

## 8. Changes to the current profile model (for the engine)

Add to `Profile`:

```
insulin: 'none' | 'basal' | 'mealtime_or_pump'
meds: Array<'sulfonylurea' | 'sglt2' | 'glp1' | 'metformin' | 'other'>
pregnantOrBreastfeeding: boolean
kidney: 'none' | 'unsure_mentioned' | 'ckd_1_2' | 'ckd_3' | 'ckd_4_5' | 'dialysis'
comorbidities: Array<'htn' | 'ascvd' | 'dyslipidemia' | 'masld' | 'hf' | 'gout' | 'gastroparesis' | 'celiac' | 'pcos' | 'ibs' | 'gerd' | 'bariatric' | 'pancreatitis' | 'eatingDisorder'>
pattern: 'none' | 'mediterranean' | 'vegetarian' | 'vegan' | 'halal' | 'kosher'
allergens: Array<FDA top-9 + 'gluten' | 'lactose'>
diagnosedYear?: number
labs?: { a1c?: number; egfr?: number; potassium?: number; ldl?: number }
```

`Targets` gains a `constraints` array — each entry is a rule id, the field it changed, and the human reason — so the derivation screen (PRD A2) and the verifier can both show *why*. Condition `t1` stays in the enum but routes to the A5 exit unless `insulin !== 'mealtime_or_pump'`, closing the PRD/prototype discrepancy.

---

## 9. Open questions

1. Do we surface potassium/phosphorus at all in V0, or only apply the protein cap for CKD and defer mineral screening to V1? (Recipe DB needs K/P per ingredient — check coverage in [recipe-db-1000].)
2. Should "very low carb" be a fixed 50 g/day (literature) instead of 15 % of energy?
3. Who is the clinical reviewer for the thresholds table before the pitch?
4. Do we ask the eating-disorder question in V0 or handle it via tone only (no "remaining budget" language anywhere)?

---

## Sources

- American Diabetes Association. *Standards of Care in Diabetes — 2025*, Sections 5 (lifestyle/nutrition), 8 (obesity), 9 (pharmacologic), 11 (CKD), 13 (older adults), 15 (pregnancy). https://diabetesjournals.org/care/issue/48/Supplement_1
- Evert AB et al. *Nutrition Therapy for Adults With Diabetes or Prediabetes: A Consensus Report.* Diabetes Care 2019;42(5):731–754.
- KDIGO 2022 Clinical Practice Guideline for Diabetes Management in CKD. Kidney Int 2022;102(5S).
- Lean MEJ et al. DiRECT trial: primary care-led weight management for remission of T2D. Lancet 2018.
- Diabetes Prevention Program Research Group. NEJM 2002;346:393–403.
- FDA Drug Safety Communication: SGLT2 inhibitors and ketoacidosis (2015, updated labelling).
- AHA 2021 Dietary Guidance to Improve Cardiovascular Health. Circulation 2021;144:e472–e487.
- CDC National Diabetes Statistics Report (2024 data release).
- Institute of Medicine Dietary Reference Intakes (macronutrients, 2005) — pregnancy minimums.
- FDA Food Allergen Labeling (FALCPA + FASTER Act, sesame 2023).
- FTC Health Breach Notification Rule (16 CFR Part 318); Washington My Health My Data Act (2023).
