# Lock the student email to their login account

## What changes for a student

- On the bus registration form, the Email field is filled in automatically with the email they signed in with, shown greyed out and not editable.
- Whatever they type elsewhere, the saved application always carries their login email.
- In the student profile view, the email keeps showing that account email.
- If the admin rejects the application, the student sees the rejection remarks written by the admin, and can edit and resubmit the same application from the same login email (status returns to pending).


## What changes for the admin

- The admin can still edit a student's email in the Student details edit form.
- When the admin saves a new email for a student who has a login account, that account's sign-in email is changed too: from then on the student signs in with the new email address (same password, no re-confirmation needed).
- If the new email is already used by another account, the save is rejected with a clear message and nothing is changed.
- Quick-added students (no login account yet) simply get the email stored on their record.

## Technical notes

- `src/components/bus/StudentPortal.tsx`: fetch the signed-in email (via `getMe`, or reuse the existing status query) and seed `form.email`; render the email input as `readOnly`/`disabled` with a short hint.
- `src/lib/bus.functions.ts`
  - `submitRegistration`: ignore the client email and write `context.claims.email` (fall back to submitted value only if the claim is missing), so the stored email always equals the login email.
  - `updateStudent`: after the students-row update, if the email changed and the row has a `user_id`, load `supabaseAdmin` inside the handler (`await import("@/integrations/supabase/client.server")`) and call `auth.admin.updateUserById(user_id, { email, email_confirm: true })`. Surface a friendly error for duplicate-email failures and keep the row and account consistent (update the auth email first, then the row, or roll the row back on failure).
- No database migration needed.
