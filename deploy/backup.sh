#!/usr/bin/env bash
# Nightly backup of the database and uploaded files (photos, resumes), kept on this server
# and copied to a second machine in Uzbekistan. Run from cron as the deploy user:
#
#   30 3 * * * BACKUP_REMOTE=backup@10.0.0.5:/srv/backups/autodoc /var/www/autodoc-admin/deploy/backup.sh
#
# Keeps 14 daily and 8 weekly copies. Restore (into a scratch database first!):
#   pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" db_<stamp>.dump
#   tar -C /var/www/autodoc-admin/api -xzf storage_<stamp>.tar.gz
set -euo pipefail

: "${BACKUP_REMOTE:?set BACKUP_REMOTE, e.g. backup@10.0.0.5:/srv/backups/autodoc}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/autodoc}"
APP_DIR="${APP_DIR:-/var/www/autodoc-admin/api}"

# DATABASE_URL lives in the API's .env.
set -a
# shellcheck disable=SC1091
. "$APP_DIR/.env"
set +a

stamp="$(date +%F_%H%M)"
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"

pg_dump --format=custom --no-owner --file="$BACKUP_DIR/daily/db_$stamp.dump" "$DATABASE_URL"
if [ -d "$APP_DIR/storage" ]; then
  tar -C "$APP_DIR" -czf "$BACKUP_DIR/daily/storage_$stamp.tar.gz" storage
fi

# Sundays also go to the weekly set.
if [ "$(date +%u)" = 7 ]; then
  cp "$BACKUP_DIR/daily/"*"_$stamp".* "$BACKUP_DIR/weekly/"
fi

find "$BACKUP_DIR/daily" -type f -mtime +14 -delete
find "$BACKUP_DIR/weekly" -type f -mtime +56 -delete

# Mirror, so deletions (expired copies, and data removed by the retention jobs) reach the copy too.
rsync -a --delete "$BACKUP_DIR/" "$BACKUP_REMOTE/"
echo "Backup $stamp done."
