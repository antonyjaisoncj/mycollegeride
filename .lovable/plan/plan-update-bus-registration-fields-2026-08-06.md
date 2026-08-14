# Plan: Update bus registration fields

## What we are changing

Replace the current "Course" and "Year of study" inputs on the bus registration form, add a new Stage dropdown, and make Stage drive the fee slab automatically.

## Proposed field design

```text
Bus Registration form
├── Full name          (text)
├── Email              (email)
├── Phone              (text)
├── Branch             (text)       ← was "Course"
├── Year of study      (dropdown)   ← First Year / Second Year / Third Year
├── Stage              (dropdown)   ← Stage-1 / Stage-2 / Stage-3  (new)
├── Boarding point     (text)
├── Guardian name      (text)
├── Guardian phone     (text)
├── Address            (textarea)
└── Passport photo     (upload)    ← new
```

Stage determines the fee slab:
- **Stage-1** → lower slab
- **Stage-2** → higher slab
- **Stage-3** → higher slab

This keeps the admin’s monthly fee setup as two amounts (lower / higher) while letting the same boarding point be priced differently per student by assigning a stage.

## Files and changes

### 1. Database migration
- Rename `students.course` to `students.branch`.
- Create enum `bus_stage` with values `'Stage-1'`, `'Stage-2'`, `'Stage-3'`.
- Add `students.stage` column using the new enum, `NOT NULL` with default `'Stage-1'`.
- Existing rows keep their old `course` text as the initial `branch` value (NOT NULL-safe) and get `stage = 'Stage-1'`.
- No new tables, so GRANT statements are not needed; existing RLS policies remain valid.

### 2. Validation schema — `src/lib/bus-schemas.ts`
- Rename `course` → `branch` in `registrationSchema`.
- Change `year_of_study` to an enum of `"First Year"`, `"Second Year"`, `"Third Year"`.
- Add `stage` enum `"Stage-1" | "Stage-2" | "Stage-3"`.
- Update `approveSchema`: remove `slab` because the server will derive it from `stage`.

### 3. Server functions — `src/lib/bus.functions.ts`
- `submitRegistration`: pass `branch` and `stage` to the insert.
- `approveApplication`: read the student’s `stage`, assign the roll number, and set `slab` automatically (`Stage-1` → lower, otherwise higher). No longer accept `slab` from the UI.
- `recordPayment` / `listDues` / `myFeeStatus` / `monthlyStatement`: no logic change; they already read `student.slab`.

### 4. Student registration form — `src/components/bus/StudentPortal.tsx`
- Update form state keys from `course` / `year_of_study` to `branch` / `year_of_study` / `stage`.
- Render Branch as a text input.
- Render Year of study as a dropdown.
- Render Stage as a dropdown.
- Update the read-only summary card to show Branch, Year, Stage, and Boarding point.

### 5. Admin registration tab — `src/components/bus/RegistrationTab.tsx`
- Pending applications card: show Branch, Year, and Stage instead of Course / Year.
- Remove the manual "Fee slab" dropdown from the approval controls (Stage now decides it).
- Keep the roll-number input.
- Approved roster table: replace the "Slab" column with a "Stage" column; show Branch and Year in the summary.

### 6. Other display labels
- `FeeTab` collection table: replace the "Slab" column with "Stage" and show the student’s stage.
- `StatementTab` CSV / defaulters: no structural change, but any student detail references will use the new field names where shown.

### 7. Type generation
- After the migration runs, the Supabase types file will be regenerated automatically to reflect `branch`, `stage`, and the `bus_stage` enum.

### 8. Passport photo upload
- Create a **private** storage bucket `student-photos` (a passport photo is personal data, so it is not publicly readable).
- Access rules: a signed-in student can upload, replace and read files only inside their own folder; admins can read every photo.
- Add `students.photo_path` (text, optional) to remember which file belongs to which student.
- Registration form (`StudentPortal.tsx`): a "Passport photo" upload control — choose a JPG/PNG up to about 2 MB, see a preview before submitting, and the file is uploaded and linked to the application on submit.
- Approved students see their photo on their profile card with an "Update photo" link to replace it.
- Admin `RegistrationTab.tsx`: shows a thumbnail on each pending application card and in the roster, loaded through a short-lived signed link from a server function.
- The photo stays optional so existing students are unaffected.

### 9. Admin quick registration (Name only)
- On the Registration tab, admins get an "Add student" box with a single **Name** field and an Add button.
- Submitting creates the student straight away as an approved rider: next application number, next running roll number, Stage-1 / lower slab by default.
- All other details (branch, year, phone, guardian, address, boarding point, photo) are left blank and can be filled in later; the database columns that are currently mandatory become optional so a name-only record can exist.
- These records have no linked login account, so the student user link becomes optional too; if that person later signs in and registers, the admin can attach the account from the roster.
- The roster marks name-only records as "Details incomplete" so they are easy to find and complete.
- Only admins can do this; the student-facing form still asks for the full details.

## Out of scope
- Adding an edit-in-place form for already-approved students. Existing records will carry the migrated placeholder/default values; new registrations and approvals will use the new fields.
