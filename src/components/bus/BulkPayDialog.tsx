import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatINR, periodLabel } from "@/lib/fee-rules";
import type { PaymentMode } from "./ReceivePaymentDialog";

export interface BulkRow {
  id: string;
  full_name: string;
  roll_number: string | null;
  total: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: string;
  rows: BulkRow[];
  pending: boolean;
  /** Students queued from the Process menu; pre-ticked when the dialog opens. */
  initialSelected?: string[];
  onConfirm: (input: {
    value_date: string;
    mode: PaymentMode;
    reference?: string | undefined;
    student_ids: string[];
  }) => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Receipt one month for many students at once under a single transaction. */
export function BulkPayDialog({
  open,
  onOpenChange,
  period,
  rows,
  pending,
  initialSelected,
  onConfirm,
}: Props) {
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [valueDate, setValueDate] = useState(today());
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [reference, setReference] = useState("");

  const queued = (initialSelected ?? []).join(",");
  useEffect(() => {
    if (open) {
      setPicked(
        Object.fromEntries(
          (queued ? queued.split(",") : []).map((id) => [id, true] as const),
        ),
      );
      setValueDate(today());
      setMode("cash");
      setReference("");
    }
  }, [open, queued]);


  const ids = rows.filter((r) => picked[r.id]).map((r) => r.id);
  const total = rows.filter((r) => picked[r.id]).reduce((a, r) => a + r.total, 0);
  const allPicked = rows.length > 0 && ids.length === rows.length;
  const max = today();
  const invalid = !valueDate || valueDate > max || valueDate < period;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk pay · {periodLabel(period)}</DialogTitle>
          <DialogDescription>
            Students who have cleared every earlier month. All picked students are
            receipted together under one transaction number, each with their own amount.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-date">Value date</Label>
              <Input
                id="bulk-date"
                type="date"
                value={valueDate}
                min={period}
                max={max}
                onChange={(e) => setValueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank">Bank transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-ref">Reference (optional)</Label>
            <Input
              id="bulk-ref"
              value={reference}
              placeholder="UTR, cheque or slip number"
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={allPicked}
                onCheckedChange={(v) =>
                  setPicked(
                    v === true ? Object.fromEntries(rows.map((r) => [r.id, true])) : {},
                  )
                }
              />
              Select all ({rows.length})
            </label>
            <span className="text-sm text-muted-foreground">
              {ids.length} selected
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
            {rows.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No student is eligible for bulk pay this month.
              </p>
            ) : (
              rows.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"
                >
                  <Checkbox
                    checked={Boolean(picked[r.id])}
                    onCheckedChange={(v) => setPicked({ ...picked, [r.id]: v === true })}
                  />
                  <span className="w-16 text-muted-foreground">{r.roll_number ?? "—"}</span>
                  <span className="flex-1">{r.full_name}</span>
                  <span className="font-medium">{formatINR(r.total)}</span>
                </label>
              ))
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-sm text-muted-foreground">Total to collect</span>
            <span className="text-lg font-semibold">{formatINR(total)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending || invalid || ids.length === 0}
            onClick={() =>
              onConfirm({
                value_date: valueDate,
                mode,
                reference: reference.trim() || undefined,
                student_ids: ids,
              })
            }
          >
            Confirm {formatINR(total)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
