# Competitors, and how DiaBite stands out

*20 November 2026. Written for the product plan, not for the deck. No person is named and no investor is named: this repository is public. Competitor facts come from each product's own site or store page and are what the vendor says, not what was measured; where a source is an independent test it says so. Prices and counts change: check the page before quoting a number. The market and funding context is in `docs/MARKET-competitive-analysis.md` and is not repeated here.*

## 1. Findings first

1. **We lose the first minute, not the argument.** Every direct competitor lets a person start without typing a meal in words: a photo, a barcode, a nutrition label. Most have a free tier, an App Store page with ratings, and an Android app. DiaBite is a web app behind a sign-in, English only, with no photo, no barcode and no label scan, and an answer that takes about 7 seconds (p90 about 14). A person comparing five apps in an app store never reaches what DiaBite does better.
2. **The whole category shares one weakness that DiaBite does not have, and an independent source names it.** Portion estimation from a photo is the weak point. A hands-on test of an AI carb counter for diabetes found portions underestimated by 17% and carbohydrate by 38.5% on average, with sandwiches the failure case; a July 2026 report of an NIH study of four photo calorie apps found calories and fat underestimated by about a third (read in a headline and summary only, not the paper). Vendors answer with a disclaimer: "an estimate, not a measurement". Nobody publishes an accuracy figure.
3. **DiaBite's real, checkable difference is not "we compute", it is "we show our working and you can correct it".** The number comes from a record, the weight comes from USDA's own household table or is named as an assumption, the person corrects any weight in one tap and the engine counts again, and a food we do not hold is named, not guessed. We checked ourselves hard on 19 November with a hundred American phrasings and fixed what it found; no competitor shows that it has been tested at all.
4. **Two competitors print numbers that are not properties of food.** An estimated blood-sugar curve with a peak time, and an estimated A1C, are properties of a person. Showing them is a positioning gift to DiaBite (and a regulatory question for them: the FDA's January 2026 guidance leaves "general wellness" outside enforcement only while a product does not claim to screen for, diagnose or manage a disease; an A1C-style number is on the wrong side of that line in our reading, which a lawyer must confirm).
5. **The thing nobody has built is the dietitian's side of a number.** The other apps export a CSV or a PDF for "your doctor". None starts from a dietitian's question: what did this person eat between visits, costed, with every assumption marked. DiaBite already prints a clinician summary; it has not been read by a clinician yet.

## 2. Who we are up against

### Layer one: apps that promise what DiaBite promises (a meal, scored by glycemic index and load, against a daily budget)

| App | How it starts | What it shows | Price (vendor pages) | Where it is ahead of DiaBite | Where it is weak |
|---|---|---|---|---|---|
| **Glycemic Snap** | photo, label, barcode, voice, text; web app too | a 0 to 100 score for the plate, GI and GL, **an estimated glucose curve with a peak time**, swaps, a daily budget (GL, net carbs, fibre, sugar), presets for type 1 and gestational; Pro: finger-prick log, time in range, **an estimated A1C**, Apple Health CGM import, a doctor report | free: 3 scans a day, diary and budget; Pro $9.99 a month or $39.99 a year | every way to start; a free tier; 14 languages; streaks, copy-a-day, regulars; CGM via Apple Health | says itself that scores and portions are estimates; names no team or clinician; no word on what happens to a food it does not know; serves conditions where a wrong portion becomes a wrong insulin dose |
| **Logi** | photo (text also) | GI and GL per food, **a predicted 3-hour glucose curve**, swaps and tips, micro-lessons, a HOMA-IR calculator, PDF for a doctor | price not on the page; free trial | coaching content; strong education framing for insulin resistance and PCOS | its page contradicts itself on database size (3,000 or 15,000 foods); no accuracy or medical disclaimer on the page; health claims and unverified testimonials with A1C changes |
| **CalEye** | photo | carbs, calories, macros, GL, a citation per estimate, a CSV or PDF export | free tier unlimited scans; Pro $4.99 a month | cheapest; unlimited free scans; citations per number; family sharing | photo portion estimation, as above; sources named only as "USDA, ADA, NIH"; no accuracy figure |
| **Glycemic Genius** | nutrition-label photo | GI and GL estimate for a packaged food, compare two foods, adjust the portion | $4.99 a month or $45 a year | label to GL in seconds | packaged foods only |
| **Glycemic Index and Load tracker** (a long-running reference app) | search a table | GI tables, a GL meal calculator, glucose, weight and pressure logs, CSV | free with ads; premium $12.99 a year | a lifetime of reference tables; cheap | ads, a paywall that reviewers call misleading, crashes, portions in grams only, some foods hard to find |
| **CarbScanner** | photo | carbs, GI, calories; one listing under the same name also does insulin dosing | free with purchases | | an insulin-dosing claim from a photo estimate is exactly the risk DiaBite refuses |
| **GlycoScan, Swoodie** | | | | | named in a list we were given; a search found nothing we could confirm exists. Do not cite them until someone opens a store page. |

### Layer two: carb counting and sensors, glycemic load secondary

| Product | What it is | Price | Why it matters to us |
|---|---|---|---|
| **Carb Manager** | carb and keto tracker, glycemic load in its paid tier, a very large user base | about $8.49 a month, $39.99 a year | the incumbent habit for low-carb diabetes tracking; a mixed verified and user-added database (per comparison blogs; not independently tested) |
| **Cronometer** | the dietitian's favourite tracker, strong micronutrients | Gold about $50 to $60 a year | glycemic load is a long-standing user request, not a shipped feature as far as we found; its credibility with dietitians is the thing to learn from |
| **Snaq** | photo carb counting wired to Dexcom, Libre and Medtronic | free tier 5 meals a week; premium from about $5 a month | built for people on insulin (about 40% type 1 by its own page); an independent hands-on review called its portions mostly wrong, small test |
| **mySugr** (Roche) | logbook, insulin and glucose | | where insulin users already are; not our user |
| **Levels, Signos, Nutrisense, Stelo and Lingo** | a sensor plus an app and coaching; Stelo and Lingo are FDA-cleared over-the-counter sensors for adults who do not use insulin | from about $15 to $25 a month for the app up to several hundred a month with sensors and coaching (aggregator figures, wide ranges) | they tell a person what already happened; DiaBite answers before the meal and needs no device. The price argument is weakening; "before, and you can audit it" is not. |

## 3. Honest score today (what a person sees in the first week)

Scale: strong, adequate, weak, absent. "DiaBite" is as shipped on 20 November.

| Capability | DiaBite | Best direct competitor | Matters because |
|---|---|---|---|
| Start with a photo | absent | strong (all of them) | the first-minute test |
| Barcode and label scan | absent | strong | packaged food is half of a day |
| Type a meal in your own words, with household measures (a cup, a medium apple, 4 oz) | **strong** | adequate (text input exists, measures are not a feature anyone shows) | Americans do not weigh food |
| Where the weight came from | **strong: named, correctable in one tap** | absent | the documented weak point of the category |
| An unknown food | **strong: named, never substituted** | absent | trust |
| Published accuracy or a test | **adequate: tested, not yet published** | absent | the only way to claim "accurate" |
| Daily budget (GL, carbohydrate) | strong | strong | parity |
| Free tier and price | weak (one price, sign-in wall) | strong ($0 to $5 for many) | conversion |
| Native app, App Store presence, ratings | absent | strong | where people look |
| Languages | absent (English) | strong (14) | not our market |
| CGM import, finger-prick log, time in range | absent | adequate (via Apple Health) | a different user: a sensor wearer |
| Estimated curve, estimated A1C | **absent on purpose** | present | see finding 4 |
| Dietitian-facing output | adequate (a printable summary, no clinician has read it) | weak (CSV, PDF) | our open lane |
| US restaurant chains | adequate (one chain, 26 items) | weak | where Americans decide in the moment |
| Menu planning, shopping list | adequate | weak to absent | habit and retention |
| Speed | weak (median about 7 s, p90 about 14 s) | adequate to strong | people abandon a spinner |
| Safety rules before any model (dosing, red flags, fasting) | **strong** | absent or not shown | trust, and risk |

## 4. Where DiaBite can be clearly better, and where it cannot

**Can be clearly better (and a competitor cannot copy quickly, because it comes from how the engine is built):**
- every number auditable, every assumed weight named and correctable, an unknown food named;
- tested in public: a published test of the engine on typed American meals, with the failures and the fixes;
- American units end to end, including restaurant portions;
- the dietitian's view of the same numbers;
- a short list of things it will not do (no curve, no A1C, no insulin advice), stated as a feature.

**Cannot be better than a funded or a fast indie team, and should not try:** photo recognition accuracy; CGM integrations; languages; a catalogue of every barcode in the world; coaching content.

## 5. The plan

Ordered by what changes the first-week outcome the most for the least build. Sizes are rough: S under a week, M one to three, L more. Each item says what it needs from the owner. Nothing here is started.

### A. Prove it in public (S to M; this is the difference, make it visible)

1. **Publish the test.** A page, "How we test", with the hundred-meal test of 19 November: what we asked, what came back right, what came back wrong, what we changed (breads, counts, spoonfuls, measures), with the date and the version. No competitor has anything like it. Needs: the owner's yes on publishing failures. *S.*
2. **Run the outside benchmark.** The independent reviewer of an AI carb counter used a cheese sandwich as the test that photo apps fail. Run the same kind of test (weighed bread, cheese, ham; typed in household measures) on DiaBite and publish the result, including what it takes to get it right. *S.*
3. **Put the assumption on the receipt, in words.** The one-tap correction exists; make the weights line the first thing a first-time user sees on their first answer, with one sentence saying why. *S.*

### B. Close the first-minute gap without competing on photos (M to L)

4. **A free first answer with no sign-in** (three questions a day, no diary), then sign-in to save. The sign-in wall is the biggest single reason a person never sees item A. Needs: a security decision (the wall exists for cost and abuse; the limits are already built). *M. Decision.*
5. **Label and barcode, computed by the engine.** Read the label (OCR) or the barcode, take the numbers from the label or from the branded record, let the engine do the arithmetic and mark them as a label's. Parity with the leaders on packaged food; the numbers stay computed. *M to L.*
6. **Photo as identification only.** Let a person photograph the plate to name the foods, then ask "how much?" in household measures instead of guessing it from the photo. This turns the category's documented weak point (portion from pixels) into our strength: the photo says what, the person or the table says how much. *L. Decision: it is a position, not a feature.*
7. **Speed.** The median answer is about 7 seconds; show the verdict as soon as the engine has it and let the agent's words follow. Parity item. *M.*

### C. Own the dietitian lane (M, then L)

8. **A short, public sample of the clinician summary** and a one-page "what we record and what we do not" for dietitians. The summary is built; no clinician has read it (WORKLIST №39, №60). The first reader's comments are worth more than any feature. *S, needs the owner to choose readers.*
9. **A dietitian invite:** a patient shares their summary by a link the dietitian opens without an account. Not a marketplace; a tool in the dietitian's hand. *M. Needs a data-protection decision (what is shared, for how long).*

### D. Price and packaging (decision, not build)

10. **A free tier that shows the difference** (the first answers, the correction, the receipt) and a paid tier for what a habit needs (the diary history, the menu, the summary). The market spans free, $4.99 a month and $39.99 to $59.99 a year; $9.99 a month is above all of it, and the case for it has to be verification and the dietitian lane, not the feature list. The annual price is still undecided (WORKLIST №40). *Decision.*

### E. What to stop and what to refuse

11. **Do not build** a glucose curve, an estimated A1C, an insulin or dose feature, or a "score" that is not a property of the food. Say so on the site as a list: "what DiaBite will not do, and why". *S, copy only.*
12. **Do not claim "accurate".** Claim "traceable": every number traces to a tool, every weight is named. The 19 November test found weights and foods that passed as verified and were wrong; the verifier checks that a number came from a tool, not that the right food or weight was chosen. The deck and the site must say traced, not correct, until the published test exists.

### F. Keep watching (a one-hour monthly check)

Glycemic Snap (features, price, the Pro tier), Logi, CalEye, Carb Manager (glycemic load in paid), the January 2026 FDA guidance and any warning letter about estimated glucose or A1C, the PHTI re-evaluation expected in 2027, Dexcom's integration of its acquired coaching app.

## 6. Decisions for the owner

1. **Publish "How we test"** with the failures in it? (A1; recommended: yes.)
2. **A free first answer without signing in?** (B4; recommended: yes, with the existing limits.)
3. **Photo as identification only, never as the weight?** (B6; recommended: later, after A and B4, and only if the position is the one you want: "the photo says what, you say how much".)
4. **Barcode and label, computed by the engine?** (B5; recommended: yes, as parity.)
5. **The price shape:** free tier plus one paid tier, and the annual price. (D10; WORKLIST №40.)
6. **Which dietitian reads the summary first?** (C8; WORKLIST №39 and №60.)

## 7. Sources

Vendor pages, read on 20 November 2026 (claims are the vendor's): Glycemic Snap (glycemicsnap.com), Logi (logifoodcoach.com), CalEye (caleye.fit), Snaq (an affiliate review page, treated as unverified), the App Store listings for Glycemic Genius, CarbScanner and the Glycemic Index and Load tracker. Independent: Diabettech's hands-on review of an AI carb counter (the cheese-sandwich article); HealthDay's July 2026 summary of an NIH study of photo calorie apps (headline only; the article body did not load); law-firm summaries of the FDA's January 2026 general wellness and clinical decision support guidance. Pricing for Carb Manager, Cronometer and the sensor services comes from aggregator and comparison sites, several published by competitors: indicative only.
