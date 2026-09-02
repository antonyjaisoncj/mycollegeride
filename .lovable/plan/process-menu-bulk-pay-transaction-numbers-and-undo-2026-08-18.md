# Process menu, Bulk Pay, transaction numbers and undo

## 1. "Receive" becomes "Process"

In the Fee payment collection list, the action button is always active and reads **Process**. Clicking it opens a small menu:

- **Monthly pay** — hidden once the month is already paid.
- **Settlement** — settle all outstanding months and close the registration.
- **Freeze** — stop dues from a chosen date.

So a student who has already paid the current month can still be settled or frozen; today that row is dead.

## 2. Bulk Pay

A **Bulk Pay** button sits next to the collection search box.

- It lists every enrolled student who has not paid the selected month, with roll number, name, slab, base, penalty (priced on the chosen value date) and payable amount.
- Students with an earlier unpaid month are listed but cannot be ticked; the row shows "Pending from <month>".
- Tick boxes select students; a running **Total** and count is shown.
- Value date and mode (cash / UPI / bank) apply to the whole batch.
- On confirm, all selected students are receipted with their own individual amounts under **one shared transaction number**; each student still gets their own receipt number.

## 3. Transaction numbers on everything

Every money event carries a transaction number: monthly fee, bulk pay, settlement, other income, expense, advance returned.

Format: `TXN-YYYYMMDD-####` (serial per day).

- The number is shown in the Receive/Process confirmation toast, in the statement rows, in expenses and in other income.
- A single bulk pay or settlement produces one transaction number covering all its rows.

## 4. Transaction lookup and undo

A **Transactions** section in the Fee payment tab (admin only):

- Search by transaction number, or browse by date.
- Shows the full detail: date, type, who recorded it, every line (student / particulars / vendor, month, base, penalty, amount) and the grand total.
- An **Undo transaction** button asks for confirmation and marks the whole transaction cancelled.

Cancelling keeps the rows for audit but flags them voided: they disappear from dues, collection status, statements, balances and advance totals, so the affected months become payable again. A cancelled transaction is shown struck through with "Cancelled on <date>" and cannot be undone twice.

## 5. Advance on settlement

When a settlement completes and the advance is returned:

- The Advance tab total "Advance currently held" drops by that amount (already the case) and the row shows the returned amount.
- The row status changes from **Held** to **Closed** (with the return date), matching the registration status.
- Undoing a settlement transaction restores the advance to Held and reopens the registration.

## Technical notes

- Migration: new table `public.transactions` (`id`, `txn_no text unique`, `txn_date date`, `kind text` — fee | bulk_fee | settlement | other_income | expense | advance_return, `created_by`, `cancelled_at timestamptz`, `cancelled_by`, `note`), with GRANTs (`select` to authenticated, `all` to service_role), RLS: admins manage, signed-in read. Daily counter table `transaction_counters(day date pk, last_no int)` plus `next_txn_no(_day date)` security-definer function, EXECUTE granted to service_role only (same pattern as `next_receipt_no`).
- Add nullable `transaction_id uuid references public.transactions(id)` to `payments`, `expenses`, `other_income`. Backfill existing rows by creating one legacy transaction per existing row so history stays viewable.
- Every read path filters out rows whose transaction is cancelled: `listDues`, `myFeeStatus`, statement readers, expense/other-income lists, roster "last paid", balances in `bus-helpers.ts`.
- New server fns in `src/lib/bus.functions.ts`: `bulkPayPreview`, `bulkPay`, `getTransaction`, `listTransactions`, `cancelTransaction`. `cancelTransaction` sets `cancelled_at`, and for settlement transactions also clears `closed_at`, `settlement_amount`, `advance_returned_at`, `advance_returned_amount` on the student.
- `recordPayment`, `settleStudent`, `addOtherIncome` and the expense insert all create a transaction row first and stamp `transaction_id`.
- UI: `ReceivePaymentDialog` keeps its three modes but is opened from a dropdown; new `BulkPayDialog.tsx` and `TransactionsSection.tsx` under `src/components/bus/`; `FeeTab.tsx` wires them; `AdvanceTab.tsx` badge shows Closed instead of Returned.
