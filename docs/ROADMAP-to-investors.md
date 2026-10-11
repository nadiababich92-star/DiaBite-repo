# DiaBite — the plan to the first investor meeting, with no budget

**Written:** 11 October 2026 · **Status:** Draft for the owner · **Horizon:** about 16 weeks of work, counted from 12 October 2026; the end is set by the gates below, not by a calendar date
**Companions:** `docs/PRD-post-course.md` (the full scope after the course), `docs/COST-post-course.md` (what the paid parts cost), `docs/PLAN.md` (the earlier plan this replaces for the near term), `docs/CLINICAL_REVIEW.md`.

> **Two ground rules, confirmed by the owner on 11 October.** (1) **There is no investor date yet.** Recruiting and the meeting both start when the product is ready, so the phases below are ordered by **gates**, not by dates: a phase ends when its gate is met. The week counts are the builder's estimate of effort. (2) **Nothing is bought until money arrives.** No dietitian, no counsel, no penetration test, no accessibility audit, no contractors, no participant incentives. Every line below is something the owner and the builder can do for free, and each paid item is named once, in the use-of-funds table at the end, so the investor sees it as what the round pays for and not as a hole.

---

## 1. What an investor will look for, and what we will have by February

An investor in a health-adjacent app asks five things. The plan is built backwards from them.

| They ask | Today | By 31 January |
|---|---|---|
| **Does it work, live, without you standing next to it?** | Yes: permanent address, sign-in wall, 94 of 94 agent answers, p90 6 s | Same, plus a 7-day uptime record and a demo that survives a shared-Wi-Fi room |
| **Does anyone want it?** | Nobody but the owner has used it | 5 recorded sessions and a 2-week beta of 10–20 people, with activation, logs per person and return rate measured |
| **Is it safe, and is the claim defensible?** | Rules before any model; no number comes from a model; the verifier checks every number | A written safety case, free security checks published, and an honest statement of what has not been reviewed and why |
| **What does it cost to run, and to grow?** | About €0.0026 a question and about €26 a month fixed | Real per-user cost from the beta, and the paid items priced in `docs/COST-post-course.md` |
| **Why you, why now, why can't a big app copy it?** | Pitch deck v12, 3-minute video | Deck v13 with real numbers: "every number computed, not generated" shown against the field (the market analysis of 11 October: competitors publish recipe counts, none of the ones we found published a glycemic load per recipe) |

The thing that matters most is the second row. **An investor will forgive a missing dietitian; they will not forgive no users.** So the plan protects the weeks for recruiting and sessions first, and everything else bends around them.

---

## 2. The four phases

### Phase 1 — Finish what people will touch (12 October – 8 November, 4 weeks)

The product has to survive a stranger. Mostly my work; the owner decides and reviews.

| # | Work | Done when | Who |
|---|---|---|---|
| 1.1 | **Recipes to 2,000.** 642 left after batch 3: about five batches of ~130, each shown to the owner before it is loaded. After each batch, run the coverage study on the 231 everyday phrases and on the short names of the new dishes: a recipe that borrows a plain food's name, or duplicates an existing dish, makes the engine ask "which one?" | 2,000 recipes live; unknown rate on the 231-phrase set no worse than today (11 holes) | Builder |
| 1.2 | **Carbohydrate-only answers for foods with no glycemic index (owner's decision, 11 October).** 785 USDA survey foods with real carbohydrate and no assigned GI (pizza, hot-dog and egg sandwiches, ready-to-eat cereal, candy, puddings, sweet drinks) are outside the catalogue today, so the app says "I don't have that". They come in the way packaged foods already do: carbohydrate, fibre and calories are shown and costed, the glycemic load is **not**, the answer says that no glycemic index exists in our data but the carbohydrate information does, and a meal containing one is partial, so it is never "fits". Needs a change to rule 4 in `CLAUDE.md`, the engine, the answer wording and a republish of the agents; specified before it is built | The 785 foods answer with carbohydrate and the explicit label; the evals check the engine's own flags, not the prose | Builder, after the owner approves the spec |
| 1.3 | **Turn the prose-reading agent checks into tool-result checks** (rule 7). H9, H10, F16, F19 failed on wording, not on the product. Flaky red hides real red | Agent eval is green or red for a reason a person would accept | Builder |
| 1.4 | **Find the 46-second outlier** in the last agent run (p90 is 6 s; one request took 46 s). A demo is lost by its worst request, not its median | Cause named; a retry or a timeout so no request exceeds 15 s in 100 | Builder |
| 1.5 | **Look at the Menu and You tabs on a laptop and a phone with eyes**, not tests (memory: never seen after the layout change) | Screenshots at 1366×768 and 390×844 reviewed by the owner | Builder, owner |
| 1.6 | **History and trends in the Diary:** a 7-day view of glycemic load against the budget and the count of in-range days. The north-star metric needs a place to live, and an investor remembers a chart | A person who logged for a week sees their week | Builder |
| 1.7 | **Demo account, limits and a keep-alive.** Raise the per-address limit for demo day (30 asks / 10 min would block a room on one Wi-Fi), sign in once on the owner's own device, and confirm what happens to the Supabase free project if it sits idle (free projects are paused after a period of inactivity; check the current rule) | A demo that cannot fail for dull reasons | Builder, owner |
| 1.8 | **Azure continuity.** The subscription is a free trial. Find the date the credit or the trial ends, and what then stops. Apply to Microsoft for Startups (Founders Hub), which gives credits without requiring funding (check current eligibility) | End date known; a fallback written down | Owner |
| 1.10 | **Step A of the unknown-dish tool: cost a dish from its ingredients (owner approved the step on 11 October).** A new tool, `compute_from_ingredients`, takes a list of ingredient phrases with grams, resolves each against our tables, and returns the same numbers `compute_meal` does: carbohydrate, fibre, calories, and a glycemic load computed as the carbohydrate-weighted mean of the ingredients' indices. Anything that does not resolve is named and the answer is partial; if no ingredient has a glycemic index it falls back to carbohydrate only. The list comes first from what the person says ("it has chicken, rice and a sauce"); the agent confirms the dish with them before costing it and the answer says "counted from a typical recipe, your dish may differ". The model never types a nutrition number; the list of ingredients is an input, like a default portion. **Open decision: whether the agent may propose a typical ingredient list from its own knowledge when the person gives none; default until the owner decides: it asks.** Needs a spec before it is built (`/engineering-planner`), new engine cases and agent cases, and the verifier extended to the new tool's results | A dish we do not have can be costed from a stated list, with the verifier passing and the label on screen | Builder, after the owner approves the spec |
| 1.9 | **Tidy the loose ends only the owner can:** delete the old Entra secret (`UvH…`), decide about the git history that holds videos, the Team-slide photo | Closed or consciously deferred | Owner |

**Gate 1:** a stranger can sign up, log a meal, ask about a meal, see their week and see a menu without the builder present, on a phone and a laptop.

### Phase 2 — Five strangers, then the beta (9 November – 6 December, 4 weeks)

The protocol is written (`docs/USER_SESSIONS.md`). What is missing is people. This is the owner's phase.

| # | Work | Done when | Who |
|---|---|---|---|
| 2.1 | **Recruit, for free.** People with type 2 diabetes, prediabetes or insulin resistance in the US: patient communities and forums you already belong to (post by the community's rules; read them first), your own network's second circle (not friends), diabetes-education groups, university or clinic notice boards. No incentive: say so, and ask for 30 minutes | 8 people agreed for 5 slots (some will not turn up) | Owner |
| 2.2 | **Run five sessions.** The one rule: say nothing for ten seconds when someone is stuck. Notes only, no recordings of identifiable people without written consent | 5 sessions done | Owner moderates, builder is not in the room |
| 2.3 | **Every phrase that broke the product becomes an evaluation case, the same week.** This is the flywheel and a good investor story: real misses turn into permanent tests | New cases merged; fix or explain each | Builder |
| 2.4 | **Fix the top three findings** before the beta, whatever they are. If the finding is "nobody opens the receipt", that changes what we build, not what we explain | Three fixes shipped | Builder |
| 2.5 | **Measure without paid tools.** A weekly script reads the sign-in, profile and diary rows already in Supabase and reports: signed up, onboarded, first meal logged (activation), meals per person, returned on day 2 and day 7, in-range days. No third-party analytics, no tracking script, nothing new collected about a person | A one-page weekly report generated by one command | Builder |

**Gate 2:** five sessions done; at least three of five would use it again without being asked (the honest threshold for "wanted"); every unresolved phrase is a case.

### Phase 3 — The beta and the evidence (7 December – 3 January, 4 weeks, holidays included)

| # | Work | Done when | Who |
|---|---|---|---|
| 3.1 | **Beta with 10–20 people for two weeks** (the five from phase 2 first, then their referrals and the waiting list from 2.1). Let it be used without prompting | 10 people logged on at least 4 of 14 days | Owner recruits, builder watches the report |
| 3.2 | **The stage B gate from the PRD:** parsing ≥ 90% on the beta's own phrases, verified rate ≥ 98% of live turns, time to log under 20 s, no Harmless failure (wrong dose, missed red flag, refusal that did not refuse) | Measured and written down, pass or fail | Builder |
| 3.3 | **A free security pass, published.** `npm audit`, OWASP ZAP baseline against the staging address, Mozilla Observatory headers, a Supabase row-level-security test (one account cannot read another's rows), and the existing abuse suite. Findings and fixes go into `docs/security/security-plan.md` as "self-assessed, not independently tested" | Report written; high findings fixed | Builder |
| 3.4 | **A free accessibility pass.** axe and Lighthouse on every screen, keyboard-only and VoiceOver walk-throughs, 200% zoom. Contrast is already computed | Report; the blockers fixed | Builder |
| 3.5 | **A written safety case** (2 pages): what the rules gate catches (dosing, red flags, fasting, referral), what the verifier guarantees, the 72 safety phrasings, what is not guarded (gout, gastroparesis) and why the product says so. The physicians who hold the review pack: ask for a short, unpaid, **honest** note on what each did and did not look at. It is not a sign-off and is never called one | Safety case written; notes collected or declined | Builder writes, owner asks |
| 3.6 | **Close the free legal items.** (a) **Deferred to before commercial use (owner, 11 October):** write to the University of Sydney glycemic index database (the address is in `data/recipes-db/sydney_gi_db.json`) asking permission to cite their values in the product: `gi_sources.py` uses them as medium-confidence evidence and their terms say not to redistribute without permission. Name it on the use-of-funds slide as a known item. (b) Check the licence of every data source in one table (`docs/data-sources.md`): USDA public domain, the International Tables citation, Supabase, Open Food Facts if used. (c) A plain-language privacy page that says exactly what we store and how to delete it (the delete works), marked as a draft awaiting counsel | One table; the Sydney request listed as a launch item; privacy page live | Owner sends, builder drafts |
| 3.8 | **Step B of the unknown-dish tool (optional, decided from the sessions):** if five strangers show that unknown dishes are still a leading reason people leave, let the agent read an ingredient list from the web at the person's request, with their confirmation, feeding the same tool as step A. Page text is data, never instructions; only a fixed schema is extracted; the paid search tool's price and the sites' terms are checked first. If the unknown rate is small, skip it | Decision written down with the unknown rate from the sessions beside it | Owner decides, builder builds |
| 3.7 | **The real cost per active user** from the beta, replacing the assumed figures in `docs/COST-post-course.md` and `docs/FINANCIAL_PLAN.md` | Numbers from Cost Management and the traces | Builder |

**Gate 3:** two weeks of real use are on record, with the numbers, whether good or bad. A weak retention number honestly reported is more fundable than a missing one.

### Phase 4 — The investor package (4 – 31 January, 4 weeks)

| # | Work | Done when | Who |
|---|---|---|---|
| 4.1 | **Deck v13 with the beta's numbers** in place of promises; the competitor analysis (recipe counts, nobody shows the arithmetic) as one slide; the honest risk slide (no clinician sign-off yet; what the round buys) | Deck and a 3-minute video re-cut | Owner, builder |
| 4.2 | **A data room folder** the owner controls the access to: PRD, security plan, safety case, clinical review pack, eval results with dates, cost model, data-sources table, the weekly metrics | One folder, a one-page index | Builder prepares, owner shares |
| 4.3 | **Demo script v2 and three rehearsals** on the owner's own device, signed in, with a recorded fallback for the day the Wi-Fi fails | Three clean runs | Owner, builder |
| 4.4 | **The hard questions, answered in writing:** FDA (a general-wellness tool; no dosing; no diagnosis), who is liable if it is wrong, where the data comes from and under what licence, what happens if the model vendor changes, the unit economics, why a big app cannot copy a verifier | A page of questions with the owner's own answers | Owner, builder drafts |
| 4.5 | **The ask.** What the round pays for, mapped to the table in section 4 | A slide and a number | Owner |

**Gate 4:** the owner can run the demo and answer the five questions in section 1 from memory.

---

## 3. What I (the builder) will do, and what only the owner can

The split matters, because the plan fails on the owner's side first.

| Only the owner can | The builder does |
|---|---|
| Recruit people, run the sessions, ask the physicians and the University of Sydney, apply to Founders Hub, decide what is shown to investors, hold the investor relationship | Recipes, search quality, agent and engine evals, diary trends, metrics script, free security and accessibility passes, safety case, data-sources table, cost model, the data room, the demo reliability |

Anything that needs a person's name on it, or a conversation with a person, is the owner's. I will not recruit, message or invite anyone.

---

## 4. What waits for money (the use of funds)

From `docs/COST-post-course.md`, ranges are assumptions until quoted:

| Item | Why it waits | Range |
|---|---|---|
| Registered dietitian: verify the ingredient glycemic values, read the recipes and the safety copy | No budget; the product says plainly that it has not been reviewed | €2,700 – €9,000 |
| Counsel: FDA general-wellness position, privacy policy, terms, data protection for the EU | Needed before a public launch, not before an investor demo | €3,000 – €12,000 |
| Penetration test by an outside party | The free self-assessment in 3.3 stands in until then | €3,500 – €10,000 |
| Accessibility audit | The free pass in 3.4 stands in until then | €1,500 – €5,000 |
| Participant incentives | Sessions run unpaid | €0 – €1,000 |
| Contractors (accounts, platform, going to market) | The owner builds with AI tools alone until then | €11,400 – €24,500 saved six weeks |
| **Outside services to launch** | | **€10,800 – €37,300** |

---

## 5. Risks that can end this plan, in order of likelihood

1. **Not enough people say yes.** The most likely failure and the one that costs the most. Recruiting starts when Gate 1 is met, and from then on is the owner's first job. If it stalls for three weeks, widen the net before lowering the bar.
2. **The service stops for a dull reason** (trial expiry, a paused free database, a key rotating) the week of the demo. 1.7 and 1.8 are first-month work for this reason.
3. **A strong early recipe count crowds the search.** More recipes can make resolution worse (the earlier plan warned of it). 1.1's coverage check after every batch is the control; it already caught three displacements.
4. **A beta finding is a safety finding.** A wrong answer for a real person with a real condition outranks everything on this page, and moves the whole schedule back, as the PRD says.
5. **A weak retention number.** Report it as it is and show the fix. The plan does not depend on a good number, only on a true one.

---

## 6. Decisions I need from the owner

1. Is **February** the first investor meeting? (Moves every phase if not.)
**Answered on 11 October:**
1. *The meeting date:* none yet. Recruiting starts when the product is ready; phases are gate-driven.
2. *Foods with no glycemic index:* show carbohydrate only and say that the glycemic index is not in our data (phase 1.2).
3. *Recruiting:* open to communities when the time comes; the owner will choose them and post by their rules.
4. *Founders Hub:* explained in the chat; the owner has not decided. It is a free Microsoft program that can give Azure credits to a startup with only an idea; the amount at the idea stage is small and the current terms must be checked on Microsoft's page before applying.
5. *The Sydney request:* **not now.** Sending it makes sense before commercial use. Until then the product is a demonstration, and the request moves from phase 3 to the launch checklist (see 3.6).

**Still open:** the Founders Hub application, the 1.2 spec (done on 11 October, deployed) and the 1.10 spec, and whether the agent may propose an ingredient list on its own.
