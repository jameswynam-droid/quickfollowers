# Subscriptions, Drip Feed, and the remaining deferred work

## What I verified with the provider before writing this

Querying the provider status endpoint with a subscription ID returns the child orders it created:

```text
status(38407572) -> {"status":"Completed","expiry":"2026-07-20","posts":"1","orders":["38407727"],"old_orders":[]}
status(38407727) -> {"charge":"16.6509","start_count":"","status":"In progress","remains":"25","currency":"NGN"}
```

Drip feed parents behave the same way:

```text
status(37595769) -> {"status":"Completed","runs":"2","orders":["37595771","37596003"]}
```

So both subscriptions and drip feeds expose their real child order IDs and each child exposes its real charge. That is the missing link needed to bill subscriptions correctly.

I also confirmed in the database that the three existing subscription rows have `charge = 0` and `charged_so_far = 0`, so nothing was ever debited even though the provider already delivered and completed them. Reserved balance was held but never converted into a real charge.

## 1. Subscription billing (the actual bug)

New background function `sync-subscriptions`, run alongside the existing order sync:

- For every active reservation, poll the parent subscription ID.
- For each child order ID returned that is not yet recorded, poll the child, read its provider charge, apply the same markup the service uses, and record it.
- Debit the user's balance by that amount, write a transaction row, increase `charged_so_far`, and release the same amount from `reserved_balance`.
- Each child is billed once, keyed by the child's provider order ID, so repeated polling never double charges.
- When the subscription reaches Completed, Canceled or expired, release any leftover reservation back to available balance and mark the reservation finished.
- Backfill: the three existing subscriptions get billed on the first run using the same path.

Estimate rule stays as you described: required balance before placing a subscription is max quantity x (new posts + old posts) x rate with markup. That is already what the code reserves, so no change there.

## 2. Child orders become visible

Each child order the provider creates is written into `orders` as its own row, linked to the parent, with its real quantity, charge, status, start count and remains. Result:

- Orders page shows the delivered child orders like any normal order.
- Subscriptions page shows the parent with its own detail.

## 3. Subscriptions page and Drip Feed page

Two new routes, `/subscriptions` and `/drip-feed`, each hidden until the user has at least one of that order type (the detection hook for this already exists and will be wired into the header and the mobile menu).

Subscriptions page shows: subscription ID, username, service, quantity range (min to max), new posts and old posts progress, delay, expiry, status, amount reserved, amount charged so far, and the list of delivered child orders with their charges.

Drip Feed page shows: parent order, service, link, runs completed out of total, interval, per run quantity, total charged, and each run's child order with its status.

## 4. Admin route hardening and Support to Admin messaging

- Every admin and support route wrapped by the existing guard with an explicit role requirement, so Support cannot reach admin-only surfaces even by typing the URL.
- New internal messages table plus an Inbox tab: Support can send a request to Admin (for example "credit this user"), Admin sees an unread badge, replies, and marks it resolved.

## 5. Cloudflare R2 for ticket attachments

- Upload proxy edge function signs and stores objects in R2 using the existing R2 secrets, so the browser never sees a bucket URL.
- Viewing goes through short lived signed URLs only.
- 15 day lifecycle cleanup for old attachments.
- Existing attachments migrated across, with the old storage path kept as a fallback until migration completes.

## 6. Blog and help centre expansion

- New articles covering every service category still missing one, including subscriptions and drip feed, all full Markdown.
- Photoreal imagery, limited to one or two generated images for the highest value articles to keep credit use low; the rest use clean typographic headers rather than filler stock.
- Service pages keep linking straight to the matching article.

## 7. Web Push for support

Service worker, subscription storage, and a sender triggered on new ticket messages so Support is notified without keeping the panel open.

## 8. Copy and icon cleanup

Sweep the whole site to remove long dashes and any sparkle icons, replacing them with plain punctuation and neutral icons.

## Technical notes

- New columns: `orders.parent_order_id`, `orders.provider_child_id`, plus indexes; `subscription_reservations` gains released tracking.
- Billing math: user charge = provider child charge x (1 + markup for that service tier), matching how order pricing already works.
- All balance movement happens in the edge function with the service role, never client side.
