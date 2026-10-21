# Five sessions: the protocol

Thirty minutes each, five people, on the hosted app. Written down so the five
are comparable, and so the moderator cannot rescue anyone.

**The one rule.** When someone gets stuck, say nothing for ten seconds. Their
being stuck *is* the finding; a hint deletes it. You will want to help. That
urge is why this document exists.

---

## What we are trying to learn

Not "do they like it". Five things we currently guess at:

1. **Do people open the receipt again?** The first-run tips tell a new person where "Show calculation" is, so
   whether they find it is no longer a question. What we can still learn: on a later answer, without the tip,
   do they open it again, and what do they make of it? If nobody does, the argument "every number traces to a
   tool" is real and still invisible, and that changes what we build.
2. **What do they actually type?** Our 87 eval cases are phrases *we* invented,
   and the 18% unknown-food rate is measured against our own list. Real
   phrasing is the thing we cannot make up.
3. **What happens at "I don't have that food"?** A single food we lack is still named and left out. A
   *dish* we lack (grandma's cholent, a restaurant plate) is now counted from typical ingredients and shown
   as an **Estimate**, never a plain "fits". Watch whether they notice the word, whether they edit the
   recipe card, whether the estimate makes them trust the answer more or less, and whether they close the tab
   at a food it simply cannot find.
4. **Do they understand the numbers?** "Glycemic load 23.8" is the unit the
   whole product speaks in. It may be reading as decoration next to the word
   "fits".
5. **Past or future?** The app is built for "can I eat this". If people arrive
   wanting to log what they already ate, that is a different product.
6. **Do they eat the same meals again and again?** Eugene Kaganovich (20 October) said people repeat
   their meals, so typing them every time gets boring. If it is true for these five, the Ask screen should offer
   their recent meals in one tap (a choice for later, with no new data stored: the diary already holds them).
   If it is not, leave it. Decision rule: two of five who say they re-type the same few meals → build it.

---

## Who to find

Five people, each: **type 2 diabetes, prediabetes or insulin resistance**,
living in the US, not a nutritionist, not a developer. A mix of newly diagnosed
and years-in is better than five of one kind.

Not friends who will be kind. A stranger who leaves halfway through has told
you more than a friend who says it's lovely.

### A message you can send

> I'm building a tool that answers "can I eat this" for people managing blood
> sugar, and I'm looking for five people to try it for half an hour on a video
> call. You'd use it while I watch and stay quiet — no preparation, no
> homework, and nothing you say can be wrong. It is not medical advice and I
> won't ask for any medical records. Would you be up for it this week or next?

---

## Before the call

- The app: **the hosted address**, opened on *their* device. Not a screen you
  drive for them. If they have a phone handy, the phone is better — that is
  where food gets logged.
- Ask permission to record, in these words: *"May I record the screen and
  audio? It stays with me, it is not published, and I'll delete it when I've
  written up notes."* If they say no, take notes and carry on.
- Have this document open, and a blank list titled **"phrases they typed"**.
  That list is the single most valuable artefact of the session.
- The app shows four first-run tips to a new browser. Do not mention them and do not turn them off: they are
  part of what the person sees.
- The app may ask once "How is it going?" after the third meal. Do not mention it and do not turn it off.
- Do not demo anything. The first time they see the app should be with their
  hands on it.

---

## The session

### 0 · Opening (2 min)

> "This is a tool for people managing blood sugar. I'm going to give you a few
> things to do and then mostly shut up — that's on purpose, not rudeness.
> Nothing you do here can be wrong; if something is confusing, that's the tool
> being confusing. Please think out loud where you can."

Do not explain what it does. Do not say "it uses AI". Both frame what they see
next.

### 1 · Set it up as yourself (5 min)

> "Set it up the way you'd set it up for real."

**Watch for:** which questions make them pause. The kidney question and the
carbohydrate approach are the two most likely to land badly. Whether they
understand why it's asking about medicines. Whether they trust it with any of
this at all — flinching here is a finding about the whole product, not the
form.

**Do not** explain any question. If they ask what something means, say: *"Put
whatever you'd put if I weren't here."*

### 2 · Ask about food, their own words (8 min)

> "Ask it about something you ate yesterday, or something you're thinking about
> eating today."

This is the heart of it. **Write down exactly what they type**, character for
character, including the ones that fail. Every phrase we cannot resolve goes
into the eval set the same week, which is how the test set stops being our
imagination.

**Watch for:** Do they type or tap an example? Do they give a portion? Do they
read past the verdict line? Do they open "Show calculation" after the tip, and do they open it again on a later answer?
What do they do while it thinks for eight seconds?

**Do not** tell them what to type. Do not tell them the number is right.

**Then, if it has not come up:** *"Log what you ate yesterday."* Watch whether they find the day control above the log
button without help, and whether "Plan it" for tomorrow makes sense to them. Write down the words they use for it.

### 3 · Something it probably doesn't know (5 min)

> "Now ask it about something you'd eat that it might not have — a brand, a
> restaurant dish, something from your family."

**Watch for:** two different moments. For a **dish** (family recipe, restaurant plate) the app answers
with an **Estimate** counted from typical ingredients: do they notice the badge and the words "counted from
a typical recipe"? Do they open "Edit the recipe" and change a gram or remove an ingredient? Do they log it?
For a **single food it does not have** (a brand, an unusual fruit) the app says it doesn't have it and asks:
do they describe it, try another wording, or give up? Ask afterwards — *"what did you make of that
answer?"* — and then say nothing.

### 4 · Why is the number what it is (5 min)

> "Suppose you didn't believe that number. What would you do?"

**Watch for:** on their second or third answer, whether they open the calculation without being told. Ask,
after they have tried: *"The tip said you can see the arithmetic. What did you make of it?"*, then say
nothing. Note whether they believe the number once they have seen it.

### 5 · Debrief (5 min)

Six questions, in this order, and let silences run:

1. What would you use this for, if anything?
2. Was there a moment you didn't believe it?
3. What did you expect it to do that it didn't?
4. How much of what you eat is the same few meals? When you are about to eat one of those, what would you want the app to do? *(Do not mention "recent meals" or "favourites": let them describe it.)*
5. Who else do you know who'd want this — and what would you tell them it is?
6. If you could change one thing, what?

**Never** ask "would you pay for it". Everyone says yes and it means nothing.

---

## What to write down

During the session, only these — analysis comes later:

| | |
|---|---|
| **Phrases typed** | Verbatim, all of them, marked ✗ if unresolved |
| **Stuck points** | Where they paused over five seconds, and what they were looking at |
| **Receipt** | Opened after the tip / opened again on a later answer / never |
| **Repeat meals** | Their own words for how often they eat the same things, and whether they re-typed one during the session |
| **Device** | Phone or laptop |
| **Quotes** | Anything they said that made you wince. Those are the useful ones |

---

## Afterwards

- Every unresolved phrase becomes an eval case that week. Five sessions should
  add fifteen to thirty real ones, which is the most valuable thing the
  sessions produce.
- Three people hitting the same wall is a fix. One person is a note.
- Write the five sessions up as one page: what broke, how often, what we
  changed. That page belongs in the pitch — "five people broke these three
  things and here is what I did" is a different class of claim from "I think
  users will find this useful".

## What this is not

Not a demo, not a sales call, not a usability test of the weekly menu (which
nobody has ever used — a separate session, later). And not a place to give
anyone dietary advice: if a participant asks you what they should eat, say
that you're not able to advise and the tool isn't either, and move on.
