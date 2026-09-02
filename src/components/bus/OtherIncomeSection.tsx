import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { addOtherIncome, deleteOtherIncome, listOtherIncome } from "@/lib/bus.functions";
import { otherIncomeSchema } from "@/lib/bus-schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatINR, periodLabel } from "@/lib/fee-rules";

const EMPTY = {
  income_date: new Date().toISOString().slice(0, 10),
  particulars: "",
  remarks: "",
  amount: "",
};

/** Admin-only: money received in a month that is not bus fee or fine. */
export function OtherIncomeSection({ period }: { period: string }) {
  const fetchIncome = useServerFn(listOtherIncome);
  const create = useServerFn(addOtherIncome);
  const remove = useServerFn(deleteOtherIncome);
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ["other-income", period],
    queryFn: () => fetchIncome({ data: { period } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["other-income"] });
    qc.invalidateQueries({ queryKey: ["statement"] });
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  const add = useMutation({
    mutationFn: create,
    onSuccess: () => {
      toast.success("Income recorded");
      setForm({ ...EMPTY, income_date: form.income_date });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: remove,
    onSuccess: () => {
      toast.success("Entry removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit() {
    const parsed = otherIncomeSchema.safeParse({
      ...form,
      amount: Number(form.amount),
      remarks: form.remarks || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the entry");
      return;
    }
    add.mutate({ data: parsed.data });
  }

  const rows = data?.rows ?? [];
  const total = rows.reduce((a, r) => a + Number(r.amount), 0);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          Income other than fee collection
        </h2>
        <p className="text-sm text-muted-foreground">
          {periodLabel(period)} · Total{" "}
          <span className="font-semibold text-foreground">{formatINR(total)}</span>
        </p>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/60 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Particulars</th>
              <th className="px-4 py-3 font-medium">Remarks</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td className="px-4 py-4 text-muted-foreground" colSpan={5}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-muted-foreground" colSpan={5}>
                  No other income recorded for this month.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">{formatDate(r.income_date)}</td>
                  <td className="px-4 py-3">{r.particulars}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.remarks ?? "—"}</td>
                  <td className="px-4 py-3 font-medium">{formatINR(Number(r.amount))}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => del.mutate({ data: { id: r.id } })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}

            <tr className="bg-muted/30">
              <td className="px-4 py-3">
                <Input
                  type="date"
                  value={form.income_date}
                  onChange={(e) => setForm({ ...form, income_date: e.target.value })}
                />
              </td>
              <td className="px-4 py-3">
                <Input
                  placeholder="Industrial visit, PTA advance…"
                  value={form.particulars}
                  onChange={(e) => setForm({ ...form, particulars: e.target.value })}
                />
              </td>
              <td className="px-4 py-3">
                <Input
                  placeholder="Remarks"
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                />
              </td>
              <td className="px-4 py-3">
                <Input
                  inputMode="numeric"
                  placeholder="₹"
                  className="w-28"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" disabled={add.isPending} onClick={submit}>
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
