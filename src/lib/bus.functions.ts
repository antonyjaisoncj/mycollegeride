import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  accrualCutoff,
  assertAdmin,
  assertDriverOrAdmin,
  assertViewer,
  advanceNet,
  balanceBefore,
  createTransaction,
  isAdmin,
  isDriver,
  monthEnd,
  outstandingMonths,
  readSettings,
  type AppSettings,
} from "./bus-helpers";
import {
  computeDue,
  currentPeriod,
  penaltiesOf,
  periodsBetween,
  previousPeriod,
  stageOn,
  toPeriod,
} from "./fee-rules";
import {
  advanceEntrySchema,
  advanceFilterSchema,
  masterResetSchema,

  approveSchema,
  bulkPaySchema,
  txnListSchema,
  txnNoSchema,
  closeSchema,
  driverEmailSchema,
  expenseSchema,
  feeConfigSchema,
  freezeSchema,
  otherIncomeSchema,
  periodSchema,
  pickupOrderSchema,
  quickAddSchema,
  recordPaymentSchema,
  registrationSchema,
  rejectSchema,
  settlementPreviewSchema,
  settlementSchema,
  freezeAtSchema,

  studentIdSchema,
  updateStudentSchema,
} from "./bus-schemas";



/** Who am I: role + my own student record (if any). */
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const admin = await isAdmin(supabase, userId);
    const driver = admin ? false : await isDriver(supabase, userId);
    const { data: student } = await supabase
      .from("students")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      userId,
      email: (claims["email"] as string | undefined) ?? null,
      isAdmin: admin,
      isDriver: driver,
      student: student ?? null,
    };

  });

/* ---------------- Tab visibility switches ---------------- */

// Public: only three boolean tab-visibility flags, and it must not fail while
// the browser session is still hydrating (that used to blank the dashboard).
export const getAppSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  return readSettings(client as never);
});

export const setAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Partial<AppSettings>) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ id: true, ...data }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return readSettings(context.supabase);
  });

/* ---------------- 1. Registration ---------------- */


export const submitRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => registrationSchema.parse(d))
  .handler(async ({ data, context }) => {
    const loginEmail = (context.claims["email"] as string | undefined) ?? data.email;
    const row = {
      ...data,
      email: loginEmail,
      photo_path: data.photo_path ?? null,
      user_id: context.userId,
    };
    // Resubmission after a rejection reuses the same record.
    const { data: existing } = await context.supabase
      .from("students")
      .select("id, status")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) {
      if (existing.status !== "rejected") throw new Error("You have already registered");
      const { error } = await context.supabase
        .from("students")
        .update({ ...row, status: "pending", rejection_reason: null })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase.from("students").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


/** Student: attach or replace my passport photo after registering. */
export const setMyPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { photo_path: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("students")
      .update({ photo_path: data.photo_path })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Short-lived signed links so admins can view stored passport photos. */
export const photoUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { paths: string[] }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const paths = data.paths.filter(Boolean).slice(0, 200);
    const urls: Record<string, string> = {};
    if (paths.length === 0) return { urls };
    const { data: signed } = await context.supabase.storage
      .from("student-photos")
      .createSignedUrls(paths, 600);
    for (const row of signed ?? []) {
      if (row.path && row.signedUrl) urls[row.path] = row.signedUrl;
    }
    return { urls };
  });

export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const [{ data, error }, { data: payments, error: pErr }] = await Promise.all([
      context.supabase.from("students").select("*").order("application_no", { ascending: true }),
      context.supabase.from("payments").select("student_id, total_amount, period, value_date").is("voided_at", null).order("value_date", { ascending: false }),
    ]);
    if (error) throw new Error(error.message);
    if (pErr) throw new Error(pErr.message);

    const lastPaidByStudent = new Map<string, (typeof payments)[number]>();
    for (const p of payments ?? []) {
      if (!lastPaidByStudent.has(p.student_id)) lastPaidByStudent.set(p.student_id, p);
    }

    const studentsWithLastPaid = (data ?? []).map((s) => ({
      ...s,
      last_payment: lastPaidByStudent.get(s.id) ?? null,
    }));

    const nextRoll =
      (data ?? [])
        .map((s) => Number(s.roll_number))
        .filter((n) => Number.isFinite(n))
        .reduce((a, b) => Math.max(a, b), 0) + 1;
    return { students: studentsWithLastPaid, nextRoll: String(nextRoll) };
  });

/** Admin: add a rider with just a name; details can be filled in later. */
export const quickAddStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => quickAddSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: existing, error: listErr } = await context.supabase
      .from("students")
      .select("roll_number");
    if (listErr) throw new Error(listErr.message);
    const nextRoll =
      (existing ?? [])
        .map((s) => Number(s.roll_number))
        .filter((n) => Number.isFinite(n))
        .reduce((a, b) => Math.max(a, b), 0) + 1;

    const { error } = await context.supabase.from("students").insert({
      full_name: data.full_name,
      status: "approved",
      stage: "Stage-1",
      slab: "lower",
      roll_number: String(nextRoll),
      date_of_joining: new Date().toISOString().slice(0, 10),
    });

    if (error) throw new Error(error.message);
    return { ok: true, roll_number: String(nextRoll) };
  });

export const approveApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => approveSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: student, error: sErr } = await context.supabase
      .from("students")
      .select("stage")
      .eq("id", data.id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!student) throw new Error("Application not found");

    const { error } = await context.supabase
      .from("students")
      .update({
        status: "approved",
        roll_number: data.roll_number,
        date_of_joining: data.date_of_joining,
        slab: student.stage === "Stage-1" ? "lower" : "higher",
        fine_amount: data.fine_amount,
        superfine_amount: data.superfine_amount,
        // The amount set at approval is only the ceiling for advance money
        // that may be held; it is not a collection.
        advance_limit: data.advance_amount,
      })
      .eq("id", data.id);
    if (error) {
      throw new Error(
        error.code === "23505" ? "That roll number is already taken" : error.message,
      );
    }

    return { ok: true };
  });


export const rejectApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rejectSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("students")
      .update({ status: "rejected", rejection_reason: data.reason ?? null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });



/** Admin or the student themselves: full profile + all payments. */
export const studentDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => studentIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const admin = await isAdmin(supabase, userId);
    const { data: student, error: sErr } = await supabase
      .from("students")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!student) throw new Error("Student not found");
    if (!admin && student.user_id !== userId) {
      throw new Error("Forbidden: you can only view your own record");
    }

    const [{ data: payments, error: pErr }, { data: signed, error: signErr }] = await Promise.all([
      supabase
        .from("payments")
        .select("*")
        .is("voided_at", null)
        .eq("student_id", student.id)
        .order("period", { ascending: false }),
      student.photo_path
        ? supabase.storage.from("student-photos").createSignedUrl(student.photo_path, 600)
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (signErr) throw new Error(signErr.message);

    return {
      student,
      payments: payments ?? [],
      photoUrl: signed?.signedUrl ?? null,
      canEdit: admin,
    };
  });

/** Admin: edit every field of a student record. */
export const updateStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateStudentSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { id, ...fields } = data;
    const { data: before, error: readErr } = await context.supabase
      .from("students")
      .select("user_id, email, full_name, roll_number, advance_amount, advance_returned_at")
      .eq("id", id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);

    const emailChanged =
      Boolean(fields.email) &&
      (before?.email ?? "").toLowerCase() !== (fields.email ?? "").toLowerCase();

    // Change the login email first: if it fails, the record stays untouched.
    if (emailChanged && before?.user_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(before.user_id, {
        email: fields.email as string,
        email_confirm: true,
      });
      if (authErr) {
        throw new Error(
          /already/i.test(authErr.message)
            ? "Another account already uses that email address"
            : `Could not change the sign-in email: ${authErr.message}`,
        );
      }
    }

    const { fine_amount, superfine_amount, advance_amount, ...rest } = fields;

    const { error } = await context.supabase
      .from("students")
      .update({
        ...rest,
        slab: fields.stage === "Stage-1" ? ("lower" as const) : ("higher" as const),
        ...(fine_amount === undefined ? {} : { fine_amount }),
        ...(superfine_amount === undefined ? {} : { superfine_amount }),
        // Editing the advance figure only changes the ceiling, never money.
        ...(advance_amount === undefined ? {} : { advance_limit: advance_amount }),
      })
      .eq("id", id);
    if (error) {
      throw new Error(
        error.code === "23505" ? "That roll number is already taken" : error.message,
      );
    }


    return { ok: true };
  });


export const setBlacklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; blacklisted: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("students")
      .update({
        blacklisted: data.blacklisted,
        blacklist_reason: data.blacklisted ? "Superfine window missed" : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin: freeze (or unfreeze) fee, fine and superfine accrual from a value date. */
export const freezeStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => freezeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("students")
      .update({ frozen_at: data.frozen_at })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Admin: close a registration with a settlement amount, or reopen it.
 * The settlement is booked as income on its date.
 */
export const closeStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => closeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: student, error: sErr } = await supabaseAdmin
      .from("students")
      .select("full_name, roll_number")
      .eq("id", data.id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!student) throw new Error("Student not found");

    const { error } = await supabaseAdmin
      .from("students")
      .update({
        closed_at: data.closed_at,
        settlement_amount: data.closed_at ? data.settlement_amount : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (data.closed_at && data.settlement_amount && data.settlement_amount > 0) {
      const txnNo = await createTransaction(supabaseAdmin, {
        kind: "settlement",
        date: data.closed_at,
        userId: context.userId,
        note: `Closing settlement — ${student.full_name}`,
      });
      const { error: iErr } = await supabaseAdmin.from("other_income").insert({
        txn_no: txnNo,
        income_date: data.closed_at,
        particulars: `Closing settlement — ${student.full_name}${
          student.roll_number ? ` (${student.roll_number})` : ""
        }`,
        remarks: "Registration closed",
        amount: data.settlement_amount,
        created_by: context.userId,
      });
      if (iErr) throw new Error(iErr.message);
    }
    return { ok: true };
  });


/* ---------------- 2. Fee payment ---------------- */

export const getFeeConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => periodSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: cfg, error } = await context.supabase
      .from("monthly_fee_config")
      .select("*")
      .eq("period", data.period)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { config: cfg ?? null };
  });

export const saveFeeConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => feeConfigSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("monthly_fee_config")
      .upsert(
        {
          period: data.period,
          lower_amount: data.lower_amount,
          higher_amount: data.higher_amount,
        },
        { onConflict: "period" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin: every approved student's due for a period, with penalties applied. */
export const listDues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => periodSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertAdmin(supabase, context.userId);
    const period = toPeriod(data.period);

    const [{ data: cfg }, { data: students }, { data: allPayments }] = await Promise.all([
      supabase.from("monthly_fee_config").select("*").eq("period", period).maybeSingle(),
      supabase.from("students").select("*").eq("status", "approved").order("roll_number"),
      // Every payment up to and including this month — arrears are chained.
      supabase.from("payments").select("*").is("voided_at", null).lte("period", period),
    ]);

    // A student only owes fees from the month they joined onwards.
    const periodEnd = (() => {
      const [y, m] = period.split("-").map(Number);
      return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
    })();

    type PaymentRow = NonNullable<typeof allPayments>[number];
    const paidPeriods = new Map<string, Set<string>>();
    const paidBy = new Map<string, PaymentRow>();
    // Part payments (not marked complete) keep the month pending but are shown
    // on the row as already received.
    const partPaidBy = new Map<string, number>();
    for (const p of allPayments ?? []) {
      if (p.settled) {
        const set = paidPeriods.get(p.student_id) ?? new Set<string>();
        set.add(toPeriod(p.period));
        paidPeriods.set(p.student_id, set);
        if (toPeriod(p.period) === period) paidBy.set(p.student_id, p);
      } else if (toPeriod(p.period) === period) {
        partPaidBy.set(
          p.student_id,
          (partPaidBy.get(p.student_id) ?? 0) + Number(p.total_amount),
        );
      }
    }


    const rows = (students ?? [])
      .filter((s) => !s.date_of_joining || s.date_of_joining <= periodEnd)
      // Frozen or closed registrations drop out of every later month.
      .filter((s) => toPeriod(accrualCutoff(s)) >= period)
      .map((s) => {
        const base = cfg
          ? Number(s.slab === "higher" ? cfg.higher_amount : cfg.lower_amount)
          : 0;
        const payment = paidBy.get(s.id) ?? null;
        const cutoff = accrualCutoff(s);
        const due = computeDue(period, base, cutoff, penaltiesOf(s));
        // Fees run in sequence from the joining month: the oldest unpaid month
        // must be settled before a later month can be received.
        const from = toPeriod(s.date_of_joining ?? s.created_at);
        const paid = paidPeriods.get(s.id) ?? new Set<string>();
        const unpaidPeriods = periodsBetween(from, period).filter((p) => !paid.has(p));
        const earliestUnpaid = unpaidPeriods[0] ?? null;
        return {
          student: s,
          payment,
          due,
          unpaidPeriods,
          earliestUnpaid,
          partPaid: partPaidBy.get(s.id) ?? 0,
          arrears: unpaidPeriods.filter((p) => p < period).length,
          blockedByArrears: Boolean(earliestUnpaid && earliestUnpaid < period),
        };
      });




    // Auto-blacklist anyone who let the superfine window lapse unpaid.
    const toBlacklist = rows
      .filter((r) => !r.payment && r.due.stage === "blacklisted" && !r.student.blacklisted)
      .map((r) => r.student.id);
    if (cfg && toBlacklist.length > 0) {
      await supabase
        .from("students")
        .update({ blacklisted: true, blacklist_reason: "Superfine window missed" })
        .in("id", toBlacklist);
      for (const r of rows) {
        if (toBlacklist.includes(r.student.id)) r.student.blacklisted = true;
      }
    }

    return { period, config: cfg ?? null, rows };
  });

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => recordPaymentSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertAdmin(supabase, context.userId);
    const period = toPeriod(data.period);

    const { data: student, error: sErr } = await supabase
      .from("students")
      .select("*")
      .eq("id", data.student_id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!student || student.status !== "approved") throw new Error("Student not found");

    const { data: cfg } = await supabase
      .from("monthly_fee_config")
      .select("*")
      .eq("period", period)
      .maybeSingle();
    if (!cfg) throw new Error("Set the fee amounts for this month first");

    // Fees are paid in sequence from the joining month: no later month can be
    // received while an earlier month is still outstanding.
    const { data: prior } = await supabase
      .from("payments")
      .select("period")
      .is("voided_at", null)
      .eq("settled", true)
      .eq("student_id", student.id)
      .lte("period", period);
    const paidSet = new Set((prior ?? []).map((p) => toPeriod(p.period)));
    if (paidSet.has(period)) throw new Error("This month is already paid");
    const chain = periodsBetween(
      toPeriod(student.date_of_joining ?? student.created_at),
      period,
    );
    const oldestUnpaid = chain.find((p) => !paidSet.has(p));
    if (oldestUnpaid && oldestUnpaid < period) {
      const label = new Date(`${oldestUnpaid}T00:00:00Z`).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
      throw new Error(`Collect the ${label} fee first — dues must be cleared in order`);
    }


    // Value date drives the penalty stage; it may be back-dated but never future.
    const today = new Date().toISOString().slice(0, 10);
    const valueDate = data.value_date;
    if (valueDate > today) throw new Error("Value date cannot be in the future");
    if (valueDate < period) throw new Error("Value date cannot be before the fee month");

    // The system computes the due; the admin may override base/penalty.
    const base = Number(student.slab === "higher" ? cfg.higher_amount : cfg.lower_amount);
    // Freezing or closing a registration stops the penalty clock on its value date.
    const cutoff = accrualCutoff(student);
    if (toPeriod(cutoff) < period) {
      throw new Error("This registration is frozen or closed for this month");
    }
    const computed = computeDue(
      period,
      base,
      valueDate < cutoff ? valueDate : cutoff,
      penaltiesOf(student),
    );
    const dueBase = data.base_amount ?? computed.base;
    const duePenalty = data.penalty_amount ?? computed.penalty;
    const due = {
      base: dueBase,
      penalty: duePenalty,
      total: dueBase + duePenalty,
      stage: computed.stage,
    };
    const settled = data.settled ?? true;



    // Receipt numbers come from a service-role-only function so signed-in
    // users cannot burn or guess sequence numbers directly.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: receiptNo, error: rErr } = await supabaseAdmin.rpc("next_receipt_no", {
      _period: period,
    });
    if (rErr) throw new Error(rErr.message);

    const txnNo = await createTransaction(supabaseAdmin, {
      kind: "fee",
      date: valueDate,
      userId: context.userId,
      note: `Monthly fee — ${student.full_name}${student.roll_number ? ` (${student.roll_number})` : ""}`,
    });

    const { error } = await supabase.from("payments").insert({
      txn_no: txnNo,
      student_id: student.id,
      period,
      value_date: valueDate,
      base_amount: due.base,
      penalty_amount: due.penalty,
      total_amount: due.total,
      stage: due.stage,
      mode: data.mode,
      reference: data.reference ?? null,
      receipt_no: receiptNo as string,
      recorded_by: context.userId,
      settled,
    });
    if (error) {
      throw new Error(
        error.code === "23505" ? "This month is already paid for this student" : error.message,
      );
    }

    // Settling dues clears an automatic blacklist.
    if (settled && student.blacklisted) {
      await supabase
        .from("students")
        .update({ blacklisted: false, blacklist_reason: null })
        .eq("id", student.id);
    }
    return { ok: true, total: due.total, stage: due.stage, txn_no: txnNo };
  });

/**
 * The advance a student currently holds, derived from the ledger
 * (collections minus returns, voided entries ignored). The mirrored
 * `students.advance_amount` column can go stale, so never read it directly.
 */
async function heldForStudent(studentId: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("advance_entries")
    .select("kind, amount")
    .eq("student_id", studentId)
    .is("voided_at", null);
  if (error) throw new Error(error.message);
  const held = (data ?? []).reduce(
    (a, e) => a + (e.kind === "return" ? -Number(e.amount) : Number(e.amount)),
    0,
  );
  return Math.max(0, Math.round(held * 100) / 100);
}

/** Admin: what a full settlement would cost on a given date. */

export const settlementPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settlementPreviewSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertAdmin(supabase, context.userId);
    const { data: student, error } = await supabase
      .from("students")
      .select("*")
      .eq("id", data.student_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!student || student.status !== "approved") throw new Error("Student not found");
    const rows = await outstandingMonths(
      supabase,
      student,
      toPeriod(data.value_date),
      data.value_date,
    );
    const total = rows.reduce((a, r) => a + r.total, 0);
    const advance = student.advance_returned_at ? 0 : await heldForStudent(student.id);
    return { rows, total, advance, net: total - advance };
  });

/**
 * Admin: settle every outstanding month at once and close the registration.
 * Each month keeps its own receipt so the statement stays month-accurate.
 */
export const settleStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settlementSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertAdmin(supabase, context.userId);
    const today = new Date().toISOString().slice(0, 10);
    if (data.value_date > today) throw new Error("Value date cannot be in the future");

    const { data: student, error: sErr } = await supabase
      .from("students")
      .select("*")
      .eq("id", data.student_id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!student || student.status !== "approved") throw new Error("Student not found");

    const rows = await outstandingMonths(
      supabase,
      student,
      toPeriod(data.value_date),
      data.value_date,
    );

    // The advance still held; the admin may return part or all of it.
    const held = student.advance_returned_at ? 0 : await heldForStudent(student.id);
    const advance = data.advance_return === undefined ? held : Number(data.advance_return);
    if (advance > held) throw new Error("Cannot return more than the advance held");

    // Optional admin override of the total dues collected: spread it over the
    // outstanding months in proportion to what each month owes.
    const computed = rows.reduce((a, r) => a + r.total, 0);
    const override = data.settlement_amount;
    if (override !== undefined && override !== computed && rows.length === 0) {
      throw new Error("No outstanding months to apply this amount to");
    }
    let allocated = rows.map((r) => r.total);
    if (override !== undefined && override !== computed && rows.length > 0) {
      let left = override;
      allocated = rows.map((r, i) => {
        if (i === rows.length - 1) return Math.max(0, Math.round(left * 100) / 100);
        const share =
          computed > 0
            ? Math.round(((override * r.total) / computed) * 100) / 100
            : Math.round((override / rows.length) * 100) / 100;
        left -= share;
        return share;
      });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const txnNo = await createTransaction(supabaseAdmin, {
      kind: "settlement",
      date: data.value_date,
      userId: context.userId,
      note: `Settlement — ${student.full_name}${student.roll_number ? ` (${student.roll_number})` : ""}`,
    });
    let total = 0;
    for (const [i, row] of rows.entries()) {
      const { data: receiptNo, error: rErr } = await supabaseAdmin.rpc("next_receipt_no", {
        _period: row.period,
      });
      if (rErr) throw new Error(rErr.message);
      const amount = allocated[i] ?? row.total;
      const penalty = Math.min(row.penalty, amount);
      const { error: pErr } = await supabase.from("payments").insert({
        txn_no: txnNo,
        student_id: student.id,
        period: row.period,
        value_date: data.value_date,
        base_amount: Math.max(0, amount - penalty),
        penalty_amount: penalty,
        total_amount: amount,
        stage: row.stage as "on_time" | "fine" | "superfine" | "blacklisted",
        mode: data.mode,
        reference: data.reference ?? null,
        receipt_no: receiptNo as string,
        recorded_by: context.userId,
      });
      if (pErr) throw new Error(pErr.message);
      total += amount;
    }

    const net = total - advance;

    const { error: uErr } = await supabaseAdmin
      .from("students")
      .update({
        closed_at: data.value_date,
        settlement_amount: net,
        blacklisted: false,
        blacklist_reason: null,
        ...(advance > 0
          ? {
              advance_returned_at: data.value_date,
              advance_returned_amount: advance,
              advance_amount: Math.max(0, held - advance),
            }
          : {}),
      })
      .eq("id", student.id);
    if (uErr) throw new Error(uErr.message);

    if (advance > 0) {
      // Mirror the refund into the advance ledger so it shows in the history.
      const { error: aErr } = await supabaseAdmin.from("advance_entries").insert({
        student_id: student.id,
        entry_date: data.value_date,
        kind: "return",
        amount: advance,
        mode: data.mode,
        note: "Advance returned on settlement — registration closed",
        txn_no: txnNo,
        created_by: context.userId,
      });
      if (aErr) throw new Error(aErr.message);
    }



    return { ok: true, total, months: rows.length, advance, net, txn_no: txnNo };
  });

/** Admin: stop fee, fine and superfine accrual from a date (from the fee tab). */
export const freezeStudentAt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => freezeAtSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("students")
      .update({ frozen_at: data.frozen_at })
      .eq("id", data.student_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });



/** Student: my own dues and payment history. */
export const myFeeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: student } = await supabase
      .from("students")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!student || student.status !== "approved") {
      return { student: student ?? null, current: null, history: [] };
    }
    const period = currentPeriod();
    const [{ data: cfg }, { data: payments }] = await Promise.all([
      supabase.from("monthly_fee_config").select("*").eq("period", period).maybeSingle(),
      supabase
        .from("payments")
        .select("*")
        .is("voided_at", null)
        .eq("student_id", student.id)
        .order("period", { ascending: false }),
    ]);
    const paidThisMonth =
      (payments ?? []).find((p) => p.period === period && p.settled) ?? null;
    const cutoff = accrualCutoff(student);
    // A frozen or closed registration stops accruing after its value date.
    const stopped = toPeriod(cutoff) < period;
    const base = cfg
      ? Number(student.slab === "higher" ? cfg.higher_amount : cfg.lower_amount)
      : null;
    return {
      student,
      current:
        base === null || stopped
          ? null
          : { ...computeDue(period, base, cutoff, penaltiesOf(student)), paid: paidThisMonth },
      history: payments ?? [],
    };
  });


/* ---------------- 3. Expense tracker ---------------- */

export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => periodSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await assertViewer(context.supabase, context.userId);
    const period = toPeriod(data.period);
    if (!admin) {
      const settings = await readSettings(context.supabase);
      if (!settings.expenses_visible) {
        throw new Error("The expense tracker is currently closed by the transport office");
      }
      // Students only ever see months up to the previous one.
      if (period > previousPeriod()) {
        throw new Error("Students can view expenses up to last month only");
      }
    }
    const end = toPeriod(new Date(new Date(`${period}T00:00:00Z`).setUTCMonth(
      new Date(`${period}T00:00:00Z`).getUTCMonth() + 1,
    )));
    let client = context.supabase;
    if (!admin) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      client = supabaseAdmin;
    }
    const [{ data: rows, error }, { data: pays }, { data: income }, opening, advanceDelta] =
      await Promise.all([
        client
          .from("expenses")
          .select("*")
          .is("voided_at", null)
          .gte("expense_date", period)
          .lt("expense_date", end)
          .order("expense_date", { ascending: false }),
        client.from("payments").select("total_amount").is("voided_at", null).gte("value_date", period).lt("value_date", end),
        client.from("other_income").select("amount").is("voided_at", null).gte("income_date", period).lt("income_date", end),
        balanceBefore(client, period),
        advanceNet(client, period, end),
      ]);
    if (error) throw new Error(error.message);
    const feeReceived = (pays ?? []).reduce((a, p) => a + Number(p.total_amount), 0);
    const otherIncome = (income ?? []).reduce((a, r) => a + Number(r.amount), 0);
    const spent = (rows ?? []).reduce((a, e) => a + Number(e.amount), 0);
    return {
      expenses: rows ?? [],
      canEdit: admin,
      balance: {
        opening,
        feeReceived,
        otherIncome,
        advanceDelta,
        expenses: spent,
        closing: opening + feeReceived + otherIncome + advanceDelta - spent,
      },
    };
  });



export const addExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => expenseSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const txnNo = await createTransaction(supabaseAdmin, {
      kind: "expense",
      date: data.expense_date,
      userId: context.userId,
      note: `${data.category} — ${data.vendor}`,
    });
    const { error } = await context.supabase.from("expenses").insert({
      ...data,
      txn_no: txnNo,
      bill_no: data.bill_no ?? null,
      notes: data.notes ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true, txn_no: txnNo };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- 4. Monthly statement ---------------- */

export const monthlyStatement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => periodSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await assertViewer(context.supabase, context.userId);
    if (!admin) {
      const settings = await readSettings(context.supabase);
      if (!settings.statement_visible) {
        throw new Error("The monthly statement is currently closed by the transport office");
      }
    }
    let supabase = context.supabase;
    if (!admin) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      supabase = supabaseAdmin;
    }
    const period = toPeriod(data.period);
    const start = new Date(`${period}T00:00:00Z`);
    const end = toPeriod(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)));

    const [
      { data: cfg },
      { data: students },
      { data: payments },
      { data: receiptRows },
      { data: expenses },
      { data: incomeRows },
      { data: allPaid },
      opening,
      advanceDelta,
    ] = await Promise.all([
      supabase.from("monthly_fee_config").select("*").eq("period", period).maybeSingle(),
      supabase.from("students").select("*").eq("status", "approved"),
      supabase.from("payments").select("*").is("voided_at", null).eq("period", period),
      // Cash-basis view: everything actually received during this month,
      // whichever month's fee it settles.
      supabase
        .from("payments")
        .select("*, students(full_name, roll_number)")
        .is("voided_at", null)
        .gte("value_date", period)
        .lt("value_date", end)
        .order("value_date"),
      supabase
        .from("expenses")
        .select("*")
        .is("voided_at", null)
        .gte("expense_date", period)
        .lt("expense_date", end)
        .order("expense_date"),
      supabase
        .from("other_income")
        .select("*")
        .is("voided_at", null)
        .gte("income_date", period)
        .lt("income_date", end)
        .order("income_date"),
      // For defaulters, we need each student's paid periods up to this month
      // so we can report the earliest unpaid month (pending from).
      supabase
        .from("payments")
        .select("student_id, period")
        .is("voided_at", null)
        .eq("settled", true)
        .lte("period", period),
      balanceBefore(supabase, period),
      advanceNet(supabase, period, end),
    ]);

    const pays = payments ?? [];
    const collection = {
      base: pays.reduce((a, p) => a + Number(p.base_amount), 0),
      penalty: pays.reduce((a, p) => a + Number(p.penalty_amount), 0),
      total: pays.reduce((a, p) => a + Number(p.total_amount), 0),
      onTime: pays.filter((p) => p.stage === "on_time").length,
      fine: pays.filter((p) => p.stage === "fine").length,
      superfine: pays.filter((p) => p.stage === "superfine").length,
    };

    const receipts = (receiptRows ?? []).map((p) => ({
      id: p.id,
      value_date: p.value_date,
      receipt_no: p.receipt_no,
      for_period: toPeriod(p.period),
      roll_number: (p.students as { roll_number: string | null } | null)?.roll_number ?? null,
      full_name: (p.students as { full_name: string } | null)?.full_name ?? "—",
      base: Number(p.base_amount),
      penalty: Number(p.penalty_amount),
      total: Number(p.total_amount),
      stage: p.stage,
      mode: p.mode,
    }));
    const receivedTotal = receipts.reduce((a, r) => a + r.total, 0);

    const otherIncome = (incomeRows ?? []).map((r) => ({
      id: r.id,
      income_date: r.income_date,
      particulars: r.particulars,
      remarks: r.remarks,
      amount: Number(r.amount),
    }));
    const otherIncomeTotal = otherIncome.reduce((a, r) => a + r.amount, 0);

    const byCategory: Record<string, number> = {};
    for (const e of expenses ?? []) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount);
    }
    const expenseTotal = Object.values(byCategory).reduce((a, b) => a + b, 0);

    const paidIds = new Set(pays.map((p) => p.student_id));
    const paidByStudent: Record<string, Set<string>> = {};
    for (const p of allPaid ?? []) {
      const set = paidByStudent[p.student_id] ?? new Set<string>();
      set.add(toPeriod(p.period));
      paidByStudent[p.student_id] = set;
    }
    const stage = stageOn(period);
    const periodLast = monthEnd(period);
    const defaulters = (students ?? [])
      .filter((s) => !paidIds.has(s.id))
      // Nobody owes for a month before they joined, or after a freeze/closure.
      .filter((s) => !s.date_of_joining || s.date_of_joining < periodLast)
      .filter((s) => toPeriod(accrualCutoff(s)) >= period)
      .map((s) => {
        const base = cfg
          ? Number(s.slab === "higher" ? cfg.higher_amount : cfg.lower_amount)
          : 0;
        const start = toPeriod(s.date_of_joining ?? s.created_at);
        const months = periodsBetween(start, period);
        const paidSet = paidByStudent[s.id] ?? new Set<string>();
        const pendingFrom = months.find((m) => !paidSet.has(m)) ?? null;
        return {
          student: s,
          due: computeDue(period, base, accrualCutoff(s), penaltiesOf(s)),
          pendingFrom,
        };
      });

    const closing =
      opening + receivedTotal + otherIncomeTotal + advanceDelta - expenseTotal;

    return {
      period,
      config: cfg ?? null,
      stage,
      collection,
      unpaid: defaulters.length,
      blacklisted: (students ?? []).filter((s) => s.blacklisted).length,
      totalStudents: (students ?? []).length,
      byCategory,
      expenseTotal,
      net: collection.total - expenseTotal,
      // Cash-basis figures for the month.
      receipts,
      receivedTotal,
      otherIncome,
      otherIncomeTotal,
      advanceDelta,
      expenses: expenses ?? [],
      opening,
      closing,
      // Names of other students stay with the transport office.
      defaulters: admin ? defaulters : [],
      canEdit: admin,
    };
  });

/* ---------------- 4b. Income other than fee and fine ---------------- */

export const listOtherIncome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => periodSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const period = toPeriod(data.period);
    const { data: rows, error } = await context.supabase
      .from("other_income")
      .select("*")
      .is("voided_at", null)
      .gte("income_date", period)
      .lt("income_date", monthEnd(period))
      .order("income_date");
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const addOtherIncome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => otherIncomeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const txnNo = await createTransaction(supabaseAdmin, {
      kind: "other_income",
      date: data.income_date,
      userId: context.userId,
      note: data.particulars,
    });
    const { error } = await context.supabase.from("other_income").insert({
      txn_no: txnNo,
      income_date: data.income_date,
      particulars: data.particulars,
      remarks: data.remarks ?? null,
      amount: data.amount,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true, txn_no: txnNo };
  });

export const deleteOtherIncome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("other_income").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


/* ---------------- 5. Driver ---------------- */

/** Driver/admin: pickup list with only the details the driver needs. */
export const driverRoster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin } = await assertDriverOrAdmin(context.supabase, context.userId);
    if (!admin) {
      const settings = await readSettings(context.supabase);
      if (!settings.driver_visible) {
        throw new Error("The driver tab is currently closed by the transport office");
      }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const period = currentPeriod();

    const [{ data: students, error }, { data: payments, error: pErr }] = await Promise.all([
      supabaseAdmin
        .from("students")
        .select("id, full_name, branch, boarding_point, roll_number, photo_path, blacklisted, pickup_seq, closed_at")
        .eq("status", "approved")
        .is("closed_at", null),
      supabaseAdmin.from("payments").select("student_id").is("voided_at", null).eq("settled", true).eq("period", period),
    ]);
    if (error) throw new Error(error.message);
    if (pErr) throw new Error(pErr.message);

    const paid = new Set((payments ?? []).map((p) => p.student_id));

    const rows = (students ?? [])
      .slice()
      .sort((a, b) => {
        const sa = a.pickup_seq ?? Number.MAX_SAFE_INTEGER;
        const sb = b.pickup_seq ?? Number.MAX_SAFE_INTEGER;
        if (sa !== sb) return sa - sb;
        return (a.roll_number ?? "").localeCompare(b.roll_number ?? "");
      })
      .map((s) => ({
        id: s.id,
        full_name: s.full_name,
        branch: s.branch,
        boarding_point: s.boarding_point,
        photo_path: s.photo_path,
        blacklisted: s.blacklisted,
        paid: paid.has(s.id),
      }));

    const paths = rows.map((r) => r.photo_path).filter((p): p is string => Boolean(p));
    const urls: Record<string, string> = {};
    if (paths.length > 0) {
      const { data: signed } = await supabaseAdmin.storage
        .from("student-photos")
        .createSignedUrls(paths, 600);
      for (const row of signed ?? []) {
        if (row.path && row.signedUrl) urls[row.path] = row.signedUrl;
      }
    }

    return { period, rows, photoUrls: urls, canEdit: true, isAdmin: admin };
  });

/** Driver/admin: save the pickup sequence for everyone. */
export const setPickupOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pickupOrderSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertDriverOrAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let seq = 1;
    for (const id of data.ids) {
      const { error } = await supabaseAdmin
        .from("students")
        .update({ pickup_seq: seq })
        .eq("id", id);
      if (error) throw new Error(error.message);
      seq += 1;
    }
    return { ok: true };
  });

/** Admin: which accounts currently have driver access. */
export const listDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "driver");
    if (error) throw new Error(error.message);
    const drivers: { user_id: string; email: string | null }[] = [];
    for (const row of data ?? []) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
      drivers.push({ user_id: row.user_id, email: u?.user?.email ?? null });
    }
    return { drivers };
  });




/** Admin: give an existing account driver access. */
export const grantDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => driverEmailSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const email = data.email.trim().toLowerCase();
    const { findUserIdByEmail } = await import("./driver.server");
    const userId = await findUserIdByEmail(email);

    if (!userId) {
      throw new Error("No account found with that email. Ask the driver to sign up first.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "driver" });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true, email };
  });

/** Admin: remove driver access. */
export const revokeDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", "driver");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- 6. Advance ---------------- */

/** Admin/driver/student: every enrolled student with their advance, oldest joiner first. */
export const listAdvances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => advanceFilterSchema.parse(d ?? {}))
  .handler(async ({ context, data: filter }) => {
    const { admin } = await assertViewer(context.supabase, context.userId);
    if (!admin) {
      const settings = await readSettings(context.supabase);
      if (!settings.advance_visible) {
        throw new Error("The advance tab is currently closed by the transport office");
      }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("students")
      .select(
        "id, full_name, roll_number, photo_path, slab, stage, date_of_joining, advance_amount, advance_limit, advance_returned_at, advance_returned_amount, closed_at, frozen_at, boarding_point",
      )
      .eq("status", "approved");
    if (error) throw new Error(error.message);

    const rows = (data ?? []).slice().sort((a, b) => {
      const da = a.date_of_joining ?? "9999-12-31";
      const db = b.date_of_joining ?? "9999-12-31";
      if (da !== db) return da < db ? -1 : 1;
      return (a.roll_number ?? "").localeCompare(b.roll_number ?? "");
    });

    const urls: Record<string, string> = {};
    const paths = rows.map((r) => r.photo_path).filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      const { data: signed } = await supabaseAdmin.storage
        .from("student-photos")
        .createSignedUrls(paths, 600);
      for (const row of signed ?? []) {
        if (row.path && row.signedUrl) urls[row.path] = row.signedUrl;
      }
    }

    // Per-student collected / returned totals come from the advance ledger:
    // the held balance is simply collected minus returned.
    // Optional date-range filter: only students with a movement in the
    // range are listed, and their totals reflect the entries in the range.
    const from = filter?.from || undefined;
    const to = filter?.to || undefined;
    const filtering = Boolean(from || to);
    let entriesQuery = supabaseAdmin
      .from("advance_entries")
      .select("student_id, kind, amount, entry_date")
      .is("voided_at", null);
    if (from) entriesQuery = entriesQuery.gte("entry_date", from);
    if (to) entriesQuery = entriesQuery.lte("entry_date", to);
    const { data: entries } = await entriesQuery;
    const collectedBy = new Map<string, number>();
    const returnedBy = new Map<string, number>();
    for (const e of entries ?? []) {
      const map = e.kind === "return" ? returnedBy : collectedBy;
      map.set(e.student_id, (map.get(e.student_id) ?? 0) + Number(e.amount));
    }

    const withTotals = rows
      .filter((r) => !filtering || collectedBy.has(r.id) || returnedBy.has(r.id))
      .map((r) => {
      const ret = returnedBy.get(r.id) ?? 0;
      const col = collectedBy.get(r.id) ?? 0;
      const status = r.closed_at || r.advance_returned_at
        ? ("closed" as const)
        : r.frozen_at
          ? ("freeze" as const)
          : col - ret > 0
            ? ("active" as const)
            : ("not_active" as const);
      return {
        ...r,
        held_now: Math.max(0, col - ret),
        collected_total: col,
        returned_total: ret,
        advance_limit: Number(r.advance_limit ?? 0),
        advance_status: status,
      };
      });


    const held = withTotals.reduce((a, r) => a + r.held_now, 0);
    const returned = withTotals.reduce((a, r) => a + r.returned_total, 0);

    return { rows: withTotals, photoUrls: urls, held, returned, canEdit: admin };
  });

/** Admin or the student: the advance ledger for one student, oldest first. */
export const listStudentAdvances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => studentIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await assertViewer(context.supabase, context.userId);
    if (!admin) {
      const settings = await readSettings(context.supabase);
      if (!settings.advance_visible) {
        throw new Error("The advance tab is currently closed by the transport office");
      }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("advance_entries")
      .select("*")
      .eq("student_id", data.id)
      .order("entry_date", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

/**
 * Admin: collect a fresh advance or return part of the advance held. Each
 * entry carries its own transaction number and updates the held balance.
 */
export const recordAdvance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => advanceEntrySchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: student, error: sErr } = await supabaseAdmin
      .from("students")
      .select("*")
      .eq("id", data.student_id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!student || student.status !== "approved") throw new Error("Student not found");

    // The held balance is the ledger: collected minus returned.
    const { data: ledger } = await supabaseAdmin
      .from("advance_entries")
      .select("kind, amount")
      .eq("student_id", student.id)
      .is("voided_at", null);
    const held = (ledger ?? []).reduce(
      (a, e) => a + (e.kind === "return" ? -Number(e.amount) : Number(e.amount)),
      0,
    );
    const limit = Number(student.advance_limit ?? 0);
    if (data.kind === "collect" && (student.closed_at || student.advance_returned_at)) {
      throw new Error("This registration is closed — no further advance can be collected");
    }
    if (data.kind === "collect" && limit > 0 && held + data.amount > limit) {
      throw new Error(
        `The maximum advance for this student is ${limit}; ${held} is already held`,
      );
    }
    if (data.kind === "return" && data.amount > held) {
      throw new Error(`Only ${held} is held for this student`);
    }

    const txnNo = await createTransaction(supabaseAdmin, {
      kind: data.kind === "collect" ? "advance" : "advance_return",
      date: data.value_date,
      userId: context.userId,
      note:
        `${data.kind === "collect" ? "Advance collected" : "Advance returned"} — ` +
        `${student.full_name}${student.roll_number ? ` (${student.roll_number})` : ""}`,
    });

    const { error: iErr } = await supabaseAdmin.from("advance_entries").insert({
      student_id: student.id,
      entry_date: data.value_date,
      kind: data.kind,
      amount: data.amount,
      mode: data.mode,
      note: data.note ?? null,
      txn_no: txnNo,
      created_by: context.userId,
    });
    if (iErr) throw new Error(iErr.message);

    // The advance itself is not other income or an expense: the monthly
    // statement picks it up as the net movement in advance held.

    const nextHeld = data.kind === "collect" ? held + data.amount : held - data.amount;
    const { error: uErr } = await supabaseAdmin
      .from("students")
      .update({ advance_amount: nextHeld })
      .eq("id", student.id);
    if (uErr) throw new Error(uErr.message);

    return { ok: true, txn_no: txnNo, held: nextHeld };
  });

/**
 * Admin: wipe every operational record so the system can start fresh.
 * Login accounts and admin roles are untouched.
 */
export const masterReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => masterResetSchema.parse(d))
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Clear uploaded passport photos first: the paths live on the students rows.
    const { data: students } = await supabaseAdmin
      .from("students")
      .select("photo_path")
      .not("photo_path", "is", null);
    const paths = (students ?? [])
      .map((s) => s.photo_path)
      .filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      await supabaseAdmin.storage.from("student-photos").remove(paths);
    }

    const wipes = [
      supabaseAdmin.from("advance_entries").delete().not("id", "is", null),
      supabaseAdmin.from("payments").delete().not("id", "is", null),
      supabaseAdmin.from("other_income").delete().not("id", "is", null),
      supabaseAdmin.from("expenses").delete().not("id", "is", null),
    ];
    for (const w of wipes) {
      const { error } = await w;
      if (error) throw new Error(error.message);
    }
    for (const t of ["students", "monthly_fee_config", "transactions"] as const) {
      const { error } = await supabaseAdmin.from(t).delete().not("id", "is", null);
      if (error) throw new Error(error.message);
    }
    const { error: rcErr } = await supabaseAdmin
      .from("receipt_counters")
      .delete()
      .not("period", "is", null);
    if (rcErr) throw new Error(rcErr.message);
    const { error: tcErr } = await supabaseAdmin
      .from("transaction_counters")
      .delete()
      .not("day", "is", null);
    if (tcErr) throw new Error(tcErr.message);

    return { ok: true };
  });


/* ---------------- 7. Bulk pay and transactions ---------------- */

/**
 * Admin: receipt one month for many students under a single transaction
 * number. Each student keeps their own receipt and their own amount.
 */
export const bulkPay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bulkPaySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertAdmin(supabase, context.userId);
    const period = toPeriod(data.period);
    const today = new Date().toISOString().slice(0, 10);
    if (data.value_date > today) throw new Error("Value date cannot be in the future");
    if (data.value_date < period) throw new Error("Value date cannot be before the fee month");

    const { data: cfg } = await supabase
      .from("monthly_fee_config")
      .select("*")
      .eq("period", period)
      .maybeSingle();
    if (!cfg) throw new Error("Set the fee amounts for this month first");

    const { data: students, error: sErr } = await supabase
      .from("students")
      .select("*")
      .in("id", data.student_ids)
      .eq("status", "approved");
    if (sErr) throw new Error(sErr.message);
    if ((students ?? []).length === 0) throw new Error("No students selected");

    const { data: prior } = await supabase
      .from("payments")
      .select("student_id, period")
      .is("voided_at", null)
      .eq("settled", true)
      .in("student_id", data.student_ids)
      .lte("period", period);
    const paidBy = new Map<string, Set<string>>();
    for (const p of prior ?? []) {
      const set = paidBy.get(p.student_id) ?? new Set<string>();
      set.add(toPeriod(p.period));
      paidBy.set(p.student_id, set);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const txnNo = await createTransaction(supabaseAdmin, {
      kind: "bulk_fee",
      date: data.value_date,
      userId: context.userId,
      note: `Bulk fee collection for ${period.slice(0, 7)}`,
    });

    let total = 0;
    let count = 0;
    const skipped: string[] = [];
    for (const student of students ?? []) {
      const paid = paidBy.get(student.id) ?? new Set<string>();
      if (paid.has(period)) {
        skipped.push(student.full_name);
        continue;
      }
      const chain = periodsBetween(
        toPeriod(student.date_of_joining ?? student.created_at),
        period,
      );
      const oldestUnpaid = chain.find((p) => !paid.has(p));
      if (oldestUnpaid && oldestUnpaid < period) {
        skipped.push(student.full_name);
        continue;
      }
      const cutoff = accrualCutoff(student);
      if (toPeriod(cutoff) < period) {
        skipped.push(student.full_name);
        continue;
      }
      const base = Number(student.slab === "higher" ? cfg.higher_amount : cfg.lower_amount);
      const due = computeDue(
        period,
        base,
        data.value_date < cutoff ? data.value_date : cutoff,
        penaltiesOf(student),
      );
      const { data: receiptNo, error: rErr } = await supabaseAdmin.rpc("next_receipt_no", {
        _period: period,
      });
      if (rErr) throw new Error(rErr.message);
      const { error: pErr } = await supabase.from("payments").insert({
        txn_no: txnNo,
        student_id: student.id,
        period,
        value_date: data.value_date,
        base_amount: due.base,
        penalty_amount: due.penalty,
        total_amount: due.total,
        stage: due.stage,
        mode: data.mode,
        reference: data.reference ?? null,
        receipt_no: receiptNo as string,
        recorded_by: context.userId,
      });
      if (pErr) throw new Error(pErr.message);
      if (student.blacklisted) {
        await supabase
          .from("students")
          .update({ blacklisted: false, blacklist_reason: null })
          .eq("id", student.id);
      }
      total += due.total;
      count += 1;
    }

    return { ok: true, txn_no: txnNo, count, total, skipped };
  });

/** Admin: the transaction register, newest first. */
export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => txnListSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("transactions")
      .select("*")
      .order("txn_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.search?.trim()) q = q.ilike("txn_no", `%${data.search.trim()}%`);
    if (data.date) q = q.eq("txn_date", data.date);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

/** Admin: everything booked under one transaction number. */
export const getTransaction = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => txnNoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertAdmin(supabase, context.userId);
    const txnNo = data.txn_no.trim().toUpperCase();
    const { data: txn, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("txn_no", txnNo)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!txn) throw new Error("No transaction with that number");

    const [{ data: payments }, { data: income }, { data: spends }] = await Promise.all([
      supabase
        .from("payments")
        .select("*, students(full_name, roll_number)")
        .eq("txn_no", txnNo),
      supabase.from("other_income").select("*").eq("txn_no", txnNo),
      supabase.from("expenses").select("*").eq("txn_no", txnNo),
    ]);

    const inflow =
      (payments ?? []).reduce((a, p) => a + Number(p.total_amount), 0) +
      (income ?? []).reduce((a, r) => a + Number(r.amount), 0);
    const outflow = (spends ?? []).reduce((a, r) => a + Number(r.amount), 0);

    return {
      transaction: txn,
      payments: payments ?? [],
      income: income ?? [],
      expenses: spends ?? [],
      inflow,
      outflow,
      net: inflow - outflow,
    };
  });

/**
 * Admin: undo a whole transaction. Nothing is deleted — every line is marked
 * cancelled so the audit trail survives, and a settlement reopens the
 * registration and puts the advance back.
 */
export const cancelTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => txnNoSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const txnNo = data.txn_no.trim().toUpperCase();

    const { data: txn, error } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("txn_no", txnNo)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!txn) throw new Error("No transaction with that number");
    if (txn.cancelled_at) throw new Error("That transaction is already cancelled");

    const now = new Date().toISOString();
    const { data: payments } = await supabaseAdmin
      .from("payments")
      .select("student_id")
      .eq("txn_no", txnNo);

    // Standalone advance movements are reversed on the held balance.
    const { data: advEntries } = await supabaseAdmin
      .from("advance_entries")
      .select("id, student_id, kind, amount")
      .eq("txn_no", txnNo)
      .is("voided_at", null);

    for (const table of ["payments", "other_income", "expenses", "advance_entries"] as const) {
      const { error: vErr } = await supabaseAdmin
        .from(table)
        .update({ voided_at: now })
        .eq("txn_no", txnNo)
        .is("voided_at", null);
      if (vErr) throw new Error(vErr.message);
    }

    // A settlement closed the registration and refunded the advance: undo both.
    if (txn.kind === "settlement") {
      const ids = [...new Set((payments ?? []).map((p) => p.student_id))];
      for (const id of ids) {
        const { error: uErr } = await supabaseAdmin
          .from("students")
          .update({
            closed_at: null,
            settlement_amount: null,
            advance_returned_at: null,
            advance_returned_amount: null,
            advance_amount: await heldForStudent(id),
          })
          .eq("id", id);
        if (uErr) throw new Error(uErr.message);
      }
    }

    // The voided advance entries are already excluded from the ledger, so the
    // mirrored balance is simply recomputed from what is left.
    const advIds = [...new Set((advEntries ?? []).map((e) => e.student_id))];
    for (const id of advIds) {
      const { error: uErr } = await supabaseAdmin
        .from("students")
        .update({ advance_amount: await heldForStudent(id) })
        .eq("id", id);
      if (uErr) throw new Error(uErr.message);
    }



    const { error: cErr } = await supabaseAdmin
      .from("transactions")
      .update({ cancelled_at: now, cancelled_by: context.userId })
      .eq("txn_no", txnNo);
    if (cErr) throw new Error(cErr.message);

    return { ok: true, txn_no: txnNo };
  });
