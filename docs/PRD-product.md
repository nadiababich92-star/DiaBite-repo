# DiaBite — Product Requirements (whole product)

> A copy, made on 19 October 2026, of the Claude Docs document "DiaBite — Product Requirements (whole product)": https://claude.ai/artifact/N9q43Ju8mrP1ZWbtmF2q6D. The document is the live version; this file lets the repository, and anything reading it, see the same text. `docs/PRD.md` is the course PRD (Weeks 1 to 5) and stays as the full record with its revision log. The diagram in "At a glance" is in the document only.

Last updated 16 October 2026 · Nadia Babich

DiaBite tells an adult with type 2 diabetes, prediabetes or insulin resistance in the US whether a meal fits what is left of their day, and shows the arithmetic. It is built and running at diabite.pro with accounts, a diary, a weekly menu, planning and a feedback loop, and is being prepared for its first outside users. The work-size estimates to a public launch are from 8 October and have not been re-estimated since.

## Problem and users

People with type 2 diabetes, prediabetes or insulin resistance face one question five to seven times a day: can I eat this, how much, and with what?

The answer is hard because glycemic impact belongs to a whole meal, not to a food. Carb counting works but costs weighing, looking up and adding up at every meal, and generic advice assumes meals cooked from a plan, which break on most days.

**Who it is for:** adults in the United States with type 2 diabetes, prediabetes or insulin resistance. The US has 40.1 million people with diabetes (12.0% of the population) and 115.2 million adults with prediabetes ([CDC National Diabetes Statistics Report](https://www.cdc.gov/diabetes/php/data-research/index.html), updated 16 September 2026, 2023 data). Diagnosed diabetes cost $412.9 billion in 2022 ([ADA, Diabetes Care](https://diabetesjournals.org/care/article/47/1/26/153797/Economic-Costs-of-Diabetes-in-the-U-S-in-2022)).

**Who it turns away, with a plain "not for you":** under 18; pregnant, breastfeeding or gestational diabetes; mealtime insulin or an insulin pump.

| Tool | What it gives | What is missing |
|---|---|---|
| Printed food list | Allowed and forbidden foods | Your meal, your day |
| Calorie app | A database, 3 to 5 minutes per meal | Any glycemic index |
| Glucose-sensor apps | A score from a $100+ a month sensor | A number you can question |
| General chatbot | A fluent answer | The same number twice |

## The product and its promise

A person types a meal in their own words; DiaBite answers in about five seconds with a verdict, the number behind it, one reason and one change, and the arithmetic one tap away.

**The promise: every number a user sees was computed, not generated.** A language model reads the question and writes the sentence. It never produces a nutrition number, and a change that would let it is stopped.

1. **Read.** A model turns "a burrito bowl" into foods and portions, and asks exactly one question when it is unsure.
2. **Compute.** A deterministic engine over 6,054 foods works out available carbohydrate, glycemic index and load, and what is left of the day. The same meal always gives the same number.
3. **Check.** A verifier compares every number in the written answer with the tool results. If one cannot be traced, the answer is regenerated once, then replaced by one built only from tool output.

**Anatomy of an answer:** the verdict as a sentence a person would say, three figures (this meal, before, left after), the reason (the food driving the load, and any portion assumed), and one next action taken from alternatives the engine returned. "Show calculation" opens a receipt of every food, portion, index and load, with its source marked checked or unverified.

**A real answer (****16**** October):** "Two eggs, a slice of rye bread and half an avocado" costs 7.2 glycemic load against the day's 45, so it fits with 37.8 left; the rye bread drives the load, and the answer says which portions were assumed.

**What it does when it does not know:** a food the database lacks is never costed under a neighbour's name. The answer says it does not have it and asks what is in it. A meal with a missing food is costed without it, labelled partial, and never called a fit. One narrow exception: a prepared dish the database lacks can be counted from its own ingredients, each of them in the database, and is shown as an estimate with its assumed weights, never as a plain fit. Foods with no glycemic index (pizza, candy, packaged foods) show carbohydrate, fibre and calories and never an invented load.

## At a glance

The rules answer first and never reach a model; a meal question goes through the engine's tools, an advice question to the advisor, and every written answer passes the verifier before it is shown. If a number cannot be traced, the answer is regenerated once, then replaced by one built only from tool output.

## Requirements

All V0 requirements across the five epics are built, and so are many of the V1 items; the table marks what is built. Scope is by build window, not by importance: several V1 items would be required for a launch.

| Epic | Built (V0) | Next (V1) | Later |
|---|---|---|---|
| **A. Profile and targets** | Targets for energy, carbohydrate, protein, fat, fibre and glycemic load, each with its formula (A1, A2); permanent exclusions for allergies and dislikes (A3); a non-dismissible disclaimer (A4); a clear "not for you" for intensive insulin (A5); first-run tips that point at the real screen, one at a time (A6) | Targets that account for eating pattern, such as a vegan's protein | Three-way target split, if clinicians say it changes numbers |
| **B. Meal logging** | Log a meal in free text with portions estimated and correctable (B1); one clarifying question instead of a guess (B2); carbohydrate and glycemic load per entry (B3); budget left, always visible (B4); the foods a person logs again in one tap (B5); a meal logged on any of the last 14 days (B9); a meal planned up to 14 days ahead that counts only once it is marked eaten (B10) | None open at this level | Photo (B6), voice (B7), bread units (B8) |
| **C. The agent loop** | Verdict with number, reason and action (C1); at least two ranked alternatives (C2); a modification, not only a refusal (C3); show calculation (C4); no dosing, ever (C5); red-flag escalation (C6); unknown foods named, not guessed, and a dish counted from its ingredients as a labelled estimate (C7); an expandable tool trace (C8) | Memory of accepted and rejected suggestions (C9) |  |
| **D. Weekly menu** | A week of meals within ±10% of energy and under the glycemic budget (D1); a shopping list that follows what the person planned and falls back to the generated week (D2); regenerate one slot (D3); no dish within 3 days (D4); no plan for kidney disease or a history of an eating disorder (D6). Not clinically reviewed, and the app says so | The weekly cap of two per dish (D4) | Cooking time and cost (D5) |
| **E. Trust, safety, data** | Sign-in by email, with the profile and the diary (planned meals included) kept in an EU region and readable only by their owner (E1); every turn logged for evaluation (E2); every food record carries a source and a date (E3); one-tap export and deletion of everything (E4); a weekly report and an in-app feedback card for the people testing it (E5) | Counsel's review of the consent text |  |

**Non-functional:** a full agent answer under 10 seconds at p90 and a deterministic logging round trip under 3 seconds; identical inputs always give identical numbers; deterministic calculations run in the browser from the same module the engine uses; WCAG AA, 16 px minimum type and a full screen-reader pass on the logging flow, because the main persona skews 40 and over.

Also built beyond V0: a feedback form and a feedback card, a phone layout checked at 375 px with a dark theme, and a permanent address (diabite.pro) where one container serves both the app and the agent.

## Agents and safety

Three agents are split by what a question needs, and plain rules in front of all of them mean no prompt can talk the product out of a refusal.

| Agent | Model | Job |
|---|---|---|
| Router | gpt-5.4-nano | Reads the question and answers one word, meal or advice, in under a second |
| Meal specialist | gpt-5.4-mini | Calls the engine's tools (resolve foods, compute the meal, day state, alternatives) in two round trips, and is required to call them |
| Advisor | gpt-5.4-mini | General questions such as brown against white rice. No tools and no numbers at all, with a memory of food preferences and a knowledge base of our own documents |

**Rules that run before any model:**

| Rule | Fires on | What the person gets |
|---|---|---|
| Dosing | Insulin or a named drug, units, bolus, carb ratio, correction factor, in common spellings and with letters spaced or full-width | A refusal and a pointer to the care team |
| Red flag | Fainting, chest pain, confusion, vomiting, dizziness; shaking or sweating said in the first person; a glucose reading of 300 mg/dL or more, or under 70 (mmol/L converted, words such as "three hundred" read); "my sugar is low" | "Seek help now"; the food conversation stops |
| Prolonged fast | Not eating for a long period | A referral, no meal talk |
| Referral | Pregnancy, kidney disease, disordered eating | The targets were never derived for this; ask a clinician |

The rules are English only, on purpose, because the market is the US. The gate runs before the rate limits, so nobody describing a red flag is ever told to wait.

**Constraints in the targets themselves:** very low carbohydrate is blocked, with the reason shown, for an SGLT2 inhibitor, a sulfonylurea or basal insulin, gout, a history of disordered eating, age 65 or over, and brittle diabetes. A kidney-disease protein cap of 0.8 g per kg beats the floor for GLP-1 users, and the app says the two pull against each other.

**What the advisor may say:** direction without quantity (white rice raises glucose faster than pearl barley; fibre and fat slow a rise). What it should say when someone reports a low reading is an open question for the clinicians.

## Data

The catalogue holds 8,633 records, and a food it does not have is named as unknown, never guessed. How often real people ask for a food it lacks is not measured yet: there are no outside users, and the turn log of the last seven days is mostly our own test questions, many of them foods we know are missing on purpose.

| Layer | Records | Where it comes from |
|---|---|---|
| Ingredients and everyday foods | 364 + 86 | Curated by hand: USDA FoodData Central nutrients, the International Tables of Glycemic Index and Glycemic Load Values (2021) |
| Recipes | 2,000 | Composed from the ingredients; a dish's glycemic index is the carbohydrate-weighted mean of its ingredients. 1,662 of the 2,000 are used by the weekly menu |
| Coverage | about 4,600 | USDA survey (FNDDS) "foods as eaten"; glycemic index estimated from the median of its USDA category |
| Packaged foods (USDA Branded Foods) | 754 | Costed for carbohydrate, fibre and energy from the label and never for a glycemic load; a meal containing one is partial and never a fit |
| Unrated survey foods | 813 | USDA survey foods nobody has assigned a glycemic index (pizza, ready-to-eat cereal, candy); carbohydrate only, never a made-up load |

How numbers are built: available carbohydrate is total carbohydrate minus fibre, and glycemic load is glycemic index times available carbohydrate divided by 100. Curated records win a tie against the coverage layer. A record with real carbohydrate and no glycemic index stays out of the catalogue, because the arithmetic would report its load as zero, which is true of cheese and false of pizza. Records a human has checked show **checked** with a date; the rest show **unverified**, on every answer.

Search uses embeddings to pick which record a phrase means (a vector index in Supabase, with a copy built into the image as a fallback). Vectors choose the record; they never produce a number.

**What is stored about a person today:**

| Where | What | Notes |
|---|---|---|
| The person's account (Supabase, Ireland) | Email, profile, diary (planned meals included), the consent record | Row-level security: only the owner can read or write it; export and deletion in the app. The browser keeps a copy |
| One request to the engine | The meal sentence and the day's totals | Held in memory for an hour so the agent's tools can read them; not written to a database |
| The turn log | The meal sentence and a random session id | Kept 30 days in Azure Log Analytics, under a session id and never an account, email or address; the consent card says so |
| The advisor's memory | Food preferences only, expiring after 90 days | Chat summaries are off |
| Supabase `feedback` | Rating, comment, optional name and email, and which moment asked (the form, after the third meal, on a later day) | Insert-only for the public; nobody can read it back with the public key |

Accounts exist since 10 October: sign-in by email link or code, required. The data lives in an EU region, so GDPR applies; the consent text is a draft and no counsel has reviewed it. Deleting an account removes its profile and diary. The weekly report numbers people by sign-up order and carries no email, name or id.

## Quality

On 15 October the deployed agent passed 204 of 204 behavioural checks, with a median answer time of 4 to 5 seconds and a p90 of 7 to 9. On 12 October Azure AI Foundry's judges, with a different model as the judge, scored groundedness 74 of 75 and intent resolution 86 of 86.

| Measure | Target | Measured |
|---|---|---|
| Ungrounded numbers in answers | 0 | 99.9% of 3,680 turns logged in the seven days to 16 October were verified, our own test runs included |
| Food resolution on a fixed set | 90% or better | 191 of 191; clarification 31 of 31 |
| Safety phrasings handled correctly, no model | 100% | 63 of 63 (28 of them failed before 6 October) |
| Behavioural checks on the live agent | all | 204 of 204 on 15 October; 199 of 202 on 8 October |
| Answer time, p90 | under 10 s | 7 to 9 s (median 4 to 5 s) over 102 questions on 15 October; 8.2 s on 8 October |
| Share of food phrases that resolve to nothing | falling | Not measured on real users yet (our own tests: 168 of 2,656 evaluation turns in seven days named a food it lacks, on purpose) |
| Answer parsing in the app | both forms the model writes | 19 of 19 |
| Verifier probes | altered numbers rejected | 18 of 18 |

**How it is checked:** `npm run eval` needs no model and runs in a few seconds (food resolution, clarification, safety phrasings, answer parsing, the verifier, the diary, the week, planning, the weekly report); `npm run eval:abuse` proves the public route's limits against a real engine; `npm run eval:agent` runs the cases against the deployed agent; `npm run rehearsal` drives two real browsers through sign-in, sync, planning and the feedback card; and a model-graded run in Azure AI Foundry reports with its spread. Mechanical checks read tool results, not the product's wording, because checks that read prose broke the day the agent started sounding human. A phrase that ever gets past a rule becomes a permanent test.

**Model-graded scores.** Azure AI Foundry's judges, run on 12 October with a different model as the judge: intent resolution 86 of 86, groundedness 74 of 75, task adherence 96 of 102 and tool-call accuracy 64 of 75. The judge disagrees with the policy of asking when a food match is unsure, so most of its misses are that disagreement, and each was read. The one real fault it found (two hard candies counted as 320 g) was a data fault and was fixed. The live checks that missed on 8 October named the dish and not its heaviest food, a wording miss and not a wrong number.

## Architecture, security and operations

One container in Azure serves both the app and the agent's tools at a permanent address, so there is no second service and nothing to start before a demo.

| Piece | Where | What it does |
|---|---|---|
| App | React, Vite and TypeScript, served by the engine | Sign-in, onboarding, ask screen, diary with planning, weekly menu, feedback |
| Engine | Express and TypeScript on Azure Container Apps, one replica | `/tools/*` for the agents, `/agent/ask` for the browser, the verifier, the rules |
| Agents | Azure AI Foundry prompt agents | Router, meal specialist, advisor; the engine's tools are called through an OpenAPI tool with a key |
| Data | Supabase (Postgres, pgvector) | Food index, accounts (sign-in, profiles, diary), feedback |
| Build and deploy | GitHub Actions builds the image on every push; `npm run deploy` puts it live | Deploy is a human step on purpose: the CI identity can only push images |
| Traces | Application Insights attached to the Foundry project | Every agent run, with tokens, time and tool calls |

**What protects it** (from a security audit on 5 and 6 October, closed on 8 October and checked against the running service):

- **The one public route that spends money** (`POST /agent/ask`) has size caps (500-character message, 32 KB body), 30 asks per 10 minutes and 200 a day per address (IPv6 per /64), 60 an hour per conversation, a daily ceiling on model turns, and answers only to its own origin. The safety rules run before these limits.
- **The tool routes** answer only with a key, held as a Container App secret and compared in constant time.
- **The browser** is told to refuse foreign scripts, framing and sniffing (Content-Security-Policy and five other headers).
- **Errors** reach the browser as fixed text, never an upstream message.
- **Supabase**: row-level security, and the public role holds only insert on `feedback` and select on `foods`.
- **Secrets** are in Container App and GitHub secrets, never in the repository, the image or a log.

**Still open:** a control on feedback spam; clean-up in the Azure portal (two stale federated credentials, three test agent identities, overlapping roles). Logging typed questions by default was decided on 15 October: they are kept for 30 days and the consent card says so. Moving from one replica needs Redis for sessions and limits, which is part of the work after the course.

**Monitoring:** one JSON line per turn into Log Analytics (verified, regenerated, unknown phrases, clarifying questions, p90), the traces above, and a weekly report of how the people testing it use it (`npm run report`: sign-ups, first meal, return on day 2 and day 7, in-range days, feedback).

## Validation

The first clinical review found a real bug within a day, and no clinician has signed off on the product. The first outside feedback, from Demo Day, was that a flat "no" pushes people away: the answer now names a change and the engine counts it.

**Clinical review.** Every decision the product makes about a person is written into one pack of twenty questions, about forty minutes to read: the energy and protein targets, what is blocked and why, the rules that stop a conversation, and the glycemic-load ceiling. Three physicians hold it. On 2 October the first review caught a protein floor for people on GLP-1 drugs that ran after the kidney cap and quietly undid it; the kidney number now wins and the app says the two pull against each other. Brittle diabetes was added at the same reviewer's suggestion. "Reviewed by" is not claimed, because that is a statement about a clinician's professional judgement.

| Open clinical question | Why it matters |
|---|---|
| Q7 to Q9: is a daily glycemic-load ceiling defensible | It is our own construction, not a guideline |
| Q4: a protein cap of 0.8 g per kg for kidney disease without knowing the stage | An unstaged cap may do more harm than none |
| Q12: the glucose thresholds, and what to say below 70 | The advisor's reply to a low reading is the live question |
| Q18: the calorie-counting objection | The ceiling is derived from the calorie target, so the objection sits inside the design |
| Q19, Q20: lean mass on GLP-1 drugs; splitting targets three ways | May change wording, or the numbers |

**User sessions.** Five people with type 2 diabetes, prediabetes or insulin resistance in the US, 30 minutes each on the hosted app, not friends. The rule for the moderator: when someone is stuck, say nothing for ten seconds. What we want to learn: whether people open the receipt unprompted, what they actually type, what they do at "I don't have that food", whether they understand glycemic load, and whether they arrive wanting to log what they already ate. Every phrase a participant types that the product cannot resolve becomes a test case that week.

## After the course

The work to a public launch was sized on 8 October at about 83 to 106 working days across nine workstreams, 17 to 21 weeks of one builder, before waiting on clinicians, counsel and recruited users; photo and voice logging and the iteration stream come after. The sizes below have not been re-estimated. Since then most of WS3 (accounts, the diary kept on the server, export and deletion, the week view) and parts of WS0, WS2 (packaged-food records, dish estimates), WS4 (the menu back with regeneration, frequent foods) and WS9 (the diabite.pro address) have been built.

**Three stages, each with a gate:**

| Stage | Who | Gate to the next stage |
|---|---|---|
| A. Five strangers | 5 people, 30 minutes each | Sessions recorded; every phrase that broke the product is a test |
| B. Beta | 10 to 20 people for two weeks | Parsing 90% or better on their phrases; verified rate 98% or better of live turns; recommendation acceptance 40% or better; time to log under 20 s; no harm failure |
| C. Launch | Public, US | Verified 99% or better; activation 50% or better; week-4 retention 30% or better; clinician review of all safety copy; FDA general-wellness position confirmed by counsel; data provenance shown in the app |

A harm failure (a wrong dose, a missed red flag, a refusal that did not refuse), a verified rate under its line for more than a day, or a systematic class of unknown foods moves a stage back. The north-star metric after launch is in-range days per active user, a median of 4.5 of 7 by week 8; nothing counts it until a diary survives closing the tab.

**Workstreams** (estimates of working days for one builder with AI tools):

| Workstream | What | Days |
|---|---|---|
| WS0 Defects and debt | Potato family, fries and school records, "unit of bread" over-block, driver naming, re-measure | 3.5 to 4 |
| WS1 Validation | Clinical answers into changes, five sessions, a two-week beta | 10 to 14 |
| WS2 The food gap | A branded-food answer type, four composite dishes, USDA branded ingestion, verifying 364 ingredient indices with a dietitian, restaurant chains | 16 to 24 |
| WS3 Accounts and diary | Server-side diary, export and delete, privacy statement, history and trends | 9 to 11 |
| WS4 Next-version features | Frequent meals, memory, the menu back with regeneration, eating-pattern targets, three-way split | 12 to 14 |
| WS6 Compliance | FDA position, privacy and terms, accessibility to WCAG AA, clinician review of copy | 10 to 11 |
| WS7 Platform | Redis and more than one replica, alerts, CI evaluations, a runbook, model upgrade cycles | 8.5 to 10 |
| WS8 Security follow-up | Logging default, feedback spam, portal clean-up, a penetration test | 3 to 4 |
| WS9 Going to market | Payments, free-tier limits, landing page, analytics, support | 11 to 14 |
| **To launch** |  | **83 to 106** |
| WS5 Photo and voice | After the diary exists | 11 to 16 |
| WS10 Iteration | CGM import, personalisation, caregiver view, clinician summary | not sized |

**Not built yet, on purpose:** photo and voice logging; a second model, region or queue; other languages in the safety rules; reminders, recurring meals, and a plan the agent knows about.

## Economics

The aim is investment to keep developing the product, so what matters is what it costs to run, fixed and variable, and what the build to a public launch costs. **Variable:** a question costs about €0.0026 in model charges, so this part grows with use. **Fixed:** about €26 a month in the measured period (an always-on replica and the registry), plus Supabase and the domain. 1,000 people asking daily cost about €470 a month in all. The build to launch needs €10,800 to €111,500 depending on how much is built by others (see Use of funds). Every price for outside specialists is an assumed range to be replaced by quotes; the draft financial plan is being rebuilt from these measurements.

**Measured** (Azure Cost Management and Foundry traces, 20 September to 8 October, 1,941 questions): about 4,900 tokens in (74% cached) and 140 out per question for the meal and advice agent; billed about €0.0026 a question, memory and context included; about €26 a month fixed (an always-on replica and the registry). The Azure Pricing Calculator gave €243.72 for a month of 135,000 questions, but it shows the always-on replica as €0 and prices the traced tokens, which are 57% under the bill; the figure to budget for that month is about €415.

| Active users, each asking | Model charges | Fixed (Azure, Supabase, domain) | Total a month |
|---|---|---|---|
| 1,000 at 2 a day | €156 | €100 to 130 | about €275 |
| 1,000 at 4.5 a day | €351 | €100 to 130 | about €470 |
| 1,000 at 7 a day | €546 | €110 to 140 | about €675 |

**Pricing plans:** Free (the whole deterministic engine, with 15 agent answers a month, about €0.04 a user) and Pro, at **$14.99 a month or about $112 a year** as the starting price, with $19.99 tested against it. The price is to be set from the sessions and the beta, not from a table.

**Use of funds:** the cash to reach a public launch, by who builds it. The founder's own time is not priced; the contractor day rate is assumed at €400 to 700.

| Way to build it | Founder's days | Cash to launch |
|---|---|---|
| A. The founder builds, buys only services (dietitian, counsel, accessibility audit, penetration test) | 83 to 106 | €10,800 to 37,300 |
| B. Hybrid: a contractor takes accounts, platform and going to market | 55 to 71 | €22,200 to 61,800 |
| C. A contractor builds it all | none building | €44,000 to 111,500 |

## Decisions, risks and sources

Nine product decisions are listed, five questions are for the clinicians, and the biggest risk is that the answers do not arrive.

| Decision | Options | Recommended |
|---|---|---|
| Branded foods | Leave unknown; carbohydrate only with "glycemic load not available"; estimate by category | Carbohydrate only, shown as a visibly different kind of answer. Estimating by category breaks the promise. Decided and built (9 October) |
| Accounts | An anonymous device id, or real sign-in; store the diary only, or the profile too | Decided 10 October: real sign-in by email, profile and diary on the server, so every user is a known person who can be asked what happened. Built; required |
| What we promise about data | Deletion on request is the floor; the wording in onboarding | A plain statement of what is kept. The data is held in the EU, so data protection needs counsel |
| Weekly menu | In the product now, or after the sessions | Decided 10 October: in the product, hidden for two profiles, labelled as not clinically reviewed |
| Logging meal sentences | On by default, or only during sessions | Decided 15 October: on, kept 30 days under a session id only, and the consent card says so |
| Feedback spam | A control before the sessions, or not | Open |
| Deploying on push | Keep the human step, or give the CI identity rights over the app | Keep it for now |
| Incentives | Whether session participants are paid | Open |
| Price | Which to test | $14.99 against $19.99, from the sessions and the beta |

**For the clinicians:** what the advisor says on a low reading (Q12); the ceiling (Q7 to Q9); the unstaged kidney cap (Q4); eating pattern and protein; splitting targets three ways (Q20).

**Risks that shape the plan:**

1. **No one answers.** Clinical and legal answers gate three workstreams. Ask several people early, and plan so one slow reply does not stop the rest.
2. **The unknown rate stays high** because branded foods dominate what people eat.
3. **Holding health data** changes what DiaBite is, and carries legal weight.
4. **One builder** is a single point of failure.
5. **Regulation.** Whether a "can I eat this" verdict for people with diagnosed diabetes stays inside FDA general-wellness guidance is the sharpest open risk; no counsel has been consulted yet.
6. **Azure has bad mornings.** On 8 October nine of eighteen turns failed inside ten minutes with connection timeouts, then not again; at launch this needs an alert and a runbook, and the demo needs a recording.
7. **A model upgrade can change behaviour the tests do not cover**, so each one is an evaluation cycle.

**Sources.** This document summarises the project's own papers, kept in the repository: `docs/PRD.md` (the course PRD, Weeks 1 to 5, with a revision log), `docs/PRD-post-course.md`, `docs/COST-post-course.md`, `docs/PLAN.md`, `docs/``ROADMAP-to-investors.md`, `docs/``CLINICAL_REVIEW.md`, `docs/USER_SESSIONS.md`, `docs/``FEEDBACK-demo-day.md`, `docs/``security/security-plan.md`, `docs/engineering/` (the plans for dish estimates, the week, first-run tips, planning, and monitoring), `docs/monitoring.md` and `docs/FINANCIAL_PLAN.md` (draft, flagged as built on costs about six times too high). External figures: [CDC National Diabetes Statistics Report](https://www.cdc.gov/diabetes/php/data-research/index.html) and [ADA, Economic Costs of Diabetes in the U.S. in 2022](https://diabetesjournals.org/care/article/47/1/26/153797/Economic-Costs-of-Diabetes-in-the-U-S-in-2022), both opened on 8 October 2026; costs from Azure Cost Management and the Azure retail price list.
