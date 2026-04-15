

# Implementation Plan -- 7 Issues

## Issue 1: Ticket Chat UI -- Subject Not Showing & Input Field Cut Off

**Root cause**: The `DialogContent` component (dialog.tsx line 45) renders a built-in X close button at `absolute right-4 top-4`. This overlaps the header content. Additionally, the `DialogTitle` uses `text-sm` making the subject too small and hard to see. The bottom padding `max(24px, ...)` is insufficient on mobile.

**Fix** (Tickets.tsx + AdminTickets.tsx):
- Hide the built-in X close button: add `[&>button.absolute]:hidden` to `DialogContent` className
- Make subject text larger: change `DialogTitle` from `text-sm` to `text-base font-semibold`
- Increase bottom padding from `max(24px, env(safe-area-inset-bottom))` to `max(40px, env(safe-area-inset-bottom))`
- Add `pb-8` as CSS fallback

**Desktop**: On `sm:` breakpoint the dialog already uses `sm:max-w-2xl sm:h-[90vh]` matching the Owlet reference layout. No desktop changes needed.

---

## Issue 2: Remove Provider Prefix Letters from Service IDs

**Current**: `getDisplayServiceId` returns `O-4506`, `S-4506`, `F-4506`.
**User wants**: Just the numeric part (e.g., `4506`).

**Fix** (serviceOrganizer.ts): Simplify `getDisplayServiceId` to extract only the last numeric segment:
```typescript
export const getDisplayServiceId = (id: string): string => {
  const parts = id.split('-');
  const last = parts[parts.length - 1];
  return /^\d+$/.test(last) ? last : id;
};
```

---

## Issue 3: SEO -- Site Name in Google Search Results

**Problem**: Google shows "quickfollowers.online" instead of "QuickFollowers".

**Fix** (index.html): Add/update `<meta property="og:site_name" content="QuickFollowers">` and ensure the `<title>` tag starts with "QuickFollowers" rather than the domain. Also add `name` property in WebSite structured data schema. Google may take days to re-crawl.

---

## Issue 4: Flutterwave Duplicate Payment Fix

**Already planned in previous iteration**. Will execute:
1. **DB migration**: Add unique partial index on `transactions(reference_id) WHERE type = 'deposit' AND reference_id IS NOT NULL`
2. **DB migration**: Create `process_deposit` PL/pgSQL function for atomic insert+balance update
3. **Edge function updates**: Update `verify-flutterwave/index.ts` and `verify-payment/index.ts` to call `process_deposit` RPC instead of separate SELECT/UPDATE/INSERT

---

## Issue 5: Performance -- Repeated Service Fetches

**Fix** (Services.tsx + App.tsx):
- React Query `staleTime: 5 * 60 * 1000` is already set in App.tsx
- Services.tsx still uses raw `useEffect` + `fetchServices()` with session cache. Add debounced search (300ms delay) to avoid re-rendering the large service list on every keystroke
- Add `touch-manipulation` to the Services page container to eliminate 300ms touch delay

---

## Issue 6: New Order Page Redesign (SMM Panel Format)

Redesign Services.tsx from card grid to a **single-form layout** matching standard SMM panels:
- Category dropdown at top
- Searchable service selector showing `ID - Service Name`
- Link field, Quantity field (with min/max displayed)
- Drip-feed toggle with runs/interval
- Real-time charge calculator
- Description section below when service is selected
- Submit/Confirm button

**No Favorites/Starred features** per user's request.

---

## Issue 7: UI/UX Improvements -- Orders & Add Funds Pages

**Orders page**: Add mobile-friendly card view for small screens (hide table, show cards with service name, status badge, date, quantity, charge). Keep table on desktop.

**Add Funds page**: Minor visual polish -- better spacing, more prominent preset amounts.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Tickets.tsx` | Hide X button, fix subject display, raise input |
| `src/pages/AdminTickets.tsx` | Same as above |
| `src/utils/serviceOrganizer.ts` | Remove provider prefix letters from IDs |
| `index.html` | SEO meta tags for site name |
| `supabase/functions/verify-flutterwave/index.ts` | Use atomic `process_deposit` |
| `supabase/functions/verify-payment/index.ts` | Use atomic `process_deposit` |
| DB migration | Unique index + `process_deposit` function |
| `src/pages/Services.tsx` | Full redesign to SMM panel format + debounced search |
| `src/pages/Orders.tsx` | Mobile card view |
| `src/pages/AddFunds.tsx` | Visual polish |

