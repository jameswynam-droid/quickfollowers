## Plan

### 1) Auto-service field rules (per provider + per service)
Refine `detectHasOldPosts`, `detectNewPostsField`, and `detectAutoService` in both `Services.tsx` and `place-order/index.ts` with a precise rule matrix:

- **Auto Members / Auto Followers / Auto Subscribers**: NEVER show extra boxes (username/min/max/posts/old_posts/delay/expiry) regardless of provider. Treat as standard link+qty.
- **Owlet Telegram auto**: only services whose name contains "Reaction" (e.g. `6599` "Auto Reaction Mix Positive") or the AI comments service (`7773`) get the subscription boxes. All other Owlet Telegram auto = standard.
- **SmmFollows Telegram auto**:
  - If name/category contains "Future Posts" → standard (no extra boxes).
  - If category contains "By Post Count" → standard.
  - Otherwise if it's a generic "Auto Views/Reactions" (not future, not by post count) → subscription boxes.
- **Service `7289`**: force both `posts` (new) and `old_posts` boxes.
- **Service `7287`**: standard order.
- **TikTok auto**: subscription boxes, hide `old_posts`.
- **Instagram auto**: subscription boxes, show `old_posts`.

Encode this as a single `classifyAutoService(service)` helper returning `{ kind: 'standard' | 'subscription', showOldPosts, showNewPosts }`, used by both frontend and edge function so rules cannot drift.

### 2) Fixed-quantity / per-N services show charge
For services with `min_order === max_order` (per-1, per-2, per-3, etc., including IG Verified Comments `4379`):
- Hide quantity input.
- Auto-set quantity to `min_order`.
- Compute and DISPLAY the total charge in the order summary using that fixed quantity (currently it shows 0.00 because qty state is empty).
- Same logic mirrored in `place-order` so server charge matches displayed charge.

### 3) Website Traffic Hashtags / Brand Searches – single line only
Switch the multiline `<Textarea>` back to a single-line `<Input>` for hashtag and brand-search username fields. Edge function stops splitting on `\n`; sends raw string trimmed (still strips leading `#` / `@`).

### 4) Subscription balance reservation
Add `reserved_balance` column to `profiles` and a `subscription_reservations` table:

```
subscription_reservations(
  id uuid pk, user_id uuid, order_id uuid,
  api_subscription_id text, estimated_max numeric,
  charged_so_far numeric default 0, status text, created_at, updated_at
)
```

Flow:
- On subscription order: compute `estimated_max = max * (posts + old_posts) * markedUpRate (/1000 if needed)`. Require `balance - reserved_balance >= estimated_max`. Insert reservation, increment `profiles.reserved_balance` by `estimated_max`. Do NOT debit balance yet.
- Available balance everywhere (Dashboard, AddFunds, place-order checks, Account) = `balance - reserved_balance`.
- Background sync (`sync-order-status`, extended) polls provider subscription status. For each newly delivered post: compute actual charge with markup, debit `balance`, decrement `reserved_balance` proportionally, insert `transactions` row referencing the subscription.
- When subscription `completed`/`canceled`/`expired`: release remaining `reserved_balance`, mark reservation closed.

Display in UI: Dashboard balance card shows "Available: $X (Reserved: $Y)" when reserved > 0.

### 5) Ticket unread notifications – correct persistence
Bug: `useUnreadTickets` re-counts admin messages whose `created_at > ticket_reads.last_read_at`. If `ticket_reads` row exists with proper timestamp, count should be 0 after reading. Verify:
- Reading a ticket (open `Tickets` detail or `AdminTickets` detail) upserts `ticket_reads.last_read_at = now()` for that ticket — confirm this fires on view AND survives logout (it does, it's in DB).
- Admin side: build identical `useAdminUnreadTickets` reading user messages where `is_admin_reply = false` and comparing against a per-admin `ticket_reads` row keyed by admin user_id.
- Fix any place that resets/ignores `last_read_at` on login.

User login popup: in `Dashboard.tsx` on mount, check unread count; if > 0 show a one-time toast/modal "You have N new repl(y/ies) from support – View tickets" linking to `/tickets`. Dismissal stored in `sessionStorage` to avoid re-popping on every dashboard visit in same session.

Admin browser notifications: in `AdminTickets.tsx`, request `Notification.permission` on mount; on Realtime INSERT into `ticket_messages` where `is_admin_reply = false`, fire `new Notification('New support message', { body: ... })`.

### 6) Service sync accuracy + scheduled daily sync
- Investigate `5919` absence: re-run `sync-services` and log any services skipped due to filters; ensure pagination/full list pulled from both Owlet and SmmFollows. Remove premature filtering that drops services with unusual `type` values.
- Add `pg_cron` job to invoke `sync-services` every morning (e.g. 05:00 UTC) via `pg_net.http_post` with the service-role key.
- Pull service `description` field from provider API when present (PerfectPanel `services` endpoint returns it for many panels); store in `services.description`. Use it in `Services.tsx` description popover when available, fallback to current generated text.

### 7) Database / API hardening (cloaking)
- Audit RLS: every public table requires `auth.uid()`-scoped policy; no anon `SELECT` except `services` (already public read needed for catalog) and `notifications` (global).
- Confirm `GRANT`s match.
- "Proxy the Supabase URL": route all Supabase reads/writes through edge functions OR keep direct client but add a custom domain alias. The realistic, free option = leave PostgREST direct (Supabase requires it for Realtime/Auth) but:
  - Strip provider identifying fields from `services` rows returned to client (already aliased as `O-####` / `S-####`).
  - Add response shaping view `services_public` excluding `provider`, `rate` (raw), `api_service_id`; expose only marked-up `display_rate`, alias `id`, name, category, description, min/max, type.
  - Enforce `services` RLS to deny anon if user not authenticated for any endpoint that includes provider columns.
  
Note in plan: full hostname proxying (hiding `*.supabase.co`) requires Cloudflare Worker + custom domain, which the user previously deferred (see `cloudflare-integration-deferred` memory). I'll surface the limitation rather than silently skip.

### 8) Deferred to next round (after above verified)
- `/drip-feed` and `/subscriptions` pages + conditional nav.
- Saved ticket replies UI + table.
- Public service alias layer (`QF-######`) replacing `O-`/`S-` prefixes.
- Help center/blog page, admin 2FA.

### Files to change
- `src/pages/Services.tsx` – classifier, fixed-qty charge, single-line hashtag/brand inputs, available-balance display.
- `src/pages/Dashboard.tsx` – unread support popup, reserved balance display.
- `src/pages/Tickets.tsx` / `src/pages/AdminTickets.tsx` – read-marking, browser notifications, unread hook for admin.
- `src/hooks/useUnreadTickets.tsx` + new `useAdminUnreadTickets.tsx`.
- `supabase/functions/place-order/index.ts` – classifier sync, reservation insert, balance check vs available, fixed-qty charge.
- `supabase/functions/sync-order-status/index.ts` – subscription progress polling, proportional debits, reservation release.
- `supabase/functions/sync-services/index.ts` – full pagination, description capture, missing-service diagnostics.
- New migration: `profiles.reserved_balance`, `subscription_reservations` table + RLS + grants, `services.description` column if missing, `services_public` view, daily cron schedule.

### Verification
- Order each of `4379`, `5919` (after re-sync), `6599`, `7287`, `7289`, `7773`, an SmmFollows "Future Posts" service, an SmmFollows "By Post Count" service, an SmmFollows generic auto-views service, a TikTok auto, an Instagram auto, a hashtag traffic service, a Brand Searches service.
- Confirm reservation holds balance; place second order exceeding available reserved-adjusted balance is rejected.
- Mark a ticket read, log out, log back in → badge stays 0.
- Verify daily cron fires (check `net._http_response`).
