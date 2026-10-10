# DiaBite — PRD, part 2: everything after the course

**Author:** Nadia Babich · **Written:** 8 October 2026 · **Status:** Draft for the owner's review
**Companion to:** `docs/PRD.md` (Weeks 1–5, the build window), `docs/PLAN.md`, `docs/CLINICAL_REVIEW.md`, `docs/security/security-plan.md`, `docs/FINANCIAL_PLAN.md`

This document is the scope of work that remains once the course ends. It does
not repeat the problem, the users or the central claim: those are in
`docs/PRD.md` and have not changed. It answers three questions: **what is
still to be built, in what order, and what does each part need** (days,
decisions, people, money), so the next step, putting a price on it, starts from
a written scope rather than a feeling.

> **How to read the numbers.** Every size below is an **estimate** of working
> days for one builder working with AI coding tools, five working days a week,
> *excluding* time spent waiting on other people (clinicians, counsel,
> recruited users). Where a size comes from an earlier document it says which.
> A range is a range: the low end if nothing surprising turns up, the high end
> if one thing does. Nothing here is a commitment.

---

## 1. Where we are

Measured on 8 October 2026 against the running service.

| | State |
|---|---|
| The promise | Every number computed by a deterministic engine and checked by a verifier before it is shown. No model produces a nutrition number |
| Product | Onboarding with targets and their derivation, ask screen, diary, weekly menu (built, never shown to a user), feedback form, phone layout |
| Agents | Router (`gpt-5.4-nano`), meal specialist (`gpt-5.4-mini`, with tools), advisor (`gpt-5.4-mini`, no tools, no numbers, memory and knowledge base), all in Azure AI Foundry |
| Catalogue | 6,054 foods: 351 ingredients, ~85 everyday foods, 1,000 recipes, 4,618 USDA survey foods |
| Quality | Measured 9 October 2026. Engine: food resolution 101/101, clarification 24/24, safety phrasings 72/72, portions 4/4, partial meals 6/6, answer parsing 17/17, verifier 16/16, plus checks that no costable record has carbohydrate without a GI, that stored data is not trusted blindly and that a hung call is retried once. Live agent after branded foods and the menu: **94 of 94 answered, 243 of 243 mechanical checks** (10 October; an earlier run on 9 October was 198 of 199, the miss being a check that read prose). Foundry model-graded: task adherence 79/90 (mean 0.91), intent resolution 74/74 (4.93), tool-call accuracy 62/63 (4.95), groundedness 61/63 (4.84). Answer time, **measured on the server's own clock on 10 October** (the network to the service is 0.09 s, so it is not the connection): 20 sequential turns, median 20 s, p90 27 s, max 47 s, with 13 rate-limit waits of 8 to 16 s in the log; six turns a few minutes later 10 to 13 s with none. The 8 October figure of 4.7 s median and 8.2 s p90 is no longer true, and the target (p90 under 10 s) is **missed**. Cause not yet established: the model deployments hold 200,000 tokens a minute, far above what a single user spends, so which limit answers 429 is the open question; the log now records the reply's message and rate-limit headers |
| Safety | Rules before any model (dosing, red flags, fasting, referral); public route limited per address, per conversation and per day; browser headers; secrets held as secrets |
| Hosting | One container on Azure Container Apps serving app and engine at a permanent address; image built by GitHub Actions; deploy is a human step on purpose |
| Cost, measured | About €0.0026 per question in model charges; about €26 a month fixed (always-on replica and registry, at list price) |
| Validation | Three physicians hold the review pack; the first review changed the product within a day; no clinician has signed off |
| Users | None yet beyond the owner. Five moderated sessions are written and not scheduled |

**What the course delivered is a demonstrated architecture, not a launched
product.** The distance between the two is this document.

---

## 2. What "done" means after the course

Three stages, each with a gate. These are the PRD's own launch table, restated
so the work below can be sorted by which gate it serves.

| Stage | Who | Gate to enter the next stage |
|---|---|---|
| **A. Five strangers** | 5 people with type 2 diabetes or prediabetes, 30 minutes each | Sessions recorded; every phrase that broke the product is an evaluation case |
| **B. Beta** | 10–20 people for two weeks | Parsing ≥ 90% on *their* phrases; verified rate ≥ 98% of live turns; recommendation acceptance ≥ 40%; time to log under 20 s; no Harmless failure |
| **C. Launch** | Open to the public in the US | Verified ≥ 99%; activation ≥ 50%; week-4 retention ≥ 30%; clinician review of all safety copy; FDA general-wellness position confirmed with counsel; data provenance shown in the app |

A **Harmless failure** (a wrong dose, a missed red flag, a refusal that did not
refuse) moves any stage back. So does a verified rate under its line for more
than a day, and a systematic class of unknown foods.

**North-star metric after launch:** in-range days per active user per week,
target a median of 4.5 of 7 by week 8. Nothing counts it today; it needs a diary
that survives closing the tab (workstream 3).

---

## 3. Principles that do not change

1. **The promise.** A model never produces a nutrition number. A change that
   would let it is stopped and reported.
2. **The gate runs before the limits**, and rules run before any model.
3. **A food the database lacks never enters the arithmetic under a neighbour's
   name.** It is unknown, and the app says so.
4. **Medical thresholds and advice are the clinicians' to decide.** We record
   the question and leave the behaviour alone until they answer.
5. **What is stored about a person is the owner's decision,** and needs
   deletion on request, a plain statement of what is kept, and row-level
   security from the first migration.
6. **Every phrase that gets past a rule becomes a test.**

---

## 4. Workstreams

Ten, ordered by when they are needed, not by size. Each has: why, what, done
when, depends on, size, and what it costs to run or buy.

### WS0 — Known defects and debt  ·  3½–4 days

*Why:* these are found, reproduced and small. Several sit on the demo path.

| Item | Detail | Size |
|---|---|---|
| Potato family | The curated "Potato, boiled" record carries the alias "baked potato", so a baked potato is costed as boiled. Bare "potato" silently means boiled although preparations differ from GI 56 to 94. Add "potato" to the category words so the agent asks; remove the alias; add cases | 1 d · **Status: done 9 Oct** |
| Chips and school records | "french fries" resolves to a school-lunch record on a 60 g portion; USDA fries all share one estimated GI. Down-rank school variants; prefer the generic record | 0.5 d · **Status: done 9 Oct** |
| Odd clarifying questions | "pizza" and "avocado toast" ask about dessert pizza or a topping. Follows from the rule that keeps no-GI records out (rule 4 in `CLAUDE.md`); resolved properly by workstream 2 | in WS2 |
| `unit` / `units` over-block | "a unit of bread" is refused as a dosing question. Narrow the pattern with the cases kept | 0.5 d · **Status: done 9 Oct** |
| Driver naming | The prompt says to name the item with the largest load, not the dish; the model sometimes names the dish. Three live checks failed on this on 8 October. Tighten the prompt, rerun the agent evals | 0.5 d · **Status: no failure in the 9 Oct run (90 cases); prompt left as is** |
| Re-measure | Rerun the Foundry model-graded evaluation (last run: September, before three agents' worth of changes) and refresh every quoted figure | 0.5 d · **Status: done 9 Oct; figures above** |
| Document consistency | The PRD text still describes earlier states in places; one pass | 0.5 d |

*Done when:* the potato, fries and unit cases are tests, the live agent run is
clean, and the quoted numbers carry a date. **9 October: met**, except "Odd clarifying
questions" (workstream 2) and "Document consistency" (a pass over the PRD text, not
yet done). Also fixed the same day, from a code review: see `docs/security/security-plan.md`.

### WS1 — Validation with real people and clinicians  ·  10–14 days of work, 6–10 weeks elapsed

*Why:* the product's claims have been tested by us and by one physician's
read. Both clinical and user validation are gates.

- **Clinical answers to changes.** Three physicians hold the pack (20 questions).
  Each answer becomes code, a test or a documented decision. Open items: the
  daily glycemic-load ceiling (Q7–Q9), the unstaged kidney protein cap (Q4), the
  glucose thresholds and what to say below 70 (Q12, which is also the open
  question about the advisor's reply to a low reading), whether blocking beats
  warning (Q10–Q11), the calorie-counting objection that sits inside the design
  (Q18), lean mass and bone on GLP-1 drugs (Q19), and splitting targets three
  ways (Q20). *Size 2–4 days, depends on how many answer.*
- **Five moderated sessions** (`docs/USER_SESSIONS.md`). Recruiting is the
  owner's. Run, transcribe, analyse, fix. *Size 3–4 days of work.*
- **Beta, 10–20 people for two weeks.** Triage feedback, turn unresolved phrases
  into cases, watch the live metrics. *Size 4–6 days spread over two weeks.*
- **Read the advisor's answers** (A1–A7 in `docs/advisor-samples.md`): the
  checks say they are safe, only a dietitian can say they are right.

*Done when:* the stage A and B gates in section 2 are met.
*Depends on:* the owner recruiting; clinicians answering.
*Costs:* clinician time is unpaid so far. Offering to pay was ruled out by the
owner; if that changes it becomes a cost line. Participant incentives, if any,
are a decision.

### WS2 — The food gap  ·  16–24 days

*Why:* about 13% of what people type resolved to nothing before branded foods (13.6%, 17 of 125 food phrases on 9 October; **7.1%, 9 of 127, on 10 October** with 737 branded products loaded; what is left is kugel, which is deliberate, and General Tso's chicken, fried rice and biscuits and gravy, the composite dishes below), mostly branded
foods with no published glycemic index. It is the most visible weakness and
the first thing a user will hit.

| Item | Detail | Size |
|---|---|---|
| Branded foods answer type | Decision needed (§6). Recommended: carbohydrate, fibre and calories from USDA Branded Foods, and an explicit "glycemic load not available" instead of a number. A visibly different kind of answer, with engine, prompt, UI and cases | 3–4 d |
| Four composite dishes | Grits, biscuits and gravy, fried rice, pepperoni pizza, built from ingredients we hold (`docs/PLAN.md` sizes this at a day) | 1 d |
| USDA Branded Foods ingestion | The dataset is large; it changes index size, search latency and what the vector store costs | 4–6 d |
| Verify ingredient GI against sources | 351 ingredients, each against its cited table. Needs a registered dietitian or a researcher; the PRD calls this out as required before external use | 5–8 d, plus the person |
| Restaurant chains | Common US chains; needs a source (menu nutrition pages or a dataset) and a licence check | 3–5 d |
| Re-measure | Unknown rate on the same field set, reported beside the old one | 0.5 d · **Status: done 9 Oct; figures above** |

*Done when:* the unknown rate is measured again and reported next to 13%,
every curated GI carries a verified source and date, and a branded product
answers in the agreed way.
*Depends on:* the branded-foods decision; a dietitian for GI verification.
*Costs:* a dietitian (the draft plan assumed a contract role at $3.0k a month
from month 2; hours needed here are far fewer, to be quoted); a possible
licence for any commercial source; extra vector storage.

### WS3 — Accounts, a diary that survives, and history  ·  9–11 days

*Why:* today the profile and diary live in the browser. Close the tab and
DiaBite has never met you. History, trends, the north-star metric, corrections
as data and memory worth having all wait on this.

Three questions from `docs/PLAN.md` are the owner's and come first (§6): what
is stored, what is promised, and whether an account is needed at all for V1. The
recommended start is a **device-scoped anonymous id**: history and trends with
no name, no email, no sign-in.

| Item | Size |
|---|---|
| Server-side diary and profile, anonymous or signed-in, with row-level security from the first migration | 2–3 d (+2 for full sign-in) |
| Export and delete everything (PRD E4) | 2 d |
| A plain statement of what leaves the browser, in onboarding; privacy policy draft | 1 d (+ counsel, WS6) |
| History and trends screens; in-range days metric | 4–5 d |

*Done when:* a person can close the app, return tomorrow on another device and
see yesterday's day; export and deletion work and are tested.
*Depends on:* the three owner decisions. The owner lives in the EU, and a
service that stores health data about identifiable people is subject to GDPR as
well as US rules; this needs counsel, not a guess (WS6).
*Costs:* Supabase Free to Pro as volume grows; storage is small; the main cost
is legal.

### WS4 — Product features for the next version  ·  12–14 days

From the PRD's own MVP 1 row and the open design questions.

| Item (PRD id) | Size |
|---|---|
| Frequent and recent meals, one tap (B5) | 1½ d |
| Persistent memory of accepted and rejected suggestions (C9), built on WS3 | 2 d |
| The weekly menu back in the product: single-slot regeneration, no dish repeated within 3 days (D3, D4). Postponed until after clinical review; `docs/PLAN.md` sizes it at 3–4 days | 4 d |
| Does eating pattern change the targets? A vegan's protein target is the open question from Week 2. Needs a clinician | 2 d |
| Three-way target split (overweight, prediabetes, established type 2), if the clinicians say it changes numbers | 2–3 d |
| What to say about lean mass and bone on GLP-1 drugs (Q19) | 1 d |

*Done when:* each has acceptance cases and passed a clinician's read where it
touches a number or advice.
*Depends on:* WS1 answers, WS3.

### WS5 — Photo and voice logging  ·  11–16 days  ·  *Later*

*Why:* the most requested feature in the category and the easiest to do badly.
It needs the diary first (`docs/PLAN.md`).

- **Photo → candidate dishes → the user confirms; portion adjustable** (B6).
  A vision model, a confirmation screen, a portion estimate, and its own
  evaluation set; portion estimation is already named as the largest accuracy
  risk. *8–12 d.*
- **Voice → transcript → the same path** (B7). *3–4 d.*

*Costs:* a vision call per photo is a new, unmeasured cost per question; measure
before pricing. The draft plan assumed photo logging on 15% of logs.

### WS6 — Compliance, accessibility and copy review  ·  10–11 days of work, 4–8 weeks elapsed

| Item | Size |
|---|---|
| FDA general-wellness position: counsel's opinion on whether a "can I eat this" verdict for people with diagnosed diabetes stays inside it. The PRD calls it the sharpest open risk | 2 d of work, weeks of waiting |
| Privacy policy, terms, consent wording; data-protection basis for EU-based operation | 2 d + counsel |
| Accessibility to WCAG AA: 16px minimum type, contrast, a full screen-reader pass on the logging flow (the primary persona skews 40+) | 4–5 d |
| Clinician review of all safety copy | 2 d |

*Done when:* counsel's written position exists, the audit passes, and the copy
carries a reviewer's name with their consent.
*Costs:* **counsel** (no quote yet), an accessibility audit if external.

### WS7 — Platform and operations  ·  8½–10 days

| Item | Size |
|---|---|
| Lift the one-replica limit: sessions, limits and the daily ceiling move to Redis (the code already says where) | 3–4 d |
| Budget alerts, availability alert, a monitoring view of the daily metrics | 1 d |
| Run the engine and abuse suites on every push in CI | 1 d |
| A runbook: deploy, roll back, rotate the engine key, what to do when Azure has a bad morning (it did on 8 October) | 1 d |
| Backups and restore for anything stored (WS3) | ½ d |
| Model upgrade cycles: each new model needs the agent evals rerun and the prompts rechecked | ~2 d each time |

*Decision:* whether a push should deploy itself. It would mean giving the CI
identity rights over the running app (today it can only push images).
*Costs:* a managed Redis; a second replica roughly doubles the fixed compute.

### WS8 — Security follow-up  ·  3–4 days plus external items

The open items of `docs/security/security-plan.md`: the logging default for
meal sentences (S6), a control on feedback spam (S9), the Azure portal clean-up
(stale federated credentials, test agent identities, overlapping roles, S10–S11),
Dependabot, pinned actions and base image. An external penetration test is
recommended before launch.
*Costs:* a penetration test quote.

### WS9 — Going to market  ·  11–14 days  ·  *depends on the finance work*

Only meaningful once the finance section is done and the price is decided.

| Item | Size |
|---|---|
| Payments and entitlements (free tier, paid tier; today everything is open) | 4–6 d |
| Per-user limits for the free tier (needs accounts; the current limits are per address) | 2 d |
| A landing page and a way to reach the people it is for | 2–3 d |
| Product analytics for activation and retention (privacy-respecting) | 2 d |
| Support: a channel and a way to answer | 1 d |

*Costs:* payment processing fees, email, a domain, analytics.

### WS10 — Iteration  ·  ongoing, not sized

CGM import, personalisation from measured glucose response, a caregiver view,
a clinician summary. Each is its own product decision and is only worth
planning once stage C has users.

---

## 5. Sequence

```
Phase 1  Survive five strangers      WS0, start WS1 (sessions), the branded-foods and accounts decisions
Phase 2  Trust                       WS1 (clinical answers, beta), WS2 (food gap), WS8
Phase 3  Foundation                  WS3, WS4, WS7, WS6 (counsel starts early: it is the slowest thing)
Phase 4  Launch                      WS6 sign-offs, WS9, stage C gate
Later                                WS5, WS10
```

Counsel and clinician replies are the long poles: ask early, plan work around
the answers rather than waiting on them.

### Effort summary

| Workstream | Days (low–high) | Elapsed constraint |
|---|---|---|
| WS0 Defects and debt | 3½–4 | none |
| WS1 Validation | 10–14 | clinicians, recruiting, two-week beta |
| WS2 Food gap | 16–24 | a dietitian for GI verification |
| WS3 Accounts and diary | 9–11 | owner decisions; counsel |
| WS4 Next-version features | 12–14 | clinician answers |
| WS5 Photo and voice (later) | 11–16 | WS3 first |
| WS6 Compliance and accessibility | 10–11 | counsel, weeks |
| WS7 Platform and operations | 8½–10 | none |
| WS8 Security follow-up | 3–4 | pen-test booking |
| WS9 Going to market | 11–14 | finance work |
| **Total** | **~95–122 working days** | **about 19–24 weeks of one builder's time; longer elapsed** |

WS10 is not in the total.

---

## 6. Decisions needed from the owner

1. **Branded foods:** leave unknown; carbohydrate only with "glycemic load not
   available" (recommended); or estimate by category (breaks the promise, not
   recommended).
2. **Accounts:** an anonymous device id, or real sign-in; and what is stored,
   diary only or the profile (diagnosis, medicines, kidney status) as well.
3. **What we promise about data:** deletion on request is the floor; the wording
   of the statement in onboarding.
4. **Weekly menu:** back in the product now or after the sessions (currently:
   after clinical review).
5. **Logging meal sentences** by default or only during sessions (recommended:
   off, on for sessions).
6. **Feedback spam:** worth a control before the sessions?
7. **Whether a push deploys by itself.**
8. ~~Whether clinicians are paid.~~ **Answered 8 October:** the owner pays no one today and will need consultants and developers later. The cost calculation therefore prices three ways of splitting the work between the owner and bought help (`docs/COST-post-course.md`); whether session participants get an incentive is still open.
9. **Which price to test,** after the finance work (the draft plan proposes
   $19.99 a month or $149 a year; it was built on costs about six times too
   high).

**From the clinicians:** what the advisor says on a low reading (Q12);
the ceiling (Q7–Q9); the kidney cap (Q4); eating pattern and protein; the
three-way split (Q20).

---

## 7. What we will not build yet

Photo logging before the diary exists. The weekly menu's extra features before
anyone has used it for a week. More recipes in bulk (the catalogue is short of
everyday foods, not of recipes). A second model, a second region or a queue
(the latency target is met). B2B2C channels and a clinician-facing view (not
underwritten). Another language: Russian and Spanish are out of scope for the
safety rules until the product leaves the US market.

---

## 8. What needs a price

The next step is the calculation. These are its inputs, with what is already
known.

| Line | Known |
|---|---|
| Model charges per question | **€0.0026**, measured from traces and Cost Management (`docs/monitoring.md`); photo calls unmeasured |
| Azure fixed cost | **About €26 a month** now (always-on replica, registry); a second replica and Redis take it to roughly €90–125 |
| Azure Pricing Calculator | to be filled from the table in the previous step |
| Supabase | Free today; the paid tier's price to be taken from the Supabase pricing page |
| Dietitian | draft plan: $3.0k a month on contract; hours here to be quoted |
| Counsel (FDA position, privacy) | no quote |
| Accessibility audit, penetration test | no quote |
| Commercial food or GI data | none chosen; USDA sources are free |
| Payments, email, domain, analytics | standard rates to be looked up once the price is chosen |
| The builder's time | **~95–122 working days**; its price is the owner's to set, as an hourly cost or as an opportunity cost |
| Clinician advisors | unpaid today; the owner pays no one now and expects to need outside help later (see section 11) |

Two ways to total it, both worth doing: **to launch** (WS0–WS4, WS6–WS9, the
effort above plus the lines that need quotes) and **to run** (the monthly cost of
operating at N active users, using the per-question and fixed figures).

---

## 9. Risks that shape the plan

1. **No one answers.** Clinical and legal answers gate three workstreams. Ask
   early, ask several, and plan so one slow reply does not stop the rest.
2. **The unknown rate stays high** because branded foods dominate what people
   actually eat. The answer type in WS2 is a product risk, not only an
   engineering one.
3. **Holding health data** changes what DiaBite is (WS3). It is the biggest
   decision here and the one with legal weight.
4. **One builder.** A solo build is a single point of failure, and a plan of
   five months of one person's time is a plan that should say so.
5. **Azure has bad mornings.** One episode (503s and timeouts for ten minutes)
   is the reason the demo needs a recording; at launch it needs an alert and a
   runbook (WS7).
6. **The prompt-and-model dependency.** A model upgrade can change behaviour the
   tests do not cover; every upgrade is an evaluation cycle (WS7).

---

## 9b. A dietitian's read of the market, 8 October

A registered dietitian and certified diabetes educator who runs a diabetes
wellness business in the US replied to the outreach. Recorded here because it
bears on four assumptions in this document and in the financial plans.

| What he said | What it changes |
| --- | --- |
| Strong apps (MacroFactor, Cronometer, MyFitnessPal, Lose It) cost about **$60 to $80 a year**; some insurers give patients free meal-scanning apps; pumps and CGMs ship their own apps | The price anchor is about $5 to $7 a month. The plan's $14.99 a month (about $180 a year) is two to three times it. At $6.99 a month, a net of €10,000 a month needs about 2,750 paying users (55,000 registered at 5% conversion), against 1,095 at $14.99 |
| In the US anyone diagnosed with diabetes or obesity is referred to a registered dietitian, covered by insurance and Medicare, and dietitians recommend tracking apps | The dietitian is the channel (the plan already named clinicians and dietitians as the only affordable one) and also the gatekeeper. The product has to be something a dietitian would recommend, which makes a clinician-facing summary (WS10, not underwritten) a candidate to move up |
| "Most people who start scanning their meals stop after a few months" | Retention is the risk to test, not assume. DiaBite asks at the moment of a decision rather than logging every meal, which may help, but week-4 retention is unmeasured |
| GLP-1 drugs are the biggest trend; people with type 2 diabetes on them use any nutrition app | The GLP-1 segment is where attention is; the product already raises the protein floor for it and the lean-mass question (Q19) is open. A hypothesis to test in the sessions, not a pivot |
| Someone with kidney failure, heart disease and diabetes needs safe advice for all three at once | Agrees with the risk already recorded. Today the product is cautious rather than comprehensive: a protein cap for kidney disease and a referral when asked |
| He read the outreach as "an app that scans carbohydrates" | The pitch message did not say what makes DiaBite different: no scanning and no tracking, a verdict at the moment of choice, with the arithmetic shown |

**What to do with it:** ask dietitians directly what would make them recommend an
app and what would make them stop; test a price near the market anchor in the
sessions and the beta; keep the product claim to "a verdict and the arithmetic
at the moment of choice", not "a nutrition app".

## 10. Costing

The first calculation is in `docs/COST-post-course.md`: the work to launch in
days, what has to be bought either way, three ways to split the build, and what
it costs to run. Its price ranges for outside specialists are **assumptions to be
replaced by quotes**.

## 11. People and outside help

None of this is hired today. What is needed, when, and what it unblocks:

| Who | For | Needed from | Form |
|---|---|---|---|
| Clinical advisors (physicians, dietitians) | WS1, WS4, WS6: answers, copy review | now | unpaid today; a paid advisory arrangement may be needed at launch |
| Registered dietitian | WS2 ingredient GI verification; sign-off on safety copy | phase 2 | part-time contract |
| Counsel (US health products, privacy, EU data protection) | WS3, WS6: FDA general-wellness position, privacy policy, terms | **ask now**: the slowest and gates three workstreams | one engagement, then on call |
| Developer(s) | WS3, WS7, WS9 can be handed over; WS2 data ingestion | phase 3 | contractor, hybrid or outsourced (cost document, section 4) |
| Designer | polish, empty states, accessibility fixes | phase 3 | short contract |
| Accessibility auditor | WS6 | before launch | one audit |
| Security tester | WS8 | before launch | one test |
| Support and community | WS9 | at launch | part-time, later |
| Nutrition-data operations; clinical and regulatory lead | keeping the data layer current; ongoing claims | after launch | the draft financial plan places these in months 16 and 19 |

## 12. Traceability

| This document | Source |
|---|---|
| Stages and gates | `docs/PRD.md`, Launch Plan |
| MVP 1 and Launch features | `docs/PRD.md`, Roadmap and Functional Requirements |
| Food gap, accounts, menu, not-yet-built | `docs/PLAN.md` |
| Clinical questions | `docs/CLINICAL_REVIEW.md` |
| Sessions | `docs/USER_SESSIONS.md` |
| Security items | `docs/security/security-plan.md` |
| Costs | `docs/monitoring.md` (measured), `docs/FINANCIAL_PLAN.md` (draft, flagged) |
| Defects | found 6–8 October; the potato family and the unit pattern are reproduced in this session |
