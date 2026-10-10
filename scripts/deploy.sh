#!/usr/bin/env bash
# Build the current commit and put it live.
#
# Hand-running these steps is how a revision once went live pointing at an
# image that was never built: `gh run list --limit 1` answered with the
# *previous* run, which had already succeeded, so the wait returned at once.
# This waits for the run whose head is this commit, and for nothing else.
set -euo pipefail

RG=${RG:-rg-nadia.babich92-5702}
APP=${APP:-diabite-engine}
REGISTRY=${REGISTRY:-ca83d2041d5eacr.azurecr.io}
REPO=${REPO:-nadiababich92-star/DiaBite-repo}
git diff --quiet || { echo "working tree is dirty — commit first"; exit 1; }

# The workflow only builds when the image's inputs change, so a commit that
# touches docs or .gitignore never produces a run. Deploy the image of the
# most recent commit that did: its contents are what HEAD would produce.
SHA=""
for candidate in $(git log -20 --format=%H); do
  if gh run list --repo "$REPO" --workflow build-engine --commit "$candidate" --limit 1 \
       --json status -q '.[0].status' 2>/dev/null | grep -q .; then
    SHA=$candidate
    break
  fi
done
[ -n "$SHA" ] || { echo "no build found for HEAD or the 20 commits before it"; exit 1; }
[ "$SHA" = "$(git rev-parse HEAD)" ] && echo "commit  $SHA" || echo "commit  $SHA (HEAD changed nothing the image is built from)"

echo "waiting for that build…"
for _ in $(seq 1 60); do
  read -r STATUS CONCLUSION <<<"$(gh run list --repo "$REPO" --workflow build-engine --commit "$SHA" \
    --limit 1 --json status,conclusion -q '.[0] | "\(.status) \(.conclusion // "-")"' 2>/dev/null || echo "missing -")"
  [ "$STATUS" = "completed" ] && break
  sleep 20
done
[ "${CONCLUSION:-}" = "success" ] || { echo "build for $SHA is $STATUS/$CONCLUSION — not deploying"; exit 1; }

echo "deploying…"
PREVIOUS_IMAGE=$(az containerapp show -g "$RG" -n "$APP" --query "properties.template.containers[0].image" -o tsv)
az containerapp update -g "$RG" -n "$APP" --image "$REGISTRY/$APP:$SHA" --query properties.latestRevisionName -o tsv >/dev/null

LATEST=$(az containerapp show -g "$RG" -n "$APP" --query properties.latestRevisionName -o tsv)
FQDN=$(az containerapp show -g "$RG" -n "$APP" --query properties.configuration.ingress.fqdn -o tsv)

# The old revisions stay until the new one has answered. They used to be switched off
# first, and on 9 October a new revision that could not start left nothing to fall back
# on: the app was down for twelve minutes.
echo "waiting for $LATEST to answer…"
LIVE=""
for _ in $(seq 1 30); do
  if curl -fsS -m 15 "https://$FQDN/health" 2>/dev/null | grep -q '"ok":true'; then LIVE=yes; break; fi
  sleep 12
done

if [ -z "$LIVE" ]; then
  echo "revision never answered; its state:"
  az containerapp revision show -g "$RG" -n "$APP" --revision "$LATEST" --query "properties.runningState" -o tsv
  echo "to go back:  az containerapp update -g $RG -n $APP --image $PREVIOUS_IMAGE"
  exit 1
fi

for r in $(az containerapp revision list -g "$RG" -n "$APP" --query "[?properties.active].name" -o tsv); do
  [ "$r" = "$LATEST" ] || az containerapp revision deactivate -g "$RG" -n "$APP" --revision "$r" >/dev/null 2>&1
done
# The ingress answers 404 "Container App is stopped or does not exist" for a few seconds while the old
# revision is deactivated and the new one takes the traffic. That, not the app, is why the first smoke
# failed after four deploys in a row. Wait until /health answers with JSON before checking anything.
for i in $(seq 1 45); do
  if curl -s -m 10 "https://$FQDN/health" | grep -q '"ok":true'; then break; fi
  sleep 4
done
echo "live: $(curl -s -m 15 "https://$FQDN/health")"

# Check the thing, not the report (CLAUDE.md rule 1): the page, the closed routes, the safety rules, a real question.
if [ -z "${SKIP_SMOKE:-}" ] && command -v node >/dev/null 2>&1; then
  # Three deploys in a row failed their first smoke and passed every rerun. A cold container is
  # the suspect, but the cause is not proven, so the failing lines are kept and a second try is
  # allowed AND reported: a pass on the second try is not a clean pass.
  SMOKE_OUT="$(mktemp)"
  if node eval/smoke.mjs "https://$FQDN" >"$SMOKE_OUT" 2>&1; then
    echo "smoke: passed"
  else
    echo "smoke: FIRST TRY FAILED:"; grep -E "^(FAIL|[A-Za-z]*Error)" "$SMOKE_OUT" | cut -c1-300
    echo "retrying once in 30 s"; sleep 30
    if node eval/smoke.mjs "https://$FQDN" >"$SMOKE_OUT" 2>&1; then
      echo "smoke: passed on the SECOND try (see the failure above)"
    else
      grep -E "^(FAIL|PASS)|Error" "$SMOKE_OUT" | cut -c1-300
      echo
      echo "SMOKE FAILED on $LATEST. To go back:  az containerapp update -g $RG -n $APP --image $PREVIOUS_IMAGE"
      exit 2
    fi
  fi
fi
