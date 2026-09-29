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
az containerapp update -g "$RG" -n "$APP" --image "$REGISTRY/$APP:$SHA" --query properties.latestRevisionName -o tsv >/dev/null

LATEST=$(az containerapp show -g "$RG" -n "$APP" --query properties.latestRevisionName -o tsv)
for r in $(az containerapp revision list -g "$RG" -n "$APP" --query "[?properties.active].name" -o tsv); do
  [ "$r" = "$LATEST" ] || az containerapp revision deactivate -g "$RG" -n "$APP" --revision "$r" >/dev/null 2>&1
done

FQDN=$(az containerapp show -g "$RG" -n "$APP" --query properties.configuration.ingress.fqdn -o tsv)
echo "waiting for $LATEST to answer…"
for _ in $(seq 1 30); do
  if curl -fsS -m 15 "https://$FQDN/health" 2>/dev/null | grep -q '"ok":true'; then
    echo "live: $(curl -s -m 15 "https://$FQDN/health")"
    exit 0
  fi
  sleep 12
done

echo "revision never answered; its state:"
az containerapp revision show -g "$RG" -n "$APP" --revision "$LATEST" --query "properties.runningState" -o tsv
exit 1
