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

## The script, version 3 (22 October): faster, and it says who they are and why DiaBite

The owner's notes on version 2: boring, too slow; it was not clear that Maya and Daniel have diabetes or why the app exists; no numbers for America. Version 3 runs about 1:50.

*Source of the two numbers on screen:* CDC, National Diabetes Statistics Report, 2023 data: 40.1 million people with diabetes (12.0% of the US population) and 115.2 million US adults with prediabetes (https://www.cdc.gov/diabetes/php/data-research/index.html, checked 22 October 2026). They are quoted with the source on screen; they are not product numbers and do not pass through the engine.

| Scene | What happens | Narrator / characters |
|---|---|---|
| Numbers | 40.1 million counts up, then 115.2 million, then a "?" over each of the two | "Forty million Americans live with diabetes. A hundred and fifteen million adults have prediabetes. And for all of them, every meal is the same question: does this fit my day?" |
| Meet | Names with their conditions: Maya, insulin resistance, no time; Daniel, type 2, a plan that breaks | "Meet Maya, who has insulin resistance, and Daniel, who has type 2 diabetes. Made up, but you know them. She has no time. He has a plan that keeps breaking." |
| Maya's problem | Petrol station, a long "log food" form on her phone | Maya: "Wrap and chips. Is that okay? I honestly don't know." / "Maya has no time to plan, so she guesses. Most tools ask for a life with spare time." |
| Daniel's problem | Sunday's weekly menu, then Wednesday: crossed-out plan, pizza | Daniel: "Sunday. The whole week, planned." / "Daniel plans every meal." / Daniel: "Wednesday. A late meeting. Pizza." / "Then life happens, and a broken plan feels like failing." |
| What DiaBite is | Maya types in the car, the answer arrives | "That is why DiaBite exists. Say what you are about to eat. It tells you if it fits what is left of your day, and shows the arithmetic." |
| Maya, the swap | Sandwich, the lighter swap, counted again | Maya: "Grilled chicken sandwich and an apple." / "A few seconds. It fits, but it names a lighter swap, and counts that too." / Maya: "Chicken salad instead. Fine." |
| The receipt | The calculation | "Every number comes from a database. Open the receipt and check it yourself." |
| Daniel, the diary | Planned dinner dashed, then fried rice logged | "In the diary, his plan stays, dashed. Only what he really eats counts." / Daniel: "Chicken fried rice." / "A plan that broke is not a failure. It is just Wednesday." |
| Honesty | The dose refusal; the cholent estimate | Maya: "How many units of insulin before pasta?" / "Some questions it never answers. Doses belong to your care team." / Daniel: "Grandma's cholent." / "And when it does not know a dish, it says so, and calls it an estimate." |
| Finale | | "A quick check on the go. A diary for the days a plan breaks. Free to try at diabite dot pro. A reference tool, not medical advice." |

Made for pace: typing is shortened to the spoken line, thinking is cut, cuts every few seconds, a push-in on every scene, a beat-driven music bed that builds with the story and ducks under the voices. Mouths follow the voice (closed, round, wide, open), read from the audio, not from phoneme data.

## Open decisions (the owner's)

1. The lines above and the order of scenes.
2. The three voices: which ones (Azure Speech has several women's and men's voices; the narrator stays quick and warm).
3. Whether Daniel's week in range (the Diary's "days in range") appears; it is omitted above to keep the story short.

## How the film is made (scripts/demo-video/two-rhythms/)

`capture.mjs` films the live app for each scene with two throwaway accounts (their own profiles and budgets: Maya 69, Daniel 59); `tts.mjs` says every line (narrator Aria, Maya Ava, Daniel Davis); `build-film.mjs` lays out the timeline and the animated page; `render-film.mjs` takes 24 fps frames; `mix.mjs` places the voices, a few quiet sounds and the captions (`.vtt`) and writes the MP4. Every number on the phone is from the live capture, none is drawn.
