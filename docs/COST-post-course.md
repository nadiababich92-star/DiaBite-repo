# DiaBite — what the work after the course costs

**Written:** 8 October 2026 · **Status:** First calculation, built on assumptions that need quotes
**Scope:** `docs/PRD-post-course.md` (workstreams WS0–WS4 and WS6–WS9, the work to a public launch; photo and voice logging and the iteration stream are not in it)
**Currency:** euros. Azure charges the account in euros, so the measured figures are exact; every other figure is an assumption stated in its own line.

> **How far to trust this.** Three kinds of number appear and are marked.
> **Measured** comes from Azure Cost Management and the Foundry traces
> (`docs/monitoring.md`). **From the PRD** is a size in working days from
> `docs/PRD-post-course.md`, itself an estimate. **Assumed** is a price range for
> a consultant or a contractor that nobody has quoted yet: a planning range,
> not a fact, and each one is a line to replace with a real quote. Nothing here
> is a figure to show an investor.

## 1. The decision behind it

The owner pays no one today, and will need consultants, developers and other
specialists later. So the calculation does not ask "can this be built for
nothing". It asks **which of the work is done by the owner, and which is bought**,
and prices three ways of splitting it.

## 2. The work to launch, in days  *(from the PRD)*

| | Working days |
|---|---|
| WS0 Defects and debt | 3½–4 |
| WS1 Validation | 10–14 |
| WS2 Food gap | 16–24 |
| WS3 Accounts and diary | 9–11 |
| WS4 Next-version features | 12–14 |
| WS6 Compliance and accessibility | 10–11 |
| WS7 Platform and operations | 8½–10 |
| WS8 Security follow-up | 3–4 |
| WS9 Going to market | 11–14 |
| **To launch** | **83–106 days, 17–21 weeks of one person** |

## 3. What has to be bought either way  *(assumed)*

Some of this cannot be done by a builder at any price of their own time: a
lawyer's opinion, a dietitian's sign-off, a test by someone who is not the
author.

| Line | Assumption | Range |
|---|---|---|
| Registered dietitian: verify ingredient glycemic values, sign off copy | 60–100 hours at €45–90 an hour | €2,700 – €9,000 |
| Counsel: whether the product stays inside FDA general-wellness; privacy policy, terms, a data-protection basis for operating from the EU | one engagement | €3,000 – €12,000 |
| Accessibility audit by an outside party | one audit | €1,500 – €5,000 |
| Penetration test | one test | €3,500 – €10,000 |
| Incentives for session and beta participants | optional; the owner pays no one today | €0 – €1,000 |
| Domain, email, miscellaneous, first year | | €100 – €300 |
| **Outside services** | | **€10,800 – €37,300** |

Clinician advisors are unpaid today and are not in this table; if that changes
it is a line to add.

## 4. Three ways to build it  *(contractor day rate assumed at €400–700)*

| | Who builds | Your days | Calendar, if you work alone on your share | Cash to launch |
|---|---|---|---|---|
| **A. Solo, buy only the services** | You, with AI tools | 83–106 | 17–21 weeks | **€10,800 – €37,300** |
| **B. Hybrid** | You, and a contractor takes accounts and diary, platform and going to market (28½–35 days) | 54½–71 | 11–14 weeks | **€22,200 – €61,800** |
| **C. Outsourced build** | A contractor builds all of it; you decide, recruit and review | 0 of building | set by the contractor | **€44,000 – €111,500** |

Your own time is not priced in any row. If it has a price, **every €100 a day
adds €8,300 – €10,600 to A**, and proportionally less to B and C.

**What B buys is time and a second pair of eyes,** not a cheaper product. It
cuts the calendar by about six weeks for roughly €11,400 – €24,500, and it puts
the part that touches stored health data (accounts) in front of someone else's
review, which is worth something on its own.

## 5. What it costs to run

### What the calculator counts, and what DiaBite is billed for

The Azure Pricing Calculator adds up more than tokens: the model's input and
output, the cached part of the context, storage for a knowledge base, tool calls,
compute and the registry. Checked against the 18 meters Azure actually billed
for 20 September to 8 October:

| The calculator's line | What DiaBite is billed |
|---|---|
| **Context** (input tokens, the cached part at a tenth of the price) | Counted: about 4,900 tokens in per question for the meal or advice agent, 74% of them cached |
| **Output** | Counted: about 140 tokens |
| **Memory** (the advisor's memory store: extraction and recall run on a model and an embedding model) | Counted inside the same token meters; the embedding meter is €0.0012 in total |
| **Knowledge base** (file search: vector storage, listed at about €0.09 a GB a day) | Not billed: two small documents |
| **Tool calls to the engine** | Not a separate meter; the engine's own compute is the container |
| **Compute, registry, logs** | Container Apps, Container Registry; log ingestion in the free band |

So the **€0.0026 per question is a complete figure**: it is total billed model
charges divided by questions, memory and context included, evaluation runs
included. Rebuilt from list prices and the traced tokens it comes to €0.0017;
the gap is retries, a second attempt when the verifier rejects, and the agent's
own overhead. **Plan with the billed figure.** One caution: agent tools that
are free or in preview today (memory, file search) can start to be billed, and
nothing in this document protects against that except re-reading the bill.

List prices used (Sweden Central, euros; the same source as the calculator):

| Meter | Price |
|---|---|
| `gpt-5.4-mini` input / cached input / output, per 1M tokens | €0.66 / €0.066 / €3.96 |
| `gpt-5.4-nano` input / cached input / output, per 1M tokens | €0.176 / €0.0176 / €1.10 |
| Container Apps vCPU, idle | €0.000003 a second |
| Container Apps memory, idle | €0.000003 per GiB-second |
| Container Registry, Basic | €0.1466 a day (about €4.40 a month) |
| Azure Redis, Basic C0 / Standard C0 | €0.0194 / €0.0484 an hour (about €14 / €35 a month) |

### Today

**About €26 a month fixed:** the replica is always on at 1 vCPU and 2 GiB, about
€21 a month at list price (idle usage, less the monthly free grant), plus the
registry at €4.40. The daily bills confirm it: Container Apps about €0.70 on
every day it ran, the registry €0.147. An earlier line in this repository said
"about €16"; that was divided over a period in which the replica was not on
every day, and was too low.

### At launch  *(Azure lines at list price, the rest assumed)*

| Line | Per month |
|---|---|
| Container Apps, two replicas for availability | about €43 |
| Container Registry | €4.40 |
| Redis for sessions and limits: Basic, or Standard with a replica | €14 – €35 |
| Supabase Pro (assumed from the US price; check the page) | about €23 |
| Domain, email, monitoring alerts (assumed) | €5 – €15 |
| **Fixed** | **about €90 – €125** |

Model charges grow with use. At the draft plan's 135 questions a month for a
paying user, and a lighter 40:

| Active users | Model charges, 135 q / month each | Model charges, 40 q / month each | Fixed | Model share of the bill |
|---|---|---|---|---|
| 100 | €35 | €10 | €90 – 125 | about a quarter |
| 1,000 | €351 | €104 | €90 – 125 | the larger part |
| 10,000 | €3,510 | €1,040 | €90 – 125 | nearly all |

A paying user costs about **€0.35 a month** in model charges, a tenth of the
$2.11 the draft financial plan assumed. Photo logging is not included: a vision
call per photo is not measured yet.

### The same month in the Azure Pricing Calculator

Built on 8 October in the calculator itself (Sweden Central, euros, pay as you go) for one launch-scale month: **1,000 active users, 135 questions each, 135,000 questions**. The token counts are the measured ones per question (meal and advice agent: 4,913 in with 74% cached, 137 out; router: 259 in with 36% cached, 13 out).

| Line in the calculator | Per month |
|---|---|
| Azure Container Apps, 1 vCPU, 2 GiB, 0.5 million requests | **€0.00** |
| Container Registry, Basic, 5 GB | €4.84 |
| Azure Cache for Redis, Basic C0 | €14.13 |
| Azure OpenAI, GPT-5.4 mini: 171.1M input, 492.1M cached input, 18.5M output tokens | €218.66 |
| Azure OpenAI, GPT-5.4 nano: 22.4M input, 12.6M cached input, 1.8M output tokens | €6.09 |
| Azure Monitor, logs at this volume | €0.00 |
| **Calculator total** | **€243.72 a month, €2,924.67 a year** |

The calculator's model lines rebuild the list-price figure to the cent (€0.00166 a question), which confirms the meters. It also **gets two things wrong for this product**, and both matter for pricing:

1. **It does not charge for the replica being on.** The Consumption plan is modelled as billed only while requests are being served, so the always-on replica shows €0.00. The real bill is idle usage: about €21.70 a month per replica at list price (confirmed by the daily bills, about €0.70 a day). Two replicas at launch add about **€43**.
2. **It models the tokens on the traces, not the bill.** Billed model charges came to €0.0026 a question against €0.00166 here, 57% higher: retries, a second attempt when the verifier rejects, and agent overhead not visible in the trace. On €224.75 of model lines that is about **€127** more.

**What to budget for that month: about €415** (€243.72 + €43 + €127), plus the non-Azure lines (Supabase about €23, domain and email €5–15) and payment fees, which are a share of revenue. That agrees with the earlier table (1,000 users: €351 model charges plus €90–125 fixed, about €440–475) from the other direction.

The estimate is not saved: saving and sharing in the calculator needs a Microsoft sign-in. To reproduce it, enter the table above, or use *Export* for a spreadsheet.

## 5b. 1,000 people using it every day

The question that matters for planning: what does a month cost when a thousand
people use the app daily? Three intensities, using the billed **€0.0026 a
question**. 4.5 a day is the draft plan's figure (five to seven eating decisions
a day, not all asked of the app).

| | 2 questions a day | **4.5 a day** | 7 a day |
|---|---|---|---|
| Questions a month | 60,000 | **135,000** | 210,000 |
| Model charges | €156 | **€351** | €546 |
| Azure fixed: two replicas, registry, Redis, alerts | €70 – 100 | **€70 – 100** | €80 – 110 |
| Supabase Pro, domain, email (assumed) | €33 | **€33** | €33 |
| **Total a month** | **about €275** | **about €470** | **about €675** |
| Per user a month | €0.28 | **€0.47** | €0.68 |

Payment fees are not in it: they are a share of whatever is charged, about €0.80
on a $19.99 subscription. At $19.99 each paying user leaves about €17.5 after
model charges and the card fee, so **about 27 paying users out of 1,000 (2.7%)
cover the whole running bill at 4.5 questions a day**, if every one of the
thousand used it that much. It leaves out people, which at this size is the larger
cost: support, a dietitian keeping the data layer current, clinical review, legal
upkeep.

**What has to change before real traffic of this size** (none of it is done):

1. **The daily ceiling.** `ASK_DAILY_CEILING` is 1,000 model turns a day, set to
   protect the budget when a question was thought to cost far more. At 4,500
   questions a day it would stop the app after about a fifth of the day's
   users. Raise it to about 10,000 (a worst-day bill of roughly €26).
2. **Two replicas need Redis first** (workstream 7). Sessions, the parked day
   state and the limits are in memory on the one replica; a second replica
   would answer a tool call for a day state parked on the first.
3. **The model quota.** The `gpt-5.4-mini` deployment allows 200,000 tokens a
   minute, about 40 questions a minute. At 1,000 daily users the peak is around
   10 a minute, a quarter of it. About 4,000 daily users would need a larger
   quota.
4. **Per-user limits** for any free tier need accounts; today the limits are
   per address and per conversation.

## 6. What a subscription would have to earn

Not a price recommendation: the price is the owner's decision and the finance
lecture is the place to make it. This only shows what the costs ask of any price.

At the draft plan's proposed **$19.99 a month** (about €18.29 at 0.915 euros to
the dollar, assumed), minus model charges of €0.35 and a card fee of about €0.80
(2.9% plus 30 cents, assumed rates), each paying user leaves about **€17.1 a
month** to pay for everything else.

- **Running costs:** about **8 paying users** cover €125 of fixed monthly cost.
- **Launch spend:** the same €17.1 has to repay what was spent to launch:

| Launch spend | Paying user-months to repay it |
|---|---|
| A, low: €10,800 | 630 (for example 100 subscribers for six months) |
| A, high: €37,300 | 2,177 |
| B, high: €61,800 | 3,607 |
| C, high: €111,500 | 6,507 |

This leaves out the free tier, churn, refunds, support, the owner's time and tax,
all of which lower the contribution. Read it as an order of magnitude: **the cost
of running DiaBite is small; the cost of launching it is the thing to plan.**

## 7. What would change these numbers

1. **Quotes.** Counsel, dietitian, accessibility and penetration test are
   assumed ranges, and they are the whole of the €26,500 spread between A's low
   and high. They are the biggest uncertainty in the cash figure.
2. **A contractor's real rate and region.** €400–700 a day is a placeholder.
3. **Photo logging** (not in the total) adds a measured-per-image cost and 8–12
   days.
4. **Whether clinicians are paid.**
5. **The branded-foods decision:** a licensed source instead of public USDA data
   would add a recurring fee.
6. **The price.** Section 6 depends on it entirely.

**Next step:** replace the assumed lines with quotes, starting with counsel
(the slowest and the one that gates three workstreams), then re-run with the
finance lecture's method.

## 8. Reaching a net of €10,000

"Net" here means what is left of subscription income after running costs and
the other monthly overhead below, **before your own income tax and before VAT or
US sales tax**. Both readings of the target are shown: €10,000 a *month*, and
€10,000 a *year* (€833 a month).

**The plans this is built on** (the draft financial plan's structure, with the
price as the variable):

| Plan | What it includes | Price |
|---|---|---|
| **Free** | the whole deterministic engine: targets and their derivation, diary, safety rules; **15 agent answers a month** (about €0.04 a user) | €0 |
| **Pro, monthly** | unlimited agent answers under fair use, and the paid features as they ship | $9.99, **$14.99** or $19.99 |
| **Pro, annual** | the same; the plan assumed 7.45 times the monthly price (a third off) | $74 / **$112** / $149 |

The mix is 55% monthly and 45% annual (the draft plan's assumption), so the
average revenue per paying user is 83% of the monthly price. Costs per paying
user: model charges about €0.35 a month (135 questions), the card fee (2.9% plus
30 cents, assumed; a Poland-based account charging US cards may pay more), and a
share of the free users' cost.

**Paying users needed**, at a free-to-paid conversion of 3%, 5% and 10%
(assumed; nothing measured yet), with €125 of fixed infrastructure and other
monthly overhead of **€600** (you alone, an accountant, tools) or **€3,000**
(adding part-time support, a dietitian retainer, legal upkeep): both assumed.

**€10,000 a month**

| Price | Overhead €600: paying users | registered users at 5% | Overhead €3,000: paying users | registered users at 5% |
|---|---|---|---|---|
| $9.99 | 1,756 | 35,100 | 2,148 | 43,000 |
| **$14.99** | **1,095** | **21,900** | **1,340** | **26,800** |
| $19.99 | 796 | 15,900 | 974 | 19,500 |

At 3% conversion the registered users needed are about 1.5 times these; at 10%,
about half.

**€10,000 a year**

| Price | Overhead €600: paying users | registered users at 5% | Overhead €3,000: paying users | registered users at 5% |
|---|---|---|---|---|
| $9.99 | 255 | 5,100 | 648 | 13,000 |
| **$14.99** | **159** | **3,200** | **404** | **8,100** |
| $19.99 | 116 | 2,300 | 294 | 5,900 |

**What these numbers leave out, and it is the main thing:**

1. **Getting the users.** The draft plan puts a paid-channel acquisition cost at
   $100 a paying user (its own estimate). At that price 1,100 paying users cost
   about €100,000 to find; 160 cost about €15,000. A monthly target of €10,000 is
   not reachable by buying users; it needs an organic channel (clinicians,
   dietitians, communities, search). That channel is the real plan.
2. **Churn.** The tables count paying users *at a time*. Subscribers leave; at 5%
   a month, 1,100 payers means winning about 55 new ones every month just to stand still.
3. **Prices were not tested.** A lower price needs more payers but may convert
   better; a higher one the reverse. Nothing here measures it.
4. **Infrastructure at 20,000 or more registered users** needs more than €125;
   the per-question costs scale, the replicas and Redis do not stay at the floor.
5. **Taxes, refunds and any app-store fee** (30% or 15% on a mobile store
   subscription; a web-first product avoids it).

**What this suggests:** €10,000 a year is a first-year goal with real
plausibility (120–400 paying users); €10,000 a month is a multi-year goal that
depends on an organic channel and on the price test. Take the price from the
sessions and the beta, not from this table.
