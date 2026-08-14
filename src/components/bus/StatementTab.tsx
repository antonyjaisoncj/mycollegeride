import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Printer } from "lucide-react";
import { monthlyStatement } from "@/lib/bus.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MonthPicker } from "./MonthPicker";
import { STAGE_LABEL, currentPeriod, formatINR, periodLabel } from "@/lib/fee-rules";

export function StatementTab({ readOnly = false }: { readOnly?: boolean }) {
  const [period, setPeriod] = useState(currentPeriod());
  const fetchStatement = useServerFn(monthlyStatement);
  const { data, isLoading } = useQuery({
    queryKey: ["statement", period],
    queryFn: () => fetchStatement({ data: { period } }),
  });

  function exportCsv() {
    if (!data || readOnly) return;
    const lines: string[] = [
      `Monthly statement,${periodLabel(period)}`,
      "",
      "Collection,Amount",
      `Base fee,${data.collection.base}`,
      `Fine + superfine,${data.collection.penalty}`,
      `Total collected,${data.collection.total}`,
      "",
      "Expenses by category,Amount",
      ...Object.entries(data.byCategory).map(([k, v]) => `${k},${v}`),
      `Total expenses,${data.expenseTotal}`,
      "",
      `Net balance,${data.net}`,
      "",
      "Defaulters,Roll,Name,Amount owed,Stage",
      ...data.defaulters.map(
        (d) =>
          `,${d.student.roll_number ?? ""},${d.student.full_name},${d.due.total},${STAGE_LABEL[d.due.stage]}`,
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bus-statement-${period.slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
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

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading statement…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Fee collected" value={formatINR(data.collection.total)} />
            <Stat label="Fines collected" value={formatINR(data.collection.penalty)} />
            <Stat label="Expenses" value={formatINR(data.expenseTotal)} />
            <Stat
              label="Net balance"
              value={formatINR(data.net)}
              tone={data.net < 0 ? "negative" : "positive"}
            />
          </div>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="font-semibold text-card-foreground">
                Collection — {periodLabel(period)}
              </h3>
              <dl className="mt-4 space-y-2 text-sm">
                <Row label="Base fee" value={formatINR(data.collection.base)} />
                <Row label="Fine + superfine" value={formatINR(data.collection.penalty)} />
                <Row label="Paid on time" value={String(data.collection.onTime)} />
                <Row label="Paid with fine" value={String(data.collection.fine)} />
                <Row label="Paid with superfine" value={String(data.collection.superfine)} />
                <Row label="Unpaid" value={String(data.unpaid)} />
                <Row label="Blacklisted" value={String(data.blacklisted)} />
                <Row label="Approved students" value={String(data.totalStudents)} />
              </dl>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
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
            </div>
          </section>

          {readOnly ? null : (
          <section>
            <h3 className="text-lg font-semibold text-foreground">Defaulters</h3>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-muted/60 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Roll</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Amount owed</th>
                    <th className="px-4 py-3 font-medium">Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.defaulters.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={4}>
                        Everyone has paid for this month.
                      </td>
                    </tr>
                  ) : (
                    data.defaulters.map((d) => (
                      <tr key={d.student.id}>
                        <td className="px-4 py-3 font-medium">{d.student.roll_number}</td>
                        <td className="px-4 py-3">{d.student.full_name}</td>
                        <td className="px-4 py-3">{formatINR(d.due.total)}</td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={d.due.stage === "blacklisted" ? "destructive" : "secondary"}
                          >
                            {STAGE_LABEL[d.due.stage]}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
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
