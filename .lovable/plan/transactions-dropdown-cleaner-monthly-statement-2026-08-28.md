# Transactions dropdown + cleaner monthly statement

## 1. Transactions back, but collapsed

In the Fee payment tab, restore the Transactions section as a collapsible panel:

- A "Transactions" button/header sits below the collection list; the panel is closed by default.
- Clicking it expands the existing lookup (search by transaction number, browse by date, view details, undo).
- Admin only, exactly as before — nothing else about it changes.

## 4. Defaulters: show fee-pending month

In the statement defaulters list, add a column that shows the earliest month for which the student still owes fee (their oldest unpaid period), e.g. "Pending from July 2026". This is derived from the same sequential-dues logic already used for payment collection.

## 2. Monthly statement: hide zero-value lines

In the "Fees billed for <month>" card, only show rows whose value is not zero:

- Base fee, Fine + superfine, Paid on time, Paid with fine, Paid with superfine, Unpaid, Blacklisted are each skipped when zero.
- "Approved students" always stays visible so the card is never empty.
- The same rule applies to the printed and CSV output.

## 3. Previous-month fees collected this month

The receipts table already lists every payment received during the month with its "Fee for" month. Add a clear split so arrears are visible:

- Group the receipts table into "For <current month>" and "For earlier months", each with its own subtotal, then the overall total received.
- Add one summary line in the Monthly balance card: "Of which, arrears for earlier months".
- Include the same split in the CSV export and print view.

## Technical notes

- `src/components/bus/FeeTab.tsx`: re-import `TransactionsSection` and wrap it in a shadcn `Collapsible` (open state local, default closed).
- `src/components/bus/StatementTab.tsx`: presentation-only changes — filter zero rows in the "Fees billed" `dl`, partition `data.receipts` by `for_period === period`, render subtotal rows, mirror both in `exportCsv`, and add the "Pending from" column to the defaulters table.
- `src/lib/bus.functions.ts`: expose `pendingFrom` in each defaulter object returned by `monthlyStatement`.
- No schema changes.
