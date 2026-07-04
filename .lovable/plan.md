I found the main cause of the support/admin issues:

- `support@quickfollowers.online` exists, but it currently only has the `user` role, not the `support` role.
- The 2FA enrollment function currently allows only `admin`, so support accounts can hit a backend error instead of a clear setup flow.
- The ticket page currently checks only for `admin`, so support would be blocked from tickets even after login.
- User Lookup is currently showing all transaction rows, including order-related transactions, inside Transaction History.

Plan:

1. Fix support account access
   - Add the missing `support` role to `support@quickfollowers.online`.
   - Keep normal users blocked from the admin panel.
   - Allow both `admin` and `support` roles to sign in through the admin login.
   - Allow support users to access tickets and user lookup, while keeping admin-only areas restricted.

2. Fix 2FA for admin and support
   - Update 2FA enrollment so both `admin` and `support` staff can enroll.
   - Keep 2FA required after setup, with the existing re-prompt interval.
   - Make failed enrollment/login/verification return safe, understandable messages like “Your account is not allowed to use the staff panel” or “Authenticator code is required,” instead of “Edge Function returned a non-2xx status code.”
   - Update the login UI to prefer backend-provided safe errors over generic function errors.

3. Fix deleted staff email reuse and duplicate prevention
   - Update staff creation to check whether an email already exists before creating a new staff account.
   - If an active account exists, show “This email is already in use.”
   - Add a proper staff delete action that removes the auth user and related staff records, so the same email can be used again after deletion.
   - Keep “remove role” separate from “delete account” to avoid accidental deletion.

4. Fix User Lookup histories
   - Order History will query only the orders table.
   - Transaction History will show only deposits and refunds.
   - Add an Order ID search field for orders using short ID, provider order ID, or internal ID fragment.
   - Add a Transaction ID search field for deposits/refunds using short ID, reference ID, or internal ID fragment.
   - Keep payment hints for Transaction History and separate subtle provider hints only for Order History.

5. Make provider hints less obvious
   - Replace direct-looking provider labels with subtle stable source codes generated from provider/service/order fields, such as `S-14`, `S-27`, etc.
   - Do not expose raw provider names, provider IDs, or provider order IDs unless already intended for support tracking.

6. Update saved reply wording
   - Update “Order speed-up request” so support says the speed request has been escalated to the technical team/admin.
   - Keep cancellation wording clear that orders already “In Progress” cannot be cancelled.
   - Remove em dashes from saved reply text and affected UI copy.

7. Fix admin panel tab visibility on mobile
   - Replace the cramped horizontal tab bar with a mobile-friendly grid/wrapped tab layout so User Lookup, Saved Replies, 2FA, Staff, Blog/Help, and other tabs are fully visible.
   - Keep desktop layout clean and scannable.
   - Avoid text clipping and hidden active states.

8. Validate after implementation
   - Test the admin login function response path.
   - Test 2FA enroll/verify behavior for a staff account.
   - Verify support can access tickets but not admin-only areas.
   - Verify lookup histories are no longer mixed.