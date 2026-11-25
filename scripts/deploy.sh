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
# Only a push to main can sign in to Azure (CLAUDE.md rule 9): a push of the same commit to another branch starts a run that
# fails at login. Without this filter that run, being the newest for the commit, was read as "the build failed" (25 November 2026).
BRANCH=${BRANCH:-main}
# Only what goes into the image has to be committed: a change in docs/ or eval/ cannot make the image differ from HEAD.
IMAGE_INPUTS=(Dockerfile .dockerignore package.json package-lock.json server agent src public index.html vite.config.ts tsconfig.json data/foods-usda/foods_usda.json data/foods-usda/branded_common.json data/foods-usda/restaurant_items.json data/recipes-db)
git diff --quiet HEAD -- "${IMAGE_INPUTS[@]}" || { echo "an input of the image is not committed — commit first"; git diff --stat HEAD -- "${IMAGE_INPUTS[@]}" | tail -5; exit 1; }

# The workflow only builds when the image's inputs change, so a commit that
# touches docs or .gitignore never produces a run. Deploy the image of the
# most recent commit that did: its contents are what HEAD would produce.
# A push does not create its build run at once. Without this wait, `gh run list` answers
# "nothing" for a fresh HEAD, the loop below concludes the image did not change, and the
# previous commit's image goes live instead (it did, on 11 October: the recipes were
# in the commit and the old catalogue was in the app).
if git diff-tree --no-commit-id --name-only -r HEAD | grep -qE '^(\.github/workflows/build-engine\.yml|Dockerfile|\.dockerignore|package(-lock)?\.json|server/|agent/|src/|data/foods-usda/(foods_usda|branded_common|restaurant_items)\.json|data/recipes-db/(ingredients|recipes_db|portion_mapping|gi_crosscheck)\.json|data/recipes-db/embeddings\.|index\.html|public/|vite\.config\.ts|tsconfig\.json)'; then
  for _ in $(seq 1 18); do
    gh run list --repo "$REPO" --workflow build-engine --branch "$BRANCH" --commit "$(git rev-parse HEAD)" --limit 1 \
      --json status -q '.[0].status' 2>/dev/null | grep -q . && break
    echo "HEAD changes the image but its build has not started; waiting…"; sleep 10
  done
fi

SHA=""
for candidate in $(git log -20 --format=%H); do
  if gh run list --repo "$REPO" --workflow build-engine --branch "$BRANCH" --commit "$candidate" --limit 1 \
       --json status -q '.[0].status' 2>/dev/null | grep -q .; then
    SHA=$candidate
    break
  fi
done
[ -n "$SHA" ] || { echo "no build found for HEAD or the 20 commits before it"; exit 1; }
# Several commits pushed at once get one build, at the tip. If anything between the last built commit and HEAD
# changes the image, that build is HEAD's, and it may not have started yet: wait for it rather than ship the older image
# (24 November 2026: an engine change two commits under an eval-only HEAD was skipped, and the old image went live).
IMAGE_PATHS='^(\.github/workflows/build-engine\.yml|Dockerfile|\.dockerignore|package(-lock)?\.json|server/|agent/|src/|data/foods-usda/(foods_usda|branded_common|restaurant_items)\.json|data/recipes-db/(ingredients|recipes_db|portion_mapping|gi_crosscheck)\.json|data/recipes-db/embeddings\.|index\.html|public/|vite\.config\.ts|tsconfig\.json)'
if [ "$SHA" != "$(git rev-parse HEAD)" ] && git diff --name-only "$SHA" HEAD | grep -qE "$IMAGE_PATHS"; then
  echo "commits after $SHA change the image; waiting for HEAD's build…"
  for _ in $(seq 1 30); do
    gh run list --repo "$REPO" --workflow build-engine --branch "$BRANCH" --commit "$(git rev-parse HEAD)" --limit 1 \
      --json status -q '.[0].status' 2>/dev/null | grep -q . && { SHA=$(git rev-parse HEAD); break; }
    sleep 10
  done
  [ "$SHA" = "$(git rev-parse HEAD)" ] || { echo "HEAD changes the image and has no build; push it, or check the workflow"; exit 1; }
fi
[ "$SHA" = "$(git rev-parse HEAD)" ] && echo "commit  $SHA" || echo "commit  $SHA (HEAD changed nothing the image is built from)"

echo "waiting for that build…"
for _ in $(seq 1 60); do
  read -r STATUS CONCLUSION <<<"$(gh run list --repo "$REPO" --workflow build-engine --branch "$BRANCH" --commit "$SHA" \
    --limit 1 --json status,conclusion -q '.[0] | "\(.status) \(.conclusion // "-")"' 2>/dev/null || echo "missing -")"
  [ "$STATUS" = "completed" ] && break
  sleep 20
done
[ "${CONCLUSION:-}" = "success" ] || { echo "build for $SHA is $STATUS/$CONCLUSION — not deploying"; exit 1; }

echo "deploying…"
# Blue-green (26 November 2026, asked by the team): the new version starts beside the old one with no traffic, is checked on its own
# address, and only then takes the traffic, all at once. The old one keeps running for 15 minutes, for requests in flight and an instant
# way back, and is then switched off. A version that fails its checks never reaches a person. Needs the app in multiple-revision mode with
# its traffic pinned to a named revision (docs/engineering/blue-green-deploy.md); in single mode the new revision would take the traffic
# the moment it started, which is what this replaces.
MODE=$(az containerapp show -g "$RG" -n "$APP" --query properties.configuration.activeRevisionsMode -o tsv)
[ "$MODE" = "Multiple" ] || { echo "the app is in $MODE revision mode; blue-green needs Multiple (docs/engineering/blue-green-deploy.md)"; exit 1; }
FQDN=$(az containerapp show -g "$RG" -n "$APP" --query properties.configuration.ingress.fqdn -o tsv)
OLD=$(az containerapp ingress traffic show -g "$RG" -n "$APP" --query "[?weight > \`0\`].revisionName | [0]" -o tsv)
[ -n "$OLD" ] || { echo "no named revision holds the traffic (traffic follows 'latest'?); pin it first (docs/engineering/blue-green-deploy.md)"; exit 1; }
SUFFIX="g${SHA:0:7}-$(date +%m%d%H%M)"
NEW="$APP--$SUFFIX"
az containerapp update -g "$RG" -n "$APP" --image "$REGISTRY/$APP:$SHA" --revision-suffix "$SUFFIX" -o none
NEWFQDN=$(az containerapp revision show -g "$RG" -n "$APP" --revision "$NEW" --query properties.fqdn -o tsv)
echo "new     $NEW (no traffic yet; $OLD still serves everyone)"

# The new version, on its own address: six good answers in a row from /health and the page, then the smoke test.
GOOD=0
for _ in $(seq 1 90); do
  if curl -s -m 10 "https://$NEWFQDN/health" | grep -q "\"revision\":\"$NEW\"" && curl -s -m 10 -o /dev/null -w '%{http_code}' "https://$NEWFQDN/" | grep -q '^200$'; then GOOD=$((GOOD+1)); else GOOD=0; fi
  [ "$GOOD" -ge 6 ] && break
  sleep 4
done
if [ "$GOOD" -lt 6 ]; then
  echo "$NEW never answered on its own address; switching it off. Nobody saw it: $OLD still has all the traffic."
  az containerapp revision deactivate -g "$RG" -n "$APP" --revision "$NEW" -o none 2>/dev/null || true
  exit 1
fi
if [ -z "${SKIP_SMOKE:-}" ] && command -v node >/dev/null 2>&1; then
  SMOKE_OUT="$(mktemp)"
  if ! node eval/smoke.mjs "https://$NEWFQDN" >"$SMOKE_OUT" 2>&1; then
    echo "smoke: FIRST TRY FAILED on $NEW:"; grep -E "^(FAIL|[A-Za-z]*Error)" "$SMOKE_OUT" | cut -c1-300
    echo "retrying once in 30 s"; sleep 30
    if ! node eval/smoke.mjs "https://$NEWFQDN" >"$SMOKE_OUT" 2>&1; then
      grep -E "^(FAIL|PASS)|Error" "$SMOKE_OUT" | cut -c1-300
      echo "SMOKE FAILED on $NEW; switching it off. Nobody saw it: $OLD still has all the traffic."
      az containerapp revision deactivate -g "$RG" -n "$APP" --revision "$NEW" -o none 2>/dev/null || true
      exit 2
    fi
    echo "smoke: passed on the SECOND try on $NEW (see the failure above)"
  else
    echo "smoke: passed on $NEW, before it took any traffic"
  fi
fi

# All at once.
az containerapp ingress traffic set -g "$RG" -n "$APP" --revision-weight "$NEW=100" -o none
echo "traffic: $NEW 100%"
echo "to go back in the next 15 minutes:  az containerapp ingress traffic set -g $RG -n $APP --revision-weight $OLD=100"
# Anything older than the version just replaced is switched off now; the replaced one in 15 minutes, unless it took the traffic back.
for r in $(az containerapp revision list -g "$RG" -n "$APP" --query "[?properties.active].name" -o tsv); do
  [ "$r" = "$NEW" ] || [ "$r" = "$OLD" ] || az containerapp revision deactivate -g "$RG" -n "$APP" --revision "$r" -o none 2>/dev/null || true
done
nohup bash -c "sleep 900; W=\$(az containerapp ingress traffic show -g $RG -n $APP --query \"[?revisionName=='$OLD'].weight | [0]\" -o tsv); [ \"\$W\" = 0 ] || [ -z \"\$W\" ] && az containerapp revision deactivate -g $RG -n $APP --revision $OLD -o none" >/dev/null 2>&1 &
echo "$OLD switches off at $(date -v+15M +%H:%M 2>/dev/null || date -d '+15 min' +%H:%M)"

# The address people use: it must now be the new version, the page and /health, several times in a row.
GOOD=0
for _ in $(seq 1 30); do
  if curl -s -m 10 "https://$FQDN/health" | grep -q "\"revision\":\"$NEW\"" && curl -s -m 10 -o /dev/null -w '%{http_code}' "https://$FQDN/" | grep -q '^200$'; then GOOD=$((GOOD+1)); else GOOD=0; fi
  [ "$GOOD" -ge 6 ] && break
  sleep 3
done
[ "$GOOD" -ge 6 ] || { echo "the public address does not answer from $NEW yet; check, and go back with the command above if needed"; exit 1; }
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
      echo "SMOKE FAILED on the public address, now $NEW. To go back:  az containerapp ingress traffic set -g $RG -n $APP --revision-weight $OLD=100"
      exit 2
    fi
  fi
fi
