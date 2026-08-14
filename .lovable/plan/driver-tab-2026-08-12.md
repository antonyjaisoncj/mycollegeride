# Driver tab

A fifth tab, **Driver**, visible only to the admin and to accounts marked as drivers. It shows a simple pickup list of approved students that the driver can re-order, and clearly marks who has paid this month.

## Driver login

Drivers do not sign up differently. The driver creates a normal account with email and password, then the admin promotes it:

- In the Registration tab, an admin-only "Driver access" box: type the driver's email, press "Make driver". The account must already exist.
- The same box lists current drivers with a "Remove" action.

## What the Driver tab shows

One card per approved student, in pickup order:

```text
[photo]  Name
         Branch · Boarding point            [Paid] / [Not paid]
```

- Only photo, name, branch and boarding point — no fees, phone, guardian or address.
- **Paid** (green) / **Not paid** (red) reflects the current month only. Blacklisted students also carry a red "Blacklisted" badge.
- A summary line on top: "24 students · 18 paid · 6 not paid".

## Re-ordering

- The driver arranges students one by one using up/down buttons on each row (works reliably on a phone, unlike drag and drop).
- The order is saved as soon as it changes and is a single shared sequence — there is one bus, so admin and students see the same order everywhere the roster is listed.
- Students without a set position appear at the end, ordered by roll number.
- The admin can also re-order from this tab; students never can.

## Technical notes

- Migration: add `'driver'` to the `app_role` enum. Add `pickup_seq integer` to `public.students`, backfilled by roll number order. No new RLS policy is needed for writes — the re-order server function verifies the driver/admin role and writes with the trusted server client, matching how `user_roles` is already managed.
- `src/lib/bus-helpers.ts`: add `isDriver(...)` and `assertDriverOrAdmin(...)`.
- `src/lib/bus.functions.ts`:
  - `driverRoster` (auth, driver or admin): approved students ordered by `pickup_seq`, returning only id, name, branch, boarding point, photo signed URL, `blacklisted`, and a `paid` boolean from a `payments` lookup on the current period.
  - `setPickupOrder` (auth, driver or admin): takes the ordered array of student ids, validates them, writes `pickup_seq`.
  - `listDrivers`, `grantDriver`, `revokeDriver` (admin only): look up the account by email through the Auth admin API and insert/delete the `driver` role row in `user_roles`; errors clearly if no account exists for that email.
  - `getMe`: also return `isDriver` so the dashboard can show the tab.
- `src/components/bus/DriverTab.tsx`: new component with the card list, paid badges, up/down buttons and optimistic reorder.
- `src/components/bus/RegistrationTab.tsx`: admin-only driver access box.
- `src/routes/_authenticated/dashboard.tsx`: add the Driver tab, shown when `isAdmin || isDriver`. A driver who is not an admin sees only that tab.
