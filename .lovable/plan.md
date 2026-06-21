## Scope (single build turn — no more questions)

### 1. Vercel reload 404 (highest priority)
Replace overly-narrow rewrite in `vercel.json` with the canonical SPA rewrite and disable `cleanUrls`:
```json
"cleanUrls": false,
"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
```
Keep existing headers, redirects, asset caching.

### 2. Standalone Admin Panel (new, isolated)
- New route `/admin` becomes a **dedicated login page** (no signup, no forgot password, no header/footer, minimal flat UI).
- Login fields: username + password + **Cloudflare Turnstile** widget (required). Uses existing `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` secrets.
- New edge function `admin-login`:
  - Verifies Turnstile token server-side.
  - Re-validates credentials via `signInWithPassword`.
  - Confirms `has_role(user_id,'admin')` — non-admins are rejected outright.
  - Returns a short-lived (4h) admin session JWT stored in `sessionStorage` under `qf_admin_session` (cleared on tab close).
- New route `/admin/panel` (and sub-routes) guarded by an `AdminGuard` that requires:
  1. The `qf_admin_session` token,
  2. A live Supabase session whose user has the `admin` role,
  3. Session not expired.
  Failing any check redirects to `/admin` login.
- Admin accounts **cannot place or buy orders**: `place-order` edge function rejects requests where the calling user has the `admin` role (returns 403 "Admin accounts cannot place orders").
- The current Admin tab in the regular user header is removed; admins access via `/admin` URL only.

### 3. Admin Panel features (existing + new)
Keep everything from current `Admin.tsx` (payments, sync services, all notification tabs, tickets link) and add:

**User Lookup tab**
- Search input by username OR email.
- Displays: full name, username, email, balance (in user's currency), reserved balance, signup date, last order date, role.
- **Order History section**: paginated list of selected user's orders (alias IDs only, no provider names).
- **Add Funds to User** form:
  - Amount + currency dropdown (uses existing currency list).
  - On submit, modal asks admin to **re-enter their admin password** + Turnstile retry.
  - New edge function `admin-credit-user` verifies password + admin role + Turnstile, then calls existing `process_deposit` RPC with `payment_method = 'admin_credit'` and a description like "Admin top-up by {admin_username}".
  - Creates a `transactions` row so user sees it in their history.

### 4. Per-post real charging in `sync-order-status`
For subscription orders with a row in `subscription_reservations`:
- Poll provider; on each newly-delivered post, compute `cost = per_post_qty * marked_up_rate / 1000`.
- If balance sufficient → debit, decrement `reserved_balance`, insert `transactions` row (`type='order_charge'`).
- If insufficient → mark that post `skipped`, bell-notify user, keep subscription running.
- On subscription end → release remaining `reserved_balance`.
- Add `posts_delivered`, `posts_charged`, `per_post_reserved` columns to `subscription_reservations`.

### 5. `/drip-feed` and `/subscriptions` pages
- New routes; filter `orders` by `order_kind`.
- Header + mobile-menu links **only render when the user has ≥1 order of that kind** (cheap count query, 5-min cache).

### 6. Saved ticket replies (admin)
- New table `admin_saved_replies` (admin_id, title, body, sort_order). RLS: admin owns rows.
- `AdminTickets.tsx`: dropdown above reply box + "Manage" modal for CRUD.

### 7. Public service alias layer + RLS hardening
- Add `services.public_alias text unique` (`O-<n>` / `S-<n>` / `F-<n>`), populated in `sync-services`.
- Create view `public.services_public` exposing only safe columns; grant SELECT to anon/authenticated; revoke SELECT on base `services` from anon/authenticated (service_role keeps full access for edge functions).
- Frontend reads from `services_public`; provider name and `api_service_id` never leave the server.
- Run linter; close any remaining RLS gaps on user-data tables.

### 8. Currency selector search + auto-timezone
- Full-variant `CurrencySelector` uses shadcn `Command` with search by code/name/symbol.
- On first authenticated Dashboard mount, if `profiles.timezone` is null, write `Intl.DateTimeFormat().resolvedOptions().timeZone`.

### 9. Exchange-rate rate-limit hardening
- `useExchangeRates`: cache TTL 12h, serve cached up to 24h (stale-while-revalidate), exponential backoff on 429, share across tabs via `BroadcastChannel`, fetch only on cold start.

### 10. Small UI polish
- Tighter mobile paddings, semantic tokens for any remaining hardcoded greys, sticky table headers on Orders/Drip-Feed/Subscriptions, consistent skeleton heights.

---

### Deferred to next turn
TOTP 2FA for admin (Turnstile already covers bot/brute-force now), Turnstile on user auth, R2 attachment migration, Supabase URL proxy, full blog/help-center, 30-day ticket cleanup.

### Files

**New:** `src/pages/AdminLogin.tsx`, `src/pages/AdminPanel.tsx`, `src/components/admin/AdminGuard.tsx`, `src/components/admin/UserLookup.tsx`, `src/components/admin/AddFundsToUser.tsx`, `src/components/admin/SavedRepliesManager.tsx`, `src/pages/DripFeed.tsx`, `src/pages/Subscriptions.tsx`, `supabase/functions/admin-login/index.ts`, `supabase/functions/admin-credit-user/index.ts`.

**Edited:** `vercel.json`, `src/App.tsx` (route swap), `src/components/Header.tsx` (remove admin link, conditional drip-feed/subscriptions links), `src/pages/Admin.tsx` → moved into `AdminPanel.tsx`, `src/pages/AdminTickets.tsx` (saved replies + guard), `src/pages/Services.tsx` + `src/utils/serviceOrganizer.ts` + `src/hooks/useOrderKinds.tsx` (read from `services_public`), `src/hooks/useExchangeRates.tsx`, `src/components/CurrencySelector.tsx`, `src/pages/Dashboard.tsx` (timezone autoset), `supabase/functions/sync-order-status/index.ts`, `supabase/functions/sync-services/index.ts`, `supabase/functions/place-order/index.ts` (block admin orders).

**Migrations:**
- `services.public_alias`, `services_public` view + grants/revokes.
- `subscription_reservations` columns (`posts_delivered`, `posts_charged`, `per_post_reserved`).
- `admin_saved_replies` table + RLS + grants.

### Verification
- Reload `/services`, `/orders`, `/drip-feed`, `/subscriptions`, `/admin` on Vercel → no 404.
- `/admin` shows isolated login with Turnstile; correct admin login succeeds, wrong/missing Turnstile fails, non-admin user fails.
- Admin attempts to place an order → 403.
- User lookup → balance top-up requires password + Turnstile → user's balance increases and transaction appears.
- Services network response contains no `provider` or `api_service_id`.
- Subscription delivers a post → balance debits exactly that slice.
