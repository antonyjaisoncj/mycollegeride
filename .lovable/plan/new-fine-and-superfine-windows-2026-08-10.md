# New fine and superfine windows

Change only the dates that decide the penalty stage for each month.

## The rule

1. Fee is due on the **last day of the month** (unchanged). Paid on or before that day = no penalty.
2. **Fine** applies from the day after the due date, and runs until the **later** of:
   - the 5th working day after the due date (working days = Monday to Friday), and
   - the next Friday after the due date.
3. **Superfine** applies from the day after the fine window closes, until the **next Friday after that fine-window end date**.
4. After the superfine window closes, the student is blacklisted.

Example for July 2026 (due Fri 31 Jul 2026):
- 5th working day after due date: Fri 07 Aug 2026; next Friday after due date: Fri 07 Aug 2026 → fine till 07 Aug 2026
- Superfine: 08 Aug – 14 Aug 2026 (next Friday)
- Blacklisted from 15 Aug 2026

Example for Aug 2026 (due Mon 31 Aug 2026):
- 5th working day: Mon 07 Sep 2026; next Friday: Fri 04 Sep 2026 → later is 07 Sep, so fine till 07 Sep 2026
- Superfine: 08 Sep – 11 Sep 2026 (next Friday)
- Blacklisted from 12 Sep 2026

Penalty amounts stay as agreed: fine = slab/12 (₹50 / ₹100), superfine = slab/4 (₹150 / ₹300), each being the total penalty added to the fee for that stage.

## What the user sees

- The Fee Payment tab header shows the recalculated "Fine till" and "Superfine till" dates.
- The Receive dialog recalculates the stage and penalty from the chosen Value Date using the new windows, so back-dated payments follow the same rule.
- Student portal and statement views pick up the new dates automatically.

## Technical notes

- `src/lib/fee-rules.ts`: add `nthWorkingDayAfter(iso, n)` counting Mon–Fri only. `windowsFor(period)` becomes: `dueDate` = last day of month; `fineUntil` = later of `nthWorkingDayAfter(dueDate, 5)` and `nextFridayAfter(dueDate)`; `superfineUntil` = `nextFridayAfter(fineUntil)`.
- `stageOn`, `penaltyAmount`, and `computeDue` keep their current shape and simply read the new window dates, so `recordPayment`, the auto-blacklist routine in `src/lib/bus.functions.ts`, and the Receive dialog follow automatically.
- No database migration; already-recorded payments keep their stored stage and amounts.
