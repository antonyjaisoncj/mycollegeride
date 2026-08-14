# College Bus Management System — Build Plan

A bus transport admin system with student self-service. Four main tabs: Registration, Fee Payment, Expense Tracker, Monthly Statement.

## Backend

Enable Lovable Cloud (database, logins, server logic). Everything is stored server-side with per-user access rules so a student can only ever see their own record.

Two kinds of users:
- **Admin** — full access to all four tabs.
- **Student** — email/password login, sees only their own registration, fee dues and payment history.

## 1. Registration

- Public registration form: name, email, phone, course/year, address, boarding point, guardian name + phone.
- Each submission gets an auto **application number** in submission order, status `pending`.
- Admin list of applications with Approve / Reject.
- On approval the admin types the **roll number** — the form pre-fills the next serial number (based on application order) but stays editable, and duplicates are rejected.
- Approved students appear in the student roster and can log in.

## 2. Fee Payment

**Monthly fee setup (admin, 1st of each month):**
- Admin enters two slab amounts for the month: lower (e.g. 600) and higher (e.g. 1200).
- Each student is assigned one of the two slabs.

**Due dates and penalties**, derived automatically per month:

| Window | Ends | Amount payable |
|---|---|---|
| On time | last day of the month | slab |
| Fine | the next Friday after the due date | slab + 1/12 (50 / 100) |
| Superfine | the Friday after that | slab + 1/4 (150 / 300) |
| Past superfine | — | student is **blacklisted** |

If the last day of the month is itself a Friday, the fine window still ends on the *following* Friday.

- Admin fee-collection screen: search by roll number/name, see the exact amount due today (auto-calculated with fine/superfine), record payment with mode (cash/UPI/bank) and reference number, generate a receipt number.
- Student view: current month's due amount, the deadline that applies right now, a countdown to the next penalty step, and full payment history.
- **Blacklist**: applied automatically once the superfine window passes unpaid. Admin can clear the blacklist manually after the student settles all dues.

## 3. Expense Tracker

- Record bus expenses: date, category (fuel, driver salary, maintenance, insurance, permit, other), vendor name, bill number, amount, notes. Text fields only, no file uploads.
- Filterable list by month and category, with running totals.
- Admin-only.

## 4. Monthly Statement

- Pick a month and get: total fee collected (split into base / fine / superfine), total expenses by category, net balance.
- Collection summary: paid on time, paid with fine, paid with superfine, unpaid, blacklisted.
- Defaulters list with roll number, name, amount owed and current penalty stage.
- Export to CSV/print.

## Technical notes

- Tables: `profiles`, `user_roles`, `applications`, `students`, `monthly_fee_config`, `fee_dues`, `payments`, `expenses`.
- Roles live in a separate `user_roles` table (never on the profile) and are checked with a security-definer function, so a student can't grant themselves admin.
- Row-level security on every table: students read only rows tied to their own account; all writes to fee, expense and approval data are admin-only.
- Penalty amounts and deadlines are computed on the server at payment time, never trusted from the browser, so the amount can't be tampered with in the client.
- Blacklisting runs as a server-side check whenever dues are read or a payment is recorded — no scheduled job needed.
- All forms validated with Zod on both client and server.
