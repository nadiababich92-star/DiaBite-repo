# DiaBite — demo script

Three minutes, one arc: **a new person opens the app, is shown where to start, asks about a meal in their own
words, and every number they get back can be traced to something that is not the model.**

Rebuilt on 15 October 2026 after the first-run tips shipped. Every beat below was run against the deployed agent that
day, and the figures quoted are the ones that came back. If a beat stops working, this file is wrong and should be
re-run, not trusted. The earlier five-beat script (8 October) is in git history.

What changed since the first demo, and so what this one shows: sign-in by email and a diary that follows you across
devices; first-run tips; a week view with in-range days; a dish the database lacks is counted from typical ingredients
and labelled an estimate; 8,633 foods and 2,000 recipes; a weekly menu and shopping list.

---

## Before you start

**Fifteen minutes before, not five.**

1. Run `bash scripts/demo-limits.sh on` the morning of a live room (one Wi-Fi would use up 30 asks in 10 minutes),
   and `off` afterwards. Skip it for a recording.
2. `https://diabite-engine.greenglacier-ab5551c6.swedencentral.azurecontainerapps.io/health` must say
   `"records":8633`. A smaller number means the database did not load and answers will be wrong in a way that
   looks right.
3. **Use a clean browser profile (a guest window), signed in as the demo person, and stop before asking anything.**
   The tips are remembered in the browser, so a profile that has already seen them will not show them, and a
   profile where onboarding has already been done on this device skips them as a returning person. A guest window
   that signs in to an account whose onboarding is done on the server shows tip 1 on the first Ask screen: that is
   the opening shot.
4. **The demo person** (an invented person, never yours): type 2 diabetes, metformin, no insulin, age 52, a daily
   budget of **45 glycemic load**. Log **150 g of Greek yogurt** for breakfast so the day has something in it (the
   beats were timed with **44.4 left**; a day at zero looks like a fresh install).
5. For the week beat the demo account needs history. Log meals on the days before, or ask for a seeded week; if it is
   seeded, **say so**: "a demo person's week".
6. Ask one throwaway question in another tab ("oatmeal") so the whole chain has answered once today, then close it.
   Do **not** answer the first question in the demo window: the tips wait for it.
7. Have the recording open in another tab. You will not need it, which is why it should be open.

---

## The beats

### 0. The empty screen  ·  0:00 – 0:20

On screen: the Ask screen, the budget bar, the first tip pointing at the box ("Say what you ate").

> "People with type 2 diabetes ask one question five to seven times a day: can I eat this? DiaBite answers it from a
> sentence. The first time you open it, it tells you where to start."

Press **Got it**.

### 1. A meal in your own words  ·  0:20 – 1:15

Type exactly:

> Two eggs, a slice of rye bread and half an avocado

About 5 to 8 seconds. While it thinks:

> "This is how people really talk about food. Not 110 grams of egg."

What comes back (the same on every run today): **fits**, a meal load of **7.2**, **37.2** left, the rye bread named as
the driver, and "no change needed". The tip on the verdict appears: let it be read, press **Next**.

> "The engine made that comparison, not the AI's opinion."

The next tip points at **Show calculation**. Press it and **stop talking for two seconds**. The receipt is the pitch:

> "Every line, the weight, the carbohydrate, the glycemic index, the load, came from a database and a formula. The
> model chose none of these numbers. It read the sentence and wrote the words around them."

Point at the pill: *Verified, N numbers traced to tools*. Then the last tip, **Keep it in your Diary**: press **Log it**.

### 2. The diary and the week  ·  1:15 – 1:40

Open **Diary**. The day is there, with the meal you just logged. Scroll to **The last seven days**.

> "Your week builds here. Four of seven days in range means three meals logged and under budget, counted by the same
> rule everywhere. A day with one apple is not a day, and it says so."

If the week is seeded, say it is a demo person's week.

### 3. A dish it does not have  ·  1:40 – 2:15

Back to **Ask**. Type:

> Cholent with beef, barley, kidney beans and potatoes

About 6 to 8 seconds. The card is an **Estimate**, never a plain "Fits": "If it's like this, it fits your day."

> "It doesn't have my grandmother's cholent. It could have picked a bean stew and given a confident number. Instead it
> counts what I told it, each ingredient from the database, and labels the answer an estimate. I can change a gram or
> take an ingredient out, and the engine counts again."

Press **Edit the recipe**, remove one ingredient: the badge stays **Estimate**. **Do not read a number aloud on this
beat**: the weights are assumptions the agent makes each time, and the same sentence came back at a load of 20 and
of 12.8 on two runs.

**Do not type "A slice of grandma's cholent" on its own for the demo.** Without the ingredients the agent invents a
list, and one of its guesses (flour, a gravy) may not be in the database, so the answer is "I can't judge the day on
this" with a question. That is honest, and a poor beat.

### 4. Safety  ·  2:15 – 2:30

Type:

> How many units of insulin should I take before pasta?

The refusal is **immediate**, no spinner.

> "That never reached a model. Dosing questions are caught by rules before anything generative sees them, because a
> refusal that depends on a model behaving is not a refusal."

### 5. How it is built  ·  2:30 – 2:50

Show the **architecture** (the trust page's three lanes, or the slide): the app, the agents on Azure AI Foundry, the
engine.

> "Three agents: one routes, one costs meals with tools, one gives advice with no tools and no numbers. A
> deterministic engine does the arithmetic from eight thousand foods. A verifier checks every number in the answer
> against what the engine returned, and if one isn't there, the answer isn't shown."

### 6. The ask  ·  2:50 – 3:00

> "It's being prepared for its first users. If you or someone you know has type 2 diabetes, prediabetes or insulin
> resistance and would try it for half an hour, the address is on screen. It's free, and it asks for your email."

---

## If time allows, or a question asks for it

- **Is brown rice better than white rice?** The advisor: a plain comparison labelled **Advice**, and the pill reads
  *No numbers stated, nothing to trace*. About 4 to 6 seconds.
- **A Zebra Cake** (a single food it does not have): it says it does not have it and asks what is in it. About 3 seconds.
  The honest difference from a dish: a single food is named, left out and asked about; a dish is counted from ingredients.
- **Burrito bowl with white rice, black beans, chicken and guacamole**: fits, a load near 26, white rice the driver,
  and a swap to basmati; it may ask whether the chicken was breast.

## What not to type on stage

| Don't | Because | Say instead |
|---|---|---|
| "A slice of grandma's cholent" alone | the agent proposes a list and one guess may be missing, so no verdict | give the ingredients, as in beat 3 |
| Any brand name | most are not in the database | a plain description of the food |
| A follow-up that depends on the last answer ("and if I add a banana?") | works only in the same session; do not reload | ask it as a whole meal |
| "baked potato", "french fries", "pizza" | different glycemic indexes, odd "did you mean" questions, carbohydrate only for pizza | stay on the beats |

If someone shouts a food, take it **after** the beats, when an unknown answer reads as honesty and not as a failure.

---

## If Azure is slow

**A turn is 5 to 9 seconds normally.** One in a few dozen takes much longer (a single food took 33 seconds once). If
one takes longer than fifteen, keep talking through the verifier and the receipt; the answer arrives inside your
sentence. **If two turns in a row exceed twenty seconds**, switch to the recording with a sentence that costs nothing:

> "I'll use a recording for the rest — same build, recorded this week."

**If the app will not answer at all**, check `/health`. The recording covers everything else.

---

## Questions you will get, and the honest answer

**"How do you know it isn't making the numbers up?"**
Every number in an answer is checked against the tool results before the answer is shown. If one cannot be traced the
model is asked once more, then a plain template built only from tool output is shown, and if even that fails the
answer is withheld. Foundry's groundedness judge scored 74 of 75 on 12 October; the one miss was a real data fault
(two hard candies counted as 320 g), found by that judge and fixed.

**"What's your accuracy?"**
Two layers, and I give both. The mechanical layer: 204 of 204 behavioural checks on the deployed agent on 15 October,
and 184 of 184 food-resolution cases in the engine, including the safety gate. The model-graded layer in Azure AI Foundry,
run 12 October with a different model as judge: intent resolution 86 of 86, groundedness 74 of 75, task adherence
96 of 102, tool-call accuracy 64 of 75. **The judge disagrees with our policy of asking when a food match is unsure**,
so most of its misses are that disagreement, and I read each one. Say the date when you quote it.

**"Why isn't an estimate more precise?"**
Because it is an estimate. A dish the database lacks is counted from typical ingredients, and the weights are assumptions
the agent makes. They change between runs, so the number changes, and the card says estimate. You can change any gram.
That is why the verdict on one is conditional and never a plain "fits".

**"How fast is it?"**
Median 4 to 5 seconds, 90th percentile 7 to 9 (102 questions, two runs on 15 October), for one person asking with pauses.

**"What happens when it doesn't know a food?"**
It says so. A single food is named and left out; a dish is counted from ingredients and labelled an estimate. Foods
with no glycemic index (pizza, candy, packaged foods) show carbohydrate, fibre and calories and never get an invented
load. The honest failure is the feature.

**"Is this medical advice?"**
No, and it says so before any number, in the banner that never leaves the screen. It refuses dosing, escalates red-flag
symptoms, and declines to set targets for pregnancy, kidney disease or a history of disordered eating, all by rules
before a model sees the question. No clinician has signed it off yet.

---

## The three-minute recording

The cohort form asks for a three-minute demo. Same beats, with the waiting edited out.

1. A **guest window**, signed in, nothing asked yet (see "Before you start"). Zoom 100%, no other tabs or notifications.
2. **Do one full silent rehearsal first.** The model writes slightly different words each time and the estimate's
   number changes between runs: never read a figure aloud on beat 3.
3. Record at 1080p, microphone check first, a second take.

| Time | On screen | Say |
|---|---|---|
| 0:00 – 0:20 | The empty Ask screen and the first tip | The opening line of beat 0 |
| 0:20 – 1:15 | Eggs, rye bread, avocado; the verdict tip; Show calculation; the log tip | Beat 1 |
| 1:15 – 1:40 | Diary and the week | Beat 2 |
| 1:40 – 2:15 | The cholent with its ingredients; Edit the recipe | Beat 3 |
| 2:15 – 2:30 | The insulin question, answered at once | Beat 4 |
| 2:30 – 2:50 | The architecture | Beat 5 |
| 2:50 – 3:00 | The address and the invitation | Beat 6 |

**Leave out:** brown against white rice (it needs time to explain the second agent), baked potato, french fries, pizza,
and any brand name.

**If a take goes wrong** (an answer over twenty seconds, or a card in a different shape): stop, wait a minute, take it again.

## Re-making the recording

`docs/demo-3min.mp4` (2 min 17 s, the voice is the AI voice Emma) was made from the live app on 15 October by three scripts in
`scripts/demo-video/`, with no ffmpeg:

1. `node scripts/demo-video/tts.mjs` writes each narration segment (`narration.json`) with Azure Speech, using the signed-in Azure CLI.
2. `node scripts/demo-video/record.mjs` creates a throwaway demo person (service key from the Container App secret, never printed),
   onboards them off camera, seeds a diary history, then opens a **second clean browser at `/?demo`** and records every beat from the real app,
   cutting out the time a model spends thinking. If the dish is not counted on the first try it asks again inside a cut. The account is deleted at the end.
3. `node scripts/demo-video/assemble.mjs` puts the kept frames and the narration on one clock and writes `/tmp/dv/demo-3min.mp4`.

Change the words in `narration.json`, or a beat in `record.mjs`, and run the three again (about ten minutes). The file is not in git
(46 MB); keep it in the course folder.
