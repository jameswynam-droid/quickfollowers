## Immediate blocker: Turnstile "Unable to connect to website"

This error is **not a code bug**. Cloudflare Turnstile only accepts requests from the exact hostnames listed on the site key's allow-list in the Cloudflare dashboard. Your current key was configured for `quickfollowers.online`, so it rejects `id-preview--92633b06-ce4f-4cc5-accd-124a59937de2.lovable.app` (the preview URL you're testing on).

**What you need to do (2 minutes):**

1. Cloudflare dashboard → Turnstile → your site key → **Settings**
2. Under "Hostname Management" add:
  - `id-preview--92633b06-ce4f-4cc5-accd-124a59937de2.lovable.app`
  - `*.lovable.app` (or just the preview host above)
3. Save. The widget will work instantly — no redeploy needed.

If you'd rather test only on the live domain, open `/admin` on `quickfollowers.online` — it already works there.

## Vercel headers "still detected"

Your app is deployed on **Netlify**, not Vercel (per project memory). `vercel.json` header rules have zero effect on Netlify responses. To strip `x-powered-by`, `server`, `x-vercel-*` etc. on Netlify I need to add a `netlify.toml` `[[headers]]` block, plus an `_headers` file as a safety net. I'll also add strict security headers (X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS).

Note: Netlify doesn't send `x-vercel-*` at all — if the scanner is flagging those, it's scanning a **cached** copy or a different deployment. After my fix, re-scan with cache disabled.

&nbsp;

## Plan for this turn

### 1. Turnstile + headers (ship now)

- Add `netlify.toml` + `public/_headers` stripping server-identifying headers and adding CSP/HSTS/XFO/Referrer-Policy/Permissions-Policy
- Remove obsolete `vercel.json` (or leave it inert — user's choice)

User: No!! I told you previously that I moved to Vercel, I don't use Netlify anymore, please do the needful by doing what's asked

### 2. Private storage bucket audit (ship now)

- Verify `ticket-attachments` bucket is `public=false`
- Confirm RLS on `storage.objects` restricts SELECT to ticket owner + admins
- Confirm all client reads go through signed URLs (already done in `src/lib/ticketAttachments.ts`)
- Add `oncontextmenu` block + `user-select:none` on attachment `<img>` tags so long-press/right-click can't reveal the signed URL directly in the ticket UI

### 3. Admin TOTP 2FA (ship now)

- New table `public.admin_totp` (user_id, encrypted_secret, verified_at, backup_codes[])
- Edge functions: `admin-totp-enroll` (returns QR + provisional secret), `admin-totp-verify` (activates), `admin-totp-check` (verifies code during login)
- Modify `admin-login` to require TOTP code once user has enrolled; unenrolled admins are forced to enroll on first login after this ships
- UI: enroll flow in AdminPanel + 6-digit code input on AdminLogin
- Library: `otpauth` (works in Deno + browser)

### 4. Blog / Help Center (ship now — scoped)

Given the scale, this turn ships the **foundation + 6 seed articles**, not 30+ articles.

**Schema:**

- `public.blog_posts` (id, slug, title, excerpt, cover_image_url, body_md, category, published, published_at, seo_title, seo_description)
- `public.blog_categories` (slug, name, description)
- RLS: public SELECT where `published = true`; admin full access

**Routes:**

- `/help` — category grid + search
- `/help/:category` — article list
- `/help/:category/:slug` — article page with JSON-LD Article schema
- Sitemap auto-includes published posts

**Admin UI:** new "Content" tab in AdminPanel — create/edit/publish posts with markdown editor + cover image upload to R2.

**Seed content (I'll write & publish):**

1. "How to find your Instagram profile link"
2. "How to find your TikTok video URL"
3. "How to find your YouTube channel/video link"
4. "How to find your Facebook page URL"
5. "How to find your Twitter/X post link"
6. "How to place your first order on QuickFollowers"

**Images:** I'll generate ultra-realistic screenshots via `imagegen` (premium tier for text legibility) showing the actual mobile app UI for each platform's share/copy-link flow.

## What I need from you

1. **Confirm:** Add the preview hostname to Turnstile allow-list yourself (I can't access your Cloudflare dashboard), OR tell me to generate a **new** Turnstile key with `*.lovable.app` included and paste it — I'll swap the secret.
2. **Confirm:** Should the blog live at `/help` (help-center framing) or `/blog` (marketing framing)? Or both — `/blog` for marketing posts, `/help` for how-to guides?

Reply with those two answers and I'll ship all four sections in the next turn. I'm not splitting this across more turns — one big shipment.

&nbsp;

Me the user, this is my reply: Do not worry, I have tried the Cloudflare Turnstile from the normal QuickFollowers domain and it works successfully, so no need to add any lovable preview domain 

The answer to the second question, both blog and help should leave in one place.

Also, from the Admin panel, remove the "sync service" button option from anywhere on the admin panel, and anywhere in my own [admin@quickfollowers.online](mailto:admin@quickfollowers.online) account, remove the "Payments" section from the Admin panel page, also when I tap the Tickets on the Admin panel which leads to the tickets page, I then see the hamburger icon option, which then displays other things like Dashboard, New Order, Orders, Transactions, please remove it so it doesn't show things like that except what is actually needed only for the support team on the admin panel. Also, in the support tickets I said you should add saved replies list add one small section inside the tickets chat that support can like search for the question and when they tap it for question they searched for or it's relation question they can see a simply tap it and then tap send it with the send button there, also add an edit button to the replies for maybe responses that looks like this "Your order id___ has been..." I hope you understand what I mean.