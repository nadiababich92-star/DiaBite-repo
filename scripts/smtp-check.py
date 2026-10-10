#!/usr/bin/env python3
"""
Check the Azure Communication Services SMTP login without Supabase in between.

    python3 scripts/smtp-check.py

It asks for the client secret with a hidden prompt (nothing is echoed, stored or
written to a file) and tries to sign in to smtp.azurecomm.net as the diabite-smtp
app. If the login works it offers to send one test message to your own address.
The secret goes to Azure and nowhere else. Run it yourself: do not paste the
secret into the chat or into a file.
"""
import getpass, smtplib, ssl, sys
from email.message import EmailMessage

RESOURCE = 'diabite-comms'
CLIENT_ID = '0c2b87dc-9bf4-4f5f-9ac5-5346babe3653'
TENANT_ID = 'a4e67912-5408-4d23-9757-c34e9c98a7fc'
SENDER = 'DoNotReply@ccddc8f5-09d0-4a8d-86bc-acb7610b7aec.azurecomm.net'
HOST, PORT = 'smtp.azurecomm.net', 587
USER = f'{RESOURCE}.{CLIENT_ID}.{TENANT_ID}'

secret = getpass.getpass('Client secret Value (hidden, then Enter): ')
print(f'length {len(secret)}, contains "~": {"~" in secret}, spaces at the ends: {secret != secret.strip()}')
secret = secret.strip()
try:
    with smtplib.SMTP(HOST, PORT, timeout=30) as s:
        s.starttls(context=ssl.create_default_context())
        s.login(USER, secret)
        print('LOGIN OK: Azure accepts this username and secret.')
        if input('Send one test email to nadia.babich92@gmail.com? [y/N] ').lower() == 'y':
            m = EmailMessage()
            m['From'], m['To'], m['Subject'] = f'DiaBite <{SENDER}>', 'nadia.babich92@gmail.com', 'DiaBite SMTP test'
            m.set_content('If you can read this, Azure Communication Services can send mail for DiaBite.')
            s.send_message(m)
            print('Sent. Look in the inbox and the spam folder.')
except smtplib.SMTPAuthenticationError as e:
    print('LOGIN REFUSED by Azure:', e.smtp_code, e.smtp_error.decode(errors='replace')[:200])
    print('So the username or the secret is wrong. The username here is built from the three ids in the script.')
    sys.exit(1)
except Exception as e:
    print('Could not complete:', type(e).__name__, str(e)[:200])
    sys.exit(2)
