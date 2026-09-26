# DiaBite — Financial Plan

**36-month operating model, funding requirement, and unit economics**
Author: Nadia Babich · Date: 1 September 2026 · Status: Draft for review
Companion to `docs/PRD.md` (Week 1). Currency: USD. Market: United States only.

> **How to read this.** Every number here is either **[decided]** (a choice already
> made — price, market, scope), **[modelled]** (computed from the assumptions in
> §2 and reproducible from them), or **[estimate]** (a benchmark carried in from
> outside and *not yet verified against a primary source*). Estimates are the
> weak joints of this plan and are listed together in §12. Nothing below should
> be shown to an investor until §12 is closed.

---

## 1. Summary

DiaBite is a subscription consumer-health product with an agentic AI core. Its
financial shape follows directly from two facts established in the PRD: the
deterministic engine does the arithmetic (so the LLM is called for
*understanding*, not for computation, which keeps inference cost low), and the
market is the United States (so pricing is direct-pay and compared against
medication, not against a fitness app).

| | Base case |
|---|---|
| Pricing | $19.99 / month · $149 / year **[proposed]** |
| Gross margin at scale | **79%** — variable cost $3.42 against $16.58 blended ARPU |
| LLM cost per paying user per month | **$2.11** — 13% of ARPU |
| LTV (blended plans) | **$252** |
| CAC — paid channel only | $100 (Y1) → $71 (Y2) → $73 (Y3) |
| LTV/CAC — paid channel | 2.5x → 3.5x |
| Payback — paid channel | 7.6 mo (Y1) → 5.4 mo (Y2) |
| Year 3 exit ARR | **$7.25M** · 37,400 paying subscribers |
| First EBITDA-positive month | **Month 35** |
| Peak cumulative cash requirement | **$3.01M** |
| Funding plan | Seed **$2.5M** at M1 · Series A **$6M** at M20 |

The plan is deliberately **product-led before it is spend-led**. Months 1–6 are
build-only with zero acquisition spend. Marketing scales in three steps
($8k → $25k → $55k → $110k/mo) and each step is gated on a metric, not on a
date (§9). This is the structural answer to the biggest risk in the category:
consumer health products with weak retention scale their way into a hole.

---

## 2. Assumption register

Everything downstream is computed from this table. Change a row and the model moves.

### Revenue

| Assumption | Value | Basis |
|---|---|---|
| Monthly price | $19.99 | **[proposed]** — awaiting sign-off, see §3 |
| Annual price | $149 (38% discount) | **[proposed]** |
| Annual plan mix | 45% of new paid | **[estimate]** |
| Free → paid conversion | 6% (Y1) → 7% (Y2) → 7.5% (Y3) | **[estimate]** — consumer health freemium runs 3–8% |
| Monthly-plan churn | 10% → 8% → 7% per month | **[estimate]** |
| Annual-plan renewal | 50% → 56% → 60% | **[estimate]** |
| Free-tier churn | 12% / month | **[estimate]** |
| Free → paid upgrade from base | 0.8% / month | **[estimate]** |

### Acquisition

| Assumption | Value | Basis |
|---|---|---|
| Blended cost per free signup | $6.00 (Y1) → $5.00 (Y2) → $5.50 (Y3) | **[estimate]** |
| Organic signups at launch | 500 / month, +10% / month | **[estimate]** |
| Channel mix | Content/SEO + condition communities + clinician & dietitian referral, with a contained paid-social test | **[decided]** |

Channel mix is a financial decision, not a marketing one. Paid social at a
$100 CAC against a $252 LTV is a 2.5x business that pays back in seven months —
survivable but not fundable at scale. Content and referral are what move the
blended number, which is why the first growth hire is a **growth/content lead**
and not a performance marketer.

### Cost of revenue

| Assumption | Value | Basis |
|---|---|---|
| Agent interactions — paying user | 4.5 / day (135 / month) | **[estimate]** — the PRD's job is 5–7 eating decisions a day |
| Agent interactions — free user | 12 / month (hard cap 15) | **[decided]** — the free tier's cost ceiling |
| Photo logging share of logs | 15% (P1 feature, from M10) | **[estimate]** |
| Infrastructure | $0.35 / paid MAU · $0.08 / free MAU | **[estimate]** |
| Support | $0.30 / paid MAU | **[estimate]** |
| Payment processing | 4.0% of gross revenue | Stripe 2.9% + $0.30 on a ~$16 average ticket |
| Food-data licensing | $1.5k/mo (Y1) → $4k (Y2) → $7k (Y3) | **[estimate]** — see §11, open PRD question |

**Web-first is worth ~11–26 points of margin.** The product is React + Vite on
the web, so subscriptions run through Stripe at ~4% rather than through an app
store at 15–30%. Native apps are a Year 2+ decision and must be priced knowing
they cost roughly $2.50 per subscriber per month in store fees.

---

## 3. Pricing

| | Monthly | Annual |
|---|---|---|
| Price | $19.99 | $149 ($12.42 / mo) |
| Assumed mix of new paid | 55% | 45% |
| Blended ARPU | **$16.58 / month** | |

**Free tier.** The whole deterministic engine: logging with glycemic load and
available carbohydrate, personal targets with their derivation, the weekly menu
generator, the shopping list. Plus 15 agent interactions per month. The free
tier costs $0.27 per user per month to run ($0.19 of it inference) and exists
because the deterministic half of the product is genuinely useful on its own —
it is the demonstration that the numbers are trustworthy.

**Pro tier.** Unlimited agent interactions under fair use, photo logging,
adaptive re-planning, longitudinal memory of accepted and rejected suggestions,
export.

**Why $19.99 and not $9.99 — a recommendation, not a decision.** The persona compares this against a medication
copay, not against a fitness app, and the competitive set anchors far higher:
ZOE and Nutrisense start in the hundreds of dollars because a CGM is in the box.
At $19.99 DiaBite is a quarter of a CGM-first subscription and the cheapest
credible thing in the category that answers *"can I eat this."* At $14.99 the
model still works but Year 3 EBITDA turns negative and the Series A gets harder;
at $9.99, paid acquisition stops paying back at all and the plan reduces to a
purely organic business.

**Not in the model, deliberately:** B2B2C (employer and payer channels), the
clinician-facing view for dietitians, and any CGM hardware attach. Each is
plausible Year 3 revenue and none is underwritten here.

---

## 4. What the agent actually costs to run

This is the number most AI-product financial plans get wrong, so it is built
from the architecture in the PRD rather than from a rule of thumb. Model prices
are Anthropic list rates; cached input reads at 0.1x and cache writes at 1.25x.

**One "can I eat this?" interaction:**

| Step | Model | Tokens (fresh in / cached in / out) | Cost |
|---|---|---|---|
| `resolve_foods` — text → food entities + portions | Claude Haiku 4.5 | 350 / 1,200 / 180 | $0.00137 |
| Agent loop — plan, call tools, narrate (2 calls) | Claude Sonnet 5 | 1,400 / 5,000 / 450 | $0.01055 |
| Verifier — every number traced to a tool result | Claude Haiku 4.5 | 900 / 600 / 90 | $0.00141 |
| Hard re-planning escalation (5% of turns) | Claude Opus 5 | 1,800 / 5,000 / 600 | $0.00133 |
| Photo logging (15% of logs) | Claude Sonnet 5, vision | 1,800 / 1,200 / 250 | $0.00095 |
| **Total per interaction** | | | **$0.0156** |

| | Interactions / month | LLM cost / month |
|---|---|---|
| Paying user | 135 | **$2.11** |
| Free user | 12 | **$0.19** |

**Three architectural decisions carry this number.**

1. **The engine computes; the model narrates.** Every gram and glycemic load
   comes from deterministic TypeScript. The model never reasons its way to a
   number, so it never needs a large thinking budget to do so. The safety
   argument in the PRD and the cost argument are the same argument.
2. **Model routing.** Entity resolution and verification are classification
   work and run on Haiku 4.5. Only planning and narration need Sonnet 5, and
   only genuinely hard re-planning escalates to Opus 5. Running the whole loop
   on Opus 5 would cost roughly $0.05 per interaction — **$6.75 per paying user
   per month**, tripling COGS and cutting gross margin from 79% to about 62%.
3. **Prompt caching.** The system prompt, tool definitions, and the user's
   profile are a stable prefix read at 0.1x. Without caching, per-interaction
   cost rises about 40%. This makes prefix stability a *financial* requirement:
   no timestamps in the system prompt, deterministic tool ordering.

**Cost control that must be built, not hoped for:** a hard per-user monthly
interaction ceiling on the free tier, a fair-use ceiling on Pro, a
tool-call-count cap per turn (a looping agent is an unbounded bill), and per-user
cost telemetry in the same log line as the tool calls and verifier result that
E3 already requires.

**Price risk runs both ways.** A 2x rise in inference prices costs 5 points of
gross margin — survivable. The historical direction has been downward, and the
model does not assume any decline.

---

## 5. Unit economics (base case, steady state)

| | |
|---|---|
| Blended ARPU | $16.58 / month |
| LLM | $2.11 |
| Infrastructure | $0.35 |
| Support | $0.30 |
| Payment processing | $0.66 |
| **Variable COGS** | **$3.42** |
| **Gross margin** | **79.4%** |

| | Monthly plan | Annual plan | Blended |
|---|---|---|---|
| Average subscription life | 12.5 mo | 27.3 mo | **19.1 mo** |
| **LTV** (ARPU × GM × life) | | | **$252** |

| | Y1 | Y2 | Y3 |
|---|---|---|---|
| CAC — paid channel only | $100 | $71 | $73 |
| LTV/CAC | 2.5x | 3.5x | 3.4x |
| Payback | 7.6 mo | 5.4 mo | 5.6 mo |
| CAC — blended with organic | $50 | $41 | $41 |
| LTV/CAC — blended | 5.0x | 6.1x | 6.1x |

**Read the paid-channel row, not the blended one.** Blended CAC flatters the
business by treating organic signups as free; it is the right number for
reporting and the wrong number for deciding whether to spend. The decision rule
is the paid-channel figure, and the gate in §9 is set on it.

**The annual plan is the retention strategy.** A monthly subscriber is worth
$165; an annual subscriber is worth $360. Everything that pushes annual mix
above 45% — an annual-only onboarding offer, a 90-day price break tied to the
diagnosis window the PRD identifies as peak motivation — moves LTV more than
any pricing change.

---

## 6. Three-year P&L (base case)

| | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Paying subscribers (exit) | 817 | 9,535 | 37,410 |
| Free users (exit) | 8,185 | 65,682 | 206,015 |
| Exit ARR | $160k | $1.86M | $7.25M |
| **Revenue** | **$45.7k** | **$936.6k** | **$4.52M** |
| Cost of revenue | $26.7k | $361.5k | $1.48M |
| **Gross profit** | **$19.0k** | **$575.1k** | **$3.04M** |
| Gross margin | 41% | 61% | 67% |
| Personnel | $651k | $1,113k | $1,809k |
| Sales & marketing | $51k | $480k | $1,680k |
| G&A, legal, compliance, tooling | $193k | $283k | $304k |
| **Total operating expense** | **$895k** | **$1.88M** | **$3.79M** |
| **EBITDA** | **($876k)** | **($1.30M)** | **($753k)** |
| Average monthly burn | $73k | $108k | $63k |
| Cumulative cash consumed | $876k | $2.18M | $2.93M |

Gross margin starts at 41% and climbs to 67% because free-tier inference and the
data licence are fixed-ish costs carried against a small paid base. At the Year 3
exit run-rate the marginal margin is the 79% in §5; the reported annual figure
converges on it as the paid base grows.

**Monthly path, Year 1:**

| Month | Signups | Free | Paid | MRR | Gross profit | Opex | EBITDA | Cumulative |
|---|---|---|---|---|---|---|---|---|
| 1 | — | — | — | — | — | $48.4k | ($48.4k) | ($48k) |
| 2 | — | — | — | — | — | $51.4k | ($51.4k) | ($100k) |
| 3 | — | — | — | — | — | $71.4k | ($71.4k) | ($171k) |
| 4 | — | — | — | — | — | $53.4k | ($53.4k) | ($225k) |
| 5 | — | — | — | — | — | $83.9k | ($83.9k) | ($309k) |
| 6 | — | — | — | — | — | $86.4k | ($86.4k) | ($395k) |
| 7 · **launch** | 1,833 | 1,710 | 124 | $2.1k | ($0.3k) | $77.4k | ($77.7k) | ($473k) |
| 8 | 1,883 | 3,249 | 254 | $4.2k | $1.0k | $88.2k | ($87.2k) | ($560k) |
| 9 | 1,938 | 4,643 | 389 | $6.4k | $2.3k | $88.2k | ($85.9k) | ($646k) |
| 10 | 1,999 | 5,917 | 528 | $8.7k | $3.8k | $82.2k | ($78.4k) | ($724k) |
| 11 | 2,065 | 7,091 | 671 | $11.0k | $5.3k | $82.2k | ($76.9k) | ($801k) |
| 12 | 2,139 | 8,185 | 817 | $13.3k | $6.9k | $82.2k | ($75.3k) | ($876k) |

**Year 2–3 quarterly exits:** M18 — 3,706 paid, $60k MRR · M24 — 9,535 paid,
$155k MRR · M30 — 20,713 paid, $336k MRR · M36 — 37,410 paid, $604k MRR,
EBITDA **+$58k**.

---

## 7. Cost structure

Year 1 spend is 73% people, 22% G&A and compliance, 6% marketing. That ratio is
the plan: Year 1 buys a product and a defensible data layer, not users.

### Headcount

| Role | Starts | Loaded cost / mo |
|---|---|---|
| Founder / PM | M1 | $5.0k → $10k (M13) → $13k (M25) |
| Senior full-stack engineer | M1 | $13.8k |
| AI / agent engineer | M1 | $15.4k |
| Product designer (contract, to M9) | M1 | $6.0k |
| Registered Dietitian (contract → FT) | M2 | $3.0k → $8.0k (M17) |
| Full-stack engineer #2 | M5 | $12.5k |
| Growth / content lead | M8 | $10.8k |
| Engineer #3 | M15 | $13.8k |
| Nutrition-data operations | M16 | $8.3k |
| Clinical & regulatory lead (part-time) | M19 | $7.0k |
| Support / community | M20 | $6.5k |
| Engineer #4 · Data scientist (evals) · Growth #2 · Engineer #5 | M25–M31 | $14.2k · $14.0k · $11.5k · $14.2k |

Headcount: 6 at M12 → 10 at M24 → 14 at M36. Costs are fully loaded (salary +
payroll tax + benefits + equipment), founder below market through Month 12.

**Two roles that look optional and are not.** The **Registered Dietitian** from
Month 2 is what makes E4 ("every food record carries a source and a
last-verified date") real rather than aspirational, and is the person who signs
off that a recommendation is safe. The **nutrition-data operations** hire in
Month 16 exists because the glycemic data layer is named in the PRD as one of
four moats — a moat that nobody maintains stops being one.

### Non-personnel

| | Y1 | Y2 | Y3 |
|---|---|---|---|
| Legal, corporate, regulatory counsel | $30k + $20k one-off (M3) | $30k + $20k (M22) | $30k |
| Privacy, ToS, medical-disclaimer review | $14k (M6) | — | — |
| Professional liability & cyber insurance | $18k | $36k | $48k |
| Evaluation dataset annotation (B1's 90% target) | $18k (M5) | — | — |
| Ongoing food-data verification | $25k | $42k | $42k |
| Clinical advisory board (2 advisors) | $18k | $24k | $24k |
| SOC 2 Type I | — | $35k (M16) | — |
| Tooling, accounting, admin, misc | $70k | $108k | $160k |

---

## 8. Funding and runway

| Round | Timing | Amount | Buys |
|---|---|---|---|
| Seed | M1 | **$2.5M** | 20 months of runway through the launch and the first retention cohort |
| Series A | M20 | **$6.0M** | Scale-up of acquisition once the paid-channel gate clears |

Cash on hand: $2.45M (M1) → $1.62M (M12) → $977k (M18) → **$726k (M20, trough
before the A)** → $6.6M (M21) → $5.6M (M36). Peak cumulative cash consumed in the
base case is **$3.01M**; the raise carries a deliberate ~35% buffer over it,
because the conservative case consumes $4.85M and needs a bigger or earlier A.

**Seed milestones — what M20 has to show.** The A is raisable on these, and not
otherwise:

- 12 weeks of live cohort data with **week-4 retention ≥ 30%** and a Month-3
  cohort curve that has flattened rather than gone to zero.
- **Paid-channel CAC ≤ $75 with payback under 6 months** in at least one
  repeatable channel.
- **Zero** ungrounded numeric claims and **zero** insulin-dosing responses in
  production — the PRD's P0 guardrails, with the eval logs to prove it.
- A resolved regulatory position (§11) and a food-data source that survives due
  diligence.
- Meal-parsing accuracy ≥ 90% on a held-out labelled set.

---

## 9. Spend gates

Acquisition spend steps up on evidence, not on the calendar. Each gate must hold
for two consecutive months before the next step is released.

| Step | Spend | Gate |
|---|---|---|
| M1–M6 | $0 | — |
| M6 | $3k | Waitlist only |
| M7–M12 | $8k / mo | Launch: activation ≥ 50% (≥3 meals in first 3 days) |
| M13–M18 | $25k / mo | Week-4 retention ≥ 30%; paid CAC ≤ $110 |
| M19–M24 | $55k / mo | Paid CAC ≤ $85; payback ≤ 7 mo; monthly churn ≤ 9% |
| M25–M30 | $110k / mo | Paid LTV/CAC ≥ 3.0x on realised (not projected) cohort revenue |
| M31–M36 | $170k / mo | Same, sustained; gross margin ≥ 75% |

**And the gate runs the other way too.** If the Year 1 numbers land at the top of
the range — blended LTV/CAC at 5x is the base case's own output — this plan is
*underspending*, and the correct response is to accelerate the Series A and
raise more, not to hold the schedule.

---

## 10. Scenarios

| | Conservative | **Base** | Optimistic |
|---|---|---|---|
| Free → paid conversion | 4.0% → 5.2% | 6.0% → 7.5% | 8.5% → 10.5% |
| Monthly churn | 12% → 9.5% | 10% → 7% | 8.5% → 5.5% |
| Annual renewal | 42% → 50% | 50% → 60% | 58% → 70% |
| Organic reach vs. base | 0.6x | 1.0x | 1.55x |
| Cost per signup vs. base | 1.35x | 1.0x | 0.82x |
| **Y1 revenue** | $23.3k | $45.7k | $81.0k |
| **Y2 revenue** | $491k | $937k | $1.57M |
| **Y3 revenue** | $2.36M | $4.52M | $7.70M |
| Y3 exit ARR | $3.77M | $7.25M | $12.48M |
| Y3 exit paying subs | 19,645 | 37,410 | 64,145 |
| **Y3 EBITDA** | ($2.34M) | ($753k) | **+$1.66M** |
| First EBITDA-positive month | beyond M36 | M35 | M27 |
| **Peak cash requirement** | **$4.85M** | **$3.01M** | **$1.75M** |

The conservative case is not a failure case — it is a $3.8M ARR business that
needs a larger Series A and reaches profitability in Year 4. The failure case is
different in kind: retention that never flattens. A product whose Month-3 cohort
curve goes to zero cannot be fixed with more marketing, and the honest response
to it is to stop spending, not to raise.

**Sensitivity — Year 3 exit subscribers, one lever moved:**

| Lever | Y3 exit paid |
|---|---|
| Base | 37,410 |
| Conversion 6% → 4.5% | ~28,100 |
| Conversion 6% → 8% | ~49,800 |
| Monthly churn 10% → 13% | ~29,200 |
| Monthly churn 10% → 8% | ~44,100 |
| Cost per signup $5 → $8 | ~24,700 |

Retention and acquisition cost dominate. Inference price does not appear in this
table because it cannot move the outcome — at 13% of ARPU it would have to
quadruple to matter, which is the point of the architecture.

---

## 11. Risks with a financial consequence

**Regulatory posture — the largest single unknown.** The PRD flags it and it is
unresolved. If a "can I eat this" verdict for people with diagnosed diabetes
falls outside FDA general-wellness guidance, DiaBite becomes a regulated device.
Financial consequence: a 510(k) route adds roughly **$400k–$900k and 12–18
months** before revenue, which this model does not carry. Mitigation is to
resolve it with counsel before Month 6 — the $20k in Month 3 is that engagement —
and to hold the claim surface inside general wellness until it is answered. This
is the one risk that can invalidate the plan rather than dent it.

**Food data licensing.** The source decision is open (PRD, Open Question 1).
USDA FoodData Central is free but carries no glycemic index; a commercial
branded/restaurant database is the realistic path to US coverage and is modelled
at $1.5k–$7k per month. If enterprise licensing lands nearer $10k/month, Year 3
gross margin drops about 2 points — material but not structural. The bigger
exposure is time: the glycemic layer has to be built regardless, which is what
the RD and the data-ops hire are for.

**Retention.** The PRD's own week-4 target of 30% is modest, and manual food
logging is a category with a well-documented adherence collapse. Every dollar in
this plan rests on the "< 20 seconds to log" requirement being met. If it is not,
churn goes to the conservative case or worse and the gates in §9 stop the spend.

**Free-tier abuse.** 200,000 free users at Year 3 cost about $54k/month in
inference and infrastructure. Uncapped, a small share of heavy users can double
that. The 15-interaction cap is a P0 cost control, not a growth lever.

**Concentration on a single model provider.** Sole-sourcing inference is a
supplier risk in a plan where inference is a cost line. The mitigation is that
the deterministic core is provider-independent by construction — only the
understanding and narration layer is coupled — so a provider change is a
prompt-and-eval migration, not a rewrite.

**Key person.** Through Month 12 the team is six people and the founder is both
PM and domain owner. Standard, and worth stating rather than hiding.

---

## 12. Before this goes to anyone

Every **[estimate]** in §2 must be replaced with a sourced figure or an explicit
range. The ones that actually move the outcome, in order:

1. **Free → paid conversion** and **monthly churn** — the two levers in the
   sensitivity table. These are unknowable pre-launch, so the plan's credibility
   rests on the gates in §9, not on the point estimates.
2. **Cost per free signup**, by channel, from a real test — not a category
   benchmark.
3. **Interactions per user per day.** 4.5 is inferred from the PRD's "five to
   seven eating decisions a day." Instrument it in the first cohort; it scales
   COGS linearly.
4. **Annual plan mix.** 45% is assumed and is worth $95 of LTV per subscriber.
5. **Food-data licensing quotes** — actual quotes, once the source is chosen.
6. **US salary benchmarks** for the loaded costs in §7.
7. **Regulatory cost** of the 510(k) contingency, from counsel.

The PRD's `[verify]` market figures (CDC prevalence, ADA cost of diabetes) are
not inputs to this model — no line here is derived from market size — but they
appear in the same investor conversation and carry the same obligation.
