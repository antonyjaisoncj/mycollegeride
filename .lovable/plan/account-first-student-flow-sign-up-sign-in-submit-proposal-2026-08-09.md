# Account-first student flow: sign up, sign in, submit proposal

## Goal

A first-time student creates an account with their email address and a password, is signed in straight away, and lands on the bus registration form to submit their proposal.

## Current state

The sign-in page already has "Sign in" and "Create account" tabs, forgot-password, and a password reset page. The one thing blocking new students is that the backend requires an emailed confirmation link before a new account can sign in — and confirmation emails depend on a sender domain that isn't set up, so students get stuck on "Confirm your email".

## Changes

1. Turn off the email confirmation requirement in the backend, so creating an account signs the student in immediately.
2. Simplify the sign-up flow on the auth page: after "Create account" succeeds, go straight to the dashboard. Remove the "Confirm your email" waiting screen and the resend action, which are no longer reachable.
3. Keep the "Continue with Google" option alongside email + password.
4. Keep "Forgot password?" and the reset-password page as they are.
5. On the dashboard, a brand-new student with no registration yet sees the bus registration call-to-action, as today — no change needed there, but this will be verified end to end.
6. Any valid email address is accepted; no college-domain restriction.

## Technical notes

- Backend auth config: enable auto-confirm for email signups.
- `src/routes/auth.tsx`: drop the `confirm` screen state, the resend handler, and the "email not confirmed" branch in sign-in error handling; navigate to `/dashboard` on successful signup. Keep password length validation and the forgot-password screen.
- No database or server-function changes.

## Trade-off to be aware of

With confirmation off, email addresses are not verified, so someone could sign up with an address they don't own. Approval still gates everything: a new account can only submit a registration, and the transport office must approve it before roll number, fees and other tabs unlock.

## Verification

Create a fresh account with a non-college email, confirm it lands signed-in on the dashboard, submit a registration, and check it appears as pending in the admin roster.
