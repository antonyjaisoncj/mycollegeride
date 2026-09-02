# Advance tab: limit vs. held, stage column, status rules

## 1. Advance amount at approval becomes a limit, not money received

Today, typing an advance amount on the approval form immediately creates a transaction and an advance ledger entry. That stops.

- The amount entered at approval (and when editing a student) is simply the **maximum advance** that may be held for that student. It creates no transaction and no ledger entry.
- Actual advance money is only recorded through the Process menu (Collect / Return) as it is today.
- Collecting more than the student's maximum is blocked with a clear message.

## 2. Advance tab columns

- "Collected" renamed to **Advance Collected**, "Returned" renamed to **Advance Returned**.
- "Monthly fee" column replaced by **Stage** (Stage-1 / Stage-2 / Stage-3).
- New **Maximum advance** column showing the limit set at approval.
- **Held** is now strictly Advance Collected minus Advance Returned (from the ledger), not a separately stored number.
- Footer totals and the two summary cards follow the same ledger figures.

## 3. Status rules

- Settled / closed registration: **CLOSED** (with the returned date as today)
- Frozen registration: **FREEZE**
- Held greater than zero, registration open: **ACTIVE**
- No advance transactions recorded: **NOT ACTIVE**

## Technical notes

- Migration: add `advance_limit numeric not null default 0` to `public.students`, backfilled from the current `advance_amount`; add it to `protect_student_admin_fields()`.
- `approveApplication` and `updateStudent` in `src/lib/bus.functions.ts`: write `advance_limit`; remove the advance transaction + `advance_entries` insert and the edit-delta ledger writes. `advance_amount` stays as the ledger-mirrored held balance maintained by `recordAdvance`, `settleStudent` and `undoTransaction` (unchanged).
- `listAdvances`: return `stage`, `advance_limit` and `frozen_at`; compute `held_now = collected_total - returned_total` from the ledger (drop the `opening` fallback and the monthly-fee config lookup), and derive status from closed/frozen/held.
- `recordAdvance`: reject a collection that would push held above `advance_limit`.
- `AdvanceTab.tsx`: rename headings, swap Monthly fee for Stage, add the Maximum advance column, apply the CLOSED / FREEZE / ACTIVE / NOT ACTIVE badges.
- Settlement, monthly statement advance-difference line and undo behaviour are unchanged.
