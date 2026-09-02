import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import {
  bulkPay,
  freezeStudentAt,
  getFeeConfig,
  listDues,
  recordAdvance,
  recordPayment,
  saveFeeConfig,
  settleStudent,
} from "@/lib/bus.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MonthPicker } from "./MonthPicker";
import { ReceivePaymentDialog } from "./ReceivePaymentDialog";
import { BulkPayDialog } from "./BulkPayDialog";
import { TransactionsSection } from "./TransactionsSection";

import { OtherIncomeSection } from "./OtherIncomeSection";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
  STAGE_LABEL,
  currentPeriod,
  formatDate,
  formatINR,
  periodLabel,
  windowsFor,
  groupByYear,
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
  const [action, setAction] = useState<"monthly" | "advance" | "freeze" | "settlement">(
    "monthly",
  );
  const [paidAlready, setPaidAlready] = useState(false);
  const [partPaidNow, setPartPaidNow] = useState(0);
  const [bulkOpen, setBulkOpen] = useState(false);
  // Students queued from the Process menu for the next bulk payment.
  const [payList, setPayList] = useState<string[]>([]);
  const [txnOpen, setTxnOpen] = useState(false);

  const [receiving, setReceiving] = useState<{
    id: string;
    full_name: string;
    roll_number: string | null;
    slab: string;
    fine_amount?: number | string | null;
    superfine_amount?: number | string | null;
    advance_amount?: number | string | null;
    advance_returned_at?: string | null;
  } | null>(null);

  const fetchDues = useServerFn(listDues);
  const fetchCfg = useServerFn(getFeeConfig);
  const saveCfg = useServerFn(saveFeeConfig);
  const pay = useServerFn(recordPayment);
  const settle = useServerFn(settleStudent);
  const bulk = useServerFn(bulkPay);
  const freeze = useServerFn(freezeStudentAt);
  const advance = useServerFn(recordAdvance);
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

  const settleAll = useMutation({
    mutationFn: settle,
    onSuccess: (res) => {
      toast.success(
        `Settled ${res.months} month(s) for ${formatINR(res.total)} — registration closed`,
      );
      setReceiving(null);
      qc.invalidateQueries({ queryKey: ["dues", period] });
      qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkCollect = useMutation({
    mutationFn: bulk,
    onSuccess: (res) => {
      toast.success(
        `${res.count} student(s) receipted for ${formatINR(res.total)} · ${res.txn_no}` +
          (res.skipped.length > 0 ? ` — skipped ${res.skipped.length}` : ""),
      );
      setBulkOpen(false);
      setPayList([]);
      qc.invalidateQueries({ queryKey: ["dues", period] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const freezeDues = useMutation({
    mutationFn: freeze,
    onSuccess: () => {
      toast.success("Dues frozen from the selected date");
      setReceiving(null);
      qc.invalidateQueries({ queryKey: ["dues", period] });
      qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const advanceEntry = useMutation({
    mutationFn: advance,
    onSuccess: (res: { txn_no: string; held: number }) => {
      toast.success(`Advance updated · ${res.txn_no}`);
      setReceiving(null);
      qc.invalidateQueries({ queryKey: ["advances"] });
      qc.invalidateQueries({ queryKey: ["advance-history"] });
      qc.invalidateQueries({ queryKey: ["dues", period] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
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

  const bulkRows = (dues.data?.rows ?? [])
    .filter((r) => !r.payment && !r.blockedByArrears && !r.student.blacklisted)
    .map((r) => ({
      id: r.student.id,
      full_name: r.student.full_name,
      roll_number: r.student.roll_number,
      total: r.due.total,
    }));

  const eligibleIds = new Set(bulkRows.map((r) => r.id));
  const queued = payList.filter((id) => eligibleIds.has(id));

  const togglePayList = (id: string, name: string) => {
    setPayList((list) => {
      if (list.includes(id)) {
        toast.success(`${name} removed from the pay list`);
        return list.filter((x) => x !== id);
      }
      toast.success(`${name} added to the pay list`);
      return [...list, id];
    });
  };

  const changePeriod = (next: string) => {
    setPeriod(next);
    setPayList([]);
  };

  const openProcess = (
    student: (typeof rows)[number]["student"],
    next: "monthly" | "advance" | "freeze" | "settlement",
    paid: boolean,
    partPaid = 0,
  ) => {
    setAction(next);
    setPaidAlready(paid);
    setPartPaidNow(partPaid);
    setReceiving(student);
  };



  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthPicker period={period} onChange={changePeriod} />
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
          <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={!cfg} onClick={() => setBulkOpen(true)}>
            Bulk pay{queued.length > 0 ? ` (${queued.length})` : ""}
          </Button>

          <Input
            className="w-64"
            placeholder="Search roll number or name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          </div>
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
                groupByYear(rows, (r) => r.student.roll_number).flatMap((group) => [
                  <tr key={`grp-${group.key}`} className="bg-muted/40">
                    <td className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground" colSpan={9}>
                      {group.label} ({group.rows.length})
                    </td>
                  </tr>,
                  ...group.rows.map(({ student, payment, due, partPaid, blockedByArrears, earliestUnpaid }) => (

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
                        <>
                          {formatINR(due.total)}
                          {partPaid > 0 ? (
                            <p className="mt-1 text-xs font-normal text-muted-foreground">
                              Received {formatINR(partPaid)} · Balance{" "}
                              {formatINR(Math.max(0, due.total - partPaid))}
                            </p>
                          ) : null}
                        </>
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
                      <div className="flex items-center gap-2">
                        {payment ? <Badge variant="secondary">Received</Badge> : null}
                        {!payment && queued.includes(student.id) ? (
                          <Badge variant="outline">In pay list</Badge>
                        ) : null}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant={payment ? "outline" : "default"} disabled={!cfg}>
                              Process
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!payment ? (
                              <DropdownMenuItem
                                disabled={blockedByArrears}
                                onSelect={() => openProcess(student, "monthly", false, partPaid)}
                              >
                                Monthly pay
                                {blockedByArrears && earliestUnpaid
                                  ? ` — clear ${periodLabel(earliestUnpaid)} first`
                                  : ""}
                              </DropdownMenuItem>
                            ) : null}
                            {!payment ? (
                              <DropdownMenuItem
                                disabled={!eligibleIds.has(student.id)}
                                onSelect={() => togglePayList(student.id, student.full_name)}
                              >
                                {queued.includes(student.id)
                                  ? "Remove from pay list"
                                  : "Add to Pay List"}
                                {blockedByArrears && earliestUnpaid
                                  ? ` — clear ${periodLabel(earliestUnpaid)} first`
                                  : student.blacklisted
                                    ? " — blacklisted"
                                    : ""}
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              onSelect={() => openProcess(student, "advance", Boolean(payment), partPaid)}
                            >
                              Advance
                            </DropdownMenuItem>
                            <DropdownMenuItem

                              onSelect={() => openProcess(student, "settlement", Boolean(payment), partPaid)}
                            >
                              Settlement
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => openProcess(student, "freeze", Boolean(payment), partPaid)}
                            >
                              Freeze
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>

                  </tr>
                  )),
                ])
              )}

            </tbody>
          </table>
        </div>
      </section>

      <OtherIncomeSection period={period} />

      <Collapsible open={txnOpen} onOpenChange={setTxnOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="font-semibold">Transactions</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${txnOpen ? "rotate-180" : ""}`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <TransactionsSection />
        </CollapsibleContent>
      </Collapsible>

      {cfg ? (
        <BulkPayDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          period={period}
          rows={bulkRows}
          pending={bulkCollect.isPending}
          initialSelected={queued}

          onConfirm={(input) => bulkCollect.mutate({ data: { period, ...input } })}
        />
      ) : null}



      {receiving && cfg ? (
        <ReceivePaymentDialog
          open
          onOpenChange={(o) => !o && setReceiving(null)}
          period={period}
          base={Number(receiving.slab === "higher" ? cfg.higher_amount : cfg.lower_amount)}
          student={receiving}
          initialAction={action}
          monthlyDisabled={paidAlready}
          partPaid={partPaidNow}
          pending={
            collect.isPending ||
            settleAll.isPending ||
            freezeDues.isPending ||
            advanceEntry.isPending
          }
          onConfirm={(input) =>
            collect.mutate({ data: { student_id: receiving.id, period, ...input } })
          }
          onSettle={(input) => settleAll.mutate({ data: { student_id: receiving.id, ...input } })}
          onFreeze={(input) => freezeDues.mutate({ data: { student_id: receiving.id, ...input } })}
          onAdvance={(input) =>
            advanceEntry.mutate({ data: { student_id: receiving.id, ...input } })
          }

        />
      ) : null}
    </div>
  );
}
