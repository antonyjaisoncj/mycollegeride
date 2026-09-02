# Advance out of "other income", into a single monthly difference row

## What changes

Right now every advance collected from a student is also written as an "Advance from student" line under *Income other than fee and fine*, and every advance returned is written as an expense. That duplicates the advance ledger and clutters both the Fee payment tab and the monthly statement.

### 1. Advance leaves the other-income and expense lists

- Collecting an advance no longer creates an "Advance from student" other-income entry.
- Returning an advance (standalone return, or the refund at settlement) no longer creates an expense entry.
- The advance movement continues to be recorded exactly once, in the student's advance ledger, with its own transaction number — so it still shows in the Transactions list and in the student's advance history.
- Existing "Advance from student" income rows and "Advance returned" expense rows created by earlier advance transactions are removed, so past months stop double-counting.

### 2. Advance tab shows it per student

The advance tab already lists each enrolled student with collected, returned and held amounts, and a status of Held / Closed / Not collected. That status is driven by the ledger, so it flips to **Held** as soon as an advance is collected and to **Closed** once it is returned — no change needed beyond removing the duplicated bookkeeping.

### 3. Monthly statement gets one advance row

The statement gains a single line, placed with the income figures:

```text
Advance held — difference from last month      + / -
```

- It is the total advance held by all students at the end of the selected month minus the total held at the end of the previous month.
- A net collection in the month increases the month's income; a net return decreases it.
- The row feeds the month's received/closing totals, print output and CSV export the same way other income does.
- The opening/closing balance chain (statement and Expense tracker balance block) uses the same figure, so the carried-forward balance stays consistent month to month.

## Technical notes

- `recordAdvance` in `src/lib/bus.functions.ts`: drop the `other_income` insert on collect and the `expenses` insert on return; keep the transaction number, the `advance_entries` row and the held-balance update.
- `settleStudent`: drop the advance-refund `expenses` insert; keep the `advance_entries` return row and the `advance_returned_at`/`advance_returned_amount` update.
- `cancelTransaction`: unchanged (it already deletes across all four tables); with no income/expense rows written, cancelling an advance simply reverses the ledger entry and the held balance.
- New helper in `src/lib/bus-helpers.ts`: `advanceNet(client, from, to)` summing non-voided `advance_entries` (`collect` positive, `return` negative) over a date range; `balanceBefore` adds the net advance before the period so opening balances include advances.
- `monthlyStatement` returns `advanceDelta` (net movement inside the month) and includes it in `receivedTotal`-side totals and `closing`; `listExpenses`' balance block adds the same figure.
- Data cleanup migration/statement: delete `other_income` rows whose `txn_no` belongs to an `advance` transaction and `expenses` rows whose `txn_no` belongs to an `advance_return` or settlement advance refund.
- UI: `StatementTab.tsx` renders the new row in the income section, the totals block, the print layout and the CSV; `ExpenseTab.tsx` balance block shows it as one line.
