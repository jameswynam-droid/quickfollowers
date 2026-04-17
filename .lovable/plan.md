

# Implementation Plan

## 1. Ticket Chat UI Fixes (Tickets.tsx + AdminTickets.tsx)

**Problems from screenshots**: Subject not visible at top, status badge positioning, input field partially hidden.

**Mobile layout changes**:
- **User view (Tickets.tsx)**: Restructure header so ticket subject is centered/prominent at top. Move the status badge to the left under the back arrow.
- **Admin view (AdminTickets.tsx)**: Same layout -- subject centered at top, status badge + "Change Status" moved to left under back arrow.
- Increase composer bottom padding from `max(40px, ...)` to `max(56px, env(safe-area-inset-bottom))` with `pb-14` fallback.

**Desktop layout**: Dialog uses `sm:max-w-2xl sm:h-[90vh]` -- will change to `sm:max-w-4xl sm:h-[85vh]` for a larger, more filled appearance.

## 2. New Order Page (Services.tsx) Redesign

**Changes based on screenshots and feedback**:
- **Remove "All Categories"** from category dropdown. Default should be empty/prompt "Select a category".
- **Add top-level search bar** above category that says "Search By Service" -- searches across ALL services by name or ID (like SmmFollows reference).
- **Category search**: When category dropdown is open, the existing service search becomes a within-category search. Move the current service search input to appear inside/below the category dropdown as a category-specific filter.
- **Drip-feed total quantity**: Show `Total: qty * runs` when drip-feed is enabled.
- **Description**: Remove `max-h-[150px]` ScrollArea limit -- show full description without truncation.
- **Performance**: Debounce the service search input (300ms) to reduce lag when typing/clearing.

## 3. Orders Page -- Revert Mobile & Fix Re-order

**Mobile view**: Revert to the previous horizontal-scroll table layout (remove the card view, restore the `min-w-[900px]` scrollable table for all screen sizes).

**Re-order button**: Instead of calling the `reorder` edge function, navigate to `/services` with query params containing the service ID. On the Services page, parse the query param and pre-select the service but leave link/quantity/drip-feed empty so users fill them manually.

## 4. Homepage Updates

- Change "#1 in Nigeria" references to "#1 in the world" (title, meta descriptions, structured data).
- Update SEO keywords to include "world" and "global" terms.
- Add more FAQs: payment methods, refund policy, account safety, delivery speed, supported platforms.
- Update footer text from "Nigeria" to global positioning.

## 5. Logo Update

- Copy the new logo (`user-uploads://file_00000000c528720aa285bc3ed9a86c9c.png`) to `src/assets/logo.png` (replacing existing) and `public/favicon.png` and `public/og-image.png`.
- The logo has a blue-to-purple gradient matching the current color scheme -- it already aligns well with `--primary: 221 83% 53%` and `--secondary: 262 83% 58%`.

## 6. UI Color Alignment with New Logo

The new logo uses deep blue (#1A3FC7) transitioning to purple (#6B21A8). The current CSS variables already use blue (221 83% 53%) and purple (262 83% 58%) which closely match. Minor adjustments:
- Slightly deepen the primary blue to match the logo's darker blue tones.
- Update `theme-color` meta tag to match.
- Ensure gradient-hero matches the logo's blue-to-purple sweep.

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Tickets.tsx` | Header restructure, input padding increase, desktop size |
| `src/pages/AdminTickets.tsx` | Same header restructure + desktop size |
| `src/pages/Services.tsx` | Top search bar, remove All Categories, drip-feed total qty, full description, debounced search, accept reorder query param |
| `src/pages/Orders.tsx` | Revert mobile to scrollable table, re-order navigates to /services with service ID |
| `src/pages/Index.tsx` | "#1 in the world", more FAQs |
| `index.html` | Update title, meta descriptions, structured data, keywords for global positioning |
| `src/components/Footer.tsx` | Update "Nigeria" to "the world" |
| `src/assets/logo.png` | Replace with new logo |
| `public/favicon.png` | Replace with new logo (resized) |
| `public/og-image.png` | Replace with new logo-based OG image |
| `src/index.css` | Minor color tuning to match logo tones |

