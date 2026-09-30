# Asking a clinician to review the logic

Short notes to send when connecting, and the longer message for after they
accept. The ask is deliberately small and specific: clinicians are asked to
"advise startups" constantly and it usually means unpaid endorsement. This asks
for forty minutes of criticism, which is a different thing and easier to say
yes to.

---

## The connection note (LinkedIn caps these at 200 characters)

Counts below are with a four-letter name in place; swap in a longer one and
check. Em dashes and quotation marks each count as one.

**A — to a physician (190)**

> Hi Dr [Name] — I build a nutrition tool for type 2 diabetes and I'd rather a
> clinician told me my numbers are wrong now than later. Could I send you the
> logic? 40-minute read, nothing to sell.

**B — to a dietitian or CDCES (185)**

> Hi [Name] — I'm building a "can I eat this?" tool for type 2 diabetes. The
> daily targets are the part I trust least. Would you tear into the logic? One
> doc, 40 min, no endorsement needed.

**C — shortest, when the name is long (160)**

> Hi Dr [Name] — I build a nutrition tool for type 2 diabetes and need a
> clinician to tell me what's wrong with my targets. 40-minute read, no pitch.
> May I send it?

**D — when you have a real hook (179)**

> Hi Dr [Name] — your talk on [subject] is why I'm writing. I build a nutrition
> tool for type 2 diabetes and need someone to tell me where my targets are
> wrong. 40-min read?

D is the one that gets answered, when it is true. Everything specific you know
about them is worth more than anything clever about you.

**If you have something specific in common** — replace the first line with it.
A talk of theirs, a paper, their clinic's population. One true specific beats
any amount of polish.

---

## The message after they accept

> Thank you for connecting.
>
> Short version: I'm building DiaBite, a tool that answers "can I eat this?"
> for adults with type 2 diabetes, prediabetes or insulin resistance. Someone
> describes a meal in their own words and it gives the carbohydrate, the
> glycemic load, and whether that fits what's left of their day — every number
> computed by a deterministic engine from USDA data and the International GI
> Tables, never by a language model, and shown with its source.
>
> It never gives a dose, never changes a prescription, and refuses those
> questions before the model sees them.
>
> What I'd like is not an endorsement — it's for someone qualified to tell me
> what's wrong. I've written every decision the product makes about a person
> into one document: the energy and protein targets, what we do about kidney
> disease and GLP-1s, which options we block and why, and the rules that stop
> the conversation. Seventeen questions, marked, about 40 minutes to read.
>
> Three I'd most like challenged:
>
> 1. We give each person a **daily glycemic-load ceiling**, derived from their
>    carbohydrate target and a target mean diet GI. That's our own
>    construction, not a guideline — and I want to know if it's defensible.
> 2. We cap protein at **0.8 g/kg for anyone who reports kidney disease**,
>    without knowing their eGFR or stage.
> 3. At a stated glucose **under 70 we stop the conversation** and say to seek
>    help — we deliberately don't tell them to take fast-acting carbohydrate.
>    I'm not sure that's right.
>
> If it's useful I'll send the document and you can write in the margins, or we
> can do half an hour on a call — whichever is less work for you. And if
> reviewing tools isn't something you do, no hard feelings at all; if you know
> someone who'd enjoy taking this apart, that would help just as much.
>
> [Your name]

---

## Two things worth deciding before you send

**Offer to pay.** Many clinicians consult at an hourly rate and a free "quick
look" quietly asks them to work for nothing. One line — *"I'm happy to pay your
consulting rate for the time"* — raises the yes-rate and costs you a message if
they decline it.

**Decide what credit you're offering**, before they ask. "Reviewed by" on a
slide is a claim about their professional judgement and they will treat it
seriously. Safer to offer a named acknowledgement and let them ask for more.

## What not to write

- "AI-powered" anywhere in the first message. It reads as the thing they are
  already tired of, and the interesting part of this product is what the model
  is *not* allowed to do.
- "Revolutionise", "disrupt", or any promise about outcomes — the product
  itself is forbidden from promising outcomes, so the pitch shouldn't either.
- A request for "just 5 minutes". It isn't five minutes, and saying so makes
  the rest less believable.
