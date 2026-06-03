All required secrets (R2_*, TURNSTILE_*) are saved. Execution will run in 7 waves so each is testable.

## Wave 1 — Auto-service order form (in-flight bug fix)
- Detect Auto services (`type` contains `subscription` or name contains `auto`) and Website Traffic with keywords (name/description contains `keyword`/`hashtag`).
- Replace **Link** input with **Username** for Auto services; hide Quantity, show: New Posts, Old Posts (Instagram only), Min, Max, Delay (minutes), Expiry (date).
- Show **Keywords** textarea (one per line) for Website Traffic.
- Live charge preview: `((min+max)/2) × posts × markedUpRate / 1000` for Auto; standard formula for traffic.
- Extend `place-order` edge function to accept `username, min, max, posts, old_posts, delay, expiry, keywords`. Switch provider `action` to `subscriptions` for Auto, keep `add` with `keywords` for traffic. Re-validate server-side.

## Wave 2 — Cloudflare R2 storage + URL hiding
- Edge functions: `r2-upload` (signed PUT, size/type validation: images 10MB, videos 50MB, ticket attachments 5MB), `r2-view` (5-min signed GET), `r2-delete`.
- Same-origin proxy route `r2-proxy` serving images so browsers see `quickfollowers.online/api/r2/<token>` instead of `*.r2.cloudflarestorage.com`.
- New table `r2_assets(id, key, bucket_prefix, owner_id, kind, size, content_type, created_at, expires_at)` with strict RLS (owner-only) + GRANTs + service_role policy.
- Daily `pg_cron` + `pg_net` job deletes ticket-kind assets older than 7 days from R2 and DB (scoped exception to the "no auto-cleanup" rule).
- Frontend helper `src/lib/r2.ts` (upload + resolve-via-proxy).
- Image protection on attachments in `Tickets.tsx` and `AdminTickets.tsx`: `onContextMenu={e => e.preventDefault()}`, `draggable={false}`, `user-select:none; -webkit-touch-callout:none`, served only through the proxy URL.
- Migrate popup uploads, service icons, and new ticket attachments to flow through `r2-upload`. Existing Supabase `ticket-attachments` bucket kept read-only as legacy for 7 days, then retired.

## Wave 3 — Blog / Help Center (20 articles, 4 categories)
- Tables: `blog_categories`, `blog_articles`, `blog_article_images` (RLS: public read where `status='published'`; admin write; GRANTs for anon SELECT on published rows + authenticated/service_role).
- Frontend routes `/help`, `/help/:category`, `/help/:category/:slug` with client-side fuse.js search, TOC, related articles, JSON-LD `Article` + `BreadcrumbList`.
- Admin CMS at `/admin/blog` (create/edit, draft/publish, R2 image upload).
- Seed 20 articles across **Getting Started**, **Platform Guides** (Instagram / TikTok / YouTube / Facebook / X / Telegram / Spotify), **Payments & Wallet**, **Troubleshooting & FAQs**. Hero + 3-6 inline images per article, generated with `imagegen` premium tier (ultra-realistic device mockups showing "where to find your Instagram profile link", "copy TikTok video URL", etc.).
- Sitemap updated with `/help` and every published article.

## Wave 4 — Category landing pages
- New file `src/data/categoryLandingData.ts` mapping each platform to followers/likes/views/comments/shares.
- Routes `/services/:platform/:category` rendered by extending `PlatformLanding.tsx`.
- JSON-LD `Service` + `BreadcrumbList`, OG image per category, all entries appended to sitemap.

## Wave 5 — Cloudflare Turnstile CAPTCHA
- Frontend `<Turnstile>` widget (sitekey from `TURNSTILE_SITE_KEY` as `VITE_TURNSTILE_SITE_KEY` constant) on Auth (signup + login), OTP request form, password reset request.
- New shared helper `verify-turnstile` (deno) calls `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
- Wire into `send-otp`, `reset-password`, and a new `verify-signup-captcha` guard called before `auth.signUp`. Reject with friendly error if invalid/expired.

## Wave 6 — Admin TOTP 2FA (mandatory, 7-day grace + recovery codes)
- Supabase native MFA (`auth.mfa.enroll/challenge/verify` TOTP).
- Table `admin_2fa_status(user_id, enrolled_at, grace_started_at, recovery_codes_hashed[])` (RLS: admin self-read/write).
- `RequireAdmin` guard: redirects to `/admin/setup-2fa` if not enrolled, blocks `/admin` past 7-day grace.
- Setup page: QR code, 6-digit verify, downloadable 10 backup codes (one-use, bcrypt-hashed).
- Login flow: after password, if admin + enrolled, prompt for TOTP before granting `/admin`.

## Wave 7 — Security scan + verification
- Run Supabase linter, fix all warnings tied to new tables/functions.
- Update `mem://` with: R2 storage, ticket 7-day auto-cleanup exception, blog/help-center, admin 2FA policy, Turnstile placements.

## Technical notes
- All new public-schema tables include GRANTs in the same migration (per Lovable Cloud rule).
- `R2_PUBLIC_HOSTNAME` is optional; if blank, fall back to signed-only proxy URLs.
- Edge functions deploy automatically; new ones default to `verify_jwt = false` and validate JWTs in code where needed.
- Frontend needs `VITE_TURNSTILE_SITE_KEY` constant (publishable) — will read from `import.meta.env` if exposed, otherwise hardcode the value the user pasted into the secret.

## Order
1 → 2 → 3 → 4 → 5 → 6 → 7. Each wave is a separate batch of edits so you can review/test between them.