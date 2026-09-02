# Group students by year, and a Defaulters-only print

## Year categories

Roll numbers look like `CE/29/62`. The middle part gives the batch:

- `29` → First Year Students
- `28` → Second Year Students
- `27` → Final Year Students
- anything else / no roll number → "Other" group, shown last so nobody disappears

## Where the grouping appears

1. **Advance tab** — the roster table gets three section headers (First Year, Second Year, Final Year) with the students listed under each, keeping the existing columns and current sort order inside each group. Each group gets its own subtotal row (Maximum advance, Collected, Returned, Held), and the existing grand total stays at the bottom. Grouping also applies to the printed view and to the date-range filtered list.
2. **Fee payment tab** — the fee collection list is split into the same three groups with a header row per group, keeping search, sorting and every existing action (Receive / Process) unchanged. Searching still filters across all groups.
3. **Monthly statement → Defaulters** — the defaulters table is split into the same groups, each with a count and amount-owed subtotal, plus the overall total.

## Defaulters print

Next to the "Defaulters" heading, add a Print button that prints only the defaulters list:

- Header shows the report title, the month it covers (e.g. "Defaulters — September 2026") and the date/time the report was printed.
- Body is the grouped defaulters table with Roll, Name, Pending from, Amount owed, Stage, plus group subtotals and grand total.
- Everything else on the Monthly statement page is hidden in that print.

## Technical notes

- Add a shared helper (e.g. `yearGroupOf(roll_number)` in `src/lib/fee-rules.ts`) returning `first` / `second` / `final` / `other` from the middle `/`-separated segment, plus labels and ordering.
- Presentation-only changes in `src/components/bus/AdvanceTab.tsx`, `src/components/bus/FeeTab.tsx`, `src/components/bus/StatementTab.tsx`; no server-function or schema changes.
- Defaulters print uses a scoped print class (e.g. `print-defaulters` on body while printing) so only that section renders; CSS additions go in `src/styles.css`.
- CSV export of defaulters keeps working and gains a year-group column.
