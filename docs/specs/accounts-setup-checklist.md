# Setup the owner does before sign-in can be built

*From `docs/engineering/engineering-doc.md`, section 11, step 1. About 40 minutes. Nothing here needs code, and **no secret is ever pasted into the chat**: each one goes straight from the Azure portal into the Supabase dashboard.*

The screen names below are the ones I know; if a screen differs, send a screenshot with the secret hidden and I will adjust.

## Part 1. Azure: a sender for the emails

1. Azure portal → **Create a resource** → **Communication Services** → resource group `rg-nadia.babich92-5702`, name `diabite-comms`, **Data location: Europe** (you are the controller in the EU; the emails carry only an address and a link).
2. Create another resource: **Email Communication Services**, same resource group, name `diabite-email`, Data location Europe.
3. Open `diabite-email` → **Provision domains** → **Add domain** → **Azure managed domain**. Wait until the status is *Verified* (a few minutes). Note the **MailFrom address** it shows, like `DoNotReply@<random>.azurecomm.net`. (Your own domain looks more trustworthy and avoids spam folders, and can replace this later; it needs DNS records.)
4. Open `diabite-comms` → **Email → Domains** → **Connect domain** → choose the one above.
5. **An identity for the SMTP login.** Microsoft Entra ID → **App registrations** → **New registration** → name `diabite-smtp` → Register. Copy the **Application (client) ID** and **Directory (tenant) ID** (not secret). **Certificates & secrets** → **New client secret** → copy its **Value** now; it is shown once. *This value is the secret: it goes only into Supabase in Part 2.*
6. `diabite-comms` → **Access control (IAM)** → **Add role assignment** → role **Communication and Email Service Owner** → assign to the app `diabite-smtp`.
7. `diabite-comms` → **Settings → SMTP credentials** shows the host and port: `smtp.azurecomm.net`, port **587**, STARTTLS. The SMTP username is `<diabite-comms resource name>.<client ID>.<tenant ID>`, the password is the client secret from step 5.

Cost: about a quarter of a cent per hundred emails; nothing for idle.

## Part 2. Supabase: send through it, and trust our address

Supabase dashboard → project **DiaBite-feedback** (region eu-west-1):

1. **Authentication → Sign In / Providers → Email**: enabled. Turn **off** "Confirm email" is not needed for links; keep the provider on, and note whether **"Allow new users to sign up"** is on (your answer to question 3 in the plan: anyone, or an allow-list).
2. **Authentication → Emails → SMTP Settings** → **Enable custom SMTP**: sender email = the MailFrom address from Part 1, sender name `DiaBite`, host `smtp.azurecomm.net`, port `587`, username and password from Part 1 step 7.
3. **Authentication → URL Configuration**: **Site URL** `https://diabite-engine.greenglacier-ab5551c6.swedencentral.azurecontainerapps.io`; **Redirect URLs**: that same address, and `http://localhost:5173` for development.
4. **Authentication → Emails → Templates → Magic Link**: the wording is mine to write with you (plain, English, no emoji): I will propose it with the sign-in screen so a clinician can read it too.
5. **Authentication → Rate Limits**: leave the defaults; raise "emails per hour" only when real use needs it.

## Part 3. What to send me when it is done

- "Part 1 and 2 done", and the MailFrom address (it is not secret).
- Your answers to the six owner questions in section 12 of the plan.
- Whether anyone may sign in or only an allow-list, and if a list, the first addresses.

I then build the tables with their row-level security first, test them on a Supabase branch, and only then touch the app.

## As set up, 10 October 2026 (nothing here is secret)

| Item | Value |
|---|---|
| Communication Services | `diabite-comms` (global, data location Europe) |
| Email Communication Services | `diabite-mail-nb`, Azure managed domain, connected to `diabite-comms` |
| Sender (MailFrom) | `DoNotReply@ccddc8f5-09d0-4a8d-86bc-acb7610b7aec.azurecomm.net` |
| SMTP | `smtp.azurecomm.net`, port 587, STARTTLS |
| SMTP identity | Entra app `diabite-smtp`; role **Communication and Email Service Owner** on `diabite-comms` (checked from the CLI on 10 October) |
| The secret | A client secret for that app, created 10 October, kept **only** in Supabase (Authentication, SMTP). The first one was lost and replaced. **Replace it a month before it expires**: create a new secret in Entra, paste it into Supabase, delete the old one. If it lapses, sign-in emails stop silently |

**Verified 10 October 2026, 11:47 UTC:** a sign-in email requested from Supabase reached the owner's inbox, through Azure Communication Services. What it cost to get there, so it is not repeated: the first secrets were created in a *second* app registration also called `diabite-smtp` (client ID `db64eb5d…`), while the login used the first one's ID (`0c2b87dc…`), and Azure answered `535 5.7.3 Authentication unsuccessful` to every attempt. Look at the **Application (client) ID**, never at the name, when two apps share a name. `scripts/smtp-check.py` (hidden prompt, nothing stored) tests the login directly and is the quickest way to tell Azure's refusal from Supabase's.

