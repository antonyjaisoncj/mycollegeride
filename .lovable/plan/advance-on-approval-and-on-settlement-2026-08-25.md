# Advance on approval and on settlement

## 1. Approving a student with an advance records a real transaction

Today the approval screen stores the advance amount as a number on the student record only — no dated entry exists anywhere, so the Advance tab shows a balance that came from nowhere and the student's log has nothing to show for it.

Change: when the admin approves an application with an advance amount above zero, the system creates a proper transaction (with its own transaction number, dated the student's date of joining) and an "Advance collected" entry in that student's advance ledger. The Advance tab then shows the student as **Held** with that amount, and the entry appears in the student's transaction history with its date and transaction number. Approving with an advance of zero creates nothing.

The same applies when the admin later edits the advance amount on an approved student: the difference is written to the ledger as a collection or a return, dated today, so the ledger and the held balance never drift apart.

## 2. Student transaction list shows advance movements

The Student details dialog currently lists fee payments only. It gains an "Advance" section listing each advance collection and return with date, amount, mode, note and transaction number, so a student's log is complete.

## 3. Settlement clears the advance holding and flips the status

Settlement already refunds the advance and writes a return entry. It will additionally set the student's held advance to zero, so:

- The Advance tab shows Held = ₹0 and the status badge changes from **Held** to **Closed**, with the refunded amount shown.
- The Advance tab total of advance held drops by that student's amount.
- The monthly statement's "Advance held — difference from last month" line picks up the reduction on the settlement date.

Undoing a settlement transaction reverses all of it — the held amount, the return entry and the closed status — as it does today.

## Technical notes

- `approveApplication` in `src/lib/bus.functions.ts`: after the student update, when `advance_amount > 0`, call `createTransaction` (kind `advance`, date = `date_of_joining`) and insert an `advance_entries` row of kind `collect`, mode `cash`, note "Advance collected at approval". Needs `supabaseAdmin` imported inside the handler (transaction counters are service-role only).
- `updateStudent`: compare the incoming `advance_amount` with the stored one; write a `collect`/`return` ledger entry plus transaction for the difference instead of silently overwriting.
- `settleStudent`: add `advance_amount: 0` to the student update when an advance is refunded (alongside the existing `advance_returned_at`/`advance_returned_amount`).
- `listAdvances`: with the ledger now complete, the derived `opening` fallback stays as a safety net; `held_now` becomes the stored `advance_amount`, which is zero after settlement.
- `undoTransaction`: the settlement branch must restore `advance_amount` to the refunded amount (currently it adds the amount back to the stored balance — verify it lands on the original value now that settlement zeroes it).
- `StudentDetailDialog`: fetch `listStudentAdvances` for the open student and render the new Advance section.

## 4. On/off switch for the Advance tab

The Advance tab joins Expense tracker, Monthly statement and Driver in the admin's visibility toggles: when it is off, students and the driver do not see the Advance tab at all; the admin always sees it.

Technical: add `advance_visible boolean not null default true` to `public.app_settings` (migration), extend the settings type/parser in `src/lib/bus-helpers.ts`, add the toggle row in `src/components/bus/TabVisibilityToggles.tsx`, gate the tab in `src/routes/_authenticated/dashboard.tsx`, and reject `listAdvances`/`listStudentAdvances` for non-admins when the flag is off (same guard style as `driver_visible`).
