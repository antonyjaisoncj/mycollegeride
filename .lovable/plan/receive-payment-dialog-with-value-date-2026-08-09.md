# Receive payment dialog with Value Date

Today the "Receive" button records a payment instantly, using today's date to decide fine/superfine. This adds a confirmation window with a back-datable Value Date, and a guaranteed-unique auto receipt number.

## What changes

**1. Receive opens a small dialog**

Clicking "Receive" on a student row opens a compact dialog showing:
- Student name, roll number, month
- Value Date field — a date picker defaulting to today; the admin can pick an earlier date
- Base amount, penalty, and total, all recalculated live as the Value Date changes
- Stage badge (On time / Fine / Superfine / Blacklisted) for the chosen date
- Payment mode (Cash / UPI / Bank) and optional reference number
- Confirm and Cancel buttons

The inline mode/reference controls move from the table row into this dialog, so the table row keeps just the Receive button.

**2. Fine and superfine follow the Value Date**

The penalty stage is decided by comparing the Value Date (not today) against the month's due date, fine Friday, and superfine Friday. Back-dating a payment to before the due date correctly records it as on time with no penalty.

Guardrails:
- Value Date cannot be in the future.
- Value Date cannot be earlier than the first day of the month being paid.
- The server recomputes the amounts from the Value Date; the browser's numbers are never trusted.

**3. Receipt number is system generated and unique**

Receipt numbers are issued by the database from a per-month counter, so two admins collecting at the same time can never get the same number. Format: `RCT-<YYYYMM>-<0001>`, e.g. `RCT-202607-0042`. The receipt number stays unchangeable and is shown in the roster and student detail history.

**4. Value date is stored and shown**

The payment record keeps the value date separately from the timestamp it was entered, so statements and the student's transaction history show the date the fee counts against.

## Technical notes

- Migration: add `value_date date not null default current_date` to `public.payments`; backfill existing rows from `paid_at`. Add a sequence-backed `next_receipt_no(period)` SECURITY DEFINER function (execute granted to `authenticated`) or a `receipt_counters` table with an atomic upsert-returning increment, used inside `recordPayment`.
- `src/lib/fee-rules.ts`: `computeDue` already accepts an `onDate`; reuse it for both the dialog preview and the server calculation.
- `src/lib/bus-schemas.ts`: extend `recordPaymentSchema` with `value_date` (YYYY-MM-DD).
- `src/lib/bus.functions.ts`: `recordPayment` validates the value-date range, calls `computeDue(period, base, value_date)`, obtains the receipt number from the DB, and writes `value_date`. `makeReceiptNo` in `bus-helpers.ts` is retired.
- New `src/components/bus/ReceivePaymentDialog.tsx`; `FeeTab.tsx` drops the inline mode/ref inputs and opens the dialog instead.
- `StudentDetailDialog.tsx` and the statement/CSV export show Value Date in place of the entry timestamp.
