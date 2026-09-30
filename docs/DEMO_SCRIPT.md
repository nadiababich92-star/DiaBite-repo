# DiaBite — demo script

Five questions, about four minutes, one arc: **a person asks about lunch in
their own words, and every number they get back can be traced to something
that is not the model.**

Every line below was run against the deployed agent on 30 September and timed.
Nothing here is aspirational; if a beat stops working, this file is wrong and
should be re-run rather than trusted.

---

## Before you start

**Fifteen minutes before, not five.** The container sleeps when idle and the
first request after a quiet hour pays for the wake-up.

1. Open the app and ask any question — "oatmeal" will do. Throw the answer
   away. This is a warm-up, not a rehearsal: it wakes the container, opens the
   connection to Foundry, and turns the first slow answer into one nobody saw.
2. Check the health line: `/health` should say `records: 1436`. A smaller
   number means the database did not load and the answers will be wrong in a
   way that looks right.
3. Set the profile up **as the person you are about to describe**. The script
   below assumes: type 2 diabetes, metformin, no insulin, peanut allergy, lose
   weight, low carb → a budget of **48 GL**. Log one breakfast (Greek yogurt)
   so the day has something in it; a day at zero looks like a fresh install.
4. Have the backup recording open in another tab, minimised. You will not need
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

What comes back: **does not fit today**, meal glycemic load about 59 against 47
left, white rice named as the driver, and one swap.

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

Answer: **fits**, and — this is the line to point at — the *why* says **110 g of
egg**. Two eggs, not one.

> "It read 'two' as a quantity. Until last week it didn't: 'two eggs' resolved
> to nothing at all, the eggs dropped silently out of the meal, and the total
> came back confidently wrong. That defect was found by a model-judge, not by a
> human reading answers."

And the next action says **no change needed** — worth a half-sentence:

> "When there's nothing to suggest, it says so. It used to invent a swap to
> fill the slot."

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

**If the app will not answer at all**, the most likely cause is the container
having been scaled to zero and failing its first request. `/health` tells you
in a second. The recording covers everything else.

---

## Questions you will get, and the honest answer

**"How do you know it isn't making the numbers up?"**
Every number in an answer is checked against the tool results before the answer
is shown. If one cannot be traced, the answer is regenerated once and then
replaced with a templated one built only from tool output. In the last run, 87
of 87 answers passed on the first attempt.

**"What's your accuracy?"**
Two layers, and I'd rather give you both than average them. The mechanical
layer — food resolution, clarification bands, the verifier — is 80 of 81 on a
fixed set, and 203 of 203 behavioural checks on the deployed agent. The
model-graded layer in Azure AI Foundry: intent resolution 70 of 71, tool-call
accuracy 56 of 59, groundedness 55 of 59. Task adherence sits at 69–74% across
four runs, and I can tell you exactly why it isn't higher.

**"Why isn't task adherence higher?"**
Because it measures compliance with our own answer format, which is strict on
purpose: four parts, under 120 words, every default weight named, the driving
food named, the swap named. None of its failures is a wrong number, a
substituted food or a missed refusal. I could raise the score by loosening the
format. The format is the product.

**"How fast is it?"**
Median 5 seconds, p90 7.8 — for one person asking with pauses, which is what a
user does. Fired back to back it queues against a per-minute token quota and
slows down; I measure both and quote which is which.

**"What happens when it doesn't know a food?"**
You saw it. It says so. 18% of the food phrases in our test set are not in the
database — mostly American brand foods — and that number is in the PRD rather
than hidden, because the honest failure is the feature.

**"Is this medical advice?"**
No, and it says so before any number, in the banner that never leaves the
screen. It refuses dosing, escalates red-flag symptoms, and declines to set
targets for pregnancy, kidney disease or a history of disordered eating —
that last one deterministically, before the model sees the question.
