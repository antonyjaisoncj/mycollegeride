# Other income, detailed monthly print, and registration close/freeze

## 1. Income other than fee and fine (Fee payment tab)

New section under the fee collection list, admin-only, for the selected month:

- Table of entries with columns: Date, Particulars, Remarks, Amount, and a delete action.
- Last row is an inline add line: date (defaults to today), particulars, remarks, amount, and an Add button.
- Months with no entries simply show an empty section — nothing is required every month.
- Section total is shown and feeds into the monthly statement as income.

Students and the driver never see this section.

## 2. Monthly statement: detail by transaction date

The statement keeps its current month-of-fee summary and gains a transaction-date view:

- **Fee received in this month** — every payment whose value date falls in the selected month, one row each: date, receipt number, roll number, name, the month the fee was for, base, fine/superfine, total. Arrears collected this month (e.g. July fee received in August) appear here with "For: July 2026".
- **Other income** — the entries from section 1 for this month.
- **Expenses** — full transaction list for the month (date, category, vendor, bill no, amount) plus the existing category totals.
- **Totals** — fee received + other income − expenses = net for the month, alongside the existing month-of-fee collection summary.

Print output renders the same detail tables in a clean print layout (all rows, no scroll clipping), and CSV export includes the transaction lists. Both stay disabled for students.

## 3. Registration tab: close and freeze

New "Close / freeze registration" section in the student details popup, admin-only:

- **Freeze registration** — set a freeze value date. From that date the student's fee, fine and superfine stop accruing: no new monthly dues after the freeze month, and penalty stages are computed as of the freeze date. The student drops out of the fee collection list for later months and out of defaulters.
- **Close registration** — records a settlement amount and closing date; the student is marked closed, removed from the collection list, defaulters and the driver roster, and marked "Closed" in the roster. The settlement amount is receipted and counted as income on its date in the monthly statement.
- Both are reversible by the admin (unfreeze / reopen).

## 4. Monthly balance carried forward (Expense tracker tab)

The expense tab gains a balance block for the selected month:

- Opening balance (carried forward from the previous month)
- Add: fee and fine received this month + other income this month
- Less: expenses this month
- **Closing balance** — carried forward as the next month's opening balance

The balance may be negative and is shown in red when it is. The chain starts from the first month with any activity; each month's closing balance is computed by rolling forward, so a correction in an earlier month flows through. The same opening/closing balance lines also appear in the monthly statement and its print output.

## Technical notes

- Migration: `other_income` table (date, particulars, remarks, amount, created_by, timestamps) with admin-only RLS and GRANTs; `students` gains `frozen_at`, `closed_at`, `settlement_amount`.
- `src/lib/fee-rules.ts`: penalty computation accepts an effective cut-off date so a frozen student's stage stops advancing.
- `src/lib/bus.functions.ts`: new `listOtherIncome` / `addOtherIncome` / `deleteOtherIncome`; new `freezeStudent` / `closeStudent`; `listDues`, `myFeeStatus`, `driverRoster` and `monthlyStatement` skip frozen/closed students past their cut-off; `monthlyStatement` additionally queries payments by `value_date` range for the received-in-month list; a shared `balanceUpTo(period)` helper sums all receipts, other income and expenses before the month to produce the opening balance, reused by `listExpenses` and `monthlyStatement`.
- UI: new `OtherIncomeSection.tsx` in the Fee payment tab, balance block in `ExpenseTab.tsx`, extended `StatementTab.tsx` with detail tables and a print stylesheet, close/freeze controls in `StudentDetailDialog.tsx`.

