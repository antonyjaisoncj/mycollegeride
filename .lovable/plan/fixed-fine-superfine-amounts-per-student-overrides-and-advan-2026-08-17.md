# Fixed fine/superfine amounts, per-student overrides, and Advance

## 1. Fine and superfine become fixed amounts

Instead of deriving penalties from the slab (base/12 and base/4), each student carries their own penalty amounts:

| Slab | Fine | Superfine |
|---|---|---|
| Lower | Rs 50 | Rs 100 |
| Higher | Rs 100 | Rs 200 |

These are the defaults. Every student record stores its own fine and superfine amount, seeded from the slab at approval, so changing the defaults later never disturbs existing students.

## 2. Admin sets them at approval and can edit later

- On the pending-application card, next to Roll number and Date of joining, the admin gets three new fields: **Fine amount**, **Superfine amount**, **Advance amount**. They are prefilled with the slab defaults (advance = one month's fee for that slab, from the current month's fee configuration) and can be changed before pressing Approve.
- The same three fields appear in the Student details dialog in admin edit mode, so they can be corrected any time.
- The Receive dialog, the collection list, the student portal and the statement all use the student's stored amounts when showing fine/superfine.

## 3. New "Advance" tab

A new tab appears after Driver. It lists every enrolled (approved) student ordered by date of joining — earliest first — showing: photo, roll number, name, date of joining, slab, advance amount, and registration status (Active / Closed, with the refunded advance shown once closed). A total of advance held is shown at the top. Admin can edit an advance amount inline; students and the driver see it read-only, subject to the same visibility toggle style as the other restricted tabs.

## 4. Advance is returned at settlement

In the Receive dialog's Settlement mode, the summary gains an "Advance refunded" line:

```text
Outstanding dues (all pending months)   +
Advance held                            -
------------------------------------------
Net payable by student (or refund due)
```

On confirming, the student's outstanding months are receipted as today, the advance is recorded as returned, and the registration status becomes CLOSED. If the advance exceeds the dues, the difference is shown as a refund payable to the student. The advance return is written to the books so the monthly statement reflects the cash going out on the settlement date.

## Technical notes

- Migration: add to `public.students` — `fine_amount numeric not null default 50`, `superfine_amount numeric not null default 100`, `advance_amount numeric not null default 0`, `advance_returned_at date`, `advance_returned_amount numeric`. Backfill existing rows from slab (lower 50/100, higher 100/200). Add the new columns to `protect_student_admin_fields()` so students cannot alter them.
- `src/lib/fee-rules.ts`: `penaltyAmount(base, stage)` gains an optional per-student `{ fine, superfine }` override; add `DEFAULT_PENALTIES` by slab. `computeDue` passes the override through. Window/date logic is unchanged.
- `src/lib/bus.functions.ts`: `approveApplication`, `quickAddStudent` and `updateStudent` accept and persist the three amounts; `listDues`, `settlementPreview`, `settleStudent`, `getStudentDetail` and the statement readers pass the student's amounts into `computeDue`. `settleStudent` subtracts the advance, sets `advance_returned_at`/`advance_returned_amount`, stores the net in `settlement_amount`, and writes the advance return as an expense-side entry on the settlement date.
- `src/lib/bus-schemas.ts` / `bus-helpers.ts`: extend the approval, update and settlement schemas; `outstandingMonths` takes the penalty override.
- New `src/components/bus/AdvanceTab.tsx`; registered in `src/routes/_authenticated/dashboard.tsx` after the Driver tab.
- Already-recorded payments keep their stored penalty amounts; nothing is recomputed retroactively.
