#!/usr/bin/env bash
#
# Uji restore bulanan (checklist operasional): restore dump ke DB kosong,
# bandingkan jumlah baris. Aturan: backup yang tidak diuji = tidak ada backup.
#
set -euo pipefail

DUMP="${1:?Gunakan: scripts/restore-check.sh backups/rawatin-xxxx.sql.gz}"
SRC_URL="${DATABASE_URL:?DATABASE_URL wajib diisi}"
CHECK_DB="${CHECK_DB:-rawatin_restore_check}"

echo "→ membuat database uji: $CHECK_DB (akan di-drop lalu dibuat ulang)"
psql "$SRC_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $CHECK_DB;" >/dev/null
psql "$SRC_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE $CHECK_DB;" >/dev/null

CHECK_URL="$(echo "$SRC_URL" | sed -E "s#/[a-zA-Z0-9_]+([?#]|$)#/$CHECK_DB\1#")"
zcat "$DUMP" | psql "$CHECK_URL" -v ON_ERROR_STOP=1 >/dev/null

count() { psql "$CHECK_URL" -tA -c "select count(*) from $1" || echo 0; }
echo "   baris: tenants=$(count tenants) orders=$(count orders) customers=$(count customers) photos=$(count photos)"

echo "✓ Restore berhasil — dump valid."
psql "$SRC_URL" -c "DROP DATABASE $CHECK_DB;" >/dev/null
