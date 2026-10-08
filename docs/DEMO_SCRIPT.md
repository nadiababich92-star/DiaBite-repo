# DiaBite — demo script

Five questions, about four minutes, one arc: **a person asks about lunch in
their own words, and every number they get back can be traced to something
that is not the model.**

Every line below was run against the deployed agent on 8 October and timed.
Nothing here is aspirational; if a beat stops working, this file is wrong and
should be re-run rather than trusted.

---

## Before you start

**Fifteen minutes before, not five.**

1. Open the app and ask any question — "oatmeal" will do. Throw the answer
   away. The container itself never sleeps (it is pinned to one replica), so
   this is not a wake-up call; it is proof that the whole chain — browser,
   engine, Foundry, the tools — is answering today, taken while there is still
   time to do something about it.
2. Check the health line: `/health` should say `records: 6054`. A smaller
   number means the database did not load and the answers will be wrong in a
   way that looks right.
3. Open **the hosted address**, not a dev server on your laptop:
   `https://diabite-engine.greenglacier-ab5551c6.swedencentral.azurecontainerapps.io`.
   The app is served by the same container that answers, so there is no laptop
   in the path and nothing to start.
4. Set the profile up **as the person you are about to describe**. The script
   below assumes: type 2 diabetes, metformin, no insulin, peanut allergy, lose
   weight, low carb → a budget of **48 GL**. Log one breakfast (Greek yogurt)
   so the day has something in it — the beats below were timed with 47.4 left; a day at zero looks like a fresh install.
5. Have the backup recording open in another tab, minimised. You will not need
   it, and that is exactly why it should be open.

**Do not** clear the browser between rehearsal and the real thing — the profile
lives in local storage, and re-doing onboarding on stage costs ninety seconds
of watching someone type their height.

---

## The five beats

### 1. "Can I eat this?" — the flagship  ·  ~8 s

Type, in the box, exactly:

> Burrito bowl with white rice, black beans, chicken and guacamole

While it thinks, say the sentence that frames everything after it:

> "This is how people actually talk about food. Not 180 grams of cooked
> long-grain white rice — 'a burrito bowl'."

What comes back: **fits, barely** — a meal load of 41.2 against 47.4 left, so
6.2 remain; white rice named as the driver, and one swap (brown rice). Since
8 October the bowl is costed by what is in it (180 g of white rice, 100 g of
black beans, 150 g of chicken, 100 g of guacamole) rather than as one database
record, which is why it no longer goes over. Say so: it is a better story than
a clean "no".

> "It fits — but look how little is left. Almost all of that is the rice, and it
> offers the swap."

The answer may also ask whether it was right to assume chicken *breast*. Let it:
that is the product saying what it assumed.

Then click **Show calculation** and stop talking for two seconds. The receipt is
the pitch:

> "Every line here — the portion, the available carbs, the glycemic index, the
> load — came from a database and a formula. The model chose none of these
> numbers. It read the question and wrote the sentence."

Point at the provenance line under the receipt. One of the sources says
**checked**, with a date; the others say **unverified**. That is deliberate:

> "We show which numbers a human has checked and which came straight from the
> source. A product that hides that is asking you to trust it. This one isn't."

### 2. "Two eggs, avocado and a slice of rye bread" — the counting beat  ·  ~8 s

> Two eggs, avocado and a slice of rye bread

Answer: **fits** (a meal load of about 7.4), and — this is the line to point at —
the *why* says **110 g of egg**. Two eggs, not one.

> "It read 'two' as a quantity. Until last week it didn't: 'two eggs' resolved
> to nothing at all, the eggs dropped silently out of the meal, and the total
> came back confidently wrong. That defect was found by a model-judge, not by a
> human reading answers."

The next action varies between runs: sometimes "no change needed", sometimes a
swap such as the rye bread for sprouted grain bread. Either is fine to say aloud;
do not promise the first. (Until 8 October a slice of rye bread was costed at
100 g and the load came out near 20; a slice is now 35 g.)

### 3. "A slice of grandma's kugel" — the honesty beat  ·  ~7 s

> A slice of grandma's kugel

Answer: **I don't have this food in the database** — and a question about what
is in it.

This is the most important beat in the demo. Say so:

> "This is the one I'd ask you to remember. It doesn't have kugel. It could
> have picked the closest thing in the database — there's a noodle casserole in
> there — and given you a number that looks perfectly reasonable. For someone
> deciding what to eat with type 2 diabetes, a confident wrong number is worse
> than no number. So it says it doesn't know and asks."

If you want one sentence on how that is enforced rather than hoped for:

> "Every run checks that a food the database doesn't have never enters the
> arithmetic under a neighbour's name. Not a rule in a prompt — a test."

### 4. "How many units of insulin should I take before pasta?" — safety  ·  instant

> How many units of insulin should I take before pasta?

The refusal is **immediate** — no spinner, no thinking. Let the speed make the
point:

> "That didn't reach the model at all. Dosing questions are caught by rules
> before anything generative sees them, because a refusal that depends on a
> model behaving well is not a refusal."

### 5. "Is brown rice better than white rice?" — the second agent  ·  ~9 s

> Is brown rice better than white rice?

Answer: a plain comparison, labelled **Advice**, with the pill underneath
reading **no numbers stated — nothing to trace**.

> "Different question, different specialist. This one has no tools and no
> calculator, and its rule is that it states no numbers at all — because a
> number here would be a number nobody checked. Three agents: one routes, one
> costs meals, one gives advice. The router picked this one in under a second."

---

## What not to type on stage

Tested, and they are the weak spots as of 30 September:

| Don't | Because | Say instead |
|---|---|---|
| "spaghetti" | one run in several resolves it to a spaghetti-squash recipe | "pasta" |
| "fried rice", "pepperoni pizza", "grits", "diet coke", "Oreos" | genuinely not in the database — fine as a *deliberate* unknown, bad as a surprise | use beat 3's kugel, which you control |
| "baked potato" | still costed as *boiled* potato (an alias nobody has removed yet) — a different glycemic index | "boiled potato" |
| "french fries", "pizza", "avocado toast" | fries pick a school-lunch record on a 60 g portion; pizza and avocado toast ask odd "did you mean" questions | stay on the five beats |
| Anything with a brand name | Chick-fil-A, KIND, Kraft: all unknown | a plain description of the food |
| A follow-up that depends on the last answer ("and if I add a banana?") | works, but the session must be the same one — do not reload between | ask it as a whole meal |

If someone from the audience shouts a food, take it — but take it **after** the
five beats, when an unknown answer reads as honesty rather than as a failure.

---

## If Azure is slow

**A turn is 5–9 seconds normally.** If one takes longer than fifteen, do not
wait in silence — the thing you say while it thinks is in the script for a
reason. Keep talking through the verifier and the receipt; the answer will
arrive inside your sentence.

**If two turns in a row exceed twenty seconds**, the deployment is rate-limited
or the region is busy. Switch to the recording with a sentence that costs you
nothing:

> "I'll use a recording for the rest — same build, recorded this morning."

Nobody minds. What they mind is watching a spinner.

**One episode to know about.** On the morning of 8 October nine of eighteen turns
failed inside ten minutes (the model service could not reach the engine and the
engine could not reach the model: `503`, `connection timeout`). It did not
repeat under eight concurrent turns later the same day, and nothing had
restarted. Treat it as the reason the recording is open in the other tab.

**If the app will not answer at all**, the most likely cause is the container
having been scaled to zero and failing its first request. `/health` tells you
in a second. The recording covers everything else.

---

## Questions you will get, and the honest answer

**"How do you know it isn't making the numbers up?"**
Every number in an answer is checked against the tool results before the answer
is shown. If one cannot be traced, the answer is regenerated once and then
replaced with a templated one built only from tool output. In the run on
8 October, every answer that came back was verified; one of 87 came back as a
transient server error and is counted as a miss, not hidden.

**"What's your accuracy?"**
Two layers, and I'd rather give you both than average them. The mechanical
layer needs no model: food resolution 95 of 95, clarification bands 19 of 19,
the safety gate 63 of 63 phrasings, answer parsing 9 of 9, the verifier 12 of
12. On the deployed agent, 180 of 183 behavioural checks passed on 8 October
(191 of 191 on 5 October); the three misses named the dish rather than its
heaviest food as the driver — a wording miss, not a wrong number. The
model-graded layer in Azure AI Foundry was last run in September: intent
resolution 70 of 71, tool-call accuracy 56 of 59, groundedness 55 of 59, task
adherence 69–74% across four runs. **Not re-run since the changes of
October** — say "September" if you quote it.

**"Why isn't task adherence higher?"**
Because it measures compliance with our own answer format, which is strict on
purpose: four parts, under 120 words, every default weight named, the driving
food named, the swap named. None of its failures is a wrong number, a
substituted food or a missed refusal. I could raise the score by loosening the
format. The format is the product.

**"How fast is it?"**
Median 4.7 seconds, p90 8.2 (8 October, 86 questions) — for one person asking with
pauses, which is what a user does. Four people asking at once also worked, eight
turns in a row, between 4 and 12 seconds. Fired back to back it queues against a per-minute token quota and
slows down; I measure both and quote which is which.

**"What happens when it doesn't know a food?"**
You saw it. It says so. about 13% of the food phrases in our test set are not in the
database — mostly American brand foods — and that number is in the PRD rather
than hidden, because the honest failure is the feature.

**"Is this medical advice?"**
No, and it says so before any number, in the banner that never leaves the
screen. It refuses dosing, escalates red-flag symptoms, and declines to set
targets for pregnancy, kidney disease or a history of disordered eating —
that last one deterministically, before the model sees the question.

---

## The three-minute recording

The pitch template asks for a recording of **under three minutes** in place of
the live demo. This is the cut of the five beats that fits, about **2 min 50 s**,
with the dead time between a question and its answer edited out (an answer takes
5 to 15 seconds; a recording does not have to wait for it).

**Before you press record**

1. Open the hosted address, not a dev server. Ask any question and discard it, so
   the whole chain has answered once today.
2. The profile is the one in "Before you start" above: type 2 diabetes, peanut
   allergy, a budget of 48 GL, one breakfast logged. A day at zero looks like a
   fresh install.
3. Set the browser to a normal window, zoom 100%, dark and light as you prefer but
   not changing mid-recording. Close other tabs and notifications.
4. **Do one full silent rehearsal** with the screen recorder running. The model
   writes a slightly different answer each time: the burrito bowl came back at 41.2
   and at 45.5 glycemic load on two runs the same day. Do not read a figure aloud;
   say what it means ("it fits, with very little left").
5. Record at 1080p with the microphone check first. Keep a second take.

**The cut**

| Time | On screen | Say |
|---|---|---|
| 0:00 – 0:20 | The app, the budget line, the three sample questions | "People with type 2 diabetes ask one question five to seven times a day: can I eat this? DiaBite answers it from a sentence, and every number in the answer is computed, not generated." |
| 0:20 – 1:10 | Type **Burrito bowl with white rice, black beans, chicken and guacamole**. The answer card. Click **Show calculation** and hold still for two seconds | While it thinks: "This is how people really talk about food. Not 180 grams of cooked rice." On the card: "It fits, with very little left, and it names the white rice as the driver and offers one swap." On the receipt: "Every line came from a database and a formula. The model chose none of these numbers." Point at the source line: "checked" or "unverified", and say so |
| 1:10 – 1:35 | **Two eggs, avocado and a slice of rye bread** | "'Two' counts as two: the reason says 110 grams of egg. Two weeks ago two eggs resolved to nothing and the total was confidently wrong. A model judge found that, not a person." |
| 1:35 – 2:05 | **A slice of grandma's kugel** | "This is the one to remember. It does not have kugel. It could have picked a noodle casserole and given you a number that looks reasonable. For someone deciding what to eat with diabetes, a confident wrong number is worse than none, so it says it does not know and asks." |
| 2:05 – 2:25 | **How many units of insulin should I take before pasta?** The refusal arrives at once | "That never reached a model. Dosing questions are caught by rules before anything generative sees them, because a refusal that depends on a model behaving is not a refusal." |
| 2:25 – 2:50 | The address on screen | "Three agents on Azure AI Foundry, a deterministic engine, a verifier on every answer. Next: five people with diabetes using it, and clinicians taking the logic apart. The address is on screen." |

**Leave out of the recording:** the brown against white rice beat (it needs time to
explain the second agent), "baked potato", "french fries", "pizza" and
"avocado toast", and any brand name.

**If a take goes wrong** (an answer takes over twenty seconds, or a question comes
back with a different shape): stop, wait a minute, and take it again. Azure had one
bad ten minutes on 8 October; it did not repeat.
