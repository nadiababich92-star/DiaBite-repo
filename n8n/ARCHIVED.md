# Archived

This is the workflow DiaBite ran on before it moved to Azure AI Foundry, kept for
reference. **Do not run it and do not copy its safety gate.** The gate that ships
is `server/safety.ts`, which has since gained mmol/L readings, insulin brand
names, prolonged-fasting and referral rules, and the normalising that catches
spaced, full-width and spelled-out phrasings. This copy lacks all of them, and its
glucose pattern would send "metformin 500 mg" to the emergency script.
