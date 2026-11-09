# What we build next

Written 30 September. It leaves out the two things with their own deadlines —
the financial section (Saturday's lecture) and rehearsing the demo — and covers
what turns DiaBite from a thing that demonstrates well into a thing someone
uses twice.

Everything here is sized against what is already true: the agent answers in
under eight seconds at p90, 203 of 203 behavioural checks pass, the app lives
at a permanent address, and **18% of the food phrases people type are not in
the database**.

---

## Now — make it survive contact with five strangers

The user sessions are the next real event, and three things stand between the
product and someone using it unattended.

### 1. The phone
*Half a day.*

Food gets logged standing at a fridge, not at a desk. At 375 px the app holds
together — the onboarding reads well, nothing overflows — but the **ask box is
about 150 px wide**, which is the primary input of the product reduced to a
slot, and the tab row wraps onto two lines with the feedback pill stranded on
the second. Stack the input above the button, give the tabs a scroll rather
than a wrap.

**Done when:** a meal question can be typed and read on a phone without
zooming, and the receipt's three columns still line up.

### 2. The feedback form, on the hosted build
*Ten minutes, and one decision from you.*

Vite inlines the Supabase project URL and publishable key at build time, and
the repository's secrets hold only the Azure ones, so the hosted form is inert.
Both values are public by design — anyone who opens dev tools sees them — so
putting them in the repository's secrets is ordinary practice. I can set them
from your `.env.local` without printing them anywhere.

**Done when:** a comment left on the hosted app appears in the Supabase table.

### 3. The session protocol
*Half a day to write; the sessions are yours to schedule.*

Five moderated sessions, each 30 minutes, run on the hosted URL. The protocol
names the tasks (log a real breakfast, ask about a meal you are unsure of, find
out why a number is what it is), what I measure (where they hesitate, what they
type that we cannot resolve, whether they believe the number), and — the part
that matters most — **what the moderator must not say**. The instinct to
rescue someone who is stuck destroys the only data the session produces.

Every unresolvable phrase they type goes straight into the eval set. That is
the flywheel: real misses become permanent tests.

**Done when:** five sessions are recorded, and the phrases they broke it with
are cases.

---

## Next — the food gap

18% unknown is the product's most visible weakness, and it needs a decision
from you before it needs code from me.

### The decision: branded foods

The missing items are, almost entirely, American everyday and brand foods:
Doritos, Oreos, Red Bull, KIND bars, Chick-fil-A, Kraft mac and cheese, diet
coke. **They have no published glycemic index.** Three honest options:

| Option | What it costs |
|---|---|
| **Leave them unknown** | The current behaviour. Honest, and the demo turns it into a strength — but a user who eats Doritos gets nothing, twice, and stops asking |
| **Add them with nutrients only, no GI, and say so** | Carbs, fibre and calories are published for every branded product (USDA Branded Foods). We could give a carb figure and say the glycemic load cannot be computed. Half an answer, clearly labelled as half |
| **Estimate GI by category, marked as an estimate** | Every number becomes traceable to "a category average", not to a measurement. It breaks the sentence the whole product rests on |

My recommendation is the middle one, and I would build it as a visibly
different kind of answer — carbs yes, glycemic load explicitly not available —
rather than quietly filling the gap.

### The part that needs no decision
*A day.*

Four dishes in the missing list are composites of ingredients we already hold,
so they can be built the way the other thousand recipes were, with no invented
numbers: **grits, biscuits and gravy, fried rice, pepperoni pizza**. That is
about five points of the eighteen.

**Done when:** the unknown rate is measured again on the same field set and
reported next to the old one.

---

## Then — the product beyond the demo

### Accounts, and a diary that survives closing the tab
*Two to three days, and the largest decision in this document.*

Today the profile and the diary live in `localStorage`. Close the tab on your
phone and open it on a laptop and DiaBite has never met you. Nothing else on
this list compounds until that changes: no history, no trends, no "your usual
breakfast", no learning from corrections, no returning user to retain.

Supabase is already wired in — the feedback table and the food vectors are
there — so the work is auth plus two tables, not new infrastructure.

**But this is where DiaBite starts holding health data**, and that is a product
decision before an engineering one. Three questions I cannot answer for you:

1. **What do we store?** The diary alone, or the profile — diagnosis,
   medicines, kidney status — too? The second makes the product work across
   devices and makes us custodians of clinical information about a named
   person.
2. **What do we promise?** Deletion on request is the floor. A line in the
   onboarding saying what leaves the browser, in the plain language the rest of
   the app uses.
3. **Do we need an account at all for V1?** A device-scoped anonymous id would
   give history and trends with no name, no email and no sign-in — most of the
   value, almost none of the exposure. I would start here.

**Done when:** a person can close the app, come back tomorrow, and see
yesterday's day.

### What that unlocks, in order
- **History and trends** — the PRD's north-star metric is in-range days by
  week eight, and today nothing counts them.
- **Corrections as labelled data** — every time someone fixes a resolution, we
  have a labelled pair. That is the eval set growing itself.
- **Memory worth having** — the advisor has a memory store holding food
  preferences. With a diary behind it, it could know that you eat oatmeal most
  mornings, which is the difference between a chatbot and a copilot.

---

## Decisions only you can make

Listed together because the plan stalls on them, not because they are urgent
today.

1. **Branded foods** — which of the three options above.
2. **Accounts** — anonymous device id, or real sign-in, and what we store.
3. **The weekly menu** — V0 or V1. It works and it is the least-tested surface
   in the product; it has never been in front of a user.
4. **Does eating pattern change the targets?** A vegan's protein target is the
   open question from Week 2 that never closed.
5. **The advisor's answers** — A1 to A7 are waiting on your read. The checks
   say they are safe; only you can say whether they are *right* — whether what
   it says about keto, fruit and morning highs is what a dietitian would say.

---

## Questions waiting for a clinician

*From a literature check on 9 November 2026 (a search tool that reads papers, given the five decisions in `docs/research-brief-literature.md`).* Nothing here has been changed in the product. The owner decides which physician receives which question; no message has been sent.

1. **Protein cap with kidney disease.** Today: 0.8 g/kg for anyone who reports chronic kidney disease, 1.0 g/kg if they only mention kidney trouble. The search found that guidelines converge on 0.8 g/kg only for advanced disease (eGFR below 30) and do not advise restriction earlier, so an unstaged cap may under-feed most people who report it. *Options:* a cap only when a stage or eGFR is stated; or no protein target at all when kidney disease is reported. *Pack question:* Q4.
2. **Protein while losing weight.** Today: 1.6 g/kg. Above the type 2 diabetes literature, inside the GLP-1 literature. *Option:* a range of 1.2 to 1.6 g/kg instead of a single value. *Pack questions:* Q3, Q19.
3. **Disordered eating.** Today: no deficit, no "budget left" framing, very low carbohydrate blocked, referral when raised in conversation. The search suggests it should be an exit (no targets at all), and notes that risk is higher in type 2 than type 1 diabetes. *Pack question:* the same exits in section A.
4. **The 70 mg/dL stop.** Today: at a stated glucose below 70 the conversation about food stops and the person is told to seek help; no hypoglycaemia instruction is given. The search judged this the rule most likely to be wrong, and a person living with diabetes independently mentioned fifteen-gram treatment. *Option:* a fixed, pre-written instruction in the safety rules (not model-written), worded by physicians. *Pack question:* Q12.
5. **Present the daily glycemic-load ceiling as a guide, not a target.** Two separate searches found no direct evidence for a daily ceiling or for the 45, 50 and 120 numbers. *Option:* soften the wording in the app ("daily guide") and say in the review pack that it is a heuristic. *Pack questions:* Q7 to Q9, Q18.
6. **A carbohydrate guide per meal, for people who count carbohydrate by meal.** *(added 9 November, after a person living with diabetes asked for a "carbohydrate" way of counting beside glycemic load.)* The app today has a daily budget only. Teaching ranges of 30 to 45 g (women) or 45 to 60 g (men) per meal and 15 to 30 g per snack are rules of thumb from dietitians' practice, not derived from a person's own target, and do not add up to a low-carbohydrate day (107 g a day is about 27 to 32 g per meal). In practice only about a third of meals fell in the 30 to 50 g range, with no link to outcomes found. *Options:* a guide of about a quarter to a third of the person's own daily carbohydrate target per meal and 10 to 15% per snack, shown as a range hint and never a refusal; or the fixed teaching ranges; or personal ranges from the person's own diary. *Not decided:* whether the carbohydrate way of counting gives a verdict at all, or only information. Thresholds quoted in the search came from type 1 diabetes and children, so they do not apply to our users.

**Best supported, no change proposed:** blocking very low carbohydrate with an SGLT2 inhibitor; a 1.2 g/kg protein floor with a GLP-1 medicine.

**How far to trust this.** The tool reads a limited set of papers, so "no support in these papers" does not mean "no support". Some figures come from other populations (for example, adults on intensive insulin, who are not our users). Open every cited paper before quoting it, and bring physicians the papers with the question, not the tool's summary.

**Next:** choose who gets which question; prepare a one-page note for physicians (what we do now, what the sources say, two or three wordings to choose from).

---

## Possible features, not now

Ideas that came from people, written down so they are not lost and not built before the evidence is there.

### A voice or character you pick by mood *(9 November 2026, from a person living with diabetes)*
She liked Happy Bob, an app with several characters she can choose between to suit her mood. For DiaBite it would first be a **voice**, not a picture: a setting in the profile with three choices ("Plain" by default, "Warm", "Playful") that changes only the words around the numbers. Numbers, verdicts, refusals and red-flag answers stay exactly as they are.

- **Why wait:** one person said it, and she uses a glucose sensor, which most people with type 2 or prediabetes do not. The beta of 10 to 20 people should say whether anyone changes the setting at all.
- **Against the design contract:** `docs/design.md` rules out streaks, scores, confetti and praise, so a picture or a mascot needs a decision from the owner. A voice does not.
- **Safety rules if it is ever built:** refusals, dosing answers and red flags read the same in every voice; a person who told us about disordered eating always gets the plain voice; no voice is sarcastic about a meal that went over (the reason "Not today" was changed).
- **Cost:** a prompt instruction and a profile field; every voice has to pass the agent evals, so the run is repeated per voice.
- **First test, cheap:** three sample answers to the same question, shown to the testers, before anything is built.

---

## What I would not build yet

- **Photo logging.** It is the most demanded feature in this category and the
  easiest to do badly. It needs the diary to exist first.
- **The weekly menu's V1 features** — regeneration, shopping lists by store,
  cooking time — before anyone has used the V0 menu for a week.
- **More recipes in bulk.** The catalogue is not short of recipes; it is short
  of the everyday foods people actually name. A thousand more recipes would
  make resolution harder, not better — we have already watched "spaghetti"
  resolve to a squash dish because of neighbours it should not have had.
- **A second model, a second region, a queue.** The latency target is met and
  the quota is not binding at one user. This is the kind of work that feels
  like progress and moves nothing.
