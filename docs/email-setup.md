# DiaBite sign-in email: sender and wording

*9 November 2026. From a tester's note on 6 November: the confirmation email arrived with no branding, generic text, and looked like spam.*

## What was found in the Supabase dashboard (project `qennxqfbvgqyodjmkguo`)

| Setting | State on 9 November | Action |
|---|---|---|
| SMTP sender name | already `DiaBite` | none |
| Magic link or OTP template | already branded: "Your DiaBite sign-in link", a button and the six-digit code | none |
| **Confirm sign up template** | **Supabase's default**: "Confirm your email address", a bare link, **no product name and no code** | **replaced on 9 November** (below) |
| SMTP sender address | `DoNotReply@<guid>.azurecomm.net`, Azure's managed domain | **changed on 11 November to `login@diabite.pro`** (C, below) |

A **new** person asking for a link goes through `signInWithOtp` with `shouldCreateUser: true`, so they receive the *Confirm sign up* template, not the Magic link one. That is the email the tester saw: generic, unbranded, and, because it had no `{{ .Token }}`, no code to type into the app, only a link.

## Done

The Confirm sign up template now matches the Magic link one: subject `Your DiaBite sign-in link`, a sign-in button (`{{ .ConfirmationURL }}`), the code (`{{ .Token }}`) and a line saying it can be ignored. Both the link and the code must stay in it: the app offers both (`src/lib/auth.ts`).

```html
<h2>Your DiaBite sign-in link</h2>
<p>Tap the button to sign in to DiaBite. It works once and expires in one hour.</p>
<p><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#1c6b49;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Sign in to DiaBite</a></p>
<p>Or enter this code in the app:</p>
<p style="font-size:24px;letter-spacing:4px;font-family:monospace"><b>{{ .Token }}</b></p>
<p>If you didn't ask for this, you can ignore it. Nothing happens unless the link is opened.</p>
```

## Done on 11 November 2026: the sender address (C)

The sign-in email now comes from `login@diabite.pro`, name "DiaBite". What was done, in order:

1. **Azure** (resource group `rg-nadia.babich92-5702`): a custom domain `diabite.pro` was added to the email service `diabite-mail-nb` (customer-managed), a sender `login` (display name "DiaBite") was created on it, and the domain was linked to the communication service `diabite-comms` next to the Azure-managed one.
2. **Hostinger DNS** (four records added by Nadia's Chrome session, the five existing records untouched): TXT `@` `ms-domain-verification=f5f1de9f-b23f-4b89-9fa9-fa5750ea3f50`; TXT `@` `v=spf1 include:spf.protection.outlook.com -all`; CNAME `selector1-azurecomm-prod-net._domainkey` and `selector2-azurecomm-prod-net._domainkey` pointing at `...azurecomm.net`. Azure reports Domain, SPF, DKIM and DKIM2 as Verified.
3. **Supabase** (Authentication, Emails, SMTP Settings): only *Sender email address* was changed, to `login@diabite.pro`. Host, port, username and the stored password were not touched.

**To roll back:** put the old sender address back in the same Supabase field. The old address was `DoNotReply@ccddc8f5-09d0-4a8d-86bc-acb7610b7aec.azurecomm.net` (the Azure-managed domain is still linked, so it still works).

**One SPF record only.** A domain can have only one SPF record. If mail on `diabite.pro` is ever added with Google Workspace or another provider, merge their `include:` into the single record above instead of adding a second one.

**Not done: DMARC.** Azure shows it as not started. It is optional; a first record such as `_dmarc` TXT `v=DMARC1; p=none;` would let receivers report on the domain without rejecting anything. It is the owner's choice.

## Check

Sign in with a fresh address that has never signed in (a new person gets the Confirm sign up email) and look in the inbox and the spam folder: the subject names the product, and both the button and the code are in the body.

## Checked on 11 November 2026, 22:45 (Poland)

A sign-in request from an existing account (Gmail) produced a message in the inbox, not in spam: from `DiaBite <login@diabite.pro>`, subject "Your DiaBite sign-in link", with the sign-in button and the code. The Supabase auth log shows the request accepted in 0.45 s with no error. **Not yet checked:** the "Confirm sign up" email that a person who has never signed in receives (the template changed on 9 November); it needs an address that has never signed in. DMARC is still not set; Gmail delivered without it, so it is not urgent.


## DMARC (12 November 2026)

A TXT record `_dmarc.diabite.pro` = `v=DMARC1; p=none; adkim=r; aspf=r; pct=100` was added at Hostinger. `p=none` is monitoring only: it blocks nothing and does not change delivery; it only tells Gmail and Outlook that the domain has a policy. Checked against the Hostinger nameservers and 8.8.8.8: the record answers, and SPF, the two DKIM CNAMEs and the other TXT records are unchanged. No `rua` address is set, so no reports are sent. Tightening to `p=quarantine` is a later decision, after a few weeks of real mail.
