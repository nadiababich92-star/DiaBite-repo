# DiaBite — Financial Plan · Netherlands

**Three-year operating model · pre-seed · Dutch BV**
Nadia Babich · 20 October 2026 · Confidential

**Currency:** euros. Revenue is earned in the United States at US list prices
($19.99 / month, $149 / year) converted at €0.915 to the dollar. The cost base —
team, infrastructure, inference — is natively euro.
**The model:** `docs/DiaBite-financial-model-NL.xlsx`. Every figure here is
computed there, with editable assumptions and all three scenarios live. Where
the two disagree, the workbook is right.
**The other plan:** `docs/FINANCIAL_PLAN.md` is the same product as a Delaware
C-Corp raising a $3.0M US seed. The two are alternatives, not stages — see §2.

> **Provenance.** **[measured]** comes from Azure Cost Management and production
> traces over 1,941 live agent questions. **[scoped]** is a size in working days
> from the engineering plan. **[assumed]** has no measurement behind it; there
> are no users yet, so every growth figure is assumed. **[to verify]** marks
> Dutch salary levels, WBSO eligibility and rates, the startup-visa requirements
> and the market figures — none has been checked against its primary source.

---

## 1. Summary

DiaBite answers one question for people with type 2 diabetes, prediabetes or
insulin resistance — *can I eat this, how much, and with what?* — from a
sentence of plain English. A model reads the meal and plans the work; a
deterministic engine computes every number; a verifier rejects any answer
containing a figure no tool returned. **The architecture is built, deployed and
measured.**

| | Base case |
|---|---|
| **Gross margin** | **91.5%** — cost of goods €1.29 against €15.17 blended ARPU |
| Inference per paying subscriber | **€0.35 / month [measured]** — 2.3% of revenue |
| LTV | €265 |
| CAC, paid channel | €107 (Y1) → €79 (Y2) · LTV/CAC 2.5× → 3.4× |
| Year 1 exit ARR | €269k |
| Year 2 exit ARR | €2.16M |
| **Year 3 exit ARR** | **€7.89M** · 44,300 paying subscribers |
| First EBITDA-positive month | **Month 29** |
| Peak cumulative cash | **€1.38M** |
| Headcount at month 36 | 19 |
| **The raise** | **€1.6M pre-seed now · €5M seed at month 18** |

**Why this is a Dutch plan and not the American one with the numbers converted.**

1. **A smaller first round, and a team sized to it.** €1.6M is a large Dutch
   pre-seed, not a small US seed. The hiring plan reaches 7 people at month 12
   and 19 at month 36, against 12 and 26 in the US plan. The product does not
   need more: it is already built.
2. **WBSO.** The Dutch R&D payroll-tax credit takes **€252k** off the personnel
   line across the three years — modelled at 10% of payroll **[to verify]**, and
   roughly the difference between a Dutch and a Polish cost base.
3. **Euro costs against dollar revenue.** Inference is billed by Azure in euros,
   so the measured cost of goods needs no conversion. Revenue is US direct-pay
   at US prices.

> **What the pre-seed is actually for:** residence, a Dutch entity, and finding
> out whether the people who need this will pay for it. The product is done
> enough to launch; it is distribution and clinical validation that are not.

---

## 2. The choice this plan represents

The same product can be built as a Delaware C-Corp or a Dutch BV. They are not
sequential, and the choice closes doors in both directions.

| | Delaware C-Corp | **Dutch BV — this plan** |
|---|---|---|
| Investors | US funds | Dutch and European funds, ROMs, angels |
| First round | $3.0M seed | **€1.6M pre-seed** |
| NIH SBIR, up to ~$2M non-dilutive **[to verify]** | available | closed |
| WBSO, Innovatiekrediet, EIC, regional ROM funding | closed | **available** |
| Residence in the Netherlands | does not help | **the route to it** |
| Cost base | EU team under a US parent | Dutch, with WBSO |

**On the residence question, stated plainly because it drives the timing.** The
Dutch startup visa is granted on the strength of an approved **facilitator** and
an innovative product, not on having raised money **[to verify — IND and RVO]**.
It does, separately, require evidence of sufficient means of support, which a
founder salary from a funded company satisfies. So money is a *requirement* of
the permit, not its *mechanism*: the facilitator is the gate, and the round is
what makes living here possible once through it.

The innovation test is the part of this that is already strong. RVO assesses a
technical claim; this one is measured — a deterministic engine, a verifier, 285
evaluation cases, and a 100% verified rate on the most recent live run.

---

## 3. Where we are — what the pre-seed is not paying for

Measured 8 October 2026 against the running service, at `diabite.pro`.

| | State |
|---|---|
| **The promise** | Every number computed by a deterministic engine and checked by a verifier before display |
| **Product** | Onboarding with derived targets, ask screen, diary with a week view, weekly menu, feedback, phone layout |
| **Agents** | Router, meal specialist with tools, advisor with memory and knowledge base — in production on Azure AI Foundry |
| **Food catalogue** | 8,633 records: 364 ingredients, 2,000 recipes computing dish glycemic index from ingredients, ~4,600 USDA survey foods, 754 branded |
| **Quality [measured]** | 285 evaluation cases · most recent live run 180/183 · verified rate 100% of answers returned · p90 8.2 s |
| **Safety** | Deterministic rules before any model: dosing refused, red flags escalated, limits per address, conversation and day |
| **Clinical** | Review packs with four clinicians; the first review changed the product within a day. **No clinician has signed off** |
| **Cost [measured]** | €0.0026 a question · €26 a month of fixed infrastructure |
| **Users** | **None yet.** Five moderated sessions written, recruiting under way |

**Not done:** photo logging, a measured share of typed foods still resolving to
nothing, and the FDA general-wellness position unconfirmed. Together,
**83–106 working days [scoped]** to a public launch.

---

## 4. Market

| | |
|---|---|
| US adults with diagnosed diabetes | 40.1M, ~90% type 2 **[to verify — CDC]** |
| US adults with prediabetes | 115.2M **[to verify — CDC]** |
| **Serviceable market** — diagnosed T2D ~36M plus prediabetes that knows it ~23M | **59M people** |
| Revenue per subscriber per year | **€182** |

| | Year 3 subscribers | Share of the 59M |
|---|---|---|
| Conservative | 21,853 | 0.037% |
| **Base** | **44,312** | **0.075%** |
| Upside | 102,698 | 0.174% |

One percent of that market is 590,000 subscribers and €107M of ARR. The base
case needs less than one tenth of one percent.

**The question a Dutch investor will ask first: why the US and not Europe?**
Because the US has the largest diagnosed population in any English-speaking
market, a direct-pay culture for health products, and a category — ZOE, Levels,
Nutrisense — that has already taught consumers what a glycemic response is. We
enter an aware market rather than creating one. ZOE is a British company selling
heavily into the United States; the pattern is established. Europe is a
deliberate second market, not a skipped first one: it fragments by language,
reimbursement and clinical convention, and the safety rules would need redoing
per country.

---

## 5. Unit economics

Per paying subscriber, per month.

| | |
|---|---|
| Blended ARPU, 55% monthly / 45% annual | **€15.17** |
| Inference **[measured]** | €0.35 |
| Hosting | €0.11 |
| Support | €0.23 |
| Card fees | €0.60 |
| **Cost of goods** | **€1.29** |
| **Contribution** | **€13.88 — 91.5%** |

A free user costs **€0.039 a month** at the 15-answer ceiling.

**Why inference is 2.3% of revenue.** The engine computes and the model
narrates, so the model is never asked to derive a number and never needs a long
reasoning budget. Three models by role, chosen on evaluation results. 74% of
input tokens served from cache **[measured]**. A doubling of inference prices
costs **1.1 points of gross margin** and changes no date in this plan.

| | Conservative | Base | Upside |
|---|---|---|---|
| Blended subscription life | 15.6 mo | 19.1 mo | 23.0 mo |
| **LTV** | €217 | **€265** | €319 |
| CAC, paid channel, Y1 | €198 | **€107** | €73 |
| LTV / CAC, Y1 | 1.1× | **2.5×** | 4.4× |
| CAC, paid channel, Y2 | €146 | **€79** | €53 |
| LTV / CAC, Y2 | 1.5× | **3.4×** | 6.0× |

**Read the paid-channel row.** Blended CAC flatters the business by treating
organic signups as free. The conservative case at 1.1× is a business that cannot
buy growth — which is exactly what the gates in §8 are there to detect early.

---

## 6. Projections

| | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Paying subscribers, exit | 1,494 | 12,107 | 44,312 |
| Free users, exit | 16,325 | 86,251 | 264,107 |
| **Exit ARR** | **€269k** | **€2.16M** | **€7.89M** |
| Revenue | €74k | €1.18M | €4.91M |
| Cost of goods | €9k | €125k | €501k |
| **Gross profit** | **€66k** | **€1.05M** | **€4.41M** |
| Gross margin | 88.5% | 89.4% | 89.8% |
| Personnel, net of WBSO | €356k | €722k | €1.19M |
| Sales and marketing | €119k | €705k | €2.64M |
| G&A, legal, compliance, data | €191k | €212k | €252k |
| Fixed infrastructure | €4k | €20k | €49k |
| **Total operating expense** | **€670k** | **€1.66M** | **€4.13M** |
| **EBITDA** | **(€605k)** | **(€606k)** | **€280k** |
| Headcount, exit | 7 | 13 | 19 |

Exit ARR by quarter: Q4 €269k · Q6 €1.06M · **Q8 €2.16M** · Q10 €4.30M ·
Q12 €7.89M.

Peak cumulative cash consumption is **€1.38M**; the first EBITDA-positive month
is **29**.

---

## 7. Team and the Dutch cost base

Fully loaded monthly cost in euros — gross salary, employer contributions,
equipment, tooling. **[to verify against real offers.]**

| Role | Starts | Loaded / month |
|---|---|---|
| Founder / CEO | M1 | €5,500 → €7,500 (M13) → €9,000 (M25) |
| AI / agent engineer | M1 | €8,500 |
| Senior full-stack engineer | M1 | €7,800 |
| Registered Dietitian — part-time to full-time | M1 | €3,200 → €5,600 (M12) |
| Product designer — contract to full-time | M3 | €4,600 → €5,300 (M13) |
| Growth and content lead | M9 | €6,600 |
| Full-stack engineer #2 | M10 | €6,800 |
| Clinical and regulatory lead — part-time | M14 | €4,900 |
| **US medical director — part-time, US rate** | M15 | €8,200 |
| Support and community | M16 | €3,200 → €3,500 (M26) |
| Engineer #3 · Nutrition-data operations | M20, M21 | €7,300 · €4,200 |
| Engineer #4 · Data scientist, evaluations | M24, M26 | €7,300 · €7,800 |
| Lifecycle marketer · Engineer #5 · Head of growth | M28–M31 | €6,300 · €7,500 · €10,500 |
| Engineer #6 · Support #2 | M33, M34 | €7,500 · €3,400 |

**7 people at month 12 · 13 at month 24 · 19 at month 36** — against 12, 17 and
26 in the US plan. The difference is not ambition; it is what €1.6M buys.

**Three roles that look discretionary and are not.** The **Registered Dietitian
from month 1** makes the food data defensible — every record with a source and a
verification date — and signs off that a recommendation is safe. The **US
medical director** is a US-market requirement: clinical credibility there is
held by US-licensed clinicians, and this is the one role deliberately paid at a
US rate. **Nutrition-data operations** exists because the glycemic layer is a
moat, and a moat nobody maintains stops being one.

**WBSO** reduces this line by **€252k over three years**, modelled as 10% of
payroll. The statutory credit applies only to qualifying R&D hours, so the
blended effect on total payroll is what is modelled; the real figure needs an
application and an hours administration **[to verify — RVO]**.

---

## 8. The raise, and the gates

| Round | Timing | Amount | Runway |
|---|---|---|---|
| **Pre-seed** | now | **€1.6M** | 17 months to the seed, with €613k in hand at month 17 in the base case and **€473k in the conservative case** |
| Seed | month 18 | €5.0M | At roughly €1.06M ARR in the base case |

### Use of the pre-seed — €1.6M over 17 months

| | Amount | Share |
|---|---|---|
| Team, net of WBSO — 4 people at month 1 to 9 at month 17 | €618k | 48% |
| Sales and marketing — gated in four steps | €334k | 26% |
| Counsel, clinical validation, compliance, food data | €298k | 23% |
| Cost of goods | €34k | 3% |
| Infrastructure | €13k | 1% |
| **Total spend** | **€1.30M** | |
| Revenue earned over the period | €310k | |

### What the seed is raised on

| | Target |
|---|---|
| **Paid-channel CAC** | ≤ €85 with payback under 7 months, in one repeatable channel |
| **Retention** | Week-4 retention ≥ 30% and a **flattened month-three cohort curve** |
| **ARR** | ≥ €1M run-rate, growing |
| **Safety** | **Zero** ungrounded numeric claims and **zero** dosing responses in production, with the evaluation logs |
| **Regulatory** | FDA general-wellness position confirmed in writing by counsel |
| **Clinical** | Safety copy signed off by a named clinician |

### Spend gates

| Step | Monthly spend | Gate |
|---|---|---|
| M1–5 | €0 | Build. Counsel engaged in month 2 — the first material spend |
| M6–9 | €10k | Launch: activation ≥ 50% — three meals logged in the first three days |
| M10–15 | €25k | Week-4 retention ≥ 30%; paid CAC ≤ €120 |
| M16–24 | €70k | Paid CAC ≤ €100; payback ≤ 8 months; monthly churn ≤ 9% |
| M25–30 | €160k | Paid LTV/CAC ≥ 3.0× on **realised** cohort revenue |
| M31–36 | €280k | Sustained, with gross margin ≥ 85% |

**The gate runs both ways.** If the launch cohorts land at the upside end, this
plan is underspending and the seed should be pulled forward, not held.

### Non-dilutive money this entity can reach

Not in any projection above, and each worth a separate application: **WBSO**
(modelled, but the application is real work), **Innovatiekrediet** from RVO,
**regional ROM** co-investment and loans, **EIC Accelerator**, and
**Health~Holland / TKI** programmes **[all to verify — eligibility and current
terms]**. A Delaware entity reaches none of them, and reaches NIH SBIR instead.

---

## 9. Scenarios

| | Conservative | **Base** | Upside |
|---|---|---|---|
| Free → paid conversion | 4.2% → 5.3% | 6.0% → 7.5% | 7.5% → 9.4% |
| Monthly churn | 10.0% → 7.3% | 8.0% → 5.8% | 6.6% → 4.8% |
| Year 1 revenue | €37k | €74k | €162k |
| Year 2 revenue | €585k | €1.18M | €2.69M |
| Year 3 revenue | €2.42M | €4.91M | €11.37M |
| **Year 3 exit ARR** | **€3.87M** | **€7.89M** | **€18.35M** |
| Year 3 exit subscribers | 21,853 | 44,312 | 102,698 |
| Year 3 EBITDA | (€1.98M) | €280k | €4.95M |
| First EBITDA-positive month | beyond M36 | M29 | M18 |
| **Peak cumulative cash** | **€3.76M** | **€1.38M** | **€0.80M** |
| Cash in hand at month 17 | €473k | €613k | €803k |

The conservative case still reaches month 17 with cash, which is what the round
is sized for. It then needs a larger seed and reaches profitability in year four.

**The case this plan cannot survive is different in kind: retention that never
flattens.** A product whose month-three cohort curve goes to zero cannot be
fixed with marketing. The right response would be to stop spending, not to raise
more — and §8's gates exist to detect that within two months of launch.

---

## 10. Risks

**Regulatory — the sharpest open risk.** FDA general-wellness guidance covers
products that promote a healthy lifestyle. A *can I eat this* verdict aimed at
people with a diagnosis sits close to the line. If it falls outside, DiaBite
becomes a regulated device: a 510(k) route would add an estimated $400k–900k and
12–18 months, which this plan does not carry. *Mitigation:* counsel engaged in
month 2 — deliberately the first material spend — claims held inside general
wellness until answered, a regulatory lead from month 14, a US medical director
from month 15.

**Two jurisdictions at once.** A Dutch BV serving US consumers carries GDPR and
US rules together, and the founder's residence depends on the entity performing.
*Mitigation:* a device-scoped anonymous identity first, with deletion and export
from the first migration; counsel's month-2 scope covers both; SOC 2 Type I in
year two.

**Residence timing.** Every date here assumes the startup visa is granted. A
facilitator is the gate and the application takes months **[to verify — IND]**.
*Mitigation:* the facilitator search runs in parallel with the raise, and the
work continues from Poland in the meantime — the product is already remote.

**Acquisition cost.** €107 against a €265 LTV is 2.5× in year one — workable,
not comfortable, and the number most likely to disappoint. *Mitigation:* the
clinician and search channels are built before paid is opened, which is why
marketing is 26% of the pre-seed and not more.

**Retention.** Manual food logging has a documented adherence collapse, and
every figure here rests on logging taking under 20 seconds. The clearest outside
feedback received so far, from a diabetes educator on 20 October, was exactly
this: people stop after about two months. *Mitigation:* the product is
positioned as a decision, not a diary; the gates detect the answer in the first
two cohorts.

**One builder until the round closes.** *Mitigation:* the first three hires close
in months 1–3.

---

## 11. Assumptions

### Measured — from production

| | Value |
|---|---|
| Inference cost per agent question | €0.0026 · 1,941 questions, 27 Sep – 8 Oct 2026, including retries, verifier second attempts and evaluation runs |
| Tokens per question | 4,913 in — 74% cached — 137 out |
| Fixed infrastructure | €26/month today |
| Latency | p90 8.2 s, median 4.7 s |
| Evaluation results | 285 cases; most recent live run 180/183, verified rate 100% of answers returned |

### Assumed — and what replaces each

| | Value | Evidence that replaces it |
|---|---|---|
| Free → paid conversion | 6.0% → 7.5% | The first two cohorts. The largest single lever in the plan |
| Monthly churn / annual renewal | 8.0% / 55% | Month-three cohort curve, twelve weeks after launch |
| Upgrade from the existing free base | 0.6% / month | Cohort data — free users who convert later, not at signup |
| Questions per paying subscriber | 135 / month | Instrumented from launch; at 2.3% of revenue it cannot move the outcome |
| Annual plan mix | 45% | Checkout data from week one |
| Cost per registered signup | €6.40 → €5.50 | A live channel test before the month-10 step |
| Price | $19.99 / $149 | Five moderated sessions and the beta, before paid acquisition opens |
| Dutch loaded salaries | see §7 | Offers accepted |
| WBSO effect on payroll | 10% | An application and an hours administration |
| Build calendar to launch | 5 months | 83–106 scoped days against the hiring plan |

### Not in any number above

Photo and voice logging. Branded-food licensing. App-store fees — the product is
web-first at 2.9%, against 15–30% on a mobile store. Corporate taxes. Any
revenue from payer, employer or clinician-facing channels. Any non-dilutive
money from §8.
