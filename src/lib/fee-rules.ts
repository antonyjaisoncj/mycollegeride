// Pure fee / penalty rules. Safe to import on client and server.
// Rules agreed with the college:
//   - Two slabs per month, set manually by the admin (e.g. 600 and 1200).
//   - Fee is due on the LAST DAY of the month.
//   - Fine window ends on the next Friday strictly after the due date.
//     fine = slab / 12  (600 -> 50, 1200 -> 100)
//   - Superfine window ends the Friday after that.
//     superfine = slab / 4 (600 -> 150, 1200 -> 300)
//   - After the superfine window the student is blacklisted.

export type PenaltyStage = "on_time" | "fine" | "superfine" | "blacklisted";
export type Slab = "lower" | "higher";

/** Normalises any date to the first day of its month, as YYYY-MM-DD. */
export function toPeriod(date: Date | string): string {
  const d = typeof date === "string" ? new Date(`${date.slice(0, 10)}T00:00:00Z`) : date;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export function currentPeriod(): string {
  return toPeriod(new Date());
}

function parse(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/** Last calendar day of the period's month. */
export function dueDateFor(period: string): string {
  const d = parse(period);
  return fmt(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

/** The Friday strictly after `iso` (never the same day). */
export function nextFridayAfter(iso: string): string {
  let d = addDays(parse(iso), 1);
  while (d.getUTCDay() !== 5) d = addDays(d, 1);
  return fmt(d);
}

/** The nth working day (Mon–Fri) strictly after `iso`. */
export function nthWorkingDayAfter(iso: string, n: number): string {
  let d = parse(iso);
  let left = n;
  while (left > 0) {
    d = addDays(d, 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return fmt(d);
}

export interface PeriodWindows {
  period: string;
  /** Pay this amount on or before this date. */
  dueDate: string;
  /** Fine applies after dueDate, up to and including this date. */
  fineUntil: string;
  /** Superfine applies after fineUntil, up to and including this date. */
  superfineUntil: string;
}

export function windowsFor(period: string): PeriodWindows {
  const dueDate = dueDateFor(period);
  // Fine runs to the later of the 5th working day after the due date and the next Friday.
  const fifthWorkingDay = nthWorkingDayAfter(dueDate, 5);
  const friday = nextFridayAfter(dueDate);
  const fineUntil = fifthWorkingDay > friday ? fifthWorkingDay : friday;
  const superfineUntil = nextFridayAfter(fineUntil);
  return { period, dueDate, fineUntil, superfineUntil };
}

/** Which penalty stage applies on `onDate` (defaults to today). */
export function stageOn(period: string, onDate?: string): PenaltyStage {
  const w = windowsFor(period);
  const today = onDate ?? fmt(new Date());
  if (today <= w.dueDate) return "on_time";
  if (today <= w.fineUntil) return "fine";
  if (today <= w.superfineUntil) return "superfine";
  return "blacklisted";
}

/** Fixed penalty amounts per slab, used when a student has no override. */
export const DEFAULT_PENALTIES: Record<Slab, PenaltyAmounts> = {
  lower: { fine: 50, superfine: 100 },
  higher: { fine: 100, superfine: 200 },
};

export interface PenaltyAmounts {
  fine: number;
  superfine: number;
}

export function penaltyAmount(
  _base: number,
  stage: PenaltyStage,
  amounts: PenaltyAmounts = DEFAULT_PENALTIES.lower,
): number {
  if (stage === "fine") return Math.round(Number(amounts.fine) || 0);
  if (stage === "superfine" || stage === "blacklisted") {
    return Math.round(Number(amounts.superfine) || 0);
  }
  return 0;
}

/** The penalty amounts stored on a student, falling back to the slab defaults. */
export function penaltiesOf(student: {
  slab?: string | null;
  fine_amount?: number | string | null;
  superfine_amount?: number | string | null;
}): PenaltyAmounts {
  const fallback = DEFAULT_PENALTIES[student.slab === "higher" ? "higher" : "lower"];
  return {
    fine:
      student.fine_amount === null || student.fine_amount === undefined
        ? fallback.fine
        : Number(student.fine_amount),
    superfine:
      student.superfine_amount === null || student.superfine_amount === undefined
        ? fallback.superfine
        : Number(student.superfine_amount),
  };
}

export interface DueBreakdown extends PeriodWindows {
  base: number;
  stage: PenaltyStage;
  penalty: number;
  total: number;
  /** Date the current stage's window closes (null once blacklisted). */
  payBy: string | null;
}

export function computeDue(
  period: string,
  base: number,
  onDate?: string,
  amounts?: PenaltyAmounts,
): DueBreakdown {
  const w = windowsFor(period);
  const stage = stageOn(period, onDate);
  const penalty = penaltyAmount(base, stage, amounts ?? DEFAULT_PENALTIES.lower);
  const payBy =
    stage === "on_time"
      ? w.dueDate
      : stage === "fine"
        ? w.fineUntil
        : stage === "superfine"
          ? w.superfineUntil
          : null;
  return { ...w, base, stage, penalty, total: base + penalty, payBy };
}

export const STAGE_LABEL: Record<PenaltyStage, string> = {
  on_time: "On time",
  fine: "Fine",
  superfine: "Superfine",
  blacklisted: "Blacklisted",
};

export function formatINR(n: number): string {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatDate(iso: string): string {
  const d = parse(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Shifts a period by n months. */
export function addMonths(period: string, n: number): string {
  const d = parse(period);
  return toPeriod(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
}

/** The previous month's period relative to today. */
export function previousPeriod(): string {
  return addMonths(currentPeriod(), -1);
}

/** Every period from `start` up to and including `end` (empty when start > end). */
export function periodsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  let p = toPeriod(start);
  const last = toPeriod(end);
  while (p <= last) {
    out.push(p);
    p = addMonths(p, 1);
  }
  return out;
}

export function periodLabel(period: string): string {

  return parse(period).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const EXPENSE_CATEGORIES = [
  "Fuel",
  "Driver Salary",
  "Maintenance",
  "Insurance",
  "Permit",
  "Other",
] as const;

/** Batch categories derived from the middle part of a roll number (e.g. CE/29/62). */
export type YearGroup = "first" | "second" | "final" | "other";

export const YEAR_GROUP_ORDER: YearGroup[] = ["first", "second", "final", "other"];

export const YEAR_GROUP_LABEL: Record<YearGroup, string> = {
  first: "First Year Students",
  second: "Second Year Students",
  final: "Final Year Students",
  other: "Other Students",
};

/** `CE/29/62` -> "first". Unknown or missing roll numbers fall into "other". */
export function yearGroupOf(roll: string | null | undefined): YearGroup {
  const mid = (roll ?? "").split("/")[1]?.trim();
  if (mid === "29") return "first";
  if (mid === "28") return "second";
  if (mid === "27") return "final";
  return "other";
}

/** Splits rows into the four batch groups, preserving the incoming order. */
export function groupByYear<T>(
  rows: T[],
  roll: (row: T) => string | null | undefined,
): { key: YearGroup; label: string; rows: T[] }[] {
  return YEAR_GROUP_ORDER.map((key) => ({
    key,
    label: YEAR_GROUP_LABEL[key],
    rows: rows.filter((r) => yearGroupOf(roll(r)) === key),
  })).filter((g) => g.rows.length > 0);
}
