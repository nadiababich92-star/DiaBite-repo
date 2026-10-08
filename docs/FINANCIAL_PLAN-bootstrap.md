# DiaBite — Financial Plan

**Version 2 · built on measured costs**
Author: Nadia Babich · Date: 8 October 2026 · Status: Draft for review
Supersedes version 1 (1 September 2026), which overstated the cost of running the
product by about six times and sized a team that does not exist.

**Currency:** euros. Azure bills the account in euros, so cost figures are exact.
Prices are quoted in dollars because the market is the United States, converted at
0.915 euros to the dollar (assumed).
**Companion to:** `docs/PRD.md`, `docs/PRD-post-course.md` (the scope),
`docs/COST-post-course.md` (the cost calculation), `docs/monitoring.md` (where the
measured figures come from).

> **How to read this.** Three kinds of number, each marked.
> **[measured]** comes from Azure Cost Management and the Foundry traces.
> **[scoped]** is a size in working days from `docs/PRD-post-course.md`.
> **[assumed]** is a figure nobody has quoted or tested — a planning range, not a
> fact. Every growth number in this plan is assumed: there are no users yet.
> §12 lists what has to be replaced before any of this is shown to anyone.

---

## 1. What changed, and why version 1 was wrong

Version 1 was written before anything ran. Three of its load-bearing assumptions
have since been measured or overtaken.

| | Version 1 | Now | Source |
|---|---|---|---|
| Model charges per paying user | $2.11 / month | **€0.35 / month** | **[measured]** €0.0026 a question × 135 |
| Fixed infrastructure | not separated | **€26/mo today, €90–125 at launch** | **[measured]** |
| Team | 14 people by month 36 | **one person, buying services** | owner's decision, 8 October |
| Funding | $2.5M seed + $6M Series A | **€15,000–41,000 of launch spend** | **[scoped]** + **[assumed]** |
| Peak cash requirement | $3.01M | **about €24,000** | this model |
| Goal | $7.25M ARR by year 3 | **€10,000 net, first a year then a month** | owner's target |

**The six-times error mattered less than the second mistake.** The $3.01M was
never a property of the product — it was the cost of fourteen salaries. Remove
the team and the same product needs roughly €24,000. The architecture that made
inference cheap was already in version 1; what version 1 got wrong was assuming
that building a consumer health product requires a company.

**What this does to the shape of the plan.** With a 93% contribution margin and
€110 a month of fixed cost, ten paying subscribers cover the infrastructure.
Cost is no longer a question worth planning around. Two things are:

> **The cost of running DiaBite is trivial. The cost of launching it is one
> number — about €15,000–41,000 — and the cost of not being found is the whole
> business.**

Everything below is organised around those two, in that order.

---

## 2. Assumption register

### Measured

| | Value | Source |
|---|---|---|
| Model charges per question, billed | **€0.0026** | Cost Management, 27 Sep – 8 Oct, 1,941 questions; includes retries, verifier second attempts, memory, evaluation runs |
| Tokens per question | 4,913 in (74% cached), 137 out on `gpt-5.4-mini`; 259 in, 13 out on `gpt-5.4-nano` | Foundry traces |
| Fixed infrastructure today | **€26 / month** | one always-on replica (€21.70) + registry (€4.40) |
| Fixed infrastructure at launch | **€90–125 / month** | two replicas €43, registry €4.40, Redis €14–35, Supabase Pro €23, domain and alerts €5–15 |
| Answer latency | p90 8.2 s, median 4.7 s | live service, 8 October |

### Scoped

| | Value |
|---|---|
| Work to launch | **83–106 working days** (WS0–WS4, WS6–WS9) — 17–21 weeks full-time |
| Work excluded from that | WS5 photo and voice (11–16 days), WS10 iteration (not sized) |

### Assumed — these are the plan's weak joints

| | Value | Note |
|---|---|---|
| Questions per paying user | 135 / month (4.5 a day) | from the PRD's "five to seven eating decisions a day"; **not measured on a real user** |
| Free-tier ceiling | 15 answers / month (€0.04 a user) | a decided product limit, not an assumption |
| Build calendar | **launch in month 8** | 83–106 days at about three days a week. Full-time would be month 5 |
| Registered signups, launch month | **150**, growing **12% a month** | the single most consequential number in this document |
| Free → paid conversion | **5%** | the cost document's middle case; 3% and 10% are modelled in §10 |
| Monthly-plan churn | **8% / month** | consumer health churns hard |
| Annual-plan renewal | **50%** | |
| Plan mix | 55% monthly, 45% annual | carried from version 1 |
| Card fee | 2.9% + €0.27 a charge | a Poland-based account charging US cards may pay more |
| Overhead | €150/mo during build, €600 after launch, €1,200 from month 20 | tools, accountant, then some bought help |
| Outside services | €10,800–37,300 | `docs/COST-post-course.md` §3 — **no quotes yet**, and the whole of the spread |

---

## 3. Unit economics — per paying subscriber, per month

| | $9.99 | **$14.99** | $19.99 |
|---|---|---|---|
| Monthly price | €9.14 | **€13.72** | €18.29 |
| Annual price (7.45× monthly) | €68.10 | **€102.18** | €136.27 |
| Blended ARPU, 55/45 mix | €7.58 | **€11.38** | €15.17 |
| Card fee | €0.38 | **€0.49** | €0.60 |
| Model charges **[measured]** | €0.35 | **€0.35** | €0.35 |
| **Contribution** | **€6.85** | **€10.54** | **€14.22** |
| **Contribution margin** | 90.4% | **92.6%** | 93.7% |
| Subscribers to cover €110 fixed | 16 | **10** | 8 |

A free user costs **€0.039 a month** at the 15-answer ceiling — about 250 free
users per paying subscriber before the free tier costs more than one subscription.

| | $9.99 | **$14.99** | $19.99 |
|---|---|---|---|
| Blended churn (55/45 mix) | 6.28% / month | 6.28% | 6.28% |
| Average subscription life | 15.9 months | 15.9 months | 15.9 months |
| **LTV (contribution × life)** | €109 | **€168** | €226 |

**What this margin does and does not mean.** It means the product is cheap to
serve and a single subscriber is immediately profitable — there is no
scale threshold to reach before the economics work. It does not mean the business
works, because none of the costs that actually dominate are per-user: the launch
spend, the owner's time, and acquisition.

---

## 4. What it costs to launch

From `docs/COST-post-course.md` §4, with the pre-launch infrastructure and the
post-launch operating deficit added to give a cash requirement rather than a
spend figure.

| | Who builds | Owner's days | Launch spend | Pre-launch infra | Post-launch deficit | **Peak cash out** |
|---|---|---|---|---|---|---|
| **A. Solo, buy only services** | owner, with AI tools | 83–106 | €10,800–37,300 | €1,200 | €2,600 | **€14,600 – 41,100** |
| **B. Hybrid** | owner + contractor takes WS3, WS7, WS9 | 54½–71 | €22,200–61,800 | €1,200 | €2,600 | **€26,000 – 65,600** |
| **C. Outsourced** | contractor builds, owner decides and reviews | 0 of building | €44,000–111,500 | €1,200 | €2,600 | **€47,800 – 115,300** |

The owner's time is not priced in any row. At €100 a day it adds €8,300–10,600
to A.

**The services inside A, phased** — these are the plan's cash timetable, and
counsel comes first because it gates three workstreams:

| Month | Line | Amount |
|---|---|---|
| 1 | Domain, email, miscellaneous | €200 |
| 2–3 | **Counsel**: FDA general-wellness position, privacy policy, terms, EU data-protection basis | €6,000 |
| 4–6 | **Registered dietitian**: verify 351 ingredient GI values against sources, sign off safety copy | €5,000 |
| 7 | Accessibility audit (€2,500) + penetration test (€5,500) | €8,000 |
| 8 | Session and beta participant incentives | €500 |
| | **Total, base case** | **€19,700** |

Every line is **[assumed]** and unquoted. They are the entire €26,500 spread
between A's low and high, which makes getting three quotes the highest-value
hour of financial work available right now.

**Recommendation: option A.** Not because it is cheapest, but because at this
stage the thing being tested is whether anyone wants the product, and €41,000
is a lot to spend to find out. B becomes the right answer once the beta gate in
§9 is passed — it buys about six weeks of calendar for €11,400–24,500 and puts
the code that touches stored health data in front of a second pair of eyes,
which is worth something on its own.

---

## 5. What it costs to run

**[measured]** per-question cost, **[assumed]** everything else. Reproduced
from `docs/COST-post-course.md` §5b: a thousand people using it daily.

| | 2 questions/day | **4.5/day** | 7/day |
|---|---|---|---|
| Questions a month | 60,000 | **135,000** | 210,000 |
| Model charges | €156 | **€351** | €546 |
| Azure fixed (2 replicas, registry, Redis, alerts) | €70–100 | **€70–100** | €80–110 |
| Supabase Pro, domain, email | €33 | **€33** | €33 |
| **Total a month** | **≈ €275** | **≈ €470** | **≈ €675** |
| Per user a month | €0.28 | **€0.47** | €0.68 |

At $14.99, **about 45 paying subscribers out of those 1,000 cover the entire
running bill** at 4.5 questions a day.

**Four things have to change before traffic of that size, and none is done** —
each is in WS7 and each is cheap, but a plan that ignores them is wrong:

1. **`ASK_DAILY_CEILING` is 1,000 model turns a day**, set when a question was
   thought to cost far more. At 4,500 questions a day it stops the app about a
   fifth of the way through. Raise to ~10,000 — a worst-day bill of about €26.
2. **Two replicas need Redis first.** Sessions, parked day state and limits are
   in memory on one replica today.
3. **The model quota** is 200,000 tokens a minute, about 40 questions. Fine at
   1,000 daily users (peak ~10/min); a larger quota is needed around 4,000.
4. **Per-user free-tier limits need accounts** (WS3). Today limits are per
   address and per conversation.

**One unpriced risk in this section:** memory and file search are free or in
preview today. If Azure starts billing them, this table moves and nothing
protects against it except re-reading the bill.

---

## 6. Pricing

**Recommendation: test $14.99 a month / $112 a year.** With the explicit caveat
that `docs/COST-post-course.md` is right — the price should come from the five
moderated sessions and the beta, not from this table. What the model can say is
what each candidate demands:

| | $9.99 | **$14.99** | $19.99 |
|---|---|---|---|
| Subscribers to cover fixed cost | 16 | **10** | 8 |
| Subscribers for €10,000 a year net | 255 | **159** | 116 |
| Subscribers for €10,000 a month net | 1,756 | **1,095** | 796 |
| Month monthly net turns positive | 18 | **15** | 13 |
| Month €10,000/year rate is reached | 27 | **23** | 18 |
| Month launch spend is repaid | 35 | **31** | 28 |
| Revenue, first 12 months after launch | €5,837 | **€8,759** | €11,680 |

$19.99 reaches every milestone four to five months sooner and is what version 1
proposed. Two reasons not to start there: the PRD's own persona research puts
willingness to pay at *moderate* — this is compared against a medication copay,
not against ZOE — and at 142 subscribers a year after launch, the difference
between the three prices is €2,900 of annual revenue. **That is not enough to
justify guessing.** The price that matters is the one that converts, and nothing
has measured that.

$9.99 is the one to avoid as an opening price: it needs 16 subscribers just to
cover infrastructure and pushes every milestone out by four to eight months, in
exchange for a conversion advantage nobody has demonstrated.

**The free tier stays as designed.** The whole deterministic engine — targets
with their derivation, diary, safety rules — plus 15 agent answers a month. At
€0.04 a user it is the cheapest marketing in this plan, and it is the only
honest way to show that the numbers can be trusted before anyone pays.

---

## 7. The plan, month by month

Base case: option A, $14.99, launch in month 8, 150 signups in the launch month
growing 12% a month, 5% conversion, 8% monthly churn. Month 1 is October 2026.

| Month | Signups | Free | Paying | Revenue | Variable | Fixed | Services | Net | Cumulative |
|---|---|---|---|---|---|---|---|---|---|
| 1 | — | — | — | — | — | €176 | €200 | (€376) | (€376) |
| 2 | — | — | — | — | — | €176 | €3,000 | (€3,176) | (€3,552) |
| 3 | — | — | — | — | — | €176 | €3,000 | (€3,176) | (€6,728) |
| 4 | — | — | — | — | — | €176 | €2,000 | (€2,176) | (€8,904) |
| 5 | — | — | — | — | — | €176 | €2,000 | (€2,176) | (€11,080) |
| 6 | — | — | — | — | — | €176 | €1,000 | (€1,176) | (€12,256) |
| 7 | — | — | — | — | — | €176 | €8,000 | (€8,176) | (€20,432) |
| **8 · launch** | 150 | 142 | 8 | €85 | €12 | €710 | €500 | (€1,137) | (€21,569) |
| 9 | 168 | 288 | 15 | €175 | €24 | €710 | — | (€559) | (€22,128) |
| 10 | 188 | 438 | 24 | €270 | €37 | €710 | — | (€477) | (€22,604) |
| 11 | 211 | 594 | 33 | €372 | €51 | €710 | — | (€389) | (€22,993) |
| 12 | 236 | 759 | 43 | €482 | €65 | €710 | — | (€294) | (€23,287) |
| 14 | 296 | 1,122 | 65 | €729 | €98 | €710 | — | (€80) | **(€23,557)** ← trough |
| **15** | 332 | 1,325 | 77 | €869 | €117 | €710 | — | **€42** | (€23,515) |
| 18 | 466 | 2,050 | 123 | €1,378 | €183 | €710 | — | €485 | (€22,531) |
| 20 | 584 | 2,662 | 162 | €1,812 | €240 | €1,310 | — | €262 | (€21,605) |
| **23** | 821 | 3,851 | 238 | €2,660 | €350 | €1,310 | — | **€999** | (€19,397) |
| 24 | 920 | 4,339 | 270 | €3,008 | €396 | €1,310 | — | €1,302 | (€18,094) |
| 30 | 1,815 | 8,721 | 552 | €6,135 | €803 | €1,310 | — | €4,021 | (€1,634) |
| **31** | 2,033 | 9,773 | 621 | €6,897 | €902 | €1,310 | — | €4,685 | **€3,051** ← repaid |
| 37 | — | — | 1,122 | €12,468 | €1,625 | €1,310 | — | **€10,062** | €38,000 |

Milestones in the base case:

| | |
|---|---|
| Peak cash requirement | **€23,557**, month 14 |
| Monthly net turns positive | **month 15** (7 months after launch, 77 subscribers) |
| €10,000 a *year* rate (€833/mo net) | **month 23** (238 subscribers) |
| Launch spend fully repaid | **month 31** |
| €10,000 a *month* net | **month 37** (about 1,100 subscribers) |

**Reconciliation with `docs/COST-post-course.md`.** That document's static tables
say €10,000 a year needs 159 subscribers at $14.99 and €10,000 a month needs
1,095. This model agrees on both counts and adds the thing the static table
leaves out — the time to accumulate them against churn. 159 subscribers arrive
in month 20; the €833 *net* rate lands in month 23 because overhead steps up to
€1,200 at month 20. 1,095 subscribers arrive in month 36. The two documents are
consistent; one answers "how many", this one answers "when".

---

## 8. The result that matters most

At 6.28% blended churn, a flat acquisition rate produces a flat business. Where
it settles:

| Signups per month, flat | Plateau | Contribution | Against €1,310 of fixed + overhead |
|---|---|---|---|
| 75 | 60 subscribers | €630 / month | **loses €680 a month, forever** |
| 150 | 120 subscribers | €1,259 / month | **breaks even and never repays the launch** |
| 300 | 239 subscribers | €2,519 / month | €1,200 a month |
| 600 | 478 subscribers | €5,037 / month | €3,700 a month |

**150 signups a month, flat, is a business that never loses money and never
earns any.** It is not a failure anyone would notice for a year, which is what
makes it the real risk. Compounding is not a nice-to-have in this plan — it is
the plan.

This is why §9's gates are written on the acquisition channel and not on the
product. The product's numbers are already good: 93% margin, verified answers,
latency under target. Nothing in the cost structure can go wrong enough to
matter. The channel can.

**Where the channel has to come from.** Paid acquisition is ruled out by
arithmetic, not by preference: version 1's own estimate put a paid-channel
subscriber at $100, against an LTV of €168. Finding 1,100 subscribers that way
costs about €110,000, which is four times the entire launch budget. So the
channel is clinicians and dietitians who already see these patients, condition
communities, and search — the three places where the product's actual
differentiator, showing the arithmetic, is the thing being discussed.

---

## 9. Gates

Spend and commitment step up on evidence. These are the PRD's own launch
stages, with the money attached.

| Stage | Spend released | Gate to pass first |
|---|---|---|
| **Now → five strangers** (WS0, WS1 sessions) | counsel engagement (€6,000); nothing else | WS0 defects closed; five sessions recorded; every phrase that broke the product is an eval case |
| **Beta**, 10–20 people, two weeks | dietitian (€5,000) | Parsing ≥ 90% on *their* phrases; verified rate ≥ 98% of live turns; acceptance ≥ 40%; time to log under 20 s; **no Harmless failure** |
| **Launch** | audit + pen test (€8,000); payments built | Verified ≥ 99%; clinician review of all safety copy; **counsel's FDA position in writing**; data provenance shown in-app |
| **Buy help** (option B) | contractor, €11,400–24,500 | 100 paying subscribers **and** signups growing month over month for three consecutive months |
| **Overhead to €3,000/mo** (support, dietitian retainer, legal upkeep) | — | 400 paying subscribers |

**The gate that stops the plan:** if signups are flat for three consecutive
months after launch, §8 says the business plateaus below break-even. The right
response is to change the channel or stop, not to spend more on the product.

---

## 10. Sensitivity

Every lever, at $14.99. **Acquisition dominates everything.**

| Change | Net positive | Repaid | €10k/year rate | €10k/month | Peak cash |
|---|---|---|---|---|---|
| **Base** | M15 | M31 | M23 | M37 | €23,557 |
| Half the signups (75) | M25 | M38 | M29 | M43 | €27,048 |
| Double the signups (300) | M12 | M25 | M16 | M31 | €22,214 |
| **Flat growth (+0%/mo)** | **never** | **never** | **never** | **never** | **€35,702+** |
| Fast growth (+20%/mo) | M14 | M25 | M17 | M28 | €23,211 |
| Conversion 3% | M19 | M36 | M27 | M42 | €25,958 |
| Conversion 10% | M12 | M24 | M15 | M31 | €22,154 |
| Churn 12%/month | M16 | M32 | M24 | M38 | €23,677 |
| Churn 5%/month | M15 | M30 | M22 | M36 | €23,468 |

Two readings worth taking from this table.

**Churn barely moves the dates** — 12% against 5% is one month to net-positive
and two months to repayment. That is a consequence of the 45% annual mix, which
is doing more work here than any other single assumption, and an argument for
pushing annual harder than the 45% assumed.

**Nothing in the cost structure appears in this table at all.** Model charges
could quadruple and no date would move by a month. The architecture already won
that argument; there is nothing left to optimise there, and effort spent on it
is effort not spent on the channel.

---

## 11. Risks with a financial consequence

**Counsel's answer on the FDA line.** Still unanswered, and it gates WS3, WS6
and WS9. If a "can I eat this" verdict for diagnosed users falls outside
general-wellness guidance, the product becomes a regulated device: version 1
put a 510(k) route at $400k–900k and 12–18 months, which this plan cannot
carry under any scenario. It is the only risk here that ends the plan rather
than delays it, and the €6,000 in months 2–3 is the cheapest insurance in the
document. **Ask now.**

**Holding health data from the EU.** The owner operates from the EU and the
market is the US, so storing identifiable health data brings GDPR alongside US
rules. WS3's recommended start — a device-scoped anonymous id, no name, no
email — is also the cheapest legal posture, and that is not a coincidence.
Treat real sign-in as a decision with a legal price, not a feature.

**The 13% unknown-food rate.** The most visible weakness and the first thing a
user hits. It is a conversion risk, not a cost risk: WS2 is 16–24 days of the
owner's time and a dietitian's hours, already in the plan. What it threatens is
the 5% conversion assumption, which §10 shows is worth seven months.

**One builder.** 83–106 days of one person is a plan with a single point of
failure, and an illness or a job that takes priority moves every date in §7.
The half-time build assumption already carries some of this; the honest
statement is that the calendar is the least reliable column in this document.

**Azure billing changes.** Memory and file search are free or in preview. If
they start being billed, §5 moves. Small, but unhedged.

**Not in this plan at all:** photo and voice logging (WS5 — a vision call per
image is unmeasured, and 11–16 days), branded-food licensing if USDA proves
insufficient, app-store fees should a mobile app ever ship (15–30%, against the
current 2.9% — web-first is worth keeping), and taxes of every kind. "Net" here
means before income tax and before VAT or US sales tax.

---

## 12. What has to be replaced before this is shown to anyone

In the order that moves the outcome:

1. **Signups per month and their growth rate.** The whole plan turns on it, and
   §8 shows that flat growth is a business that never earns. Nothing measures
   it. The five sessions and the beta are the first data.
2. **Three quotes** — counsel, dietitian, accessibility, pen test. They are the
   entire €26,500 spread in the cash figure, and counsel is also the slowest
   thing in the plan. This is the highest-value hour available right now.
3. **Free → paid conversion.** 5% is borrowed. Worth seven months between 3%
   and 10%.
4. **Questions per user per day.** 4.5 is inferred from the PRD, not observed.
   It scales model charges linearly — which, per §10, is the one input that
   genuinely does not matter much. Instrument it anyway; it is free.
5. **The price.** Take it from the sessions and the beta.
6. **The build calendar.** Month 8 assumes about three days a week. State the
   real number and every date in §7 moves with it.

The PRD's market figures (CDC prevalence, ADA cost of diabetes) are not inputs
here — no line in this plan derives from market size — but they carry the same
verification obligation wherever they appear.

---

## 13. If the plan were funded instead

Worth stating once, because version 1 assumed it and this version does not.

A €2.5M seed is now **roughly a hundred times** the cash this product needs to
reach launch. Raising it would not accelerate anything that is actually slow:
counsel's reply, clinicians' answers, and whether 150 people a month find the
product are not cash-limited problems. What money buys is option C — a
contractor builds everything, €47,800–115,300 — which compresses the calendar
by a few months and nothing else.

Version 1's $3.01M peak-cash figure should be read as what it was: the cost of
a fourteen-person company, not the cost of this product. The case for raising
returns only if the channel in §8 proves to compound faster than one person can
serve it. That is a Stage C question, and on the evidence available on
8 October it is premature by about a year.
