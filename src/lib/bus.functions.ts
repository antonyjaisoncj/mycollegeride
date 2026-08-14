import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertAdmin,
  assertDriverOrAdmin,
  assertViewer,
  isAdmin,
  isDriver,
  readSettings,
  type AppSettings,
} from "./bus-helpers";
import {
  computeDue,
  currentPeriod,
  periodsBetween,
  previousPeriod,
  stageOn,
  toPeriod,
} from "./fee-rules";
import {
  approveSchema,
  driverEmailSchema,
  expenseSchema,
  feeConfigSchema,
  periodSchema,
  pickupOrderSchema,
  quickAddSchema,
  recordPaymentSchema,
  registrationSchema,
  rejectSchema,

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

/** First-time setup: become admin only while no admin exists. */
export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("claim_admin", {
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { claimed: Boolean(data) };
  });

export const adminExists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("admin_exists");
    if (error) throw new Error(error.message);
    return { exists: Boolean(data) };
  });

/* ---------------- Tab visibility switches ---------------- */

export const getAppSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => readSettings(context.supabase));

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
      context.supabase.from("payments").select("student_id, total_amount, period, value_date").order("value_date", { ascending: false }),
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
      .select("user_id, email")
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

    const { error } = await context.supabase
      .from("students")
      .update({ ...fields, slab: fields.stage === "Stage-1" ? "lower" : "higher" })
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
      supabase.from("payments").select("*").lte("period", period),
    ]);

    // A student only owes fees from the month they joined onwards.
    const periodEnd = (() => {
      const [y, m] = period.split("-").map(Number);
      return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
    })();

    type PaymentRow = NonNullable<typeof allPayments>[number];
    const paidPeriods = new Map<string, Set<string>>();
    const paidBy = new Map<string, PaymentRow>();
    for (const p of allPayments ?? []) {
      const set = paidPeriods.get(p.student_id) ?? new Set<string>();
      set.add(toPeriod(p.period));
      paidPeriods.set(p.student_id, set);
      if (toPeriod(p.period) === period) paidBy.set(p.student_id, p);
    }

    const rows = (students ?? [])
      .filter((s) => !s.date_of_joining || s.date_of_joining <= periodEnd)
      .map((s) => {
        const base = cfg
          ? Number(s.slab === "higher" ? cfg.higher_amount : cfg.lower_amount)
          : 0;
        const payment = paidBy.get(s.id) ?? null;
        const due = computeDue(period, base);
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

    // Amounts are always computed here — never taken from the browser.
    const base = Number(student.slab === "higher" ? cfg.higher_amount : cfg.lower_amount);
    const due = computeDue(period, base, valueDate);

    // Receipt numbers come from a service-role-only function so signed-in
    // users cannot burn or guess sequence numbers directly.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: receiptNo, error: rErr } = await supabaseAdmin.rpc("next_receipt_no", {
      _period: period,
    });
    if (rErr) throw new Error(rErr.message);

    const { error } = await supabase.from("payments").insert({
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
    });
    if (error) {
      throw new Error(
        error.code === "23505" ? "This month is already paid for this student" : error.message,
      );
    }

    // Settling dues clears an automatic blacklist.
    if (student.blacklisted) {
      await supabase
        .from("students")
        .update({ blacklisted: false, blacklist_reason: null })
        .eq("id", student.id);
    }
    return { ok: true, total: due.total, stage: due.stage };
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
        .eq("student_id", student.id)
        .order("period", { ascending: false }),
    ]);
    const paidThisMonth = (payments ?? []).find((p) => p.period === period) ?? null;
    const base = cfg
      ? Number(student.slab === "higher" ? cfg.higher_amount : cfg.lower_amount)
      : null;
    return {
      student,
      current:
        base === null
          ? null
          : { ...computeDue(period, base), paid: paidThisMonth },
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
    const { data: rows, error } = await client
      .from("expenses")
      .select("*")
      .gte("expense_date", period)
      .lt("expense_date", end)
      .order("expense_date", { ascending: false });
    if (error) throw new Error(error.message);
    return { expenses: rows ?? [], canEdit: admin };
  });

export const addExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => expenseSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("expenses")
      .insert({ ...data, bill_no: data.bill_no ?? null, notes: data.notes ?? null, created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
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

    const [{ data: cfg }, { data: students }, { data: payments }, { data: expenses }] =
      await Promise.all([
        supabase.from("monthly_fee_config").select("*").eq("period", period).maybeSingle(),
        supabase.from("students").select("*").eq("status", "approved"),
        supabase.from("payments").select("*").eq("period", period),
        supabase
          .from("expenses")
          .select("*")
          .gte("expense_date", period)
          .lt("expense_date", end),
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

    const byCategory: Record<string, number> = {};
    for (const e of expenses ?? []) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount);
    }
    const expenseTotal = Object.values(byCategory).reduce((a, b) => a + b, 0);

    const paidIds = new Set(pays.map((p) => p.student_id));
    const stage = stageOn(period);
    const defaulters = (students ?? [])
      .filter((s) => !paidIds.has(s.id))
      .map((s) => {
        const base = cfg
          ? Number(s.slab === "higher" ? cfg.higher_amount : cfg.lower_amount)
          : 0;
        return { student: s, due: computeDue(period, base) };
      });

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
      // Names of other students stay with the transport office.
      defaulters: admin ? defaulters : [],
      canEdit: admin,
    };
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
        .select("id, full_name, branch, boarding_point, roll_number, photo_path, blacklisted, pickup_seq")
        .eq("status", "approved"),
      supabaseAdmin.from("payments").select("student_id").eq("period", period),
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
