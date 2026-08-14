# Date of Joining filters the fee collection list

Students should only appear in a month's collection list if they had already joined by that month.

## What changes

**1. Approval asks for a Date of Joining**

When the admin approves an application, the approve step now asks for a Date of Joining alongside the roll number, defaulting to today. Quick-added students get today as their joining date.

**2. Collection list is filtered by month**

In the Fee payment tab, the Collection table for a month lists only students whose Date of Joining falls on or before the last day of that month. A student who joins in August never shows up in July's list, and never becomes a July defaulter or gets auto-blacklisted for it.

**3. Joining month is charged in full**

A student who joins mid-month pays the normal slab amount for that month, with the usual fine and superfine rules applied from the value date.

**4. Visible and editable**

Date of Joining shows in the Student details popup and can be corrected by the admin in the edit form.

**5. Existing students**

Every already-approved student is backfilled with their record creation date, so past months keep showing the same people they show today.

## Technical notes

- Migration: add `date_of_joining date` to `public.students`; backfill approved rows with `created_at::date`.
- `bus-schemas.ts`: `approveSchema` gains `date_of_joining` (YYYY-MM-DD, not in the future); `updateStudentSchema` gains an optional `date_of_joining`.
- `bus.functions.ts`:
  - `approveApplication` writes the supplied date; `quickAddStudent` writes `current_date`.
  - `listDues` filters students with `date_of_joining <= last day of period` (rows with a null date are treated as joined, so nothing disappears).
  - The auto-blacklist pass in `listDues` operates on the same filtered set only.
  - `updateStudent` persists the edited date.
- `RegistrationTab.tsx`: approve dialog gets a date input defaulting to today.
- `StudentDetailDialog.tsx`: shows Date of Joining in the profile and a date field in edit mode.
