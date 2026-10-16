# DiaBite — demo script

A story, not a feature tour: **Dana, a made-up woman of fifty-two with type 2 diabetes, asks her one question at breakfast, at dinner,
at her grandmother's table. Every number she gets back can be traced to something that is not the model.**

Rebuilt on 15 October 2026 after the first-run tips shipped and the cohort leader's feedback (he found the app a pain: it tells you
no and you stop). The recording has no time limit; it runs about four minutes. Every beat was run against the deployed
agent that day. If a beat stops working, this file is wrong and should be re-run, not trusted. The earlier five-beat script
(8 October) is in git history.

What changed since the first demo, and so what this one shows: sign-in by email and a diary that follows you across devices;
first-run tips; a week view with in-range days; a dish the database lacks is counted from typical ingredients and labelled an
estimate; 8,633 foods and 2,000 recipes; a weekly menu and shopping list.

---

## Before you start

**Fifteen minutes before, not five.**

0. The plain address hides the builders' tools (the lab row and the tool-call panel) since 16 October; add `?lab` to the address to see them. `?demo` still works and still hides them.
1. Run `bash scripts/demo-limits.sh on` the morning of a live room (one Wi-Fi would use up 30 asks in 10 minutes),
   and `off` afterwards. Skip it for a recording.
2. `https://diabite.pro/health` must say
   `"records":8633`. A smaller number means the database did not load and answers will be wrong in a way that
   looks right.
3. **Use a clean browser profile (a guest window), signed in as the demo person, and stop at the first screen of the setup.**
   The tips are remembered in the browser, so a profile that has already seen them will not show them, and a
   profile where onboarding has already been done on this device skips them as a returning person. The recording does the setup on camera, so for a live demo use an account whose setup is done on the server: a guest window that signs in to it
   shows tip 1 on the first Ask screen.
4. **The demo person** (an invented person, never yours): type 2 diabetes, metformin, no insulin, age 52, a daily
   budget of **45 glycemic load**. Log **150 g of Greek yogurt** for breakfast so the day has something in it (the
   beats were timed with **44.4 left**; a day at zero looks like a fresh install).
5. For the week beat the demo account needs history. Log meals on the days before, or ask for a seeded week; if it is
   seeded, **say so**: "a demo person's week".
6. Ask one throwaway question in another tab ("oatmeal") so the whole chain has answered once today, then close it.
   Do **not** answer the first question in the demo window: the tips wait for it.
7. Have the recording open in another tab. You will not need it, which is why it should be open.

---

## The story, scene by scene

Dana is **invented and says so**: a chip in the corner of every app scene reads "a made-up person". Her profile in the app is the demo
person's (age 52, type 2, metformin, a budget of 45 glycemic load). The words are in `scripts/demo-video/narration.json`; the order is below.

| Scene | On screen | What happens | Why it is there |
|---|---|---|---|
| Title | "Can I eat this?" | the promise in one line | the question |
| Dana's problem | a card, five lines lit in turn | the list of allowed and forbidden foods; the real question; five to seven times a day; a calorie app costs minutes; real life is a burrito bowl | the problem, in the words of the first pitch |
| The promise | a slide that fills in step by step: safety rules, three agents, the engine, the verifier | a model reads, an engine counts, a verifier blocks any number no tool returned | the architecture the cohort leader asked for |
| Thursday 7:40, the setup | the app's own onboarding: what it keeps, her diagnosis, her medicines, her day | Dana agrees, types her age, picks type 2 and metformin; a budget of 45 appears, with the formula shown | **everything is personal**: diagnosis, medicines, age, weight, activity, kidneys, allergies and how she eats all change her numbers. The video does **not** say a doctor approved it: no clinician has signed it off |
| Thursday 7:40, breakfast | the first tip, then eggs, rye bread, avocado | fits, load 7.2, 37.8 left; the verdict tip; Show calculation; the receipt; Log | the first minute of a new person |
| Thursday 6:45 pm | spaghetti, garlic bread, orange juice | **"Not today", over by about 9**, the swap it names is ringed on screen (whole wheat pasta); Dana tries it and changes the juice to water too, and it **fits** | **the softened no**: it does not only forbid, it names a way and the engine counts the way. The swap alone is not enough (40.6 against 37.7 left): the video says Dana changes the juice as well |
| Thursday 10:30 pm | the insulin question | refused at once, no spinner | safety |
| Sunday | cholent with its ingredients | **Estimate**, "if yours is like this"; Edit the recipe, remove one, still an estimate | a dish the database lacks |
| Her week | the Diary | "4 of 7 days in range", four weeks as a strip | why she comes back |
| How we know | a slide of three big numbers (204 of 204, 74 of 75, 86 of 86) and the one real fault found and fixed | 204 of 204 checks, a second model's marks, and the one real fault found and fixed | trust |
| The ask | the address | free, asks for your email | the invitation |

**Do not read a number aloud on the Sunday scene**: the weights are assumptions the agent makes each time, and the same sentence came back at a load
of 20 and of 12.8 on two runs. The evening meal ("Spaghetti with tomato sauce, garlic bread and a glass of orange juice") was chosen because it
did not fit on three runs out of three and each time named a swap; the dish is not "A slice of grandma's cholent" on its own, which makes the agent
invent a list and sometimes leaves a food out.

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

## The recording

1. A **guest window**, signed in, nothing asked yet (see "Before you start"). Zoom 100%, no other tabs or notifications.
2. **Do one full silent rehearsal first.** The model writes slightly different words each time and the estimate's number changes between runs.
3. Record at 1080p, microphone check first, a second take.

The finished recording is made by the scripts below, not by hand: it needs no rehearsal and no live Azure on stage.

## Re-making the recording

`docs/demo-story.mp4` (about 4 min 10 s, the voice is the AI voice Emma) was made from the live app on 15 October by three scripts in
`scripts/demo-video/`, with no ffmpeg:

1. `node scripts/demo-video/tts.mjs` writes each narration segment (`narration.json`) with Azure Speech, using the signed-in Azure CLI.
2. `node scripts/demo-video/record.mjs` creates a throwaway demo person (service key from the Container App secret, never printed),
   onboards them off camera, seeds a diary history, then opens a **second clean browser at `/?demo`** and records every beat from the real app,
   cutting out the time a model spends thinking. If the dish is not counted on the first try it asks again inside a cut. The account is deleted at the end.
3. `node scripts/demo-video/assemble.mjs` puts the kept frames and the narration on one clock and writes `/tmp/dv/demo-3min.mp4 (copy it to docs/demo-story.mp4)`.

Change the words in `narration.json`, or a beat in `record.mjs`, and run the three again (about ten minutes). The file is not in git
(46 MB); keep it in the course folder.
