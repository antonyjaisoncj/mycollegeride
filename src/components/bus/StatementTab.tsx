import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Printer } from "lucide-react";
import { monthlyStatement } from "@/lib/bus.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MonthPicker } from "./MonthPicker";
import {
  STAGE_LABEL,
  YEAR_GROUP_LABEL,
  currentPeriod,
  formatDate,
  formatINR,
  groupByYear,
  periodLabel,
  yearGroupOf,
} from "@/lib/fee-rules";


function signed(n: number): string {
  return n < 0 ? `-${formatINR(Math.abs(n))}` : formatINR(n);
}

export function StatementTab({ readOnly = false }: { readOnly?: boolean }) {
  const [period, setPeriod] = useState(currentPeriod());
  const fetchStatement = useServerFn(monthlyStatement);
  const { data, isLoading } = useQuery({
    queryKey: ["statement", period],
    queryFn: () => fetchStatement({ data: { period } }),
  });

  const currentReceipts = data?.receipts.filter((r) => r.for_period === period) ?? [];
  const arrearsReceipts = data?.receipts.filter((r) => r.for_period !== period) ?? [];
  const currentTotal = currentReceipts.reduce((a, r) => a + r.total, 0);
  const arrearsTotal = arrearsReceipts.reduce((a, r) => a + r.total, 0);

  function exportCsv() {
    if (!data || readOnly) return;
    const lines: string[] = [
      `Monthly statement,${periodLabel(period)}`,
      "",
      `Opening balance,${data.opening}`,
      "",
      "Fee received this month — for current month,Date,Receipt,Roll,Name,Fee month,Base,Fine/Superfine,Total",
      ...currentReceipts.map(
        (r) =>
          `,${r.value_date},${r.receipt_no},${r.roll_number ?? ""},${r.full_name},${periodLabel(
            r.for_period,
          )},${r.base},${r.penalty},${r.total}`,
      ),
      `Subtotal — current month,${currentTotal}`,
      "",
      "Fee received this month — for earlier months,Date,Receipt,Roll,Name,Fee month,Base,Fine/Superfine,Total",
      ...arrearsReceipts.map(
        (r) =>
          `,${r.value_date},${r.receipt_no},${r.roll_number ?? ""},${r.full_name},${periodLabel(
            r.for_period,
          )},${r.base},${r.penalty},${r.total}`,
      ),
      `Subtotal — arrears,${arrearsTotal}`,
      `Total received,${data.receivedTotal}`,
      "",
      "Income other than fee and fine,Date,Particulars,Remarks,Amount",
      ...data.otherIncome.map(
        (r) => `,${r.income_date},${r.particulars},${r.remarks ?? ""},${r.amount}`,
      ),
      `Total other income,${data.otherIncomeTotal}`,
      "",
      `Advance held — difference from last month,${data.advanceDelta}`,
      "",
      "Expenses,Date,Category,Vendor,Bill no,Amount",
      ...data.expenses.map(
        (e) =>
          `,${e.expense_date},${e.category},${e.vendor},${e.bill_no ?? ""},${e.amount}`,
      ),
      `Total expenses,${data.expenseTotal}`,
      "",
      "Expenses by category,Amount",
      ...Object.entries(data.byCategory).map(([k, v]) => `${k},${v}`),
      "",
      `Closing balance,${data.closing}`,
      "",
      "Fees billed for this month,Amount",
      ...(data.collection.base ? [`Base fee,${data.collection.base}`] : []),
      ...(data.collection.penalty ? [`Fine + superfine,${data.collection.penalty}`] : []),
      ...(data.collection.total ? [`Total,${data.collection.total}`] : []),
      ...(data.collection.onTime ? [`Paid on time,${data.collection.onTime}`] : []),
      ...(data.collection.fine ? [`Paid with fine,${data.collection.fine}`] : []),
      ...(data.collection.superfine ? [`Paid with superfine,${data.collection.superfine}`] : []),
      ...(data.unpaid ? [`Unpaid,${data.unpaid}`] : []),
      ...(data.blacklisted ? [`Blacklisted,${data.blacklisted}`] : []),
      "Approved students," + data.totalStudents,
      "",
      "Defaulters,Year group,Roll,Name,Pending from,Amount owed,Stage",
      ...groupByYear(data.defaulters, (d) => d.student.roll_number).flatMap((group) => [
        ...group.rows.map(
          (d) =>
            `,${YEAR_GROUP_LABEL[yearGroupOf(d.student.roll_number)]},${d.student.roll_number ?? ""},${d.student.full_name},${d.pendingFrom ? periodLabel(d.pendingFrom) : "—"},${d.due.total},${STAGE_LABEL[d.due.stage]}`,
        ),
        `Subtotal — ${group.label},,,,,${group.rows.reduce((a, r) => a + r.due.total, 0)}`,
      ]),
      `Total owed,,,,,${data.defaulters.reduce((a, r) => a + r.due.total, 0)}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bus-statement-${period.slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printDefaulters() {
    document.body.classList.add("print-defaulters-only");
    const cleanup = () => {
      document.body.classList.remove("print-defaulters-only");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 1000);
  }


  function ReceiptRows({ rows }: { rows: typeof currentReceipts }) {
    return rows.map((r) => (
      <tr key={r.id}>
        <td className="px-3 py-2">{formatDate(r.value_date)}</td>
        <td className="px-3 py-2 text-muted-foreground">{r.receipt_no}</td>
        <td className="px-3 py-2">{r.roll_number ?? "—"}</td>
        <td className="px-3 py-2">{r.full_name}</td>
        <td className="px-3 py-2">{periodLabel(r.for_period)}</td>
        <td className="px-3 py-2">{formatINR(r.base)}</td>
        <td className="px-3 py-2">{r.penalty ? formatINR(r.penalty) : "—"}</td>
        <td className="px-3 py-2 font-medium">{formatINR(r.total)}</td>
      </tr>
    ));
  }

  return (
    <div className="space-y-8 print:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <MonthPicker period={period} onChange={setPeriod} />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={readOnly || !data}
          >
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            disabled={readOnly}
          >
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      <h2 className="hidden text-lg font-semibold print:block">
        Monthly statement — {periodLabel(period)}
      </h2>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading statement…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Opening balance" value={signed(data.opening)} tone={data.opening < 0 ? "negative" : "positive"} />
            <Stat label="Received this month" value={formatINR(data.receivedTotal + data.otherIncomeTotal + data.advanceDelta)} />
            <Stat label="Expenses" value={formatINR(data.expenseTotal)} />
            <Stat
              label="Closing balance"
              value={signed(data.closing)}
              tone={data.closing < 0 ? "negative" : "positive"}
            />
          </div>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
            <h3 className="font-semibold text-card-foreground">
              Fee and fine received in {periodLabel(period)}
            </h3>
            <div className="mt-3 overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[760px] text-sm print:min-w-0">
                <thead className="bg-muted/60 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Receipt</th>
                    <th className="px-3 py-2 font-medium">Roll</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Fee for</th>
                    <th className="px-3 py-2 font-medium">Base</th>
                    <th className="px-3 py-2 font-medium">Fine</th>
                    <th className="px-3 py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.receipts.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-muted-foreground" colSpan={8}>
                        No money received this month.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {currentReceipts.length > 0 ? (
                        <>
                          <tr className="bg-muted/30">
                            <td className="px-3 py-2 font-semibold text-muted-foreground" colSpan={8}>
                              For {periodLabel(period)}
                            </td>
                          </tr>
                          <ReceiptRows rows={currentReceipts} />
                          <tr>
                            <td className="px-3 py-2 font-semibold text-muted-foreground" colSpan={7}>
                              Subtotal
                            </td>
                            <td className="px-3 py-2 font-semibold">{formatINR(currentTotal)}</td>
                          </tr>
                        </>
                      ) : null}
                      {arrearsReceipts.length > 0 ? (
                        <>
                          <tr className="bg-muted/30">
                            <td className="px-3 py-2 font-semibold text-muted-foreground" colSpan={8}>
                              For earlier months
                            </td>
                          </tr>
                          <ReceiptRows rows={arrearsReceipts} />
                          <tr>
                            <td className="px-3 py-2 font-semibold text-muted-foreground" colSpan={7}>
                              Subtotal
                            </td>
                            <td className="px-3 py-2 font-semibold">{formatINR(arrearsTotal)}</td>
                          </tr>
                        </>
                      ) : null}
                    </>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="px-3 py-2 font-semibold" colSpan={7}>
                      Total received
                    </td>
                    <td className="px-3 py-2 font-semibold">{formatINR(data.receivedTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
            <h3 className="font-semibold text-card-foreground">
              Income other than fee and fine
            </h3>
            <div className="mt-3 overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[560px] text-sm print:min-w-0">
                <thead className="bg-muted/60 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Particulars</th>
                    <th className="px-3 py-2 font-medium">Remarks</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.otherIncome.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-muted-foreground" colSpan={4}>
                        None this month.
                      </td>
                    </tr>
                  ) : (
                    data.otherIncome.map((r) => (
                      <tr key={r.id}>
                        <td className="px-3 py-2">{formatDate(r.income_date)}</td>
                        <td className="px-3 py-2">{r.particulars}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.remarks ?? "—"}</td>
                        <td className="px-3 py-2 font-medium">{formatINR(r.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="px-3 py-2 font-semibold" colSpan={3}>
                      Total
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      {formatINR(data.otherIncomeTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <dl className="mt-4 text-sm">
              <div className="flex items-center justify-between border-t border-border pt-3">
                <dt className="text-muted-foreground">
                  Advance held — difference from last month
                </dt>
                <dd className="font-semibold">{signed(data.advanceDelta)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
            <h3 className="font-semibold text-card-foreground">Expenses</h3>
            <div className="mt-3 overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[640px] text-sm print:min-w-0">
                <thead className="bg-muted/60 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Vendor</th>
                    <th className="px-3 py-2 font-medium">Bill no.</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.expenses.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-muted-foreground" colSpan={5}>
                        No expenses this month.
                      </td>
                    </tr>
                  ) : (
                    data.expenses.map((e) => (
                      <tr key={e.id}>
                        <td className="px-3 py-2">{formatDate(e.expense_date)}</td>
                        <td className="px-3 py-2">{e.category}</td>
                        <td className="px-3 py-2">{e.vendor}</td>
                        <td className="px-3 py-2 text-muted-foreground">{e.bill_no ?? "—"}</td>
                        <td className="px-3 py-2 font-medium">
                          {formatINR(Number(e.amount))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="px-3 py-2 font-semibold" colSpan={4}>
                      Total expenses
                    </td>
                    <td className="px-3 py-2 font-semibold">{formatINR(data.expenseTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
              <h3 className="font-semibold text-card-foreground">
                Monthly balance — {periodLabel(period)}
              </h3>
              <dl className="mt-4 space-y-2 text-sm">
                <Row label="Opening balance (carried forward)" value={signed(data.opening)} />
                <Row label="Fee and fine received" value={formatINR(data.receivedTotal)} />
                {arrearsTotal > 0 ? (
                  <Row label="Of which, arrears for earlier months" value={formatINR(arrearsTotal)} />
                ) : null}
                <Row label="Other income" value={formatINR(data.otherIncomeTotal)} />
                <Row
                  label="Advance held — difference from last month"
                  value={signed(data.advanceDelta)}
                />
                <Row label="Expenses" value={`-${formatINR(data.expenseTotal)}`} />
                <Row label="Closing balance (carried forward)" value={signed(data.closing)} />
              </dl>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
              <h3 className="font-semibold text-card-foreground">
                Fees billed for {periodLabel(period)}
              </h3>
              <dl className="mt-4 space-y-2 text-sm">
                {data.collection.base ? <Row label="Base fee" value={formatINR(data.collection.base)} /> : null}
                {data.collection.penalty ? <Row label="Fine + superfine" value={formatINR(data.collection.penalty)} /> : null}
                {data.collection.total ? <Row label="Total" value={formatINR(data.collection.total)} /> : null}
                {data.collection.onTime ? <Row label="Paid on time" value={String(data.collection.onTime)} /> : null}
                {data.collection.fine ? <Row label="Paid with fine" value={String(data.collection.fine)} /> : null}
                {data.collection.superfine ? <Row label="Paid with superfine" value={String(data.collection.superfine)} /> : null}
                {data.unpaid ? <Row label="Unpaid" value={String(data.unpaid)} /> : null}
                {data.blacklisted ? <Row label="Blacklisted" value={String(data.blacklisted)} /> : null}
                <Row label="Approved students" value={String(data.totalStudents)} />
              </dl>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
            <h3 className="font-semibold text-card-foreground">Expenses by category</h3>
            {Object.keys(data.byCategory).length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No expenses this month.</p>
            ) : (
              <dl className="mt-4 space-y-2 text-sm">
                {Object.entries(data.byCategory).map(([k, v]) => (
                  <Row key={k} label={k} value={formatINR(v)} />
                ))}
                <Row label="Total" value={formatINR(data.expenseTotal)} />
              </dl>
            )}
          </section>

          {readOnly ? null : (
            <section id="defaulters-report">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-foreground">Defaulters</h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="print:hidden"
                  onClick={printDefaulters}
                >
                  <Printer className="mr-2 h-4 w-4" /> Print defaulters
                </Button>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Defaulters for {periodLabel(period)} · Printed on{" "}
                {new Date().toLocaleString("en-IN")}
              </p>
              <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card print:overflow-visible">
                <table className="w-full min-w-[600px] text-sm print:min-w-0">
                  <thead className="bg-muted/60 text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Roll</th>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Pending from</th>
                      <th className="px-4 py-3 font-medium">Amount owed</th>
                      <th className="px-4 py-3 font-medium">Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.defaulters.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                          Everyone has paid for this month.
                        </td>
                      </tr>
                    ) : (
                      groupByYear(data.defaulters, (d) => d.student.roll_number).flatMap(
                        (group) => [
                          <tr key={`grp-${group.key}`} className="bg-muted/40">
                            <td
                              className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                              colSpan={5}
                            >
                              {group.label} ({group.rows.length})
                            </td>
                          </tr>,
                          ...group.rows.map((d) => (
                            <tr key={d.student.id}>
                              <td className="px-4 py-3 font-medium">{d.student.roll_number}</td>
                              <td className="px-4 py-3">{d.student.full_name}</td>
                              <td className="px-4 py-3">
                                {d.pendingFrom ? periodLabel(d.pendingFrom) : "—"}
                              </td>
                              <td className="px-4 py-3">{formatINR(d.due.total)}</td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant={
                                    d.due.stage === "blacklisted" ? "destructive" : "secondary"
                                  }
                                >
                                  {STAGE_LABEL[d.due.stage]}
                                </Badge>
                              </td>
                            </tr>
                          )),
                          <tr
                            key={`sub-${group.key}`}
                            className="bg-muted/20 text-xs font-semibold"
                          >
                            <td className="px-4 py-2" colSpan={3}>
                              Subtotal — {group.label}
                            </td>
                            <td className="px-4 py-2">
                              {formatINR(group.rows.reduce((a, r) => a + r.due.total, 0))}
                            </td>
                            <td />
                          </tr>,
                        ],
                      )
                    )}
                    {data.defaulters.length > 0 ? (
                      <tr className="font-semibold">
                        <td className="px-4 py-3" colSpan={3}>
                          Total owed ({data.defaulters.length} students)
                        </td>
                        <td className="px-4 py-3">
                          {formatINR(data.defaulters.reduce((a, r) => a + r.due.total, 0))}
                        </td>
                        <td />
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          )}

        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold ${
          tone === "negative" ? "text-destructive" : "text-card-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-card-foreground">{value}</dd>
    </div>
  );
}
