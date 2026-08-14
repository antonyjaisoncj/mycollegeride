# Sequential fee payment, tab visibility toggles, restricted student expense view

## 1. Fees must be paid month by month, in order

Today a payment can be recorded for any month independently. Change it so a student's
dues run as a continuous chain from their joining month:

- The oldest unpaid month from the joining month onward is the only month payable.
- August cannot be received while July is unpaid — the Receive action is blocked with
  a clear message naming the earliest outstanding month.
- Fine and superfine keep being computed for each month from that month's own due date
  and the value date used, so old unpaid months carry their full penalties.
- The Fee Collection list shows, per student, their earliest outstanding month and a
  count of pending months, so the office can see arrears at a glance.
- Auto-blacklisting stays as is (superfine window lapsed on the outstanding month).

## 2. Admin ON/OFF switches for Expense tracker, Monthly statement and Driver tabs

- A new settings record holds three switches: expenses visible, statement visible,
  driver tab visible.
- Only the admin can change them; everyone signed in can read them.
- Switches appear in the Registration tab, next to the existing Driver access box.
- When a switch is OFF, students (and the driver for the driver tab) no longer see that
  tab, and the matching data calls refuse non-admin requests. Admin always sees everything.

## 3. Students get a limited Expense tracker view

- Students may only browse months up to the previous month; the current month is not
  selectable and the server rejects a current-or-future month for non-admins.
- The CSV download and Print buttons are disabled for students on the Expense tracker
  and Monthly statement tabs.
- Admin behaviour is unchanged.

## Technical notes

- Migration: `app_settings` single-row table with the three boolean flags, plus grants,
  RLS (read for authenticated, write for admin) and an updated_at trigger.
- `src/lib/fee-rules.ts`: helper to enumerate the periods from a joining date to a target
  period.
- `src/lib/bus.functions.ts`:
  - `listDues` adds `earliestUnpaidPeriod` and `pendingMonths` per row (query all payments
    for each student from joining month to the selected period).
  - `recordPayment` rejects a payment when an earlier month is unpaid.
  - `listExpenses` / `monthlyStatement` / `driverRoster` check the corresponding flag and
    the previous-month rule for non-admins.
  - New `getAppSettings` and admin-only `setAppSettings`.
- UI: `FeeTab` / `ReceivePaymentDialog` surface arrears and disable Receive when blocked;
  `ExpenseTab` and `StatementTab` gain `canExport` handling; `dashboard.tsx` hides tabs by
  flag; `RegistrationTab` gains the switches.
