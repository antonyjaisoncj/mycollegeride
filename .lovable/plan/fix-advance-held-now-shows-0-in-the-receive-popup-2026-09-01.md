# Fix: "Advance held now" shows 0 in the Receive popup

## What is wrong

Advances collected through the Receive popup do land in the advance ledger — that is why the Advance tab shows the right Collected/Held figures. But the copy of the held amount kept on the student record never gets updated: a safety rule on the students table silently discards changes to advance fields when the update is made by the system (not by a signed-in admin), so it stays at 0.

Confirmed in the data: every approved student has a stored advance of 0, while several of them have ledger entries of 600 or 1200 collected.

The Receive popup (Settlement and Return advance) reads that stale stored number, so it shows "Advance held now: 0" and refuses to return anything, while the Advance tab shows the true amount.

## The fix

Stop trusting the stored copy and read the held balance from the advance ledger — the same source the Advance tab already uses — everywhere the amount matters:

- Settlement preview: "Advance held now", the advance-refund line and the net payable.
- Confirming a settlement: the amount that may be returned and the return entry written.
- Returning advance from the Process menu: the cap on how much can be returned.
- Undoing a settlement or an advance transaction: the balance restored afterwards.

The stored field keeps being maintained as a mirror, but no screen depends on it any more, so no stale value can be shown again.

## Technical notes

- Root cause: `protect_student_admin_fields()` resets `advance_amount` to its old value whenever `has_role(auth.uid(),'admin')` is false; `recordAdvance` and `settleStudent` update via `supabaseAdmin` where `auth.uid()` is null, so the write is dropped.
- Add a small `heldForStudent(supabaseAdmin, studentId)` helper in `src/lib/bus.functions.ts` summing non-voided `advance_entries` (collect − return).
- Replace `Number(student.advance_amount)` at lines ~741 (`settlementPreview`) and ~774 (`settleStudent`) with that helper; keep the `advance_returned_at` closed-registration check.
- `recordAdvance` already computes `held` from the ledger — unchanged.
- `undoTransaction` (~1866-1885): recompute the balance from the ledger after voiding entries instead of arithmetic on the stored value.
- No migration required; the trigger stays as-is so students still cannot alter advance fields.
