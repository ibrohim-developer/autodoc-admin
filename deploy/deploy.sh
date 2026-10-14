#!/usr/bin/env bash
# Runs on the server (by hand or from .gitlab-ci.yml): update, build, restart.
# Database migrations run when the API starts, so a deploy is just build + reload.
#
# Not zero-downtime: the API restarts for a few seconds. The dashboard build is replaced in
# place; open tabs keep working and pick up the new version on their next page load.
set -euo pipefail

cd "$(dirname "$0")/.."

git pull --ff-only
pnpm install --frozen-lockfile
pnpm --filter @autodoc/dashboard build
pnpm --filter @autodoc/api build
pm2 reload deploy/ecosystem.config.cjs --update-env

# The API answers only once migrations are done; fail the deploy if it doesn't come back.
for _ in $(seq 1 30); do
  if curl -fs http://127.0.0.1:4000/api/health > /dev/null; then
    echo "API is up."
    exit 0
  fi
  sleep 2
done
echo "API did not come back within 60 seconds: check 'pm2 logs autodoc-api'." >&2
exit 1
