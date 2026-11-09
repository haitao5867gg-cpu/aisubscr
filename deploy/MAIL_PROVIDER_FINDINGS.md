# Email Sending investigation — 2026-11-09 (PST)

No production changes or email sends were made during this investigation.

Cloudflare account: 437637ddfa120866a14f724c230ca713
Zone: aisubscr.com / cb3c588b31341950bf74488871edb8d4

Read-only connector checks:
- GET /accounts/437637ddfa120866a14f724c230ca713/email/sending/limits -> HTTP 403, code 10000, Authentication error.
- GET /zones/cb3c588b31341950bf74488871edb8d4/email/sending/subdomains -> HTTP 403, code 10000, Authentication error.
- DNS listing succeeds. Existing root SPF is v=spf1 include:_spf.mx.cloudflare.net ~all; three Cloudflare mail-routing MX records and cf2024-1._domainkey DKIM TXT exist. Apex and www proxied A records remain intact. No DNS records were changed.
- The connector reports that the credential is accepted but lacks access to these operations; reconnecting with the SAME permissions will not help. No retry through another authentication route attempted.

Provider setup is stopped. Account entitlement / Workers plan could not be established through the denied endpoints. Zone Free plan is NOT evidence of Workers billing plan.

Official documentation, fetched this turn:
1. https://developers.cloudflare.com/email-service/platform/pricing/index.md
   Arbitrary-recipient outbound mail requires Workers Paid; 3,000 emails/month included, then $0.35 per 1,000. Verified destination addresses are free but insufficient for arbitrary registered customers.
2. https://developers.cloudflare.com/email-service/get-started/send-emails/index.md
   Dashboard Compute > Email Service > Email Sending > Onboard Domain. DNS review includes cf-bounce MX/SPF, DKIM and _dmarc. Do not overwrite existing root routing/SPF/DKIM blindly. SMTP token requires Email Sending: Edit.
3. https://developers.cloudflare.com/email-service/api/send-emails/rest-api/index.md
   Node/non-Workers apps can POST /accounts/{account_id}/email/sending/send with a separately provisioned scoped bearer token. REST returns per-recipient delivered/permanent_bounces/queued arrays; HTTP success does not necessarily mean delivered.

To enable real mail later:
- Owner verifies/authorizes Workers Paid if not already active (no purchase made).
- Owner enables Email Sending and onboards aisubscr.com in the dashboard or grants appropriate Email Sending API permissions.
- Supply separate production mail credentials using a secure form; never extract connector credentials, put tokens in git, or report them.
- Sender can be noreply@aisubscr.com after domain onboarding.
- SMTP alternative: smtp.mx.cloudflare.net:465, username api_token, password an Email Sending: Edit API token, with TLS.

Until setup is complete, feature must explicitly use the requested server-log console fallback, and release notes must clearly state real emails are NOT sent. Do not silently fall back to logging after a real SMTP provider failure without documenting that policy.

Coding handoff caveats:
- Main at the prior deployment is 8a3a593; use current main remotely with a CloudAgent.
- Repository prisma/ currently has schema.prisma and seed.ts, but no migrations. Production was created with db push. The migration plan must safely baseline existing schema before new migrations, preserving all production data. NEVER seed or db:setup in production.
- No reset feature has been implemented or deployed by this executor; CloudAgent is not exposed in this executor tool set. Parent must launch coding work.
- Attach aisubscr-deploy-inputs.tar.gz for requested deploy/ operational files. It contains ONLY the existing notes/configs/script, no credentials or .env.

## Implementation note

Password reset mail is sent by `src/lib/mail`, selected with `MAIL_PROVIDER`:

- `console`, also the default when `MAIL_PROVIDER` and `SMTP_HOST` are both unset, logs the message on the server. Real email is not sent. The log line is prefixed `AISUBSCR_MAIL_CONSOLE` and includes the reset code.
- `smtp` uses nodemailer with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`. Cloudflare Email Sending is `smtp.mx.cloudflare.net:465`, username `api_token`, implicit TLS. The same settings work for Resend (`smtp.resend.com`, username `resend`) and Gmail.
- An SMTP or SMTP-config failure is logged without switching to the console provider, and the HTTP response stays the generic “如果该邮箱已注册，验证码已发送” so the form cannot be used to check which emails are registered. The unused code row is deleted.
