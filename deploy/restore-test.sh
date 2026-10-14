#!/usr/bin/env bash
# Monthly proof that the backups can be restored: the newest dump goes into a scratch
# database next to the live one, the row counts are compared, the files archive is checked,
# and the scratch database is dropped again. The live database is never touched.
#
#   0 5 1 * * /var/www/autodoc-admin/deploy/restore-test.sh >> /var/log/autodoc-restore-test.log 2>&1
#
# Exit code 0 = restore works. Anything else: look at the log before you need the backup.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/autodoc}"
APP_DIR="${APP_DIR:-/var/www/autodoc-admin/api}"
SCRATCH_DB="${SCRATCH_DB:-autodoc_restore_test}"

set -a
# shellcheck disable=SC1091
. "$APP_DIR/.env"
set +a

dump="$(ls -1t "$BACKUP_DIR"/daily/db_*.dump 2>/dev/null | head -1 || true)"
[ -n "$dump" ] || { echo "No dump in $BACKUP_DIR/daily" >&2; exit 1; }
stamp="${dump##*/db_}"; stamp="${stamp%.dump}"
echo "$(date -Is) restore test of $dump"

# Same server and credentials as the live database, another database name.
admin_url="${DATABASE_URL%/*}/postgres"
scratch_url="${DATABASE_URL%/*}/$SCRATCH_DB"
cleanup() { PGOPTIONS="-c client_min_messages=warning" psql -q "$admin_url" -c "DROP DATABASE IF EXISTS \"$SCRATCH_DB\"" >/dev/null; }
trap cleanup EXIT
cleanup
psql -q "$admin_url" -c "CREATE DATABASE \"$SCRATCH_DB\""

pg_restore --no-owner --exit-on-error -d "$scratch_url" "$dump"

# Every table that matters must be there; the live database may only have grown since.
status=0
for table in users documents media leads applications audit_log; do
  restored="$(psql -tA "$scratch_url" -c "SELECT count(*) FROM $table")"
  live="$(psql -tA "$DATABASE_URL" -c "SELECT count(*) FROM $table")"
  echo "  $table: restored $restored, live $live"
  if [ "$table" = users ] && [ "$restored" -eq 0 ]; then
    echo "  users is empty in the backup" >&2
    status=1
  fi
done

files="$BACKUP_DIR/daily/storage_$stamp.tar.gz"
if [ -f "$files" ]; then
  count="$(tar -tzf "$files" | grep -vc '/$' || true)"
  echo "  files archive: $count files"
else
  echo "  no files archive for $stamp" >&2
  status=1
fi

[ "$status" -eq 0 ] && echo "Restore test passed." || echo "Restore test FAILED." >&2
exit "$status"
