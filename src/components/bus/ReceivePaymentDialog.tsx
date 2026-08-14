import { useEffect, useMemo, useState } from "react";
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
  student: { id: string; full_name: string; roll_number: string | null };
  pending: boolean;
  onConfirm: (input: { value_date: string; mode: PaymentMode; reference?: string | undefined }) => void;
}

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
  onConfirm,
}: Props) {
  const [valueDate, setValueDate] = useState(today());
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [reference, setReference] = useState("");

  useEffect(() => {
    if (open) {
      setValueDate(today());
      setMode("cash");
      setReference("");
    }
  }, [open]);

  const max = today();
  const invalid = !valueDate || valueDate > max || valueDate < period;
  const due = useMemo(
    () => computeDue(period, base, invalid ? max : valueDate),
    [period, base, valueDate, invalid, max],
  );

  const breakdown = useMemo(() => {
    const dueDate = dueDateFor(period);
    const fifthWorkingDay = nthWorkingDayAfter(dueDate, 5);
    const nextFriday = nextFridayAfter(dueDate);
    const fineBasis = fifthWorkingDay > nextFriday ? "5th working day" : "next Friday";
    return { dueDate, fifthWorkingDay, nextFriday, fineBasis };
  }, [period]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Receive fee</DialogTitle>
          <DialogDescription>
            {student.full_name}
            {student.roll_number ? ` · Roll ${student.roll_number}` : ""} ·{" "}
            {periodLabel(period)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="value-date">Value date</Label>
            <Input
              id="value-date"
              type="date"
              value={valueDate}
              min={period}
              max={max}
              onChange={(e) => setValueDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Post to an earlier date to charge the penalty that applied then.
            </p>

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

            {invalid ? (
              <p className="text-xs text-destructive">
                Pick a date between {formatDate(period)} and today.
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Base</span>
              <span>{formatINR(due.base)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Penalty</span>
              <span>{due.penalty > 0 ? formatINR(due.penalty) : "—"}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 font-semibold">
              <span>Total payable</span>
              <span>{formatINR(due.total)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Stage on value date</span>
              <Badge variant={STAGE_VARIANT[due.stage]}>{STAGE_LABEL[due.stage]}</Badge>
            </div>
          </div>

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

          <p className="text-xs text-muted-foreground">
            The receipt number is generated automatically and is unique.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={invalid || pending}
            onClick={() =>
              onConfirm({ value_date: valueDate, mode, reference: reference || undefined })
            }
          >
            Confirm payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
