#!/usr/bin/env bash
#
# Backup harian pg_dump → R2 (S3-compatible). "Backup yang tidak pernah
# diuji restore = tidak ada backup" — jalankan scripts/restore-check.sh.
#
# Env: DATABASE_URL (Wajib, bisa pg://...), R2_ENDPOINT, R2_BUCKET,
#      R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PREFIX
#
set -euo pipefail

DB_URL="${DATABASE_URL:?DATABASE_URL wajib diisi}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
DUMP="rawatin-${STAMP}.sql.gz"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "→ pg_dump $DB_URL → $TMPDIR/$DUMP"
pg_dump --no-owner --no-privileges "$DB_URL" | gzip -9 > "$TMPDIR/$DUMP"

if command -v aws >/dev/null 2>&1 && [[ -n "${R2_ACCESS_KEY_ID:-}" ]]; then
  echo "→ upload ke R2 (bucket=$R2_BUCKET key=${R2_PREFIX:-backups}/$DUMP)"
  AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  aws --endpoint-url "$R2_ENDPOINT" s3 cp "$TMPDIR/$DUMP" "s3://$R2_BUCKET/${R2_PREFIX:-backups}/$DUMP"
else
  echo "⚠  aws CLI / R2_ACCESS_KEY_ID tidak ditemukan — hanya menyimpan dump lokal."
fi

# Simpan salinan lokal juga (untuk uji restore & audit cepat)
mkdir -p ./backups
cp "$TMPDIR/$DUMP" "./backups/$DUMP"
echo "✓ Backup selesai: backups/$DUMP"
ls -la backups/ | tail -3
