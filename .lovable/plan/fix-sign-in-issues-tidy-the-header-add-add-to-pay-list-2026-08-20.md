# Fix sign-in issues, tidy the header, add "Add to Pay List"

## 1. Password reset that actually works

Today the reset page only recognises a link that arrives with a `#type=recovery`
fragment or an already-live session. Reset mails now commonly arrive as a
`?code=...` or `?token_hash=...&type=recovery` link, which the page does not
handle — so it shows "invalid or expired" or bounces.

- `/reset-password` will handle all three link shapes: exchange a `code` for a
  session, verify a `token_hash` recovery token, or accept the legacy hash
  tokens.
- Clear states: "Checking your link", the new-password form, and a friendly
  "link expired — send a new one" with a button back to sign in.
- "Forgot password?" stays on the same page (no jump that feels like a new
  window), keeps the typed email, and confirms the mail was sent inline.

## 2. Registration form cannot be submitted while signed in

The form validates all fields at once and only surfaces the first problem as a
toast, so a missing address or phone can look like a dead button. The exact
cause is not confirmed yet, so the first step is to reproduce a signed-in
submit and read the real error, then:

- Show validation messages under each field, mark required fields, and scroll
  to the first error, so nothing fails silently.
- Surface the real server error text in the toast when the save is rejected.

## 3. Header cleanup

Remove the "Sign in" button in the top right of the landing page header. The
hero keeps the "Student registration" and "Admin sign in" buttons, and the
sign-in page keeps its current Sign in / Sign up tabs plus Continue with
Google. Access stays as it is: signing in with an admin account opens admin
mode, any other account opens student mode.

## 4. "Add to Pay List" in the Process menu

A new item alongside Settlement and Freeze that queues the student for the
next bulk payment.

- Available only when the student has nothing paid for the month, is not
  blocked by arrears and is not blacklisted; otherwise it is greyed out with
  the reason.
- Picking it adds the student to a pay list held for the selected month, and a
  toast confirms it.
- The Collection row shows a small "In pay list" badge, and the item flips to
  "Remove from pay list" for students already queued.
- The "Bulk pay" button shows the queued count, e.g. "Bulk pay (4)", and
  opening the dialog pre-ticks every queued student. Other eligible students
  can still be ticked manually.
- After a successful bulk pay the queue is cleared; changing the month clears
  it too.

## Technical notes

- `src/routes/reset-password.tsx`: add `exchangeCodeForSession` and
  `verifyOtp({ type: "recovery", token_hash })` paths before falling back to
  the current hash/session check.
- `src/routes/auth.tsx`: keep tabs and Google; only the forgot-password UX
  copy and state handling change.
- `src/routes/index.tsx`: drop the header sign-in button.
- `src/components/bus/StudentPortal.tsx`: field-level errors from
  `registrationSchema.safeParse`, no other behaviour change.
- `src/components/bus/FeeTab.tsx`: local `payList` state keyed by student id,
  reset on month change and after bulk pay; passed to `BulkPayDialog` as
  initially selected ids. No server or database change — the queue lives in the
  admin's screen until confirmed.
