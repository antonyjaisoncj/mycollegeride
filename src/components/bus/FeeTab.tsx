import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getFeeConfig, listDues, recordPayment, saveFeeConfig } from "@/lib/bus.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MonthPicker } from "./MonthPicker";
import { ReceivePaymentDialog } from "./ReceivePaymentDialog";
import {
  STAGE_LABEL,
  currentPeriod,
  formatDate,
  formatINR,
  periodLabel,
  windowsFor,
} from "@/lib/fee-rules";

const STAGE_VARIANT = {
  on_time: "secondary",
  fine: "default",
  superfine: "default",
  blacklisted: "destructive",
} as const;

export function FeeTab() {
  const [period, setPeriod] = useState(currentPeriod());
  const [search, setSearch] = useState("");
  const [receiving, setReceiving] = useState<
    { id: string; full_name: string; roll_number: string | null; slab: string } | null
  >(null);

  const fetchDues = useServerFn(listDues);
  const fetchCfg = useServerFn(getFeeConfig);
  const saveCfg = useServerFn(saveFeeConfig);
  const pay = useServerFn(recordPayment);
  const qc = useQueryClient();


  const dues = useQuery({
    queryKey: ["dues", period],
    queryFn: () => fetchDues({ data: { period } }),
  });
  const cfgQuery = useQuery({
    queryKey: ["fee-config", period],
    queryFn: () => fetchCfg({ data: { period } }),
  });

  const [lower, setLower] = useState("");
  const [higher, setHigher] = useState("");

  const saveConfig = useMutation({
    mutationFn: saveCfg,
    onSuccess: () => {
      toast.success("Fee amounts saved for this month");
      qc.invalidateQueries({ queryKey: ["fee-config", period] });
      qc.invalidateQueries({ queryKey: ["dues", period] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const collect = useMutation({
    mutationFn: pay,
    onSuccess: (res) => {
      toast.success(`Payment of ${formatINR(res.total)} recorded`);
      setReceiving(null);
      qc.invalidateQueries({ queryKey: ["dues", period] });
      qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cfg = cfgQuery.data?.config ?? null;
  const w = windowsFor(period);
  const rows = (dues.data?.rows ?? []).filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.student.full_name.toLowerCase().includes(q) ||
      (r.student.roll_number ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthPicker period={period} onChange={setPeriod} />
        <p className="text-sm text-muted-foreground">
          Due {formatDate(w.dueDate)} · Fine till {formatDate(w.fineUntil)} · Superfine till{" "}
          {formatDate(w.superfineUntil)}
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-card-foreground">
          Fee amounts for {periodLabel(period)}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set the two slabs on the first of the month. Fine is one twelfth of the slab,
          superfine one quarter.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="lower">Lower slab (₹)</Label>
            <Input
              id="lower"
              className="w-36"
              inputMode="numeric"
              placeholder={cfg ? String(Number(cfg.lower_amount)) : "600"}
              value={lower}
              onChange={(e) => setLower(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="higher">Higher slab (₹)</Label>
            <Input
              id="higher"
              className="w-36"
              inputMode="numeric"
              placeholder={cfg ? String(Number(cfg.higher_amount)) : "1200"}
              value={higher}
              onChange={(e) => setHigher(e.target.value)}
            />
          </div>
          <Button
            disabled={saveConfig.isPending}
            onClick={() => {
              const l = Number(lower || (cfg ? cfg.lower_amount : 0));
              const h = Number(higher || (cfg ? cfg.higher_amount : 0));
              if (!l || !h) {
                toast.error("Enter both slab amounts");
                return;
              }
              saveConfig.mutate({ data: { period, lower_amount: l, higher_amount: h } });
            }}
          >
            {cfg ? "Update amounts" : "Save amounts"}
          </Button>
          {cfg ? (
            <p className="text-sm text-muted-foreground">
              Currently {formatINR(Number(cfg.lower_amount))} / {formatINR(Number(cfg.higher_amount))}
            </p>
          ) : (
            <p className="text-sm text-destructive">Not set for this month yet.</p>
          )}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Collection</h2>
          <Input
            className="w-64"
            placeholder="Search roll number or name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/60 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Roll</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Base</th>
                <th className="px-4 py-3 font-medium">Penalty</th>
                <th className="px-4 py-3 font-medium">Payable now</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Receipt number</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dues.isLoading ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={9}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={9}>
                    No approved students yet.
                  </td>
                </tr>
              ) : (
                rows.map(({ student, payment, due, blockedByArrears, earliestUnpaid }) => (
                  <tr key={student.id}>
                    <td className="px-4 py-3 font-medium">{student.roll_number}</td>
                    <td className="px-4 py-3">
                      {student.full_name}
                      {student.blacklisted ? (
                        <Badge variant="destructive" className="ml-2">
                          Blacklisted
                        </Badge>
                      ) : null}
                      {blockedByArrears && earliestUnpaid ? (
                        <p className="mt-1 text-xs text-destructive">
                          Pending from {periodLabel(earliestUnpaid)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{student.stage}</td>
                    <td className="px-4 py-3">{cfg ? formatINR(due.base) : "—"}</td>
                    <td className="px-4 py-3">
                      {cfg && due.penalty > 0 ? formatINR(due.penalty) : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {payment ? (
                        <span className="text-muted-foreground">
                          Paid {formatINR(Number(payment.total_amount))}
                        </span>
                      ) : cfg ? (
                        formatINR(due.total)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STAGE_VARIANT[payment ? payment.stage : due.stage]}>
                        {STAGE_LABEL[payment ? payment.stage : due.stage]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">
                        {payment?.receipt_no ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!payment ? (
                        <Button
                          size="sm"
                          disabled={!cfg || blockedByArrears}
                          title={
                            blockedByArrears && earliestUnpaid
                              ? `Collect the ${periodLabel(earliestUnpaid)} fee first`
                              : undefined
                          }
                          onClick={() => setReceiving(student)}
                        >
                          Receive
                        </Button>
                      ) : (
                        <Badge variant="secondary">Received</Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {receiving && cfg ? (
        <ReceivePaymentDialog
          open
          onOpenChange={(o) => !o && setReceiving(null)}
          period={period}
          base={Number(receiving.slab === "higher" ? cfg.higher_amount : cfg.lower_amount)}
          student={receiving}
          pending={collect.isPending}
          onConfirm={(input) =>
            collect.mutate({ data: { student_id: receiving.id, period, ...input } })
          }
        />
      ) : null}
    </div>
  );
}
