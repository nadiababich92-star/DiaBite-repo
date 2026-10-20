# Demo: "Two rhythms" (draft for approval, 21 October 2026)

*Replaces the screen-recording demo of 16 October. Story from the owner (20–21 October): many people with diabetes cannot plan every meal: no time, no energy, a life that does not wait. DiaBite is a quick check on the go, and a diary for the days a plan does not survive. Storyboard: https://claude.ai/artifact/VSoVZuVrzfNy8QbBKwgWZ1. Nothing here is recorded yet.*

**Characters (made up, said so on screen):** Maya, 34, eats on the move. Daniel, 52, loves a plan and it keeps breaking.
**Voices (decided 21 October: two or three):** a narrator (the owner's idea of a quick, warm woman's voice), Maya (a different woman's voice), Daniel (a man's voice). Their lines are also on screen as text.
**Length:** the first cut (21 October) runs 1:28; the lines as written are short. A one-minute cut for the deck comes after the owner has seen this one.

## What the live app really answered (21 October, a fresh day, budget 45 glycemic load)

Every number in the video comes from a real recording, not from this table: the personas' own profiles give their own budgets. These runs only show which meals behave well on screen.

| Meal typed | What the app did | Use |
|---|---|---|
| coffee with milk and a banana | Fits. Meal load 11.7; 33.3 left. Coffee 100 g, milk 100 g, banana 100 g (defaults, said so) | Maya, morning |
| a grilled chicken sandwich and an apple | Fits, meal load 35.6, 9.4 left; names a swap, **Chicken Salad Sandwich** | Maya, petrol station |
| a chicken salad sandwich and an apple | Fits, meal load 21.2, 23.8 left; names the **Chicken Caesar Wrap** next | Maya asks again after the swap |
| chicken fried rice | Fits, meal load 27.3, 17.7 left; swap **Chicken Cabbage Stir-Fry** | Daniel, Wednesday, logged |
| a cheeseburger and a medium fries | "I can't judge the day on a partial total": medium fries is not in the database, asks what kind | honesty |
| grandma's cholent | An **estimate** from a typical recipe, with potatoes left out, asks how they were cooked; never a plain "fits" | honesty |
| how many units of insulin should I take before pasta? | Refused by a rule, no model involved | safety |
| a chicken wrap and a bag of chips, two slices of pepperoni pizza, a bowl of ramen | The app first asks which one: a quick clarifying question | not used (they stall the story) |

## The script, version 2 (22 October, for approval): why DiaBite, in about three minutes

*Why two people:* one is the problem seen from each side. Maya has no time, so she guesses. Daniel has the time, plans every week, and the plan breaks, so he feels he failed. Both are failed by tools that ask for a life with spare time. DiaBite is the same answer for both. Version 1 showed the features but never said what was wrong.

| Time | Scene | Narrator | The characters |
|---|---|---|---|
| 0:00–0:15 | **The question.** A counter turns to 1,095 (3 meals × 365). Both faces, a "?" over each | "Three meals a day. That is more than a thousand decisions a year. And for a person with diabetes, every one hides the same question: does this fit my day?" | |
| 0:15–0:28 | **Meet them.** Split: NO TIME / A PLAN THAT BREAKS | "Meet Maya and Daniel. They are made up, but you probably know them. They live in very different ways, and they run into the same wall." | |
| 0:28–0:55 | **Maya, the problem.** Petrol station, a wrap and chips, a thought bubble; then a long "log your food" form on her phone | "Maya has no time to plan. Her day is a car, a desk and a petrol station. So she guesses, or skips the meal, and worries all afternoon. Most tools ask for a life with spare time." | Maya: "Wrap and chips. Is that okay? I honestly don't know." |
| 0:55–1:20 | **Daniel, the problem.** Sunday plan, then Wednesday night, plan crossed out, pizza box | "Daniel is the opposite. He plans every meal for the week. Then life happens. A plan that breaks feels like failing, and some people stop trying." | Daniel: "Sunday. The whole week, planned." / "Wednesday. A late meeting. Pizza." |
| 1:20–1:30 | **The gap** | "Two people. Two rhythms. What is missing is an answer that fits a real day." | |
| 1:30–2:05 | **Maya with DiaBite.** Morning, then the petrol station and the swap | "She types it the way she would say it. A few seconds later: it fits, and here is what is left of today. Not quite? It names a lighter swap, and counts that too." | Maya: "Coffee with milk and a banana." / "Grilled chicken sandwich and an apple." / "Chicken salad instead. Fine." |
| 2:05–2:20 | **The receipt** | "Every number comes from a database, line by line. Open the receipt and check it yourself. A language model never makes one up." | |
| 2:20–2:45 | **Daniel with DiaBite.** The diary: planned (dashed), then eaten | "Daniel logs what really happened. The plan stays on the page, dashed. The diary counts only what was eaten. A plan that broke is not a failure. It is just Wednesday." | Daniel: "Chicken fried rice." |
| 2:45–3:05 | **Honesty.** The dose refusal, the cholent estimate | "Some questions it will never answer. Doses belong to your care team, and it refuses before any model sees the question. And when it does not know a dish, it says so, and calls the count an estimate." | Maya: "How many units of insulin before pasta?" / Daniel: "Grandma's cholent." |
| 3:05–3:20 | **Finale** | "A quick check on the go. A diary for the days a plan does not survive. One tool for both. Free to try at diabite.pro. A reference tool, not medical advice." | |

**Also changed in the making:** the characters' mouths move with their voices, the phone cross-fades between screens, a quiet music bed sits under the voices (it dips when anyone speaks).

## Open decisions (the owner's)

1. The lines above and the order of scenes.
2. The three voices: which ones (Azure Speech has several women's and men's voices; the narrator stays quick and warm).
3. Whether Daniel's week in range (the Diary's "days in range") appears; it is omitted above to keep the story short.

## How the film is made (scripts/demo-video/two-rhythms/)

`capture.mjs` films the live app for each scene with two throwaway accounts (their own profiles and budgets: Maya 69, Daniel 59); `tts.mjs` says every line (narrator Aria, Maya Ava, Daniel Davis); `build-film.mjs` lays out the timeline and the animated page; `render-film.mjs` takes 24 fps frames; `mix.mjs` places the voices, a few quiet sounds and the captions (`.vtt`) and writes the MP4. Every number on the phone is from the live capture, none is drawn.
