# Blue-green deploy (26 November 2026)

Asked for by the team: while a new version goes out, the site keeps running on the old one. Owner's choices, 26 November 2026: traffic
moves **all at once** once the new version passes its checks; the old version keeps running **15 minutes**; keeping half-finished
conversations across a deploy is **a separate task, later**.

## Why

Until now the app ran in single-revision mode with one replica and no readiness probe. `az containerapp update` started a new revision
and Azure moved the traffic to it as soon as it started, not when it was ready, then the old one was switched off. `scripts/deploy.sh`
itself recorded what people saw: a few seconds of 404 "Container App is stopped or does not exist", then requests flapping between the
old and the new revision (the reason for its "six good answers in a row"). A revision that could not start took the site down: twelve
minutes on 9 October 2026.

## How it works now (`npm run deploy`)

1. The new image starts as a new revision named `diabite-engine--g<sha7>-<MMDDhhmm>` with **no traffic**. Everyone stays on the old one.
2. The new revision is checked on **its own address** (`<revision>.greenglacier-ab5551c6.swedencentral.azurecontainerapps.io`):
   `/health` must name that revision and the page must answer 200, six times in a row; then `eval/smoke.mjs` against that address.
3. If either fails, the new revision is switched off. Nobody saw it.
4. Otherwise **100% of traffic** moves to it in one step (`az containerapp ingress traffic set`).
5. The previous revision stays active for **15 minutes** (requests in flight finish, and going back is one command, printed by the
   script), then switches itself off unless it took the traffic back. Anything older is switched off at once.
6. The public address must then answer from the new revision six times in a row, and the smoke test runs on it again.

`/health` now carries `revision` (Azure's `CONTAINER_APP_REVISION`), so "which version does a person reach" is asked of the running service
(CLAUDE.md rule 1), never assumed.

Going back during the 15 minutes:

```bash
az containerapp ingress traffic set -g rg-nadia.babich92-5702 -n diabite-engine --revision-weight <old revision>=100
```

## One-time setup (not done yet: needs the owner)

The app must be in multiple-revision mode with its traffic pinned to a named revision; otherwise a new revision would still take the traffic
the moment it starts. The script refuses to deploy until this is done. Run once, in this order (the site keeps answering throughout):

```bash
az containerapp revision set-mode -g rg-nadia.babich92-5702 -n diabite-engine --mode multiple
az containerapp ingress traffic set -g rg-nadia.babich92-5702 -n diabite-engine --revision-weight diabite-engine--0000277=100
```

(`diabite-engine--0000277` is the revision live on 26 November 2026; use whichever `az containerapp revision list … --query "[?properties.active].name"` shows.)

## What it costs

For 15 minutes after each deploy two replicas run instead of one (minimum 1 replica per active revision): a few cents a deploy.

## What it does not do (yet)

- **Conversations in progress** live in the engine's memory (`server/sessions.ts`). After the switch the new revision does not know a
  half-finished clarifying question ("I still don't have that dish"). Owner's decision: a separate task, later.
- **The catalogue** is still read once at start (CLAUDE.md rule 10): a change in Supabase reaches people on the next new revision, or on
  `az containerapp revision restart` of the one with the traffic.
- **The Foundry agents** are not part of this: `agent/provision.ts` publishes a new agent version, which every revision uses at once.
