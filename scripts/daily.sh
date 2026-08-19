#!/usr/bin/env bash
# ============================================================
#  BioStar — daily automation
#  Publishes the next 5 profiles, refreshes every live page,
#  rebuilds the static site and (optionally) deploys it.
#
#  Run manually:   ./scripts/daily.sh
#  Run from cron:  see DEPLOY.md
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

LOG="logs/daily-$(date +%F).log"
mkdir -p logs
exec > >(tee -a "$LOG") 2>&1

echo "=============================================="
echo " BioStar daily run — $(date '+%F %H:%M:%S')"
echo "=============================================="

# Once a week (Sundays) re-pull source records so facts stay current.
if [ "$(date +%u)" = "7" ]; then
  echo "▶ Sunday: refreshing source records (7-day cache)…"
  CACHE_DAYS=7 node scripts/02-fetch-facts.mjs
  node scripts/02b-enrich-works.mjs || echo "  (works enrichment skipped)"
fi

echo "▶ Regenerating posts (new queue items + refresh of live pages)…"
node scripts/03-generate-posts.mjs

echo "▶ Images…"
node scripts/04-make-covers.mjs

echo "▶ Publishing today's batch…"
node scripts/05-publish-daily.mjs

echo "▶ Building static site…"
npm run build --silent

echo "▶ Deploying…"
if [ -n "${DEPLOY_CMD:-}" ]; then
  eval "$DEPLOY_CMD"
elif command -v wrangler >/dev/null 2>&1 && [ -n "${CF_PAGES_PROJECT:-}" ]; then
  wrangler pages deploy dist --project-name "$CF_PAGES_PROJECT" --commit-dirty=true
elif [ -d .git ]; then
  git add -A && git commit -q -m "content: daily publish $(date +%F)" || echo "  nothing to commit"
  git push origin HEAD && echo "  pushed — host will rebuild"
else
  echo "  no deploy target configured (set DEPLOY_CMD or CF_PAGES_PROJECT) — dist/ is ready"
fi

echo "✅ Done — $(date '+%F %H:%M:%S')"
