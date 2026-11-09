#!/bin/sh
set -eu
umask 077
backup_dir=/opt/aisubscr/backups
mkdir -p "$backup_dir"
sqlite3 /opt/aisubscr/prisma/production.db ".backup '$backup_dir/aisubscr-$(date +%F-%H%M%S).sqlite3'"
find "$backup_dir" -maxdepth 1 -name 'aisubscr-*.sqlite3' -type f -mtime +13 -delete
