## 1. Search box conflict (Services.tsx)

**Problem**: When the user types in "Search By Service", the global results dropdown opens. If they then open the Category dropdown, both popovers are visible at the same time and overlap.

**Fix**:
- When the global search shows results, automatically close the category dropdown (`setCategoryDropdownOpen(false)`).
- When the category dropdown opens, clear/collapse the global search results (don't clear the input — just hide the results panel via a `globalSearchOpen` boolean).
- Make the global search results render as an absolutely-positioned floating panel (`absolute z-50`), not inline, so it never pushes the Category section down.
- Add a click-outside handler so each panel closes when the user clicks elsewhere.

## 2. Ticket subject placement (Tickets.tsx + AdminTickets.tsx)

User wants the subject **on the same row as the back arrow & status badge**, slightly larger and highlighted — not stacked above.

**New header layout (mobile + desktop)**:
```
[← back]  [Subject — bold, text-base/lg, primary color, truncate]   (admin: [Status select])
[Status badge]                                                      ← second row, left-aligned, small
```
- Subject uses `font-bold text-base sm:text-lg text-primary truncate flex-1`.
- Remove the centered subject block above the row.
- Admin: keep the "Change Status" select on the right of the same row.

## 3. Favicon

The current `public/favicon.png` is the full logo, which renders poorly at 16/32px. Generate a properly-cropped square favicon from the new logo:
- Crop to the icon mark only (drop the wordmark), pad to a square, export 256×256 PNG → `public/favicon.png`.
- Add `apple-touch-icon` 180×180 variant.

## 4. New OG image (1200×630)

Generate a branded OG card via a Node script (sharp/canvas) writing to `public/og-image.png`:
- 1200×630 canvas, blue→purple gradient background matching `--primary`/`--secondary`.
- Centered: logo mark (left) + "QuickFollowers" wordmark (right) + tagline "World's #1 SMM Panel".
- Subtle pattern/glow, fully opaque text.

## 5. Daily admin pop-up to users (Dashboard + Homepage)

**New table** `daily_popups`:
| column | type |
|---|---|
| id | uuid pk |
| title | text |
| message | text |
| primary_button_label | text nullable |
| primary_button_url | text nullable |
| primary_button_color | text (hex) nullable |
| secondary_button_label | text nullable |
| secondary_button_url | text nullable |
| secondary_button_color | text (hex) nullable |
| is_active | boolean default true |
| created_at, updated_at | timestamptz |

RLS: admins full CRUD; `authenticated` and `anon` SELECT where `is_active = true`.

**Admin UI**: new section in `/admin` to create/edit/toggle pop-ups, including color pickers for each button.

**Display component** `DailyPopupModal.tsx`:
- Mounted in `Dashboard.tsx` and `Index.tsx`.
- On mount, fetch the active popup. If found, check `localStorage[`popup_seen_${popup.id}_${YYYY-MM-DD}`]`. If absent, show modal and set the key.
- Buttons render with their custom hex colors via inline `style={{ backgroundColor: color }}` and route via `<a target="_blank" rel="noreferrer noopener">` or internal navigate.
- Slightly curved corners (`rounded-2xl`), max-w-md, fully opaque.

## 6. Floating bell info modal sizing (FloatingNotificationBell.tsx)

- Change `DialogContent` from `max-w-md max-h-[85vh]` to `w-[95vw] sm:max-w-2xl max-h-[90vh] rounded-2xl` so it fills nearly the full screen on mobile with rounded (not pointed) corners.
- Increase ScrollArea heights to `h-[75vh]`.

## 7. Add Funds page polish

- Apply logo gradient (`bg-gradient-to-br from-primary to-secondary`) to the page header card.
- Preset amount buttons → larger (`h-14`), `rounded-xl`, two-tone: selected = filled gradient + white text, unselected = outline with hover gradient border. Add subtle shadow.
- Currency-symbol input: keep dynamic padding, but add primary-color focus ring.

## 8. "In Progress" vs "Processing" status

The provider returns `In progress` and `Processing` as **distinct** statuses. Currently both collapse to `processing`.

**Database migration**: add `'in_progress'` to the `order_status` enum (keep `processing` for true "Processing" responses).

**`sync-order-status/index.ts`**: update mapping
- `'in progress' | 'inprogress'` → `'in_progress'`
- `'processing'` → `'processing'`
- `'pending'` → `'pending'`
- `'partial'` → `'partial'`
- `'completed' | 'complete'` → `'completed'`
- `'cancelled' | 'canceled'` → `'cancelled'`
- `'failed' | 'error'` → `'failed'`
- Update the `.in('status', [...])` poll list to include `'in_progress'`.

**`Orders.tsx`**: add `In Progress` to status filter, badge color (`secondary`), and label map. Display label "In Progress" verbatim from API for unknown variants.

## 9. Security audit (database)

Run the Supabase linter and security scan, then:
- Verify `otp_codes` and `otp_rate_limits` have RLS enabled (currently no policies — confirm RLS is `ON` so they're locked down to service role only; if not, enable RLS with no public policies).
- Confirm no table is missing RLS.
- Re-confirm `profiles.balance` immutability policy is intact.
- Verify `daily_popups` RLS on creation.
- Address any new linter findings (mark fixed via security tool).

## 10. APK

Skipped per user choice.

---

## Files to change

| File | Change |
|---|---|
| `src/pages/Services.tsx` | Mutually-exclusive search panels, absolute-positioned global results, click-outside |
| `src/pages/Tickets.tsx` | Header: subject inline with back arrow, bold/highlighted |
| `src/pages/AdminTickets.tsx` | Same header layout + status select on right |
| `public/favicon.png` | Regenerated cropped icon (256×256) |
| `public/apple-touch-icon.png` | New 180×180 |
| `index.html` | apple-touch-icon link |
| `public/og-image.png` | Regenerated 1200×630 branded card |
| DB migration | New `daily_popups` table + RLS; add `'in_progress'` to `order_status` enum |
| `src/components/DailyPopupModal.tsx` | New component |
| `src/pages/Dashboard.tsx` | Mount DailyPopupModal |
| `src/pages/Index.tsx` | Mount DailyPopupModal |
| `src/pages/Admin.tsx` | New "Daily Pop-ups" admin section with color pickers |
| `src/components/FloatingNotificationBell.tsx` | Larger, rounded-2xl modal |
| `src/pages/AddFunds.tsx` | Gradient header, polished preset buttons |
| `supabase/functions/sync-order-status/index.ts` | Map `in progress` → `in_progress`; include in poll |
| `src/pages/Orders.tsx` | Add `In Progress` filter/badge/label |
| Security tools | Run linter + scan, address findings |
