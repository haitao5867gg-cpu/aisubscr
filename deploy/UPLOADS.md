# Product and support images

Admins upload product photos and the customer-service QR from the product and settings screens. The browser sends the file to `POST /api/admin/uploads`. The server checks the declared type and the file bytes, then stores a WebP.

Accepted input:

- JPEG, PNG, or WebP
- at most 5 MB
- the content type and the magic bytes must match (`FF D8 FF`, PNG signature, or `RIFF`/`WEBP`)
- `sharp` must be able to decode the file

Output:

- WebP, quality 80
- product images fit inside 1600×1600
- the support QR fits inside 800×800
- smaller images are not enlarged

## Cloudflare R2

Set all five variables in `/opt/aisubscr/.env`. If any one is missing or the public URL is not `https` in production, the app uses the local disk instead and does not call R2.

| Variable | Purpose |
| --- | --- |
| `R2_ACCOUNT_ID` | Account id in the S3 endpoint `https://<accountid>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | R2 access key id |
| `R2_SECRET_ACCESS_KEY` | R2 secret access key |
| `R2_PUBLIC_BUCKET` | Bucket the app can `PutObject` into |
| `R2_PUBLIC_BASE_URL` | Public base with no trailing slash, for example `https://cdn.aisubscr.com` |

Create an R2 bucket, turn on public access (r2.dev or a custom domain), and create an API token that can write objects in that bucket. The object key looks like `products/<uuid>.webp` or `contact-qr/<uuid>.webp`. The saved URL is `<R2_PUBLIC_BASE_URL>/<key>`.

Ticket screenshots are not uploaded to R2 and are not given a public URL. They are WebP files under `tickets/<uuid>.webp` on the local uploads disk. Customers and admins load them through `/api/tickets/attachments/<id>`, which checks the ticket owner or an enrolled admin.

The page CSP `img-src` includes the origin of `R2_PUBLIC_BASE_URL` plus `'self'`, `blob:`, and `data:`. Next inlines that origin when it builds middleware. Set the variable before `npm run build`. Changing the public URL later needs another build and `systemctl restart aisubscr`.

Do not commit the secret. Leave the placeholders in `.env.example` empty.

## Local disk

With R2 unset, product and QR files are written under `UPLOADS_DIR` (default `public/uploads/`) and the URL is `/uploads/...`. Ticket screenshots use the same directory but the public route refuses `tickets/`. `next start` does not serve files added to `public/` after the process starts, so a route handler reads the directory on each request. Product and QR filenames are UUIDs and the response is cached as immutable. The middleware skips `/uploads/` so those responses are not marked `private, no-store`. An optional nginx alias is in `docs/DEPLOY.md`; it must return 404 for `/uploads/tickets/`.

On the server:

```bash
mkdir -p /opt/aisubscr/public/uploads
chown -R aisubscr:aisubscr /opt/aisubscr/public/uploads
```

The systemd unit runs as `aisubscr` with `UMask=0077`. The process can read the files it writes. Back up this directory with the database if you are not using R2. Uploaded files are not in git.

`client_max_body_size` in the nginx site is 10m, which is above the 5 MB application limit.

## What is stored in SQLite

Product rows keep the URL in `Product.imageUrl`. The support QR prefers `SiteSetting.qrImageUrl`. Older rows that still have `qrImageData` keep working through `GET /api/contact-qr` until an admin uploads a replacement or clears the image. A new upload clears those legacy bytes.

Only same-site paths, or URLs under `R2_PUBLIC_BASE_URL`, can be saved. Other remote image URLs are rejected.
