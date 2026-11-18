# Letting a person share their log with a dietitian or physician

Worklist №21, from the 14 November call (item 5). Written 18 November 2026. It follows `docs/research-export-for-professionals.md` (what the export gives) and the printable "Summary for my clinician", built and live since 18 November. Nothing here is built; it lays out the options and the questions that decide between them.

**This is research, not legal advice.** The legal points come from law-firm summaries found on 18 November, not from the statutes. Where sources disagreed or I could not check, it says so. Counsel (worklist №58) confirms before anything is built.

## What exists today

A person can print or save a PDF of the last 7, 14 or 28 days with their targets (no email, no age or weight, no kidney or pregnancy status). It is built in the browser, stored nowhere, and sent nowhere. What the person does with the file is theirs. No clinician has yet seen it.

## How other products do it

- **Dexcom Clarity** (glucose data) is patient-initiated and time-limited. The person enters the clinic's code in the app, or, if the clinic has no account, generates a share code valid for 3, 6 or 12 months. Either side can stop sharing at any time. Clinics without an account can use exported PDF reports. ([Dexcom](https://provider.dexcom.com/how-do-patients-share-data-my-clinic), [Dexcom FAQ](https://www.dexcom.com/en-us/faqs/how-can-i-share-my-sensor-data-with-my-healthcare-team)) The PDF fallback is our printable page.
- **Cronometer Pro** (food diary) is the professional-account model: a dietitian pays for a Pro subscription, invites a client by email, the client accepts, and the dietitian reads the diary, targets and reports on a dashboard; removing the client ends access. Clients get the premium tier free while on a dietitian's list. ([Cronometer](https://cronometer.com/blog/cronometer-pro/), [support](https://support.cronometer.com/hc/en-us/articles/360018673051-Pro-Client-Tab)) Its pricing is stated inconsistently on its own pages (about $39.99 a month on one; ten client spaces in the monthly plan on another), so I give no price.

## Options

| | What it is | What must exist | Rough size |
|---|---|---|---|
| **A. Print or save a PDF** (built) | The person hands over a page | nothing | done |
| **B. A link to a frozen snapshot** | The person taps "Share", gets a link to a read-only copy of the same page for a chosen period; opens in any browser with no account; expires (say 7 or 30 days); the person can switch it off | an account (the diary is on the server only for signed-in people), a table for snapshots with an expiry, an unguessable token, revocation, a record of when it was opened, consent wording | 1 to 2 weeks with tests |
| **C. Professional accounts** | A dietitian or physician signs up, is verified, invites a client or is invited, and sees their diary on a dashboard | a second product: professional sign-up and verification, roles, a dashboard, billing or a decision not to bill, support, contracts | weeks; a separate workstream |
| **D. Into a clinic's record (FHIR and similar)** | The log lands in the clinic's electronic record | integrations per system, and very likely a contract with the clinic | not a first step |

A person can also e-mail the PDF themselves. That needs nothing from DiaBite and carries the usual risk of ordinary email, which is theirs.

## What the law seems to say, to be confirmed by counsel

- **HIPAA.** Under the HHS guidance of 2016 (six scenarios), an app a person chooses for themselves, which sends data to their provider at their request, does not make the developer a "business associate", so HIPAA does not apply to it. **It flips when a provider or plan hires the developer or pays for the app and directs patients to it.** That matters for option C and for any future "a clinic offers DiaBite to its patients" arrangement. The guidance is old and covers six cases; counsel must say where DiaBite stands. ([summary](https://www.morganlewis.com/pubs/health-apps-and-hipaa-ocr-publishes-new-guidance-for-health-app-developers))
- **FTC Health Breach Notification Rule**, amended in 2024 and in force since 29 July 2024, reaches health apps that HIPAA does not cover. A "breach" includes an **unauthorised disclosure** to a third party, not only a hack, and notice must name who got the data and what kind. For option B this is the sharp edge: a link that reaches someone the person did not intend, or a share that goes beyond what they agreed to, would count. ([summary](https://www.mofo.com/resources/insights/240514-ftc-issues-final-rule-to-expand))
- **Washington's My Health My Data Act** (in force since 31 March 2024, with a private right of action through the state consumer-protection law) requires opt-in consent to collect consumer health data, a **separate** consent to share it, a way to withdraw, and, on request, a list of the third parties it was shared with. Sources disagree on remedies and on whether a small-business exemption exists, so I give neither. Other states have similar laws; **I did not check them.** ([summary](https://clarkhill.com/news-events/news/its-here-the-who-what-and-how-of-washingtons-new-my-health-my-data-act-and-its-private-right-of-action))

Taken together: sharing the person *chooses*, with a clear consent, an expiry and a switch-off, is the shape the law and Dexcom's practice point to. Sharing nobody asked for, or that cannot be undone, is the shape to avoid.

## What each option would change in what DiaBite holds

- **A** holds nothing new.
- **B** adds a copy of a person's diary period on the server for as long as the link lives: new health data, with a retention rule, deletion on account deletion, and a record of access. It must be covered by the privacy statement (worklist №58) and by the consent record.
- **C** adds professional accounts and a second class of reader of people's data, with the contract questions that come with it.

## Recommendation

1. **Do not build B or C yet.** The printable page has not been in front of a clinician. The cheapest and most informative step is to put it there and ask the three questions below. If they would use the printout and do not want more, B is not worth its server-side health data.
2. **If clinicians ask for a link, build B as a frozen snapshot**, patient-initiated, expiring, revocable, with no clinician account. It is the smallest shape that matches Dexcom's pattern and needs no professional product. Treat the first release as needing counsel's sentence on consent and the breach rule.
3. **Keep C for after funding and a dietitian on the team** (a decision already recorded in the project notes). It is a product, not a feature.

## Questions

**For clinicians** (worklist №39, №60)
1. Would you read this printed page in a visit, and what is missing from it?
2. If a patient could send you a link to the same page instead, would you open it, and how do you want to receive it (email, a portal, a code)?
3. Do you want a patient's log in a dashboard of your own, and would you pay for that?

**For the owner**
4. Is B worth a server-side copy of a person's diary period, if clinicians ask for it?
5. Is any arrangement where a clinic offers DiaBite to its patients something you want to pursue? It is the case where HIPAA may start to apply.

**For counsel** (№58)
6. Where does DiaBite stand under HIPAA, the FTC rule and Washington's act (and the other states'), for a patient-initiated share with a provider?
7. What consent text, retention and breach-notice process does a share link need?

## What I could not verify

The statute texts themselves; Washington's remedy amounts and small-business exemption; other states' consumer-health-data laws; Cronometer's current price; whether Dexcom's clinic-code flow has any form of audit shown to the patient.
