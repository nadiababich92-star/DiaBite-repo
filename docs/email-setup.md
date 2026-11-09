# DiaBite sign-in email: sender and wording

*9 November 2026. From a tester's note on 6 November: the confirmation email arrived with no branding, generic text, and looked like spam.*

## What was found in the Supabase dashboard (project `qennxqfbvgqyodjmkguo`)

| Setting | State on 9 November | Action |
|---|---|---|
| SMTP sender name | already `DiaBite` | none |
| Magic link or OTP template | already branded: "Your DiaBite sign-in link", a button and the six-digit code | none |
| **Confirm sign up template** | **Supabase's default**: "Confirm your email address", a bare link, **no product name and no code** | **replaced on 9 November** (below) |
| SMTP sender address | `DoNotReply@<guid>.azurecomm.net`, Azure's managed domain | **open, needs the owner** (C) |

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

## Still open: the sender address (C)

The inbox shows the name "DiaBite", but the address behind it is a random string at `azurecomm.net`, and filters trust a message from `login@diabite.pro` much more. To change it: Azure → Communication Services → Email → Domains → add `diabite.pro` as a custom domain; Azure lists the TXT, SPF and DKIM records to add at Hostinger. When the domain verifies, add a sender such as `login@diabite.pro` and put it in Supabase → Authentication → Emails → SMTP Settings → *Sender email address*. These are the owner's DNS records.

## Check

Sign in with a fresh address that has never signed in (a new person gets the Confirm sign up email) and look in the inbox and the spam folder: the subject names the product, and both the button and the code are in the body.
