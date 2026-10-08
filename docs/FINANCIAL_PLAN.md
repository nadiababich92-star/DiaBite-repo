# DiaBite — Financial Plan

**Three-year operating model · seed round**
Nadia Babich · 8 October 2026 · Confidential

**Currency:** US dollars. Revenue is earned in the US; the cost base is in euros
(the team and infrastructure are EU-based), converted at $1.093 to the euro.
**Companion documents:** `docs/PRD.md` (product), `docs/PRD-post-course.md`
(scope of work), `docs/COST-post-course.md` and `docs/monitoring.md` (measured
costs), `docs/CLINICAL_REVIEW.md` (clinical validation).

> **Provenance.** Every figure is marked. **[measured]** comes from Azure Cost
> Management and production traces over 1,941 live agent questions.
> **[scoped]** is a size in working days from the engineering plan.
> **[assumed]** has no measurement behind it yet. There are no users, so every
> growth figure is assumed; §13 lists them with the evidence that will replace
> each one. Market figures carry **[to verify]** until re-checked against the
> primary source.

---

## 1. Executive summary

DiaBite answers one question for people with type 2 diabetes, prediabetes or
insulin resistance — *can I eat this, how much, and with what?* — in seconds,
from a sentence of plain English. A language model reads the meal and plans the
work; a deterministic engine computes every number; a verifier rejects any
answer containing a figure no tool returned. The user gets a verdict, the number
behind it, a reason, and the arithmetic one tap away.

**The architecture is built, deployed and measured.** That is what distinguishes
this plan from a forecast: the cost of goods below is not an estimate.

| | Base case |
|---|---|
| Pricing | $19.99 / month · $149 / year |
| **Gross margin** | **91.5%** — COGS of $1.41 against $16.58 blended ARPU |
| Inference cost per paying subscriber | **$0.38 / month [measured]** — 2.3% of revenue |
| LTV | $290 | 
| CAC, paid channel | $117 (Y1) → $86 (Y2) |
| LTV / CAC, paid channel | 2.5× → 3.4× · payback 7.7 → 5.6 months |
| Year 1 exit ARR | $395k |
| Year 2 exit ARR | $3.27M |
| **Year 3 exit ARR** | **$11.46M** · 58,900 paying subscribers |
| First EBITDA-positive month | **Month 30** |
| Peak cumulative cash | **$2.65M** |
| **The raise** | **$3.0M seed now · $12M Series A at month 20** |

**Three things make the economics unusual for consumer health.**

1. **91.5% gross margin, measured not modelled.** The model never produces a
   nutrition number, so it is never asked to reason its way to one. Inference
   costs $0.0028 a question in production. At 2.3% of revenue, inference pricing
   is not a line item that can threaten this business.
2. **US revenue on an EU cost base.** Engineering, clinical and operations sit
   in the EU at roughly 60% of US loaded cost, against US consumer pricing. The
   plan reaches $11.5M ARR with 26 people and $2.65M of cumulative cash.
3. **The product exists.** 6,054 foods, three agents in production, 285
   evaluation cases, a verified rate of 100% across the most recent live run, p90
   latency of 8.2 seconds. The seed buys distribution and clinical validation,
   not a first version.

> **What the seed is actually for:** finding out whether people who need this
> will pay for it, at a cost of acquisition that works. Everything else is done
> or scoped.

---

## 2. Where we are — what the seed is not paying for

Measured 8 October 2026 against the running service.

| | State |
|---|---|
| **The promise** | Every number computed by a deterministic engine and checked by a verifier before display. No model produces a nutrition number |
| **Product** | Onboarding with derived targets, ask screen, diary, weekly menu generator, feedback, phone layout |
| **Agents** | Router, meal specialist with tools, advisor with memory and knowledge base — all in production on Azure AI Foundry |
| **Food catalogue** | 6,054 foods: 351 verified ingredients, 1,000 recipes computing dish GI deterministically from ingredients, 4,618 USDA survey foods |
| **Quality [measured]** | Food resolution 95/95 · clarification 19/19 · safety phrasings 63/63 · verifier 12/12 · live agent 180/183 checks · p90 8.2 s, median 4.7 s |
| **Safety** | Deterministic rules run before any model: insulin dosing refused, red flags escalated, rate limits per address, conversation and day |
| **Clinical** | Three physicians hold a 20-question review pack; the first review changed the product within a day. **No clinician has signed off yet** |
| **Cost [measured]** | $0.0028 a question · $28 a month of fixed infrastructure |
| **Users** | **None yet.** Five moderated sessions written, not scheduled |

**What is honestly not done:** no accounts (the diary lives in the browser), no
photo logging, 13% of typed foods resolve to nothing — mostly branded products
with no published glycemic index — and the FDA general-wellness position is
unconfirmed. Each is scoped in days in `docs/PRD-post-course.md` and funded
below. Together they are **83–106 working days [scoped]** to a public launch.

---

## 3. Market

| | |
|---|---|
| US adults with diagnosed diabetes | 40.1M, ~90% type 2 **[to verify — CDC, Sept 2026]** |
| US adults with prediabetes | 115.2M **[to verify — CDC]** |
| Annual US cost of diagnosed diabetes | $412.9B **[to verify — ADA]** |
| **Serviceable market** — diagnosed T2D (~36M) plus prediabetes that knows it (~23M) | **59M people** |
| Revenue per subscriber per year | **$199** |

Diet is first-line treatment for type 2 diabetes, and medical nutrition therapy
moves HbA1c by about as much as adding a drug **[to verify — ADA Standards of
Care]**. The gap is delivery: structured programmes need human coaches and do
not scale, and the software that does scale was built for calorie counting.

**The penetration this plan assumes is small enough to check by eye.**

| | Y3 subscribers | Share of the 59M |
|---|---|---|
| Conservative | 33,700 | 0.057% |
| **Base** | **58,900** | **0.100%** |
| Upside | 120,700 | 0.205% |

One percent of the serviceable market is 590,000 subscribers and $117M of ARR.
The base case needs one tenth of one percent.

**Competitive position.** ZOE, Levels and Nutrisense taught US consumers what a
glycemic response is, then priced it behind a $100-plus monthly sensor.
MyFitnessPal and Cronometer give a database and three to five minutes of work
per meal, with no glycemic index at all. A general-purpose chatbot answers the
question fluently and gives two different glycemic loads for the same meal.
DiaBite is the only one that answers *can I eat this* with a number it can show
you the derivation of — at a tenth of the price of a CGM subscription.

---

## 4. Business model

| Plan | Price | Per month | Mix of new paid **[assumed]** |
|---|---|---|---|
| Monthly | $19.99 | $19.99 | 55% |
| Annual | $149 | $12.42 | 45% |
| **Blended ARPU** | | **$16.58** | |

**Free tier.** The entire deterministic engine — targets with their derivation,
the diary, the safety envelope, the weekly menu — plus 15 agent answers a month.
It costs **$0.043 per user per month [measured]**, which makes it the cheapest
acquisition channel in the plan and, more importantly, the proof: a user can
confirm the numbers are trustworthy before paying for anything.

**Paid tier.** Unlimited agent answers under fair use, photo logging,
longitudinal memory of what was accepted and rejected, history and trends,
export.

**On the price.** $19.99 is one quarter of a CGM-first subscription and is the
figure this plan is built on, because a paid-acquisition path needs the ARPU to
support it. It has not been tested on a user. A $14.99 variant is modelled in
§13 and costs roughly four months of calendar; the price will be set from the
five moderated sessions and the beta, before the first dollar of paid
acquisition is spent.

**Deliberately not in these projections:** employer and payer channels, a
clinician-facing view for dietitians and endocrinologists, CGM data import, and
any market outside the US. Each is a credible second act. None is underwritten
here.

---

## 5. Unit economics

### Cost of goods, per paying subscriber per month

| | | Share of ARPU |
|---|---|---|
| Blended ARPU | **$16.58** | |
| Inference **[measured]** | $0.38 | 2.3% |
| Hosting and infrastructure | $0.12 | 0.7% |
| Support | $0.25 | 1.5% |
| Payment processing | $0.66 | 4.0% |
| **Cost of goods** | **$1.41** | 8.5% |
| **Gross profit** | **$15.17** | **91.5%** |

**Why inference is 2.3% of revenue and not 13%.** Three decisions, all made for
safety and all paying a commercial dividend:

- **The engine computes; the model narrates.** Every gram and glycemic load
  comes from deterministic code. The model is never asked to derive a number, so
  it never needs a long reasoning budget to do so.
- **Three models, by role.** A small, fast model routes. A mid-tier model reads
  meals and answers. Only the hardest re-planning escalates. Routing was chosen
  on evaluation results, not on price — and the evidence favoured the model that
  guessed less, which was also the cheaper one.
- **74% of input tokens are served from cache [measured].** The system prompt,
  tool definitions and user profile are a stable prefix. Prefix stability is
  therefore an engineering rule, not an optimisation.

A doubling of inference prices would cost **1.1 points of gross margin**. This
is the line most AI-product plans get wrong in the other direction, and it is
the one line here that is measured rather than forecast.

### Retention and lifetime value **[assumed]**

| | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Monthly-plan churn | 8.0% | 6.8% | 5.8% |
| Annual-plan renewal | 55% | 60% | 65% |
| Blended subscription life | 16.4 mo | 19.1 mo | 22.2 mo |
| **LTV** | $249 | **$290** | $337 |

**The annual plan is the retention strategy.** It is 45% of new subscriptions
and carries roughly twice the lifetime of a monthly one. An annual-first
onboarding offer, timed to the 90-day window after diagnosis when motivation is
highest, is the single highest-leverage retention lever in the plan — ahead of
any product feature.

### Acquisition efficiency

| | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| **CAC — paid channel only** | **$117** | **$86** | **$100** |
| LTV / CAC | 2.5× | 3.4× | 2.9× |
| Payback | 7.7 mo | 5.6 mo | 6.6 mo |
| CAC — blended with organic | $79 | $57 | $65 |
| LTV / CAC — blended | 3.7× | 5.1× | 4.5× |

**The paid-channel row is the one that governs decisions.** Blended CAC flatters
the business by treating organic signups as free; it is the right number for
reporting and the wrong number for deciding whether to spend. Year 3's CAC rises
as paid channels saturate — that is modelled, not an oversight, and it is the
reason the organic channel is built first.

---

## 6. Growth model

Three channels, in the order they are built.

**1. Clinicians and dietitians.** Endocrinologists, primary-care physicians and
RDs already see these patients and are already asked *what can I eat*. They have
no good answer to hand out. Three physicians are engaged in clinical review
today; the review relationship is the beginning of the referral relationship.
This is the channel the product's differentiator — showing the arithmetic — was
built for, because it is the only one a clinician can inspect.

**2. Search and content.** The question has enormous, specific, low-competition
long-tail search volume: *glycemic load of X*, *can diabetics eat Y*. The food
catalogue and the deterministic engine generate pages that are correct by
construction, and every unresolved food a user types is logged and becomes both
an evaluation case and a content target.

**3. Paid social and search.** Opened only once the first two establish a
baseline and the gates in §10 are met. Modelled at a cost per registered signup
of $7.00 improving to $6.00 **[assumed]**.

| | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Marketing spend | $746k | $1.32M | $3.90M |
| Registered signups | 23,300 | 216,000 | 553,000 |
| Free → paid conversion **[assumed]** | 6.0% | 7.0% | 7.5% |
| Paying subscribers, exit | 2,007 | 16,748 | 58,909 |

Marketing scales in four steps — $15k, $40k, $110k, $250k, then $400k a month —
and each step is released by a metric, not a date (§10).

---

## 7. Financial projections

### Three-year P&L — base case

| | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Paying subscribers, exit | 2,007 | 16,748 | 58,909 |
| Free users, exit | 22,093 | 119,331 | 344,824 |
| **Exit ARR** | **$395k** | **$3.27M** | **$11.46M** |
| Revenue | $107k | $1.78M | $7.29M |
| Cost of goods | $12k | $190k | $748k |
| **Gross profit** | **$95k** | **$1.59M** | **$6.54M** |
| Gross margin | 88.4% | 89.3% | 89.7% |
| Personnel | $608k | $1.33M | $2.15M |
| Sales and marketing | $746k | $1.32M | $3.90M |
| G&A, legal, compliance, data | $130k | $90k | $406k |
| **Operating expense** | **$1.15M** | **$2.74M** | **$6.46M** |
| **EBITDA** | **($1.05M)** | **($1.15M)** | **$86k** |
| Headcount, exit | 12 | 17 | 26 |

Reported gross margin runs 88–90% rather than the 91.5% marginal figure because
free-tier inference and fixed hosting are carried against a smaller paid base;
it converges upward as the base grows.

### Quarterly

| Quarter | Revenue | EBITDA | Exit subscribers | Exit ARR | Headcount |
|---|---|---|---|---|---|
| Q1 · M1–3 | — | ($168k) | — | — | 6 |
| Q2 · M4–6 **launch** | $3k | ($253k) | 173 | $35k | 8 |
| Q3 · M7–9 | $27k | ($287k) | 722 | $143k | 10 |
| Q4 · M10–12 | $78k | ($343k) | 2,007 | $395k | 12 |
| Q5 · M13–15 | $156k | ($323k) | 3,766 | $740k | 13 |
| Q6 · M16–18 | $330k | ($454k) | 8,174 | $1.61M | 14 |
| Q7 · M19–21 | $544k | ($254k) | 12,535 | $2.46M | 15 |
| Q8 · M22–24 | $750k | ($121k) | 16,748 | $3.27M | 17 |
| Q9 · M25–27 | $1.09M | ($319k) | 25,121 | $4.91M | 20 |
| Q10 · M28–30 | $1.49M | ($41k) | 33,351 | $6.50M | 22 |
| Q11 · M31–33 | $2.04M | ($44k) | 46,235 | $9.01M | 26 |
| **Q12 · M34–36** | **$2.66M** | **$490k** | **58,909** | **$11.46M** | 26 |

The EBITDA dips in Q6, Q9 and Q11 are the marketing steps opening. Each is a
deliberate purchase of a cohort that pays back in five to eight months.

### Year 1, month by month

| Month | Signups | Free | Paying | MRR | Gross profit | Opex | EBITDA | Cumulative |
|---|---|---|---|---|---|---|---|---|
| 1 | — | — | — | — | — | $39k | ($39k) | ($39k) |
| 2 | — | — | — | — | — | $73k | ($73k) | ($112k) |
| 3 | — | — | — | — | — | $55k | ($55k) | ($168k) |
| 4 | — | — | — | — | — | $81k | ($81k) | ($249k) |
| 5 | — | — | — | — | — | $73k | ($73k) | ($321k) |
| **6 · launch** | 2,643 | 2,469 | 173 | $2.9k | $2.5k | $102k | ($99k) | ($421k) |
| 7 | 2,688 | 4,696 | 353 | $5.8k | $5.1k | $98k | ($93k) | ($514k) |
| 8 | 2,737 | 6,712 | 536 | $8.8k | $7.8k | $102k | ($94k) | ($608k) |
| 9 | 2,790 | 8,545 | 722 | $11.9k | $10.5k | $111k | ($100k) | ($708k) |
| 10 | 6,420 | 13,558 | 1,146 | $18.9k | $16.7k | $130k | ($113k) | ($821k) |
| 11 | 6,484 | 18,052 | 1,575 | $25.9k | $22.9k | $138k | ($115k) | ($936k) |
| 12 | 6,553 | 22,093 | 2,007 | $32.9k | $29.2k | $144k | ($115k) | ($1.05M) |

Peak cumulative cash consumption is **$2.65M at month 32**; the first
EBITDA-positive month is **30**.

---

## 8. Team and the EU cost base

Fully loaded cost — salary, employer contributions, equipment, tooling. The team
is EU-based, which is the structural reason this plan reaches $11.5M ARR on
$2.65M of cash.

| Role | Starts | Loaded / month |
|---|---|---|
| Founder / CEO | M1 | $7.5k → $9.5k (M13) → $11.5k (M25) |
| AI / agent engineer | M1 | $10.0k |
| Senior full-stack engineer | M1 | $9.2k |
| Registered Dietitian — part-time to full-time | M1 | $3.8k → $6.7k (M10) |
| Product designer — contract to full-time | M2 | $5.5k → $6.3k (M12) |
| Full-stack engineer #2 | M3 | $8.0k |
| Growth and content lead | M5 | $7.9k |
| Clinical and regulatory lead — part-time | M6 | $5.8k |
| **US medical director — part-time, US rate** | M7 | $10.0k |
| Support and community | M8 | $3.8k |
| Engineer #3 · Nutrition-data operations | M11, M12 | $8.6k · $5.0k |
| Engineer #4 · Data scientist, evaluations | M15, M17 | $8.6k · $9.2k |
| Lifecycle and retention marketer | M19 | $7.5k |
| Engineer #5 · Head of growth | M22, M23 | $8.8k · $12.5k |
| Engineers #6–7 · Clinical ops · Support #2–3 | M26–M28 | $17.6k · $7.0k · $8.0k |
| Engineers #8–9 · Finance and ops · Growth analyst | M31–M33 | $18.0k · $8.5k · $7.0k |

Headcount: **12 at month 12 · 17 at month 24 · 26 at month 36.**

**Three roles that look discretionary and are not.** The **Registered Dietitian
from month 1** is what makes the food data defensible — every record carrying a
source and a verification date — and signs off that a recommendation is safe.
The **US medical director** is a US-market requirement, not a nicety: clinical
credibility in the US is held by US-licensed clinicians, and this is the one
role deliberately paid at a US rate. **Nutrition-data operations** exists
because the glycemic data layer is a moat, and a moat nobody maintains stops
being one.

### Non-personnel

| | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Counsel — FDA position, privacy, terms, claims | $82k | $60k | $66k |
| Clinical advisory board | $25k | $30k | $30k |
| Ongoing food-data verification | $32k | $42k | $42k |
| Evaluation dataset annotation | $22k | — | — |
| Accessibility audit and penetration test | $9k | — | $30k |
| SOC 2 Type I | — | $40k | — |
| Insurance, tooling, accounting, admin | $50k | $90k | $144k |
| Infrastructure | $6k | $22k | $54k |

---

## 9. Scenarios

| | Conservative | **Base** | Upside |
|---|---|---|---|
| Free → paid conversion | 4.2% → 5.3% | 6.0% → 7.5% | 7.5% → 9.4% |
| Monthly churn | 10.0% → 7.3% | 8.0% → 5.8% | 6.6% → 4.8% |
| Cost per signup vs. base | 1.30× | 1.00× | 0.85× |
| Organic reach vs. base | 0.60× | 1.00× | 1.50× |
| Year 1 revenue | $59k | $107k | $218k |
| Year 2 revenue | $1.00M | $1.78M | $3.66M |
| Year 3 revenue | $4.13M | $7.29M | $15.04M |
| **Year 3 exit ARR** | **$6.49M** | **$11.46M** | **$23.66M** |
| Year 3 exit subscribers | 33,697 | 58,909 | 120,655 |
| Year 3 EBITDA | ($2.78M) | $86k | $5.34M |
| First EBITDA-positive month | beyond M36 | M30 | M20 |
| **Peak cumulative cash** | **$5.73M** | **$2.65M** | **$1.56M** |
| Gross margin, Year 3 | 89.1% | 89.7% | 90.1% |

**The conservative case is still a venture outcome** — $6.5M of ARR growing, at
89% margin — but it needs a larger Series A and reaches profitability in year
four. It is the case the round is sized against.

The case this plan is not built to survive is different in kind: **retention
that never flattens.** A product whose month-three cohort curve goes to zero
cannot be fixed with marketing, and the correct response is to stop spending,
not to raise more. §10's gates exist to detect that within two months of launch
rather than two years.

### What moves the outcome

| Lever | Effect on Year 3 ARR |
|---|---|
| Conversion 6.0% → 4.2% | −43% |
| Conversion 6.0% → 7.5% | +33% |
| Monthly churn 8% → 10% | −28% |
| Cost per signup $7.00 → $9.10 | −31% |
| **Inference price doubling** | **−1.1 points of gross margin; no change to ARR** |

---

## 10. The raise

| Round | Timing | Amount | Post-round runway |
|---|---|---|---|
| **Seed** | now | **$3.0M** | 19 months to the Series A, with $1.07M of cushion at the trough in the base case and $0.77M in the conservative case |
| Series A | month 20 | $12.0M | At $2.18M ARR growing ~3× year on year |

### Use of the seed — $3.0M over 19 months

| | | Share |
|---|---|---|
| Team — 4 people at month 1 to 15 at month 19 | $1.43M | 54% |
| Sales and marketing — gated in four steps | $746k | 28% |
| Counsel, clinical validation, compliance, food data | $403k | 15% |
| Cost of goods | $83k | 3% |
| **Total spend** | **$2.67M** | |
| Revenue earned over the period | $751k | |

### What the Series A is raised on

The round is raisable on these and not otherwise. Each is already instrumented
in production or scoped.

| | Target |
|---|---|
| **Paid-channel CAC** | ≤ $90 with payback under 7 months, in at least one repeatable channel |
| **Retention** | Week-4 retention ≥ 30% and a **flattened month-three cohort curve** across twelve weeks of live data |
| **ARR** | ≥ $2M run-rate, growing |
| **Safety** | **Zero** ungrounded numeric claims and **zero** insulin-dosing responses in production, with the evaluation logs to prove it |
| **Regulatory** | FDA general-wellness position confirmed in writing by counsel |
| **Clinical** | Safety copy signed off by a named clinician; food data carrying source and verification dates |
| **Accuracy** | Meal parsing ≥ 90% on users' own phrases, not ours |

### Spend gates

Marketing is released on evidence, not on the calendar. Each gate holds for two
consecutive months before the next step opens.

| Step | Monthly spend | Gate |
|---|---|---|
| M1–5 | $0 | Build; counsel engaged in month 2 |
| M6–9 | $15k | Launch: activation ≥ 50% — three meals logged in the first three days |
| M10–15 | $40k | Week-4 retention ≥ 30%; paid CAC ≤ $130 |
| M16–24 | $110k | Paid CAC ≤ $110; payback ≤ 8 months; monthly churn ≤ 9% |
| M25–30 | $250k | Paid LTV/CAC ≥ 3.0× on **realised** cohort revenue |
| M31–36 | $400k | Sustained, with gross margin ≥ 85% |

**The gate runs both ways.** If the launch cohorts land at the upside end, this
plan is underspending, and the right response is to pull the Series A forward
and raise more — not to hold the schedule.

**One note on capital efficiency.** A variant of this plan reaching launch
without institutional capital is modelled in
`docs/FINANCIAL_PLAN-bootstrap.md`: the product needs roughly $20k of outside
services to reach a public launch, because it is already built. That is not the
plan being proposed — it caps the business at a few hundred subscribers and
cedes a market that is being actively educated by better-funded competitors —
but it means **the seed buys growth, not survival**, and the company is not
forced into a bad Series A.

---

## 11. Beyond year three

Growth saturating, marketing rising to $900k a month, no new market or channel
assumed.

| | Revenue | Exit subscribers | Exit ARR |
|---|---|---|---|
| Year 3 | $7.29M | 58,909 | $11.46M |
| Year 4 | $19.13M | 131,350 | $25.42M |
| Year 5 | $33.84M | 210,987 | **$40.58M** |

$40M of ARR is **0.36% of the serviceable market** — still a rounding error
against 59M people. The expansions that are deliberately absent from every
number above are what carry the business past it: CGM import and personalisation
from measured glucose response, a clinician-facing view sold into practices,
employer and payer channels, the caregiver persona, and markets outside the US.

---

## 12. Risks

**Regulatory — the sharpest open risk.** FDA general-wellness guidance covers
products that promote a healthy lifestyle. A *can I eat this* verdict aimed at
people with a diagnosis sits close to the line. If it falls outside, DiaBite
becomes a regulated device: a 510(k) route would add an estimated $400k–900k and
12–18 months before revenue, which this plan does not carry.
*Mitigation:* counsel engaged in month 2 — the first material spend in the plan
— claims held inside general wellness until answered, a part-time regulatory
lead from month 6, and a US medical director from month 7. This is the one risk
that changes the plan rather than delays it, and it is deliberately the first
money spent.

**Retention.** Manual food logging has a well-documented adherence collapse, and
every figure in §7 rests on logging taking under 20 seconds. *Mitigation:* the
gates in §10 detect it in the first two cohorts; the annual plan at 45% of mix
absorbs monthly churn; the north-star metric is in-range days per week, which
only moves if behaviour actually changes.

**Acquisition cost.** $117 against a $290 LTV is a 2.5× business in year one —
workable, not comfortable, and the number most likely to disappoint.
*Mitigation:* the clinician and search channels are built before paid is opened,
which is why marketing is only 28% of the seed.

**The 13% unknown-food rate.** The most visible product weakness and the first
thing a user meets. It is a conversion risk, not a cost risk. *Mitigation:*
16–24 days scoped, a dietitian from month 1, and an explicit "glycemic load not
available" answer rather than a guessed number — the promise holds even where
the data does not.

**Holding health data from the EU.** A US-facing service storing identifiable
health data, operated from the EU, is subject to GDPR alongside US rules.
*Mitigation:* a device-scoped anonymous identity first, with deletion and export
from the first migration; counsel's scope covers it; SOC 2 Type I in year two.

**Clinical liability.** No clinician has signed off yet. *Mitigation:* the
advisory board and the review pack are live; professional liability and cyber
insurance are funded from year one; the product refuses dosing questions
deterministically, before any model runs.

**Key person.** The founder is currently the whole team. *Mitigation:* the first
three hires close in month 1–3 and the architecture is documented to the level
of this plan's own sources.

---

## 13. Assumptions

### Measured — from production

| | Value |
|---|---|
| Inference cost per agent question | $0.0028 · 1,941 questions, 27 Sep – 8 Oct, including retries, verifier second attempts and evaluation runs |
| Tokens per question | 4,913 in — 74% cached — 137 out |
| Fixed infrastructure | $28/month today; $98–137 at launch |
| Latency | p90 8.2 s, median 4.7 s |
| Evaluation results | 285 cases; most recent live run 180/183, verified rate 100% of answers returned |
| Unresolved-food rate | 13% of field phrases |

### Assumed — and what will replace each

| | Value | Evidence that replaces it |
|---|---|---|
| Questions per paying subscriber | 135 / month | Instrumented from launch; scales COGS linearly, and at 2.3% of revenue it cannot move the outcome |
| Free → paid conversion | 6.0% → 7.5% | The first two cohorts. **Worth 43% of Year 3 ARR** |
| Monthly churn / annual renewal | 8.0% / 55% | Month-three cohort curve, twelve weeks after launch |
| Annual plan mix | 45% | Checkout data from week one |
| Cost per registered signup | $7.00 → $6.00 | A live channel test before the month-10 step |
| Price | $19.99 / $149 | Five moderated sessions and the beta, before paid acquisition opens |
| Build calendar to launch | 5 months | 83–106 scoped days against the hiring plan |
| Loaded personnel cost | EU rates, 60% of US | Offers accepted |
| Outside services | $403k over 3 years | **Quotes outstanding** for counsel, accessibility audit and penetration test |

### Not in any number above

Photo and voice logging. Branded-food licensing if USDA data proves
insufficient. App-store fees — the product is web-first at 2.9%, against 15–30%
on a mobile store, and leaving the web is a decision with a known price.
Corporate taxes. Any revenue from the expansions listed in §4 and §11.
