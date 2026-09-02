// Shared server-side helpers for the bus management server functions.
// No secrets here — the caller passes an already-authenticated Supabase client.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Client = SupabaseClient<Database>;

export async function assertAdmin(supabase: Client, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin access required");
}

export async function isAdmin(supabase: Client, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return Boolean(data);
}
export async function isDriver(supabase: Client, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "driver")
    .maybeSingle();
  return Boolean(data);
}

/** Driver tab access: the bus driver or an admin. */
export async function assertDriverOrAdmin(
  supabase: Client,
  userId: string,
): Promise<{ admin: boolean }> {
  if (await isAdmin(supabase, userId)) return { admin: true };
  if (await isDriver(supabase, userId)) return { admin: false };
  throw new Error("Forbidden: driver access required");
}


/**
 * Read access for the shared tabs: admins always, approved students read-only.
 * Returns whether the caller is an admin so callers can widen or narrow data.
 */
export async function assertViewer(
  supabase: Client,
  userId: string,
): Promise<{ admin: boolean }> {
  if (await isAdmin(supabase, userId)) return { admin: true };
  const { data } = await supabase
    .from("students")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.status !== "approved") {
    throw new Error("Forbidden: your bus registration is not approved yet");
  }
  return { admin: false };
}

export type AppSettings = {
  expenses_visible: boolean;
  statement_visible: boolean;
  driver_visible: boolean;
  advance_visible: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  expenses_visible: true,
  statement_visible: true,
  driver_visible: true,
  advance_visible: true,
};

/** Reads the admin-controlled tab switches; defaults to everything visible. */
export async function readSettings(supabase: Client): Promise<AppSettings> {
  const { data } = await supabase.from("app_settings").select("*").maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return {
    expenses_visible: Boolean(data.expenses_visible),
    statement_visible: Boolean(data.statement_visible),
    driver_visible: Boolean(data.driver_visible),
    advance_visible: Boolean((data as { advance_visible?: boolean }).advance_visible ?? true),
  };
}


/** First day of the month after `period`, as YYYY-MM-DD. */
export function monthEnd(period: string): string {
  const d = new Date(`${period}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
}

export type MonthMoney = {
  feeReceived: number;
  otherIncome: number;
  expenses: number;
};

/**
 * Net advance movement over a date range: collections add, returns subtract.
 * `from` is inclusive and optional; `to` is exclusive.
 */
export async function advanceNet(
  supabase: Client,
  from: string | null,
  to: string,
): Promise<number> {
  let q = supabase
    .from("advance_entries")
    .select("kind, amount")
    .is("voided_at", null)
    .lt("entry_date", to);
  if (from) q = q.gte("entry_date", from);
  const { data } = await q;
  return (data ?? []).reduce(
    (a, r) => a + (r.kind === "return" ? -Number(r.amount) : Number(r.amount)),
    0,
  );
}

/**
 * Everything received and spent strictly before `period` — the opening balance
 * carried forward into that month. Can be negative.
 */
export async function balanceBefore(supabase: Client, period: string): Promise<number> {
  const [{ data: pays }, { data: income }, { data: spends }, advance] = await Promise.all([
    supabase.from("payments").select("total_amount").is("voided_at", null).lt("value_date", period),
    supabase.from("other_income").select("amount").is("voided_at", null).lt("income_date", period),
    supabase.from("expenses").select("amount").is("voided_at", null).lt("expense_date", period),
    advanceNet(supabase, null, period),
  ]);
  const sum = (rows: { amount?: unknown; total_amount?: unknown }[] | null, key: string) =>
    (rows ?? []).reduce((a, r) => a + Number((r as Record<string, unknown>)[key] ?? 0), 0);
  return (
    sum(pays ?? [], "total_amount") +
    sum(income ?? [], "amount") -
    sum(spends ?? [], "amount") +
    advance
  );
}


/**
 * The date up to which a student's fee, fine and superfine keep accruing.
 * A frozen or closed registration stops the clock on its value date.
 */
export function accrualCutoff(
  student: { frozen_at?: string | null; closed_at?: string | null },
  today = new Date().toISOString().slice(0, 10),
): string {
  const stops = [student.frozen_at, student.closed_at].filter(Boolean) as string[];
  return stops.reduce((a, b) => (b < a ? b : a), today);
}


export type OutstandingRow = {
  period: string;
  base: number;
  penalty: number;
  total: number;
  stage: string;
};

/**
 * Every unpaid month for a student from the joining month up to `upto`,
 * priced with the penalty that applies on `valueDate`.
 */
export async function outstandingMonths(
  supabase: Client,
  student: {
    id: string;
    slab: string;
    fine_amount?: number | string | null;
    superfine_amount?: number | string | null;
    date_of_joining?: string | null;
    created_at: string;
  },
  upto: string,
  valueDate: string,
): Promise<OutstandingRow[]> {
  const { toPeriod, periodsBetween, computeDue, penaltiesOf } = await import("./fee-rules");
  const start = toPeriod(student.date_of_joining ?? student.created_at);
  const months = periodsBetween(start, upto);
  if (months.length === 0) return [];

  const [{ data: paid }, { data: cfgs }] = await Promise.all([
    supabase
      .from("payments")
      .select("period")
      .is("voided_at", null)
      .eq("settled", true)
      .eq("student_id", student.id),
    supabase
      .from("monthly_fee_config")
      .select("*")
      .gte("period", months[0]!)
      .lte("period", months[months.length - 1]!),
  ]);
  const paidSet = new Set((paid ?? []).map((p) => toPeriod(p.period)));
  const cfgMap = new Map((cfgs ?? []).map((c) => [toPeriod(c.period), c]));

  const out: OutstandingRow[] = [];
  for (const period of months) {
    if (paidSet.has(period)) continue;
    const cfg = cfgMap.get(period);
    // A month whose fee amounts have not been entered yet is not billable:
    // skip it instead of blocking every dues screen for the student.
    if (!cfg) continue;
    const base = Number(student.slab === "higher" ? cfg.higher_amount : cfg.lower_amount);
    const due = computeDue(period, base, valueDate, penaltiesOf(student));
    out.push({
      period,
      base: due.base,
      penalty: due.penalty,
      total: due.total,
      stage: due.stage,
    });
  }
  return out;
}


/**
 * A fresh transaction number. Every money event (fee, bulk fee, settlement,
 * other income, expense, advance return) is stamped with one so it can be
 * looked up and undone as a whole later.
 */
export async function createTransaction(
  admin: Client,
  input: { kind: string; date: string; userId: string; note?: string | null },
): Promise<string> {
  const { data: txnNo, error } = await admin.rpc("next_txn_no", { _day: input.date });
  if (error) throw new Error(error.message);
  const { error: tErr } = await admin.from("transactions").insert({
    txn_no: txnNo as string,
    txn_date: input.date,
    kind: input.kind,
    note: input.note ?? null,
    created_by: input.userId,
  });
  if (tErr) throw new Error(tErr.message);
  return txnNo as string;
}
