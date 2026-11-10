#!/bin/sh
set -eu
umask 077
# Shared database after the cutover in docs/DEPLOY.md. Override AISUBSCR_DB if the file lives elsewhere.
db="${AISUBSCR_DB:-/opt/aisubscr-shared/production.db}"
backup_dir="${AISUBSCR_BACKUP_DIR:-/opt/aisubscr/backups}"
mkdir -p "$backup_dir"
sqlite3 "$db" ".backup '$backup_dir/aisubscr-$(date +%F-%H%M%S).sqlite3'"
find "$backup_dir" -maxdepth 1 -name 'aisubscr-*.sqlite3' -type f -mtime +13 -delete
