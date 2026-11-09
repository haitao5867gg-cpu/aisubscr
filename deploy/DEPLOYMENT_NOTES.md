# aisubscr production deployment

Deployed 2026-11-09 (America/Los_Angeles).

- URL: https://aisubscr.com and https://www.aisubscr.com
- Origin: 186.244.241.245, Ubuntu 24.04.1 LTS
- Source: https://github.com/haitao5867gg-cpu/aisubscr, main commit 8a3a593 (PR #2)
- App: /opt/aisubscr; non-root user aisubscr; Node 22.23.4
- Service: /etc/systemd/system/aisubscr.service; enabled; Restart=always; app binds 127.0.0.1:3000
- Nginx site: /etc/nginx/sites-available/aisubscr
- Environment: /opt/aisubscr/.env (0600); canonical URLs https://aisubscr.com
- Database: /opt/aisubscr/prisma/production.db (0600)
- Credentials: /root/ADMIN_CREDENTIALS.txt (0600), box copy /workspace/aisubscr/ADMIN_CREDENTIALS_PROD.txt (0600, excluded from git)
- SSH key on box: /home/box/.ssh/aisubscr_ed25519; password login remains enabled.
- SSH override: /etc/ssh/sshd_config.d/00-aisubscr-auth.conf; original main config backed up at /etc/ssh/sshd_config.aisubscr-backup
- TLS: Let's Encrypt, /etc/letsencrypt/live/aisubscr.com/{fullchain,privkey}.pem; certbot.timer enabled; nginx reload hook installed; renewal dry run passed.
- Cloudflare: aisubscr.com zone cb3c588b31341950bf74488871edb8d4; apex/www A -> 186.244.241.245, proxied; SSL Full(strict); Always Use HTTPS on. Existing MX/TXT/DKIM preserved.
- Origin CA issuance was denied by connector permissions; no credentials workaround attempted. Let's Encrypt used instead.
- Backups: root-only /opt/aisubscr/backups; consistent SQLite backup via /usr/local/sbin/aisubscr-backup; cron /etc/cron.d/aisubscr-backup; 14-day retention. Cron runs 11:17 UTC = 03:17 PST / 04:17 PDT. Backups are currently local-only.
- UFW: 22/80/443 allowed, enabled. fail2ban active with sshd jail. 2 GiB persistent swap.
- Verification: home/login/products and www return 200, CSS asset 200; /admin redirects to /login?next=/admin which loads 200; systemctl restart recovery passed; service boot-enabled; live DB and backup integrity passed; three products and one admin seeded.
- Optional authenticated Python HTTP test was blocked by Cloudflare error 1010 (browser integrity), not an application response. No security controls were disabled; admin authenticated dashboard has not been end-to-end verified.
- npm audit --omit=dev reports 2 issues: Next (moderate, transitive) and PostCSS (high). Full npm ci audit reports 8 (7 moderate, 1 high). See production-audit.json. No automatic/breaking dependency upgrades applied.
- OS updates flag reboot required; server was not rebooted. Application restart was tested; boot enablement verified.
- No repository source changes needed; server git worktree clean. Operational config copies in this directory are not committed to GitHub.
- Mock payments and example content remain intentional. Do not treat as a real-payment shop.

Maintenance:
  ssh -i /home/box/.ssh/aisubscr_ed25519 root@186.244.241.245
  systemctl restart aisubscr
  journalctl -u aisubscr --no-pager
  /usr/local/sbin/aisubscr-backup
  certbot renew --dry-run --no-random-sleep-on-renew

WARNING: npm run db:setup re-runs seed and RESETS the admin password. Do not run it on production for routine updates. Use reviewed schema migrations instead.

## Password reset upgrade (existing production database)

Production was created with `prisma db push` and has no `_prisma_migrations` history. Do not run `npm run db:seed`, `npm run db:setup`, or `npx prisma db seed`.

From the new release, on the server:

```bash
cd /opt/aisubscr
/usr/local/sbin/aisubscr-backup
# code for this release is already checked out and dependencies installed
npx prisma migrate resolve --applied 20261109120000_baseline
npx prisma migrate deploy
npm run build
systemctl restart aisubscr
```

`migrate resolve` only records that the pre-reset schema is already present. It does not rewrite tables. `migrate deploy` then adds `User.sessionVersion` and the reset-code tables. Run `migrate resolve` once on this database. Later releases only need `npx prisma migrate deploy`.

`npx prisma migrate deploy` alone on this database stops with Prisma error P3005 and does not change data. That is expected until the baseline is marked applied.

Until Cloudflare Email Sending is ready, set `MAIL_PROVIDER=console` in `/opt/aisubscr/.env`. Real email is not sent; the reset code is written to `journalctl -u aisubscr`. Do not set `MAIL_PROVIDER=smtp` until `SMTP_*` and `MAIL_FROM` are in place. An SMTP failure is logged and is not replaced by the console provider. New variables are listed in `.env.example`.

Password-reset rate limits use `X-Real-IP`. Include `deploy/nginx-cloudflare-realip.conf` from the TLS server block so that address is the visitor, then `nginx -t && systemctl reload nginx`.
