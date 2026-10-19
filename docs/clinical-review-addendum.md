# DiaBite — what has changed since you read the review pack

**For: the four clinicians who hold the pack** · Prepared by Nadia Babich · 10 October 2026, updated 19 October 2026 · *draft: not yet sent*

Thank you again for the time you have already given. This is **not** a second review. Nothing here needs you to reread the pack. Six things have changed in how the product treats a person since you saw it, and I would like your view on the questions that came out of them. About fifteen minutes, and you can stop after the first few; a single line against a question number is worth more to me than silence.

The questions are numbered **Q21 to Q32**, continuing the pack's Q1 to Q20. Three lines in the pack itself are out of date, and this page corrects them: the pack counts 6,054 records (there are now 8,633: 364 ingredients, 86 everyday foods, 2,000 recipes, about 4,600 USDA survey foods, 754 packaged and 813 "unrated" foods); it says a pepperoni pizza "comes back as I do not have that food" (it is now answered with carbohydrate only, see 2 and 5 below); and it calls Q17 open (it was decided as proposed, carbohydrate without a load, and I would still like your view on it).

## What changed

1. **A meal with a food we do not have is never called "fits".** If one food in a meal is missing from the database, the app costs the rest, says the total is partial and names what is missing. It will say *"this already does not fit"* if the part it could cost is over the day's budget; it will not say the meal fits. Before this, that was only in an instruction to the model; it is now decided by the calculation, so the model cannot get it wrong.
2. **Packaged and branded foods** (an Oreo, a KIND bar, a can of Red Bull) are now answered. We show the carbohydrate, fibre and calories printed on the label, and we say the glycemic load is not available, because no glycemic index is published for packaged products. We do **not** estimate one. A meal containing such a food is partial in the sense above.
3. **The weekly menu is back** (it had been built and never shown to anyone). It is hidden, with a short explanation and no plan, for a person who reports a **history of disordered eating, chronic kidney disease, or dialysis**. Everyone else sees it with the line *"These meals have not been reviewed by a clinician yet."*
4. **People sign in.** An emailed link, no password; the app holds their profile and diary in Ireland, with export and deletion. The first screen, before anything else, now carries the sentence in Q23.
5. **Foods with no glycemic index at all** (pizza, ready-to-eat cereal, candy, puddings, sweet drinks: 813 USDA survey foods) are answered the way packaged foods are: carbohydrate, fibre and calories from the data, **never** a glycemic load, and a meal containing one is partial and never "fits". Before, these came back as "I do not have that food".
6. **A dish the database lacks can be counted from its ingredients** (for example a grandmother's cholent), as an **estimate**: the app lists typical ingredients with assumed weights, finds each in the database, and says plainly it is an estimate and that the person can change any gram. The verdict on an estimate is conditional ("if yours is like this…"), never a plain "fits". Every number is still computed by the engine; only the weights are assumptions.

## Five questions

**Q21. The menu: who should not be shown a plan?**
I hide it for a history of disordered eating, CKD and dialysis, and show it to everyone else. That is a first guess, not a researched rule. For each of these, should the menu be hidden, shown with a warning, or shown as it is: *"my doctor has mentioned my kidneys"* (not diagnosed), gout, gastroparesis, brittle (unpredictable) diabetes, a GLP-1 user (protein), anyone over 65, anyone on a sulfonylurea? And is there anything else that belongs on the hidden list?

**Q22. A calorie target for someone with a history of disordered eating.**
Today onboarding still computes and shows a daily calorie and carbohydrate target to a person who reports a history of disordered eating, with a message to speak to their clinician. Should the app show *any* daily numerical target to that person, or none?

**Q23. The first thing a signed-out person reads.**
Because sign-in comes before the first question, someone with an emergency has to get past it. There is one safeguard in the screen and one underneath it. The sign-in screen itself carries, above everything, *"If you have symptoms such as chest pain, confusion, vomiting or fainting, call emergency services. DiaBite does not give insulin or medication doses."* And underneath, the engine answers a message that describes a red flag or asks for a dose with the usual refusal or escalation even when no one is signed in; but the app does not let a signed-out person type, so in practice that second one only protects anything that talks to the engine directly. Is the sentence right? Is a sign-in wall in front of a tool like this acceptable at all, or would you want the first screen to allow a question about a red flag without signing in?

**Q24. "Carbohydrate, load not available."**
For a packaged food the card says, in substance: *"I can give you the carbohydrate, not the load. It has no published glycemic index, so DiaBite does not estimate one."* with the label's carbohydrate, fibre and calories for one serving. Can a person with type 2 diabetes use that safely? Does it risk being read as permission to eat the food? Is there something it should add (the serving size on the label, "check the label for your portion"), or leave out?

**Q25. Partial meals: "I can't judge the day".**
When part of a meal cannot be scored, the app declines to say it fits and asks about the missing food, or says it already does not fit. Would you rather it showed a *range* (the load of the part it could cost, up to a stated ceiling), or is declining the safer thing for this audience?

## Three more, added the evening of 10 October

**Q26. "What is GL?" in two sentences.**
Next to the main figure there is a link, "What is GL?", that opens: *"Glycemic load puts two things into one number: how fast a food raises blood sugar, and how much carbohydrate is in your portion. Your day has a budget of N. Each meal spends some of it, and the number you see is what is left."* Is that accurate and safe for a person with type 2 diabetes who has never heard the term? Is "how fast a food raises blood sugar" a fair gloss of the glycemic index, and is there a sentence you would add or strike?

**Q27. A shorter disclaimer.**
The banner used to show its whole text (reference tool, not medical advice, the numbers are published averages, not for insulin dosing, discuss changes with your clinician). It now shows only its first sentence, *"This is a reference tool, not medical advice."*, with the rest one tap away under "Read more". The whole text is unchanged and is also agreed to at the end of onboarding. Is a one-sentence banner with the rest on a tap enough, or must the dosing sentence always be visible?

**Q28. Changing a portion after the answer.**
After an answer the person can change any food's weight; the engine counts the meal again and a card above the original answer shows the new figures and a new verdict word taken from the same rule as before (fits, does not fit, or "I can't judge" when a food is missing). The explanation text written for the original portions stays below, marked as the original. Should the app also let someone *add* a food or *remove* one this way, or keep that to a new question? Is "Original answer, before you changed a portion" a clear enough label?

**Q29. The menu now draws on 1,662 recipes.**
The weekly menu used to choose from 30 hand-written dishes. It now also draws on 1,662 recipes from a database of 2,000 (American, Italian, Tex-Mex, Mediterranean, Asian, Middle Eastern and others): every recipe's nutrition, glycemic index and load were computed from its ingredient table, and nobody has read them as a dietitian would. A week still shows "These meals have not been reviewed by a clinician yet". Is that line enough while they are unreviewed, or should a recipe carry a visible "unreviewed" mark until a dietitian has signed off, and is there a category you would take out of the menu altogether (for instance sandwiches and wraps, or soups with starchy thickeners)?

## Three more, added on 19 October

**Q30. An estimate for a dish we do not have.**
When the database lacks a dish, the app proposes typical ingredients with weights and counts them, and the card says *"Estimate: I counted this from typical ingredients, which may not be yours"* with an editor for the recipe. The verdict on it is conditional, never a plain fit. Is a number you can edit better for this audience than "I do not have it", or does an estimate with assumed weights invite false confidence? Would you want a range instead of a single figure?

**Q31. Foods that get carbohydrate and no load.**
Pizza, cereal, candy, packaged foods: the card gives carbohydrate, fibre and calories and says no glycemic index is available. This was Q17 in the pack and was decided as proposed. For a person with type 2 diabetes, is carbohydrate without a load more useful than silence, or does it risk reading as permission? (Q24 asks the same of packaged foods; one answer will do for both.)

**Q32. A meal can be planned for another day, and counts only once it is eaten.**
A person can put a meal on tomorrow, or on a day in the past. A planned meal is shown dimmed, marked "planned", and counts in no budget, no week and no "days in range" until it is marked eaten. Nothing else about the food advice changes. Is there any risk in a person planning a day of meals that the app has not judged as a whole day, and is "planned" clear enough as a word?

## How to answer

Select any text and comment, or reply with question numbers. Partial answers are welcome.

Everything in the product that decides something about a person is in the pack; the new behaviour is reproduced in this one page and in the live app. Nothing here changes a threshold, a dose rule or a target: those still wait on your earlier answers.
