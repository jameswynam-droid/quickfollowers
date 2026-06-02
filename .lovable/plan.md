## Plan to fix the current issues

### 1. Auto-service order form support
- Add special handling on the New Order page for:
  - TikTok Auto services: show `Username`, `New posts`, `Min`, `Max`, `Delay`, `Expiry`, and charge.
  - Instagram Auto services: show `Username`, `New posts`, `Old posts`, `Min`, `Max`, `Delay`, `Expiry`, and charge.
  - Owlet Website Traffic services that require hashtags: show a `Hashtags / Keywords` field and explain what to enter.
- Update the order payload sent to the provider so these extra fields are forwarded using the provider’s expected SMM panel parameters.
- Update frontend and backend validation so username-based auto services are accepted instead of being rejected for not being a full link.
- Add clear inline help text explaining:
  - `New posts`: how many future posts the subscription should affect.
  - `Old posts`: how many existing Instagram posts should also receive engagement.
  - `Min/Max`: random amount delivered per post between those two values.
  - `Delay`: wait time before delivery after a new post is detected.
  - `Expiry`: date when the auto subscription should stop.
- Calculate and display the final charge before submit. For auto services, I’ll use the standard SMM panel subscription pricing pattern: estimate total delivered quantity from min/max per post and post count, then apply the marked-up per-1000 rate. Backend will re-calculate the charge so users cannot manipulate it.

### 2. Twitch and confusing service descriptions
- Add fallback descriptions for Twitch services where the provider description is blank or generic, especially Twitch chat bot/custom chat services.
- Add service-specific warnings for services likely to confuse users, including auto subscriptions, drip-feed, custom comments, Twitch bots, website traffic, and hashtag/keyword traffic.
- After implementation, I’ll report any service categories that still have weak/generic descriptions and should be improved manually or via a description refresh.

### 3. Signup, OTP, username, and error messages
- Stop default verification-link emails by keeping built-in email confirmations disabled and using only the custom OTP flow.
- After a user enters the correct signup OTP, create the account, sign them in immediately, and redirect to `/dashboard`.
- Replace generic auth errors like `Edge Function returned a non-2xx status code` with specific messages such as:
  - `An account with this email already exists. Please sign in instead.`
  - `Invalid or expired verification code.`
  - `Too many OTP requests. Please try again later.`
- Normalize usernames to lowercase before checking and saving. Existing capital-letter usernames are not dangerous, but mixed-case usernames can confuse search/login display, so I’ll enforce lowercase going forward and check existing usernames for conflicts before migration.

### 4. Payment balance reliability
- Review both Paystack and Flutterwave verification flows.
- Keep the existing idempotency protection, but harden it so a successful payment cannot show as successful unless the wallet update succeeds.
- Add safer payment status messaging on the success page: if the balance update is delayed/failed, show a specific support-friendly message instead of saying the wallet was funded.
- Add a recovery path/admin audit query for successful payment references that did not create a deposit transaction or did not update balance.

### 5. Ticket attachments and hidden storage URLs
- Fix the broken attachment previews that currently show `Bucket not found`.
- Stop placing direct backend storage URLs in ticket messages.
- Replace direct signed links with a small authenticated backend file-view function, so opening an attachment uses a QuickFollowers-controlled route/function instead of exposing the storage provider URL in the UI.
- Update both user and admin ticket views to use the resolved preview URL consistently; the admin ticket screen currently still uses the raw `attachment_url` in some places.
- Keep the bucket private and only allow the ticket owner or admin to access the file.

### 6. Ticket message privacy
- Important limitation: a support chat must store messages somewhere to show chat history. We cannot have persistent tickets while storing nothing.
- To meet your privacy goal, I’ll remove ticket messages from the external sync workflow and stop copying them to any secondary database/bot sync.
- If you want unreadable database contents too, I’ll add application-level encryption for ticket message bodies and attachment paths so the database stores encrypted text instead of readable customer/admin messages. The app will decrypt only for the correct user/admin session.

### 7. Database access and security tightening
- Review all public/unauthenticated access and restrict anything that does not need public access.
- Keep public read only where it is genuinely needed, such as public homepage/SEO content and active popups if intended.
- Lock OTP tables so users cannot read OTP codes or rate-limit records directly.
- Enable leaked-password protection.
- Remove sensitive tables from external sync, especially OTP tables and ticket messages.
- Re-run the security scan after fixes and mark resolved findings.

### 8. Cloaking backend/provider identity
- Full database cloaking is not 100% possible in a client-side web app because the browser must call backend APIs.
- What I can do:
  - Remove direct storage URLs from attachment previews/downloads.
  - Avoid showing backend provider URLs in user-visible links and errors.
  - Keep provider names out of logs/errors/UI.
  - Tighten CSP/connect rules after the attachment proxy is in place.
- What I cannot honestly promise: making all network requests completely hide the underlying managed backend from a determined technical user without adding a separate custom backend/proxy layer.

### 9. SEO diagnostics and robots cleanup
- Remove the `/seo-diagnostics` route and page import.
- Update sitemap to remove `/auth` if we do not want it indexed, and keep only public SEO routes such as homepage, terms/privacy, and landing pages.
- Review `robots.txt` to avoid listing sensitive paths like `/admin`; instead rely on route-level `noindex` and authentication for private pages.

### 10. Verification after implementation
- Test signup with:
  - new email + OTP → dashboard
  - existing email → specific existing-email error
  - invalid OTP → specific OTP error
- Test payment success flow and balance update behavior.
- Test user/admin ticket attachments with image and PDF previews.
- Test auto-service forms for TikTok, Instagram, and website traffic hashtag services.
- Run a security scan and summarize remaining risks/limitations.