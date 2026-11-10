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
  # Routine releases use scripts/deploy.sh. See docs/DEPLOY.md. Do not seed.
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

Password-reset, login, and registration rate limits resolve the visitor the same way. nginx's `X-Real-IP` wins when it is already the visitor. When it is still a Cloudflare edge address, the app uses `CF-Connecting-IP`, then the rightmost non-proxy `X-Forwarded-For` hop. A client who connects to the origin cannot override `X-Real-IP` by sending `CF-Connecting-IP`. Include `deploy/nginx-cloudflare-realip.conf` from the TLS server block so `X-Real-IP` is the visitor even if `CF-Connecting-IP` is absent, then `nginx -t && systemctl reload nginx`.

## Dependency audit (2026-11-10)

Before: `npm audit` reported 8 (7 moderate, 1 high). `npm audit --omit=dev` reported 2 (Next moderate, via PostCSS, and PostCSS high). After this release both commands report 0.

Next 15.5.29 has no patched release; the advisory's upstream fix is Next 16.4.6. `postcss` is overridden to 8.5.32, the patched 8.x line Next already uses. The dev-only minimatch advisory (`GHSA-g3hv-75wg-m249`, fixed in 11.0.1) sits under `@typescript-eslint/typescript-estree@8.72.2`, which declares `minimatch@^10.2.2`. `npm audit fix` will not cross that range. The override pins minimatch 11.0.5 for that package only. ESLint still runs.

## Security headers and auth limits (2026-11-10)

No nginx change is required for the headers. The app sets CSP, `X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options`, and `Permissions-Policy`. HSTS (`max-age=63072000; includeSubDomains`) is added only when the request is HTTPS or `X-Forwarded-Proto` is `https`.

Session cookie remains `aisubscr_session` with `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` when `NODE_ENV=production`. Before restarting, confirm `SESSION_SECRET` in `/opt/aisubscr/.env` is unique and at least 32 characters. The process will not issue sessions if it is missing, shorter, the dev fallback, or the `.env.example` placeholder.

On a database that already has the baseline migration recorded:

```bash
cd /opt/aisubscr
/usr/local/sbin/aisubscr-backup
npx prisma migrate deploy
npm run build
systemctl restart aisubscr
```

`migrate deploy` adds `AuthRateEvent` only. Do not run `db:seed` or `db:setup`.

## Payment notices (2026-11-10)

`npx prisma migrate deploy` also applies `20261110143000_payment_notices`, which creates `PaymentNotice` only. Checkout stays on the mock provider. Leave `PAYMENT_PROVIDER=mock`. The `WECHAT_PAY_*` and `ALIPAY_*` placeholders in `.env.example` stay empty. Do not commit merchant secrets. HTML responses stay `private, no-store` because of the CSP nonce; `/_next/static` keeps a one-year immutable cache for Cloudflare.

## Coupons, unpaid-order expiry, and support pages (2026-11-10)

`npx prisma migrate deploy` applies `20261110210000_coupons_support_expiry`. It adds coupon tables, FAQ rows, contact and announcement columns, and order discount / expiry columns. It does not insert promo codes, FAQ text, or legal copy. Do not run `db:seed` or `db:setup`.

## Admin 2FA, image uploads, SQLite, and internal routes (2026-11-10)

`npx prisma migrate deploy` applies `20261110233000_admin_totp_uploads_indexes`. It adds TOTP columns, `TotpRecoveryCode`, `SiteSetting.qrImageUrl`, `SiteSetting.adminTotpRequired`, and order indexes on `(userId, createdAt)`, `(userId, status, createdAt)`, and `(status, createdAt)`. `Coupon.code` and `AuditLog.createdAt` were already indexed. It does not insert users or turn 2FA on. Do not run `db:seed` or `db:setup`.

New environment variables, all optional:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_PUBLIC_BUCKET`
- `R2_PUBLIC_BASE_URL`

Leave them empty to store uploads in `public/uploads`. Setup is in `deploy/UPLOADS.md`. Set `R2_PUBLIC_BASE_URL` before `npm run build` when using R2, because the CSP image origin is read at build time. Rotating `SESSION_SECRET` makes existing authenticator secrets undecryptable; recovery codes still work so an admin can sign in and enroll again.

The app enables SQLite WAL (`PRAGMA journal_mode=WAL`) and a 5 second busy timeout (`socket_timeout=5` on the Prisma connection, plus `PRAGMA busy_timeout=5000`). WAL files (`production.db-wal` and `production.db-shm`) sit next to the database. The existing backup script should keep using the SQLite backup API so those files stay consistent.

Reload nginx after copying `deploy/nginx-http.conf` and `deploy/nginx-https.conf`. `/api/internal/` is allowed only from `127.0.0.1` and `::1`. The expire cron should keep using `scripts/expire-orders.ts` or `curl` to `http://127.0.0.1:3000`. A public `https://aisubscr.com/api/internal/...` call is denied by nginx. See `deploy/CRON.md`.

```bash
cd /opt/aisubscr
/usr/local/sbin/aisubscr-backup
npx prisma migrate deploy
npm run build
nginx -t && systemctl reload nginx
systemctl restart aisubscr
```

Unpaid orders expire after 30 minutes unless admin settings or `ORDER_EXPIRE_MINUTES` say otherwise. Install the cron from `deploy/CRON.md`. A visit to an order page also expires due orders, so the cron is the backstop. Promo-code uses are counted inside the order transaction and returned if the order expires or is cancelled before payment.
