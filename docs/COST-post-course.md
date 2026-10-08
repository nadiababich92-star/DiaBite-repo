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

**Today (measured):** about **€16 a month** fixed, an always-on replica and the
registry, plus **€0.0026 per question** in model charges.

**At launch (assumed):** two replicas for availability, a managed Redis for the
limits and sessions, monitoring, a paid Supabase tier, a domain and email.
**About €80 – €150 a month fixed.**

Model charges grow with use. At the draft plan's 135 questions a month for a
paying user, and a lighter 40:

| Active users | Model charges, 135 q / month each | Model charges, 40 q / month each | Fixed | Model share of the bill |
|---|---|---|---|---|
| 100 | €35 | €10 | €80 – 150 | under a quarter |
| 1,000 | €351 | €104 | €80 – 150 | the larger part |
| 10,000 | €3,510 | €1,040 | €80 – 150 | nearly all |

A paying user costs about **€0.35 a month** in model charges, a tenth of the
$2.11 the draft financial plan assumed. Photo logging is not included: a vision
call per photo is not measured yet.

## 6. What a subscription would have to earn

Not a price recommendation: the price is the owner's decision and the finance
lecture is the place to make it. This only shows what the costs ask of any price.

At the draft plan's proposed **$19.99 a month** (about €18.29 at 0.915 euros to
the dollar, assumed), minus model charges of €0.35 and a card fee of about €0.80
(2.9% plus 30 cents, assumed rates), each paying user leaves about **€17.1 a
month** to pay for everything else.

- **Running costs:** about **9 paying users** cover €150 of fixed monthly cost.
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
