import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { settlementPreview, listStudentAdvances } from "@/lib/bus.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STAGE_LABEL,
  computeDue,
  dueDateFor,
  formatDate,
  formatINR,
  nextFridayAfter,
  nthWorkingDayAfter,
  penaltiesOf,
  periodLabel,
} from "@/lib/fee-rules";

const STAGE_VARIANT = {
  on_time: "secondary",
  fine: "default",
  superfine: "default",
  blacklisted: "destructive",
} as const;

export type PaymentMode = "cash" | "upi" | "bank";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: string;
  base: number;
  student: {
    id: string;
    full_name: string;
    roll_number: string | null;
    slab?: string | null;
    fine_amount?: number | string | null;
    superfine_amount?: number | string | null;
    advance_amount?: number | string | null;
    advance_returned_at?: string | null;
  };
  pending: boolean;
  /** Which action the Process menu opened with. */
  initialAction?: Action;
  /** Hide monthly pay once the month is already receipted. */
  monthlyDisabled?: boolean;
  /** Amount already received this month through part payments. */
  partPaid?: number;
  onConfirm: (input: {
    value_date: string;
    mode: PaymentMode;
    reference?: string | undefined;
    base_amount: number;
    penalty_amount: number;
    settled: boolean;
  }) => void;
  onFreeze: (input: { frozen_at: string }) => void;
  onSettle: (input: {
    value_date: string;
    mode: PaymentMode;
    reference?: string | undefined;
    settlement_amount: number;
    advance_return: number;
  }) => void;
  onAdvance: (input: {
    kind: "collect" | "return";
    amount: number;
    value_date: string;
    mode: PaymentMode;
    note?: string | undefined;
  }) => void;
}

type Action = "monthly" | "advance" | "freeze" | "settlement";

const ACTIONS: { key: Action; label: string }[] = [
  { key: "monthly", label: "Monthly pay" },
  { key: "advance", label: "Advance" },
  { key: "freeze", label: "Freeze" },
  { key: "settlement", label: "Settlement" },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ReceivePaymentDialog({
  open,
  onOpenChange,
  period,
  base,
  student,
  pending,
  initialAction = "monthly",
  monthlyDisabled = false,
  partPaid = 0,
  onConfirm,
  onFreeze,
  onSettle,
  onAdvance,
}: Props) {
  const actions = monthlyDisabled ? ACTIONS.filter((a) => a.key !== "monthly") : ACTIONS;
  const [action, setAction] = useState<Action>(initialAction);
  const [valueDate, setValueDate] = useState(today());
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [reference, setReference] = useState("");
  const [advKind, setAdvKind] = useState<"collect" | "return">("collect");
  const [advAmount, setAdvAmount] = useState("");
  const [baseInput, setBaseInput] = useState("");
  const [penaltyInput, setPenaltyInput] = useState("");
  const [settled, setSettled] = useState(true);

  // Advance figures come from the advance ledger so they match the Advance tab
  // exactly (collected total, returned total, and the balance still held).
  const fetchAdvanceLedger = useServerFn(listStudentAdvances);
  const ledger = useQuery({
    queryKey: ["advance-history", student.id],
    queryFn: () => fetchAdvanceLedger({ data: { id: student.id } }),
    enabled: open,
  });
  const { collected, returned } = useMemo(() => {
    let c = 0;
    let r = 0;
    for (const e of ledger.data?.rows ?? []) {
      if (e.voided_at) continue;
      if (e.kind === "return") r += Number(e.amount);
      else c += Number(e.amount);
    }
    return { collected: c, returned: r };
  }, [ledger.data]);
  const balance = Math.max(0, collected - returned);
  const held = collected;

  useEffect(() => {
    if (open) {
      setValueDate(today());
      setMode("cash");
      setReference("");
      setAction(initialAction);
      setAdvKind("collect");
      setAdvAmount(String(base || ""));
      setSettled(true);
    }
  }, [open, initialAction, base]);

  useEffect(() => {
    setAdvAmount(advKind === "return" ? String(balance) : String(base || ""));
  }, [advKind, balance, base]);

  const max = today();
  const advanceInvalid =
    !valueDate ||
    valueDate > max ||
    !(Number(advAmount) > 0) ||
    (advKind === "return" && Number(advAmount) > balance);
  const invalid = !valueDate || valueDate > max || valueDate < period;
  const due = useMemo(
    () => computeDue(period, base, invalid ? max : valueDate, penaltiesOf(student)),
    [period, base, valueDate, invalid, max, student],
  );


  // Base defaults to what is still outstanding after any part payments.
  useEffect(() => {
    setBaseInput(String(Math.max(0, due.base - partPaid)));
    setPenaltyInput(String(due.penalty));
  }, [due.base, due.penalty, partPaid]);

  const baseNum = Number(baseInput) || 0;
  const penaltyNum = Number(penaltyInput) || 0;
  const editedTotal = baseNum + penaltyNum;
  const amountsInvalid =
    baseInput.trim() === "" ||
    penaltyInput.trim() === "" ||
    Number.isNaN(Number(baseInput)) ||
    Number.isNaN(Number(penaltyInput)) ||
    baseNum < 0 ||
    penaltyNum < 0;

  const fetchPreview = useServerFn(settlementPreview);
  const preview = useQuery({
    queryKey: ["settlement-preview", student.id, invalid ? max : valueDate],
    queryFn: () =>
      fetchPreview({
        data: { student_id: student.id, value_date: invalid ? max : valueDate },
      }),
    enabled: open && action === "settlement",
  });

  // Settlement amounts are prefilled from the preview but stay admin-editable.
  const [settleAmount, setSettleAmount] = useState("");
  const [advReturn, setAdvReturn] = useState("");
  useEffect(() => {
    if (preview.data) {
      setSettleAmount(String(preview.data.total));
      setAdvReturn(String(preview.data.advance));
    }
  }, [preview.data]);

  const settleNum = Number(settleAmount) || 0;
  const advReturnNum = Number(advReturn) || 0;
  const settlementInvalid =
    settleAmount.trim() === "" ||
    advReturn.trim() === "" ||
    Number.isNaN(Number(settleAmount)) ||
    Number.isNaN(Number(advReturn)) ||
    settleNum < 0 ||
    advReturnNum < 0 ||
    advReturnNum > (preview.data?.advance ?? 0);

  const breakdown = useMemo(() => {
    const dueDate = dueDateFor(period);
    const fifthWorkingDay = nthWorkingDayAfter(dueDate, 5);
    const nextFriday = nextFridayAfter(dueDate);
    const fineBasis = fifthWorkingDay > nextFriday ? "5th working day" : "next Friday";
    return { dueDate, fifthWorkingDay, nextFriday, fineBasis };
  }, [period]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Receive fee</DialogTitle>
          <DialogDescription>
            {student.full_name}
            {student.roll_number ? ` · Roll ${student.roll_number}` : ""} ·{" "}
            {periodLabel(period)}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 flex-1 space-y-4 overflow-y-auto px-6 py-1">
          <div
            className={`grid gap-2 rounded-lg border border-border bg-muted/40 p-1 ${
              actions.length === 4 ? "grid-cols-4" : "grid-cols-3"
            }`}
          >
            {actions.map((a) => (
              <Button
                key={a.key}
                type="button"
                size="sm"
                variant={action === a.key ? "default" : "ghost"}
                onClick={() => setAction(a.key)}
              >
                {a.label}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="value-date">
              {action === "freeze" ? "Freeze from" : "Value date"}
            </Label>
            <Input
              id="value-date"
              type="date"
              value={valueDate}
              {...(action === "advance" ? {} : { min: period })}
              max={max}
              onChange={(e) => setValueDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {action === "advance"
                ? "Post to an earlier date to book the advance on that day."
                : "Post to an earlier date to charge the penalty that applied then."}
            </p>

            {action === "monthly" ? (
            <div className="rounded-md border border-border bg-muted/40 p-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Due date</span>
                <span>{formatDate(breakdown.dueDate)}</span>
              </div>
              <div className="mt-1 flex justify-between gap-2">
                <span className="text-muted-foreground">5th working day after due</span>
                <span>{formatDate(breakdown.fifthWorkingDay)}</span>
              </div>
              <div className="mt-1 flex justify-between gap-2">
                <span className="text-muted-foreground">Next Friday after due</span>
                <span>{formatDate(breakdown.nextFriday)}</span>
              </div>
              <div className="mt-1 flex justify-between gap-2 font-medium">
                <span>Fine window closes on</span>
                <span>
                  {formatDate(due.fineUntil)} ({breakdown.fineBasis} is later)
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-2 font-medium">
                <span>Superfine window closes on</span>
                <span>{formatDate(due.superfineUntil)} (next Friday after fine end)</span>
              </div>
            </div>
            ) : null}

            {action === "advance" ? (
              <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={advKind === "collect" ? "default" : "outline"}
                    onClick={() => setAdvKind("collect")}
                  >
                    Collect
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={advKind === "return" ? "default" : "outline"}
                    onClick={() => setAdvKind("return")}
                  >
                    Return
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adv-amount">Amount (₹)</Label>
                  <Input
                    id="adv-amount"
                    inputMode="numeric"
                    value={advAmount}
                    onChange={(e) => setAdvAmount(e.target.value)}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Advance collected</span>
                  <span>{formatINR(held)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Advance returned</span>
                  <span>{returned > 0 ? formatINR(returned) : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Advance held now</span>
                  <span>{formatINR(balance)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Held after this entry</span>
                  <span>
                    {formatINR(
                      advKind === "collect"
                        ? balance + (Number(advAmount) || 0)
                        : Math.max(0, balance - (Number(advAmount) || 0)),
                    )}
                  </span>
                </div>
                {advKind === "return" && Number(advAmount) > balance ? (
                  <p className="text-xs text-destructive">
                    Cannot return more than the advance held.
                  </p>
                ) : null}
              </div>
            ) : null}

            {invalid && action !== "advance" ? (
              <p className="text-xs text-destructive">
                Pick a date between {formatDate(period)} and today.
              </p>
            ) : null}
          </div>


          {action === "monthly" ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            {partPaid > 0 ? (
              <p className="mb-2 text-xs text-muted-foreground">
                Already received this month: {formatINR(partPaid)}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="base-amount">Base (₹)</Label>
                <Input
                  id="base-amount"
                  inputMode="numeric"
                  value={baseInput}
                  onChange={(e) => setBaseInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  computed: {formatINR(due.base)}
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="penalty-amount">Penalty (₹)</Label>
                <Input
                  id="penalty-amount"
                  inputMode="numeric"
                  value={penaltyInput}
                  onChange={(e) => setPenaltyInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  computed: {formatINR(due.penalty)}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 font-semibold">
              <span>Total payable</span>
              <span>{formatINR(editedTotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Stage on value date</span>
              <Badge variant={STAGE_VARIANT[due.stage]}>{STAGE_LABEL[due.stage]}</Badge>
            </div>
          </div>
          ) : null}

          {action === "freeze" ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p>
                Fee, fine and superfine stop accruing from this date. Nothing is collected
                now and the registration stays open.
              </p>
            </div>
          ) : null}

          {action === "settlement" ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              {preview.isLoading ? (
                <p className="text-muted-foreground">Calculating outstanding…</p>
              ) : preview.error ? (
                <p className="text-destructive">{(preview.error as Error).message}</p>
              ) : (preview.data?.rows.length ?? 0) === 0 && !preview.data?.advance ? (
                <p className="text-muted-foreground">Nothing outstanding to settle.</p>
              ) : (
                <>
                  {preview.data!.rows.map((r) => (
                    <div key={r.period} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">
                        {periodLabel(r.period)}
                        {r.penalty > 0 ? ` (+${formatINR(r.penalty)})` : ""}
                      </span>
                      <span>{formatINR(r.total)}</span>
                    </div>
                  ))}
                  <div className="mt-2 flex justify-between border-t border-border pt-2">
                    <span className="text-muted-foreground">Outstanding dues</span>
                    <span>{formatINR(preview.data!.total)}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="settle-amount">Settlement amount (₹)</Label>
                      <Input
                        id="settle-amount"
                        inputMode="numeric"
                        value={settleAmount}
                        onChange={(e) => setSettleAmount(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        computed: {formatINR(preview.data!.total)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="adv-return">Advance return (₹)</Label>
                      <Input
                        id="adv-return"
                        inputMode="numeric"
                        value={advReturn}
                        onChange={(e) => setAdvReturn(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        held: {formatINR(preview.data!.advance)}
                      </p>
                    </div>
                  </div>
                  {advReturnNum > preview.data!.advance ? (
                    <p className="mt-1 text-xs text-destructive">
                      Cannot return more than the advance held.
                    </p>
                  ) : null}
                  <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
                    <span>
                      {settleNum - advReturnNum < 0 ? "Refund to student" : "Net payable"}
                    </span>
                    <span>{formatINR(Math.abs(settleNum - advReturnNum))}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    All months above are receipted on this date, the advance return is
                    recorded in the Advance tab, and the registration is marked closed.
                  </p>
                </>
              )}
            </div>
          ) : null}

          {action === "freeze" ? null : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref">Reference (optional)</Label>
              <Input
                id="ref"
                value={reference}
                placeholder="Ref no."
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>
          )}

          {action === "monthly" ? (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={settled}
                onChange={(e) => setSettled(e.target.checked)}
              />
              <span>
                Payment Complete
                <span className="block text-xs text-muted-foreground">
                  Untick to record a part payment — the month stays in the pending list.
                </span>
              </span>
            </label>
          ) : null}

          {action === "freeze" || action === "advance" ? null : (
            <p className="text-xs text-muted-foreground">
              The receipt number is generated automatically and is unique.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              pending ||
              (action === "advance" ? advanceInvalid : invalid) ||
              (action === "monthly" && amountsInvalid) ||
              (action === "settlement" &&
                (preview.isLoading ||
                  settlementInvalid ||
                  (!preview.data?.rows.length && !preview.data?.advance)))
            }
            onClick={() => {
              if (action === "freeze") {
                onFreeze({ frozen_at: valueDate });
                return;
              }
              if (action === "advance") {
                onAdvance({
                  kind: advKind,
                  amount: Number(advAmount) || 0,
                  value_date: valueDate,
                  mode,
                  note: reference || undefined,
                });
                return;
              }
              const input = {
                value_date: valueDate,
                mode,
                reference: reference || undefined,
              };
              if (action === "settlement")
                onSettle({
                  ...input,
                  settlement_amount: settleNum,
                  advance_return: advReturnNum,
                });
              else
                onConfirm({
                  ...input,
                  base_amount: baseNum,
                  penalty_amount: penaltyNum,
                  settled,
                });
            }}
          >
            {action === "freeze"
              ? "Freeze dues"
              : action === "advance"
                ? advKind === "collect"
                  ? "Collect advance"
                  : "Return advance"
                : action === "settlement"
                  ? "Settle and close"
                  : settled
                    ? "Confirm payment"
                    : "Record part payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
