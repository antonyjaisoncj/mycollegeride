import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { addExpense, deleteExpense, listExpenses } from "@/lib/bus.functions";
import { expenseSchema } from "@/lib/bus-schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MonthPicker } from "./MonthPicker";
import {
  EXPENSE_CATEGORIES,
  currentPeriod,
  formatDate,
  formatINR,
  previousPeriod,
} from "@/lib/fee-rules";

type Category = (typeof EXPENSE_CATEGORIES)[number];

export function ExpenseTab({ readOnly = false }: { readOnly?: boolean }) {
  // Students may only look back — never at the running month.
  const [period, setPeriod] = useState(readOnly ? previousPeriod() : currentPeriod());
  const fetchExpenses = useServerFn(listExpenses);
  const create = useServerFn(addExpense);
  const remove = useServerFn(deleteExpense);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", period],
    queryFn: () => fetchExpenses({ data: { period } }),
  });

  const [form, setForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    category: "Fuel" as Category,
    vendor: "",
    bill_no: "",
    amount: "",
    notes: "",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["statement"] });
  };

  const addMutation = useMutation({
    mutationFn: create,
    onSuccess: () => {
      toast.success("Expense recorded");
      setForm({ ...form, vendor: "", bill_no: "", amount: "", notes: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMutation = useMutation({
    mutationFn: remove,
    onSuccess: () => {
      toast.success("Expense removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = expenseSchema.safeParse({
      ...form,
      amount: Number(form.amount),
      bill_no: form.bill_no || undefined,
      notes: form.notes || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    addMutation.mutate({ data: parsed.data });
  }

  const expenses = data?.expenses ?? [];
  const total = expenses.reduce((a, e) => a + Number(e.amount), 0);

  return (
    <div className="space-y-8">
      {readOnly ? null : (
      <form
        onSubmit={submit}
        className="rounded-xl border border-border bg-card p-5 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-card-foreground">Record an expense</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="edate">Date</Label>
            <Input
              id="edate"
              type="date"
              value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm({ ...form, category: v as Category })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendor">Vendor</Label>
            <Input
              id="vendor"
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bill">Bill number</Label>
            <Input
              id="bill"
              value={form.bill_no}
              onChange={(e) => setForm({ ...form, bill_no: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amt">Amount (₹)</Label>
            <Input
              id="amt"
              inputMode="numeric"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={1}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <Button type="submit" className="mt-4" disabled={addMutation.isPending}>
          Add expense
        </Button>
      </form>
      )}


      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Expenses</h2>
          <div className="flex items-center gap-4">
            <MonthPicker
              period={period}
              onChange={setPeriod}
              max={readOnly ? previousPeriod() : undefined}
            />
            <p className="text-sm font-semibold text-foreground">Total {formatINR(total)}</p>
          </div>
        </div>

        {data?.balance ? (
          <div className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
            <BalanceCell
              label="Opening balance"
              value={data.balance.opening}
              hint="Carried forward"
            />
            <BalanceCell label="Fee & fine received" value={data.balance.feeReceived} />
            <BalanceCell label="Other income" value={data.balance.otherIncome} />
            <BalanceCell label="Advance difference" value={data.balance.advanceDelta} />
            <BalanceCell label="Expenses" value={-data.balance.expenses} />
            <BalanceCell
              label="Monthly balance"
              value={data.balance.closing}
              hint="Carried to next month"
              strong
            />
          </div>
        ) : null}


        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/60 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Bill no.</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                {readOnly ? null : <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                    Loading…
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                    No expenses recorded for this month.
                  </td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3">{formatDate(e.expense_date)}</td>
                    <td className="px-4 py-3">{e.category}</td>
                    <td className="px-4 py-3">{e.vendor}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.bill_no ?? "—"}</td>
                    <td className="px-4 py-3 font-medium">{formatINR(Number(e.amount))}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.notes ?? "—"}</td>
                    {readOnly ? null : (
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => delMutation.mutate({ data: { id: e.id } })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** One figure in the carry-forward balance strip; negatives show in red. */
function BalanceCell({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: number;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 ${strong ? "text-xl font-semibold" : "text-lg font-medium"} ${
          value < 0 ? "text-destructive" : "text-card-foreground"
        }`}
      >
        {value < 0 ? `-${formatINR(Math.abs(value))}` : formatINR(value)}
      </p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

