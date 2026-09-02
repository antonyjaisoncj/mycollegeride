import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { cancelTransaction, getTransaction, listTransactions } from "@/lib/bus.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDate, formatINR, periodLabel } from "@/lib/fee-rules";

const KIND_LABEL: Record<string, string> = {
  fee: "Monthly fee",
  bulk_fee: "Bulk fee collection",
  settlement: "Settlement",
  expense: "Expense",
  other_income: "Other income",
};

/** Look up any money transaction by its number and undo it if needed. */
export function TransactionsSection() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const fetchList = useServerFn(listTransactions);
  const fetchOne = useServerFn(getTransaction);
  const cancelFn = useServerFn(cancelTransaction);
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["transactions", search],
    queryFn: () => fetchList({ data: search.trim() ? { search: search.trim() } : {} }),
  });

  const detail = useQuery({
    queryKey: ["transaction", open],
    queryFn: () => fetchOne({ data: { txn_no: open as string } }),
    enabled: Boolean(open),
  });

  const undo = useMutation({
    mutationFn: cancelFn,
    onSuccess: (res) => {
      toast.success(`Transaction ${res.txn_no} cancelled`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Transactions</h2>
        <Input
          className="w-64"
          placeholder="Search transaction number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Every fee receipt, bulk collection, settlement, other income and expense carries a
        transaction number. Cancelling one reverses all of its entries.
      </p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/60 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Transaction number</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Details</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.isLoading ? (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                  Loading…
                </td>
              </tr>
            ) : (list.data?.rows.length ?? 0) === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                  No transactions found.
                </td>
              </tr>
            ) : (
              (list.data?.rows ?? []).map((t) => (
                <tr key={t.id} className={t.cancelled_at ? "opacity-60" : undefined}>
                  <td className="px-4 py-3 font-mono text-xs">{t.txn_no}</td>
                  <td className="px-4 py-3">{formatDate(t.txn_date)}</td>
                  <td className="px-4 py-3">{KIND_LABEL[t.kind] ?? t.kind}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.note ?? "—"}</td>
                  <td className="px-4 py-3">
                    {t.cancelled_at ? (
                      <Badge variant="destructive">Cancelled</Badge>
                    ) : (
                      <Badge variant="secondary">Posted</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setOpen(open === t.txn_no ? null : t.txn_no)}
                    >
                      {open === t.txn_no ? "Hide" : "View"}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open ? (
        <div className="mt-4 rounded-xl border border-border bg-card p-5">
          {detail.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading transaction…</p>
          ) : detail.data ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-sm">{detail.data.transaction.txn_no}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(detail.data.transaction.txn_date)} ·{" "}
                    {KIND_LABEL[detail.data.transaction.kind] ?? detail.data.transaction.kind}
                    {detail.data.transaction.note ? ` · ${detail.data.transaction.note}` : ""}
                  </p>
                </div>
                {detail.data.transaction.cancelled_at ? (
                  <Badge variant="destructive">
                    Cancelled {formatDate(detail.data.transaction.cancelled_at.slice(0, 10))}
                  </Badge>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={undo.isPending}>
                        Undo transaction
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Undo {detail.data.transaction.txn_no}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Every entry under this number is reversed. Nothing is deleted — the
                          lines stay on record as cancelled. A settlement also reopens the
                          registration and restores the advance.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep it</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            undo.mutate({
                              data: { txn_no: detail.data!.transaction.txn_no },
                            })
                          }
                        >
                          Undo transaction
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>

              {detail.data.payments.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold">Fee receipts</h3>
                  <table className="mt-2 w-full text-sm">
                    <tbody className="divide-y divide-border">
                      {detail.data.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2">
                            {p.students?.roll_number ?? "—"} · {p.students?.full_name ?? "—"}
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {periodLabel(p.period)} · receipt {p.receipt_no}
                          </td>
                          <td className="py-2 text-right font-medium">
                            {formatINR(Number(p.total_amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {detail.data.income.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold">Other income</h3>
                  {detail.data.income.map((r) => (
                    <div key={r.id} className="flex justify-between py-2 text-sm">
                      <span>{r.particulars}</span>
                      <span className="font-medium">{formatINR(Number(r.amount))}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {detail.data.expenses.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold">Payments out</h3>
                  {detail.data.expenses.map((r) => (
                    <div key={r.id} className="flex justify-between py-2 text-sm">
                      <span>
                        {r.category} · {r.vendor}
                      </span>
                      <span className="font-medium">−{formatINR(Number(r.amount))}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">Net effect</span>
                <span className="text-lg font-semibold">{formatINR(detail.data.net)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-destructive">Transaction not found.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
