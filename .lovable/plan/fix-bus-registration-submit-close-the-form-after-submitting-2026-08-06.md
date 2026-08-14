# Fix bus registration submit + close the form after submitting

## Why submitting never works

The `students` table requires an **application number** on every row, but nothing ever fills it in — the database has no automatic numbering, and neither the student registration form nor the admin "add student by name" box supplies one. Every insert is rejected by the database, so the form always fails. (Confirmed: the students table currently has 0 rows.)

## The fix

1. **Automatic application numbers.** Give the application number a database-side sequence starting after the highest existing number, so every new registration gets the next serial number automatically, with no race between two students submitting at the same time. This also fixes the admin quick-add box, which has the same problem.

2. **Close the form after a successful submit.** Once the registration goes through, the form collapses and the Registration tab shows the submitted application card ("Application #N — pending approval") instead of the empty form.

3. **Clearer failures.** If a submit is still rejected for any reason, show the actual reason in the error toast rather than a generic message.

## Technical notes

- Migration: create a sequence for `public.students.application_no`, set it as the column default and owned by the column, and initialise it to `max(application_no) + 1`.
- `submitRegistration` and `quickAddStudent` in `src/lib/bus.functions.ts` keep inserting without `application_no`; the default supplies it. Insert calls get `.select().single()` so the created row (and its number) comes back.
- `src/components/bus/StudentPortal.tsx`: on submit success, reset `showForm` to false, clear the photo file state, and invalidate `my-fee-status` so the status card renders.
- No RLS change needed — the existing student insert policy (own `user_id`, pending, no roll number) already permits these rows.
