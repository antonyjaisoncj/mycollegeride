# Editable amounts and "Payment Complete" in Monthly pay

## What changes for the admin

In **Process → Monthly pay**:

- **Base** and **Penalty** become editable fields, pre-filled with the amounts the system computes for the chosen value date. Any amount is allowed (higher or lower, including zero) — a "computed: X" hint sits under each field so it is clear when the admin has overridden it.
- The **Total payable** line updates live from the two edited fields.
- A checkbox **Payment Complete** sits above the Confirm button, ticked by default.

### Behaviour of the tick

- **Ticked** — the month is settled. It disappears from the pending/dues list, and the next month becomes payable, exactly as today.
- **Unticked** — the receipt is recorded as a **part payment**. The month stays in the pending list and later months stay blocked until it is completed. The collection row shows the amount already received and the remaining balance, and its action button still offers Monthly pay so the admin can take further instalments.

When a part-paid month is opened again in Monthly pay, the Base field is pre-filled with the remaining balance (computed due minus what has already been received for that month) so the admin can simply confirm with the tick on to close it.

Every instalment gets its own receipt number and its own transaction number, so all of them show in the student's transaction list, in statements and in monthly totals — nothing about how money is counted changes.

## Technical notes

- **Migration**
  - `ALTER TABLE public.payments ADD COLUMN settled boolean NOT NULL DEFAULT true;` (existing rows stay complete).
  - Drop `payments_student_id_period_key` and replace it with a partial unique index so only one *settled*, non-voided payment can exist per student/month, while any number of part payments are allowed:
    `CREATE UNIQUE INDEX payments_student_period_settled_key ON public.payments (student_id, period) WHERE settled AND voided_at IS NULL;`
- **Schema** — `recordPaymentSchema` gains `base_amount`, `penalty_amount` (non-negative numbers, optional; fall back to computed) and `settled: boolean`.
- **`recordPayment`** — uses the supplied base/penalty when present instead of `computeDue` values, stores `settled`, and keeps stage derived from the value date. The "already paid" duplicate error message stays, now triggered only by a second settled row. Auto-blacklist clearing only happens when `settled` is true.
- **Paid/unpaid reads** — every query that decides whether a month counts as paid adds `.eq("settled", true)`: `listDues` (paid-period set and `paidBy`), `monthlyStatement`'s defaulter `pendingFrom` scan, `bulkPayPreview`/`bulkPay`, the driver paid/unpaid badge query, `settlementPreview`/`settleStudent` outstanding months, and the student-side unpaid list in `bus-helpers.ts`. Money aggregations (statement receipts, balances, student ledger) keep reading all non-voided rows so part payments are counted as income.
- **`listDues`** additionally returns `partPaid` (sum of non-settled totals for that month) per row so the collection table can show "Received X · Balance Y" and the dialog can pre-fill the remaining base.
- **UI** — `ReceivePaymentDialog.tsx` monthly branch gets the two amount inputs, the live total, and the Payment Complete checkbox; `FeeTab.tsx` passes `partPaid` through and renders the part-paid hint on the row. Settlement, Freeze, Advance and Bulk Pay are untouched.
