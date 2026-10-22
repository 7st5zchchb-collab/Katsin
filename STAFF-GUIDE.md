# Katsin staff workspace

The production staff entry is `/admin`; guests use `/`. Both run on the same Cloudflare Worker and D1 database. The source repository contains application code and schema migrations, never live employee codes, guest records or payment data.

## Roles

- Director / manager: reservations, cashier, staff registration and access, all profiles, shift corrections, daily sales corrections, full audit history.
- Host: reservations and own profile; reservation activity only.
- Cashier: open and edit table bills; record cash, card or split payments; own profile and bill activity. Closed bills can only be voided by management.
- Waiter: own profile, clock-in/out, shift history and sales totals.
- Assistant: own profile, clock-in/out and shift history.

Managers register employees in Team & access using first name, last name, job title and access role. They can choose a unique six-digit code (leading zeros are preserved) or leave the code blank for generation. Codes appear once and are stored as keyed digests. Rotating a code revokes prior sessions. Disabling access takes effect immediately.

The initial manager name and credential digest are configured through production environment secrets, not the repository. `STAFF_MANAGER_NAME`, `STAFF_PASSWORD_HASH`, `STAFF_SESSION_KEY` and optional `STAFF_MANAGER_REVOKED_BEFORE` must be configured on a new deployment. `STAFF_PASSWORD_HASH` is the SHA-256 digest of the initial manager code. Never commit real secrets or codes.

## Billing and sales

This is an independent internal ledger. It does not process bank card charges, issue fiscal receipts, synchronize with iiko or perform refunds. A cashier records payments already received through the existing cash/terminal process.

Open a bill for a table and registered waiter, add item names, quantities and prices in whole AMD, and save. Give a reason for changes. Closing requires exact cash + card = bill total. A bill can be closed once; concurrent changes require reloading. Voiding retains history and does not refund money externally.

Waiter totals are derived from closed bills by their closure date in Yerevan time (calendar midnight). Management can enter an authoritative corrected total for a day. It replaces the derived total for that day, including later bills; it is not added to it. The profile labels these overrides explicitly. Open/void bills do not count as sales. These figures are sales served, not wages or profit.

## Attendance

Clock-in/out requires the employee's own code, using server time. One open shift per employee is allowed. Management can correct start/end with a reason and revision protection; overlapping shifts are rejected. Monthly hours are clipped to month boundaries, and days worked are distinct Yerevan calendar days touched by a shift. Remote clock-in is currently allowed; no geolocation or workplace-network restriction is enforced.

## Verification

Run `node --test tests/*.test.mjs` and `node node_modules/typescript/bin/tsc --noEmit`. The route tests use in-memory SQLite, real migrations and database triggers to verify roles, privacy, leading-zero codes, uniqueness, shift totals, bill payments, duplicate/stale writes, revenue overrides, and audit history.

Publish schema migrations before the matching Worker code. Existing reservations remain intact; new actor history begins with the new deployment. No historical actor names are invented. iiko and a purchased custom domain are follow-up integrations.

## Weekly schedules

The Calendar / Schedule tab contains separate assistant and waiter schedules. Managers and directors can edit both. In Team & access, assign only the assistants' schedule permission to Levon's actual employee account and only the waiters' schedule permission to Gor Saqayan's account. Permissions use employee identity, never matching a typed name. The runtime-only STAFF_INITIAL_ROSTER configuration contains the 22 identities (nine assistants and all 13 waiters from the supplied roster). A successful bootstrap-manager login or an authenticated manager opening Team & access inserts missing pending accounts and audit events atomically. Existing records and subsequent manager edits are preserved; no access codes are generated. Levon receives the assistant schedule capability and Gor Saqayan the waiter capability. Surnames use the user-confirmed corrections; no photographed shift values are guessed. Team & access opens on the waiter category and has separate role filters with counts; the All category shows the complete roster. The new employee form follows the selected category without changing existing employee roles. The members API also supports an optional validated role filter. No host names were supplied; their category remains available for management to populate.

Each schedule has a private draft, a published snapshot and an optional future publication time. Editors choose a Monday–Sunday week, fill all seven days per employee (start/end or day off), then publish now or schedule a chosen time in Yerevan. A saved scheduled snapshot becomes visible based on server time without requiring the editor to keep the site open. Editing a draft does not change that scheduled snapshot unless it is scheduled again. Editors can cancel a future publication. Archived weeks are read-only. The interface selects the current week; there is no invented automatic repetition of last week's shifts.

Published snapshots retain employee names as of publication. Viewer responses exclude drafts and pending publication details. The current team roster includes employees registered without codes so a schedule can be prepared before login is activated. The team form supports an optional last name and explicit registration without a code; such accounts remain inactive until a unique code is issued.

Schedules are persisted as versioned JSON records in D1 settings, one key per team/week. Compare-and-set checks prevent stale writes, and audit events retain the author, team, week and saved entries. Schedule API tests cover cross-team permissions, draft privacy, incomplete rosters, timed publication and week rollover.

## Tips

The Tips tab is available to managers, directors, waiters and assistants. Waiters append whole-AMD tip receipts for the current Yerevan day with an optional table note. They cannot enter a different employee identity or change a receipt. Management can void a receipt with a reason; the original remains in history. Assistants only view their own allocation. All staff history requests expose only the signed-in employee’s receipts and payout; managers see the complete pool and roster.

The current formula deducts 7% of the gross pool for management, then itemized expenses, then assigns 18% of the remainder to assistants and 82% to waiters. Daily employee weights (for example 0.5, 1, 1.5) are entered explicitly by management. They are proportional allocation weights, not fixed percentages. Unconfirmed rates default to zero; no automatic rates or attendance assumptions are invented. The team’s exact final rule still needs the owner’s confirmation. Each group’s whole-AMD allocation uses largest remainders with stable identity ordering so rounding never creates or loses money.

Daily receipts, expense descriptions, roster names, role snapshots and weights persist in versioned D1 settings. The manager saves weights and expenses before finalizing the day. Closing requires a nonnegative pool and positive participants in both groups. Closed days reject further receipts or configuration edits until management reopens them with a reason. Each successful write is audited atomically and stale revisions are rejected. Open-day payouts are clearly provisional. The page refreshes every 30 seconds when no entry or configuration is being edited; selecting a past date shows history. Tips are separate from restaurant bill sales and attendance hours; this records allocations, not actual payouts or wages.

Validation adds privacy, receipt duplicate protection, unauthorized writes, expense calculations, close/reopen locking, void history and whole-AMD conservation tests. Browser QA remains limited by preview connectivity.

Assistant schedule cells now use a single dropdown: OFF, SH, 11 or 1. OFF is a day off; 11 and 1 label starts at 11:00 and 13:00. SH remains a symbolic shift because its exact hours have not been confirmed. Codes are stored and published explicitly without invented end times or changes to attendance/payroll. Existing time-based schedule entries are retained and shown as a legacy option until an editor explicitly replaces them. Waiter time editors retain their existing behavior. API validation restricts the new codes to assistants and rejects unknown values.

The assistants' common weekly grid is accompanied by a personal seven-day strip, selectable daily staffing lists and seven daily coverage indicators. The default rule is two 11:00 starters, one 13:00 starter, one or two OFF, and all others SH. Deviations are visible review warnings, not automatic changes to the roster. All team viewers see published coworkers' assignments; only editors see the current draft.

The departure-order helper compares the two 11:00 starters on successive known dates, prioritizing 11 before 13 before SH/OFF. Equal dates continue forward. An OFF boundary that is not already resolved by an early start compares the preceding day and leaves unresolved ties to Levon. Missing data never produces a guessed order; exact departure times are not assigned. The API includes visible snapshots from up to 14 stored future assistant weeks, while comparison is bounded to 98 days and stops at the first unknown day. Future drafts and not-yet-visible scheduled snapshots remain private. Sunday comparisons can continue into a published following Monday. Tests cover repeated equal dates, OFF boundaries, missing data, week boundaries, daily coverage and future-draft privacy.

The departure order appears as a small 1 or 2 in the upper-right corner of that day’s 11:00 cells only. Both editor and published views use the same comparison. Unresolved or incomplete comparisons leave the badge absent rather than assigning a random number.

## Waiter closing duty (P / plen)

Waiters now use the same OFF, SH, 11 and 1 selectors and future-date departure comparison. A separate P checkbox flags a working shift as closing duty; OFF cannot have P. Changing a working shift preserves P, switching to OFF clears it. The weekly grid shows P and daily counts out of two; a missing/excess closer is flagged for review. P cannot be assigned to an 11:00 starter: those two must leave first and second. Selecting 11 clears P.

Closing duty and daily report has a date picker, including past months. It resolves the P identities from the published snapshot for that week, preserving historical names. A report freezes the two closers' identities at first submission. No past P assignments are invented or backfilled from unknown records.

Only the date's two assigned P waiters, managers and directors see the closing amount. Other waiters see assignment names only. Assistants, hosts and cashiers cannot access this financial report. Assigned P waiters can submit/edit the current Yerevan day, or the previous day until 06:00 for after-midnight closing. Management can correct historical reports when the published assignment exists. Corrections require a reason.

The two waiters share one versioned daily total (whole AMD), note and append-only revision history, with exact author names and timestamps. Compare-and-set prevents duplicate or stale writes; each accepted revision is audited atomically with before/after amounts and assigned identities. This report does not automatically change bill sales, waiter sales, tip receipts, tip allocations, bank transactions or fiscal records. Its amount is the manually counted daily closing total. Tests verify P validation, author permissions, total privacy, shared-report corrections, duplicate protection, audit and a historical September 23 lookup.

Waiter departure badges now number all eligible non-P workers: the two 11:00 starters reserve positions 1 and 2, and the remaining working shifts receive 3, 4, etc. according to pairwise upcoming-schedule comparisons. A current SH waiter who starts at 11:00 tomorrow precedes another current SH waiter starting at 13:00 tomorrow. OFF and P cells have no numbered departure badge. Unknown or tied comparisons remain unnumbered; no employee-name ordering resolves a tie. Assistants retain their two early-starter badges only. Tests include the Narek SH-today/11-tomorrow example and exclusion of both P closers.

## Assistant percentages and actual receipts

Assistant percentages is a separate daily editor available to managers/directors and the identity with assistant schedule permission (Levon). It returns assistant identities and percentages only, not team tip receipts or payout amounts. Inputs are fixed percentages of the assistants' 18% pool, stored as integer basis points, rather than normalized relative weights. The editor shows the accumulated percentage and remaining share. Partial totals below 100% can be saved, totals over 100% are rejected, and day finalization requires exactly 100%. Changes require a reason, share the tip day's revision/closed lock, and are audited atomically. Closed days must be reopened by management before percentage edits.

New tip days default to percentage allocation for assistants. Pre-existing days without the new assistantShares field retain their previous proportional calculations until explicitly changed. Waiter calculations continue to use relative daily weights. Integer largest-remainder allocation preserves money exactly, and any partial assistant allocation exposes its unassigned remainder. No individual rates are invented. Values are per day, allowing shift-dependent shares without changing historical days.

Received amounts provides one actual-receipt entry per employee per Yerevan date, distinct from the calculated tip allocation. Employees can record their own past/current actual receipt; management can record/correct any waiter or assistant. Corrections require a reason. Version checks prevent duplicate/stale writes, prior versions are retained, and immutable activity records include the actor and before/after amount. This is a declaration of received money, not a bank transfer or modification of calculated allocations.

The report supports an employee selector for management, inclusive from/to dates up to 366 days, and presets for this month, last month, and last month's first day through today. It lists every calendar day, actual received amounts, the calculated allocation and provisional/final state, author and note. Total and average use actual receipts only. The average denominator is the count of days with an explicit receipt, including recorded zero; missing days remain blank and are excluded. Finalized calculated allocations have a separate total. Ordinary staff see only themselves; assistant schedule authority does not grant access to coworkers' receipt amounts. No historical amounts are backfilled or inferred.

Tests cover percentage authority, roster/total validation, partial totals, finalization locks, closed-day immutability, fixed-percentage and legacy calculations, whole-AMD conservation, receipt privacy, employee/date filters, inclusive periods, recorded-zero averages, correction reasons and stale-write protection.

The approved initial employee code is supplied only through the STAFF_INITIAL_CODES runtime secret. A matching login initializes the configured pending roster and assigns the intended employee credential once, using the existing keyed code digest and uniqueness checks. A durable one-time marker prevents a later login from restoring a disabled or rotated credential. The explicitly configured assignment rotates any existing credential for that employee and revokes prior sessions. Later manual rotation or disable actions are preserved by the one-time marker. No real employee code is stored in source or tests; tests use a distinct dummy credential and verify rights, one-time assignment and non-reactivation.

Authentication regression fix: signed session validation now accepts the same bounded lowercase alphanumeric/hyphen identities used by the seeded roster, alongside manager and existing UUID accounts. Session creation validates this format too. HMAC verification, expiration, role lookup, disable and revocation checks remain required. A regression test reproduces a seeded-code login followed by authenticated identity lookup, and checks rights plus rejection of tampered identities.

The confirmed management roster adds Vahe and Lyudvig as managers and a separate new Hayk as director, with no guessed surname or initial code. Existing assistant/waiter Hayk identities are retained. Ella remains the existing bootstrap manager. All three new roles use the same full-management authorization as Ella; activation requires a unique code issued in Team & access. The runtime roster importer now validates all supported staff roles and uses the matching job title. Tests activate isolated dummy management identities and verify their full management, percentage, receipt and closing-report access.

## Performance and HTTP hardening (2026-10-22)

Cards and gallery thumbnails use content-addressed 560px WebP previews. All original photos remain available for the main gallery. The 67 previews total 2,764,534 bytes versus 12,314,834 bytes for their originals (77.6% less); this is an asset-size comparison, not an end-to-end page-speed measurement. Run `python scripts/generate-photo-previews.py` with Pillow after adding photos. The hero gets high fetch priority; room panoramas load lazily. Availability requests cannot overlap in a visitor tab, polling pauses while the page is hidden, and it refreshes when visible again. Staff reservation polling also pauses in hidden tabs.

The initial runtime roster is marked only after its complete atomic batch succeeds. Reopening Team & access now performs one indexed marker lookup instead of repeating per-person write statements. A changed configured roster gets its own marker; existing accounts and manually changed roles/codes remain untouched. Reservation availability and date-sorted history have additional indexes, introduced by migration 0004.

All unsafe `/api/` requests require the same Origin. JSON request bodies are bounded by actual streamed UTF-8 byte count (1 KiB login, 8 KiB reservations, 256 KiB other APIs), including chunked or falsely sized bodies. Admin and API responses are `private, no-store`; response headers add nosniff, strict-origin referrer policy, and a limited CSP for base URLs, plugin objects and frame ancestors. The CSP permits ChatGPT embedding and is not a full script-nonce policy. Content-addressed photo previews may be cached for a year.

Login attempts share a database counter: 10 per IP per 15-minute fixed window. Guest booking submissions have separate 5-per-15-minute and 20-per-day fixed windows per IP, with Retry-After responses. Trusted Cloudflare connecting IP is used; missing IPs share an unknown bucket. Authenticated staff bookings retain their existing role checks and bypass guest limits. Counters are atomic across Worker instances and reject excess attempts before reservation inserts; cleanup deletes at most 32 expired counters per new bucket. This reduces single-IP abuse, not distributed bot traffic. Shared networks can hit the guest limit; the error offers calling the restaurant.

No runtime secrets, staff roster, booking database or live accounting data are copied to GitHub. C++ has not been introduced: these changes address image/network/database work in the existing Cloudflare Worker application. Regression checks: HTTP boundary tests, staff/history/authorization/rate-limit tests, translation coverage, TypeScript and production build.
