# Advance ledger, Process menu, and master reset

## 1. Advance becomes a real ledger

Today the advance is just a number stored on the student record, with an inline edit box in the Advance tab. It becomes a dated, receipted ledger.

- New table for advance entries: student, date, type (collected / returned), amount, payment mode, note, transaction number, void marker.
- Every collection and every return gets its own transaction number (same `TXN-YYYYMMDD-####` register as fees and expenses) and shows up in the Transactions section and in the monthly statement.
- The advance held per student = collected minus returned, kept in sync on the student record so existing screens keep working.
- Settlement keeps working as now: it returns the remaining advance, and that refund is written as a "returned" ledger entry so it appears in the student's advance history.
- Cancelling an advance transaction reverses the held amount, like other transactions.
- Existing advance amounts already on record stay as the opening held balance; no backfilled entries.

## 2. Advance tab rework

- Remove the inline amount input and Save button.
- Roll list ordered by joining date, one row per enrolled student showing: photo, roll number, name, boarding point, joining date, monthly fee (slab amount), advance collected, advance returned, and status (Held / Closed / Not collected).
- Summary cards for total held and total returned stay.
- Clicking a row opens a panel listing that student's advance transactions: date, time, transaction number, type, mode, amount, note, and running balance. Voided entries shown struck through.
- Print button on the tab: header with college/period, then the roll list with status and totals, print-only styling like the Monthly statement tab.

## 3. "Advance" in the Process menu

- Add **Advance** as the first option in the Process dropdown of the Fee payment tab, above Settlement and Freeze.
- Picking it opens the existing Receive dialog in a new Advance mode with: direction (Collect / Return), amount (defaults to one month's fee when collecting, to the held balance when returning), value date (defaults to today), payment mode, and note.
- Returning more than the held balance is blocked. Collecting for a closed registration is blocked.
- On confirm, the entry is written with a transaction number and the Advance tab, student detail, and transaction list refresh.

## 4. Master reset in the Registration tab

- Admin-only "Master reset" action in the Registration tab, placed in a clearly separated danger area.
- Confirmation dialog requiring the admin to type `RESET` before it is enabled, with a plain warning that the action cannot be undone.
- Wipes all app data: students, payments, advance entries, expenses, other income, transactions, fee config, and the receipt/transaction counters (so numbering restarts).
- Login accounts and admin roles are untouched; students who already have accounts can register again from scratch.
- Uploaded student photos in storage are cleared too.

## Technical notes

- New table `public.advance_entries` with grants, RLS (admins manage, students read their own) and a `kind` check of `collect`/`return`; entries recorded through `next_txn_no` and mirrored into `transactions` with kind `advance`.
- New server functions in `src/lib/bus.functions.ts`: `recordAdvance`, `listStudentAdvances`, `masterReset`; `listAdvances` extended with per-student collected/returned totals and slab fee; `setAdvanceAmount` removed.
- `settleStudent` and `cancelTransaction` updated to write/reverse advance entries.
- UI changes in `AdvanceTab.tsx` (read-only list, row expansion, print), `ReceivePaymentDialog.tsx` (advance mode), `FeeTab.tsx` (menu item + mutation), `RegistrationTab.tsx` (reset dialog).
