#!/usr/bin/env bash
# Raise the per-address limits for a demo room on one Wi-Fi, and put them back.
#
#   bash scripts/demo-limits.sh on     # 300 asks / 10 min and 1,000 / day per address
#   bash scripts/demo-limits.sh off    # back to 30 / 10 min and 200 / day
#
# The daily ceiling on model turns (ASK_DAILY_CEILING, 1,000) is not touched, so the
# worst-case day costs the same either way. Per-person limits stay on. Each change makes a
# new revision; the script waits for it and asks the running service what it is serving.
set -euo pipefail
export PATH="/opt/homebrew/bin:$PATH"
RG=rg-nadia.babich92-5702; APP=diabite-engine
URL=https://diabite-engine.greenglacier-ab5551c6.swedencentral.azurecontainerapps.io
case "${1:-}" in
  on)  az containerapp update -g "$RG" -n "$APP" --set-env-vars ASK_IP_10MIN=300 ASK_IP_DAY=1000 -o none 2>/dev/null ;;
  off) az containerapp update -g "$RG" -n "$APP" --remove-env-vars ASK_IP_10MIN ASK_IP_DAY -o none 2>/dev/null ;;
  *)   echo "usage: $0 on|off"; exit 2 ;;
esac
for i in $(seq 1 30); do
  sleep 4
  curl -sf "$URL/health" >/dev/null && break
done
echo "live: $(curl -s "$URL/health")"
az containerapp show -g "$RG" -n "$APP" \
  --query "properties.template.containers[0].env[?starts_with(name,'ASK_')].{name:name,value:value}" -o table 2>/dev/null
echo "latest revision: $(az containerapp show -g "$RG" -n "$APP" --query properties.latestReadyRevisionName -o tsv 2>/dev/null)"
