## Plan

### 1) Fix subscription/auto-service ordering and billing
- Change auto-services from normal instant-debit orders into a separate subscription flow.
- Use the provider's documented `action: add` subscription fields: `username`, `min`, `max`, `posts`, optional `old_posts`, `delay`, `expiry` in `d/m/Y` format.
- Do not create a normal negative transaction immediately for auto-services.
- Add a reservation/hold system for subscriptions:
  - On subscription creation, reserve the estimated maximum/average subscription budget from the user's available wallet balance so they cannot spend money that may be needed later.
  - When detected post deliveries are confirmed from provider status/subscription data, convert the relevant reserved amount into actual charges with normal profit markup.
  - If the subscription expires/cancels/completes with unused reservation, release the unused hold back to available balance.
- Important limitation: if the provider itself owns the new-post detection, the only safe way to stop you paying out of pocket is to ensure the user has reserved wallet funds before the provider subscription can run. There is no reliable “provider detected a post but ask my site first before charging me” hook in the standard PerfectPanel API.

### 2) Correct auto-service form rules
- TikTok auto-services: show `Username`, `New posts`, `Min per post`, `Max per post`, `Delay`, `Expiry`; no old-post box.
- Instagram auto-services: show same fields plus `Old posts`, even when the service name does not explicitly say Instagram but the category/service data indicates it.
- Telegram auto services:
  - Only these should use subscription extra boxes: `Telegram Auto Reaction Mix Positive` and `Telegram Comment AI-Generated [Auto] [Comments Relevant to your Topic]` / service `7773`.
  - Other Telegram auto services like `7287`/`7289` should remain normal link + quantity orders.
- Extend delay dropdown to include: `240, 270, 300, 360, 420, 480, 540, 600` minutes.
- Keep expiry date picker blocked from past dates on both frontend and backend.

### 3) Fix special service fields
- Instagram Verified Comments service `4379`: treat it as a package/default-one-comment service, not custom comments; hide quantity and send only the required link/service payload.
- Website Traffic:
  - Hashtag services: multiline textarea, one hashtag/phrase per line, send all lines instead of only the first.
  - Brand Searches category: add a usernames/brand-name textarea (`1 per line`) as shown in the screenshot, while preserving link and quantity.
  - Add the explanatory helper text from the screenshot for Brand Searches and hashtag/traffic inputs.

### 4) Separate normal orders, drip-feed, and subscriptions
- Add order classification fields in the database, e.g. `order_kind = standard | drip_feed | subscription`, plus subscription-specific fields (`username`, min/max, posts, old_posts, delay, expiry, provider subscription id, progress counts) and drip-feed fields (`parent id`, runs, interval, run progress).
- Update `place-order` to save the correct kind and metadata.
- Update `/orders` to exclude `drip_feed`, `subscription`, and `failed` orders.
- Create `/drip-feed` page matching the screenshot: parent/order ID, date, link, charge, quantity, service, runs progress, interval, total quantity, status.
- Create `/subscriptions` page matching the screenshot: ID, username, quantity/min-max, new/old post progress, delay, service, status, created, updated, expiry, cancel action.
- Show Drip Feed and Subscriptions links in desktop nav and mobile hamburger only after that user has at least one order of that kind.
- Make both new tables/pages horizontally scrollable and stable on mobile, with no clipped menu items.

### 5) Remove or hide failed orders cleanly
- Filter `failed` out of user-facing order history immediately.
- Keep failed records internally for admin/support/audit, but do not show them in the normal user history.
- Keep refund/idempotency protection intact so failed/cancelled refunds are not duplicated.

### 6) Add saved ticket replies for admins
- Add a `saved_ticket_replies` table with admin-only RLS and proper GRANTs.
- Add a searchable saved-reply box in `AdminTickets.tsx` inside the reply area.
- Include default order-related replies (order pending, partial/refund, wrong link, refill/drop, payment confirmation, delivery delay).
- Allow admins to insert a saved reply into the message textarea, then edit before sending.

### 7) Fix currency converter console errors
- Update the CSP `connect-src` in `netlify.toml` to allow the currency endpoints currently used:
  - `https://latest.currency-api.pages.dev`
  - `https://*.currency-api.pages.dev`
  - `https://ipapi.co`
- Reduce console warnings for expected fallback behavior so users do not see noisy failed-rate messages when fallback rates are used.

### 8) Reduce provider/service ID exposure
- Stop exposing raw provider-prefixed service IDs to the frontend/network by adding an internal public alias layer.
- Add a backend-only mapping from public service aliases to real provider service IDs.
- Frontend will receive aliases like `QF-000001` or numeric-looking public IDs only; provider names and original IDs stay server-side.
- Update search, order placement, reorder, order history, and service dropdowns to use public aliases.
- Update edge functions (`place-order`, `reorder`, sync/status functions as needed) to translate aliases server-side before calling provider APIs.
- Note: fully hiding the fact that an external provider exists is not possible from every indirect clue, but raw provider names/IDs should no longer appear in normal frontend payloads, HTML, service options, or user/admin UI.

### 9) Staff-support access without exposing provider names
- Add a simple staff/admin-support view inside this app first, because it is free and non-technical.
- Staff view will show users, orders, tickets, transactions, and support context using masked service/order IDs only.
- Keep provider names, provider API IDs, and internal service mappings hidden from non-owner staff.
- Use role-based access (`admin` / later `support`) instead of giving staff backend/database access.
- External syncing can remain a later phase if you choose a free destination, but the safest immediate free option is an in-app support dashboard.

### 10) Verification
- Test auto-service payloads for TikTok, Instagram, Telegram `6599`, Telegram `7773`, and Telegram `7287` behavior.
- Test Instagram Verified Comments `4379` submits without quantity.
- Test Brand Searches and multiline hashtags payloads.
- Test normal orders, drip-feed, and subscriptions are separated correctly.
- Test mobile and desktop navigation visibility after users have/ do not have drip-feed/subscription orders.
- Test currency console errors are gone after CSP update.
- Deploy updated backend functions after code and migration changes.