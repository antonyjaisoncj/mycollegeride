# Plan: Slim student roster + per-student transaction view

## What changes on screen

The Registration tab's student roster becomes a compact list with only:

```text
Photo (stamp size) | Roll number | Name | Boarding point | Last paid fee | Status
```

- "Last paid fee" shows the most recent payment: amount and the month it was for
  (e.g. "Rs.600 · Jul 2026"), or "—" when the student has never paid.
- "Status" shows Active / Blacklisted / Rejected badges.
- Columns removed from the table: application number, branch, stage, blacklist button.
  Blacklisted students are still shown with a subtle red tint on the row so nothing is lost;
  the blacklist/clear action moves into the student detail view.
- Rows are clickable.

## Student detail view

Clicking a row opens a dialog for that one student showing:

- Their stamp-size photo, name, roll number, boarding point, stage and status.
- A **full transaction list**: every payment ever recorded — month, receipt number, base amount,
  penalty, total, penalty stage (on time / fine / superfine), payment mode and date.
- A total-paid figure at the bottom.
- Admin-only actions kept here: blacklist / clear.

Access rules (enforced on the server, not just hidden in the UI):
- An admin can open any student's detail.
- A signed-in student can only open their own record; any request for another student's
  transactions is rejected.

Students continue to see their own history in their portal; this detail view is the same data
reachable from the roster.

## Technical changes

### 1. Validation — `src/lib/bus-schemas.ts`
Add `studentIdSchema = z.object({ id: z.string().uuid() })`.

### 2. Server functions — `src/lib/bus.functions.ts`
- `listApplications`: also fetch payments for the listed students (single query on `payments`
  ordered by `paid_at desc`) and attach a `last_payment` summary
  (`{ period, total_amount, paid_at }` or `null`) to each student row, so the roster does not
  need an extra request per student.
- New `studentDetail` (GET, `requireSupabaseAuth`, input `studentIdSchema`):
  - loads the student row;
  - authorises: allowed when the caller is an admin (`isAdmin`) **or** `student.user_id === context.userId`; otherwise throws "Forbidden";
  - returns the student plus all `payments` for that student ordered newest first, and a
    signed photo URL when `photo_path` is set.

### 3. UI — `src/components/bus/RegistrationTab.tsx`
- Trim the roster table to the five columns above; keep the existing signed-URL photo lookup
  (`photoUrls`) for the thumbnails, sized ~32x40px (stamp size).
- Row `onClick` sets `selectedId` and opens a new `StudentDetailDialog`.
- `StudentDetailDialog` (new component in `src/components/bus/StudentDetailDialog.tsx`) uses
  `useQuery(["student-detail", id])` against `studentDetail`, renders the profile header and the
  transactions table, and hosts the blacklist toggle for admins.
- Amounts formatted with the existing `formatMoney` / dates with `formatDate` from
  `src/lib/fee-rules.ts`.

### 4. Database
No migration needed — existing tables, columns and access rules already cover this; the new
server function does its own ownership check on top of them.

## Out of scope
- Editing student details from this view (separate change).
- Recording a payment from the detail dialog; that stays on the Fee Payment tab.
