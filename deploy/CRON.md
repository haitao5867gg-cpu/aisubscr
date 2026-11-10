# Expire unpaid orders

Unpaid orders (`PENDING` or `PAYING`) close after the window in admin settings (default 30 minutes). `ORDER_EXPIRE_MINUTES` overrides that setting when it is a whole number from 1 to 1440. Closing an order sets it to `EXPIRED` and, in the same transaction, puts finite stock back and returns a reserved promo-code use. The sweep is idempotent: a second run does not release stock or a code again.

Shoppers also trigger the sweep when they open an order list, an order page, or the public order link. A cron should still run so orders close even when nobody visits.

Preferred on the origin, every five minutes, as root. The script reads `DATABASE_URL` from the app env file and does not need `CRON_SECRET`. It wraps the sweep in an async `main` so `tsx` can run it as CommonJS (top-level await is rejected in that mode):

```
*/5 * * * * root bash -lc 'set -a && . /opt/aisubscr/.env && set +a && cd /opt/aisubscr && /usr/bin/npx tsx scripts/expire-orders.ts' >> /var/log/aisubscr-expire.log 2>&1
```

HTTP alternative, only from the origin host. Put a secret of at least 16 characters in `/opt/aisubscr/.env` as `CRON_SECRET`. The route answers 404 when that variable is missing, and 401 when the bearer token does not match. nginx also denies `/api/internal/` unless the TCP peer is localhost (`deploy/nginx-http.conf` and `deploy/nginx-https.conf`), so a request that arrives through Cloudflare is rejected before the app. Call the app directly on the box. Do not put the secret on the `curl` command line if process listings are visible to other users; a header file mode `0600` avoids that:

```
*/5 * * * * root curl -fsS -X POST --header @/etc/aisubscr/cron.header http://127.0.0.1:3000/api/internal/expire-orders >> /var/log/aisubscr-expire.log 2>&1
```

`/etc/aisubscr/cron.header` contains one line, mode `0600`, owner root:

```
Authorization: Bearer <CRON_SECRET>
```

Calling the endpoint again after a sweep returns `{ "ok": true, "expired": 0 }`. Do not run `db:seed` or `db:setup` as part of this job.
