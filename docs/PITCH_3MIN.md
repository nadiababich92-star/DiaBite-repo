# The three-minute pitch

Three minutes for everything, a demo included. The template's eleven slides do not fit,
so nine are shown, **in the deck's own order**, and the rest stay in the deck, hidden in
the presentation, for questions. The finished recording is `docs/pitch-3min.mp4`
(2 min 47 s: slides, an AI voice, and the demo clip on slide 6).

## Run of show

| Time | Slide | What is on screen | Words |
|---|---|---|---|
| 0:00 – 0:11 | 1 Title | "Can I eat this?" | 30 |
| 0:11 – 0:53 | 2 Problem | the quote, then each reason lit in turn, then the market and its cost | 132 |
| 0:53 – 1:09 | 4 Solution | three capabilities, "computed, not generated" | 41 |
| 1:09 – 1:45 | 6 Demo recording | the clip, which carries its own voice | clip |
| 1:45 – 2:03 | 7 Business model | price to test, channel, users needed, what is measured | 57 |
| 2:03 – 2:13 | 8 Team | you, and the three physicians | 32 |
| 2:13 – 2:29 | 9 What we've learned | evaluation is the gate | 44 |
| 2:29 – 2:42 | 10 What's next | sessions, the weekly menu and shopping list, branded foods, a diary | 36 |
| 2:42 – 2:47 | 11 Contact | the address | 7 |

About 13 seconds of the three minutes are spare. The numbers are the slide numbers of
the template; in the deck file the shown slides are `cover, problem, solution,
recording, business, team, learned, roadmap, connect`.

Hidden for the pitch, still in the deck: "Why this problem matters" (its market figures
moved onto the problem slide), "Three questions, three kinds of honesty" (the clip says
the same), and the seven backup slides (competitors, how a number is made, architecture,
safety, evidence, limits, the live script). Show one if someone asks.

## What to say

The same lines are in each slide's speaker notes, and they are what the recording says.

1. **Title.** "People with type 2 diabetes ask one question five to seven times a day: can I eat this? DiaBite answers it, and every number it gives is computed, not generated."
2. **Problem.** "After a diagnosis you get a list of allowed and forbidden foods. But the real question is different: I'm about to eat this. Can I? How much? What do I eat it with? You ask it five to seven times a day, in the aisle, at a menu, at the fridge at eleven at night. A list can't answer it, because glycemic impact belongs to the whole plate, not to one food. A calorie app can, but costs three to five minutes of work a meal. And real life is a burrito bowl and a snack in the car, so plans break on most days. Forty million Americans have diabetes, a hundred and fifteen million more have prediabetes, and diagnosed diabetes cost the country four hundred and thirteen billion dollars in 2022."
3. **Solution.** "A model reads the sentence. A deterministic engine over six thousand foods computes the number. A verifier blocks any number no tool returned. The model never produces a nutrition number: that is the promise, and it is tested on every change."
4. **The clip** (35 seconds, its own voice; say nothing over it). "First, it asks a few things about you. Then it works out the day's budget from your answers, with the formula in plain sight. Nothing is guessed. Now a real sentence goes in, and a receipt comes out. It fits, with very little left. Every number can be opened, and traced. It does not have kugel, so it says so, instead of guessing. And a dose question is refused at once, before any model sees it. Next comes a week of meals planned around your budget, and the shopping list for it."
5. **Business.** "Free to try, Pro to be tested at fourteen ninety-nine. Running it costs a quarter of a cent a question, so the real question is how people find it: dietitians are the channel. About eleven hundred payers make ten thousand euros a month. The costs are measured. Growth and conversion are assumptions, and the plan says so."
6. **Team.** "I'm Nadia, an AI product manager in Warsaw. I built this alone in five weeks, and three physicians hold the review pack that lists every decision the product makes about a person."
7. **Learned.** "Evaluation is the gate. The tests found nine defects, and a physician's review found a real bug, a kidney cap undone by a protein floor, fixed within a day. Every miss becomes a permanent test. And speed came from structure, not a bigger model."
8. **Next.** "Now: five people with diabetes and three clinicians, taking the logic apart. Next: the weekly menu and its shopping list, built and waiting for clinical review, then branded foods. And then, a diary that stays."
9. **Contact.** "Questions and criticism are welcome. Thank you." (Nothing says the app is live or finished: today one screen works and much is still to do.)

## The clip

Recorded on the hosted app in a clean browser, so it shows a person who has just
installed it, not the owner's profile. The person is invented (a woman of 52, type 2,
metformin). It runs: the five onboarding steps and the screen "Your day, and where
these numbers come from", then the three questions below, each typed rather than
clicked, then the weekly menu. The waits for the model (7 to 8 seconds) are cut; the answers are real.

| Clip time | Show |
|---|---|
| 0:00 – 0:09 | Onboarding, then the day's budget computed from the answers |
| 0:09 – 0:19 | "Burrito bowl with white rice, black beans, chicken and guacamole": the verdict, the three figures, **Show calculation** and the receipt |
| 0:19 – 0:23 | "A slice of grandma's kugel": "One question first", it does not have it |
| 0:23 – 0:27 | "How many units of insulin should I take before pasta?": the refusal |
| 0:27 – 0:35 | The weekly menu and the shopping list for the week. Built, never shown to a user, not yet clinically reviewed |

The voice never says a figure for the burrito bowl: its load changes between runs
(41 to 45). The "Download Responses" row of the course lab is hidden in the recording.

## If you record it again in your own voice

The script is first person ("I'm Nadia ... I built this alone"). The recording uses an
AI voice (Azure neural, "Emma", the high-definition one, 12% faster than default). To use your own, record each numbered line above over
`docs/pitch-3min.mp4` with the sound turned off, or ask for the pieces separately.

## If time is shorter than three minutes

Cut slide 9 ("What we've learned") and 10 ("What's next") first; they carry the least that
the clip does not already show. Never cut the promise (slide 4) or the clip.
