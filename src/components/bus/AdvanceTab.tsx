import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Printer, X } from "lucide-react";
import { listAdvances, listStudentAdvances } from "@/lib/bus.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, formatINR, groupByYear } from "@/lib/fee-rules";

type Picked = { id: string; full_name: string; roll_number: string | null } | null;

/** Advance deposits held per enrolled student, oldest joiner first. */
export function AdvanceTab({ readOnly = false }: { readOnly?: boolean }) {
  void readOnly;
  const fetchAdvances = useServerFn(listAdvances);
  const [picked, setPicked] = useState<Picked>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const filtering = Boolean(from || to);

  const { data, isLoading } = useQuery({
    queryKey: ["advances", from, to],
    queryFn: () =>
      fetchAdvances({
        data: {
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4 print:space-y-3">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-muted-foreground">
          Advance is collected and returned from the Process menu in the Fee payment tab.
        </p>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3 print:hidden">
        <div className="space-y-1">
          <Label htmlFor="adv-from" className="text-xs text-muted-foreground">
            Transactions from
          </Label>
          <Input
            id="adv-from"
            type="date"
            className="w-[160px]"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="adv-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="adv-to"
            type="date"
            className="w-[160px]"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        {filtering ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            <X className="mr-1 h-4 w-4" /> Show full list
          </Button>
        ) : null}
        {filtering ? (
          <p className="text-xs text-muted-foreground">
            Showing only students with advance movements in this period; amounts
            are for the selected dates.
          </p>
        ) : null}
      </div>

      <h2 className="hidden text-lg font-semibold print:block">Advance register</h2>

      <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Advance currently held</p>
          <p className="mt-1 text-2xl font-semibold">{formatINR(data?.held ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Advance returned</p>
          <p className="mt-1 text-2xl font-semibold">{formatINR(data?.returned ?? 0)}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card print:overflow-visible print:border-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 print:hidden">Photo</th>
              <th className="px-3 py-2">Roll</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2">Boarding point</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2 text-right">Maximum advance</th>
              <th className="px-3 py-2 text-right">Advance Collected</th>
              <th className="px-3 py-2 text-right">Advance Returned</th>
              <th className="px-3 py-2 text-right">Held</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {groupByYear(data?.rows ?? [], (s) => s.roll_number).flatMap((group) => [
              <tr key={`grp-${group.key}`} className="border-t border-border bg-muted/40">
                <td
                  className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  colSpan={11}
                >
                  {group.label} ({group.rows.length})
                </td>
              </tr>,
              ...group.rows.map((s) => {
              const url = s.photo_path ? data?.photoUrls?.[s.photo_path] : undefined;
              return (
                <tr
                  key={s.id}
                  className="cursor-pointer border-t border-border hover:bg-muted/40"
                  onClick={() =>
                    setPicked({
                      id: s.id,
                      full_name: s.full_name,
                      roll_number: s.roll_number,
                    })
                  }
                >
                  <td className="px-3 py-2 print:hidden">
                    {url ? (
                      <img
                        src={url}
                        alt={`${s.full_name} passport photo`}
                        className="h-10 w-8 rounded object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-10 w-8 rounded bg-muted" />
                    )}
                  </td>
<td className="px-3 py-2">{s.roll_number ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">
                    <button
                      type="button"
                      className="text-left text-primary underline-offset-2 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPicked({
                          id: s.id,
                          full_name: s.full_name,
                          roll_number: s.roll_number,
                        });
                      }}
                    >
                      {s.full_name}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    {s.date_of_joining ? formatDate(s.date_of_joining) : "—"}
                  </td>
                  <td className="px-3 py-2">{s.boarding_point ?? "—"}</td>
                  <td className="px-3 py-2">{s.stage}</td>
                  <td className="px-3 py-2 text-right">
                    {s.advance_limit > 0 ? formatINR(s.advance_limit) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">{formatINR(s.collected_total)}</td>
                  <td className="px-3 py-2 text-right">
                    {s.returned_total > 0 ? formatINR(s.returned_total) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatINR(s.held_now)}
                  </td>
                  <td className="px-3 py-2">
                    {s.advance_status === "closed" ? (
                      <Badge variant="secondary">
                        CLOSED
                        {s.advance_returned_at
                          ? ` · returned ${formatDate(s.advance_returned_at)}`
                          : ""}
                      </Badge>
                    ) : s.advance_status === "freeze" ? (
                      <Badge variant="outline">FREEZE</Badge>
                    ) : s.advance_status === "active" ? (
                      <Badge>ACTIVE</Badge>
                    ) : (
                      <Badge variant="outline">NOT ACTIVE</Badge>
                    )}
                  </td>
                </tr>
              );
              }),
              <tr key={`sub-${group.key}`} className="border-t border-border bg-muted/20 text-xs font-semibold">
                <td className="px-3 py-2 print:hidden" />
                <td className="px-3 py-2" colSpan={5}>
                  Subtotal — {group.label}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatINR(group.rows.reduce((a, r) => a + r.advance_limit, 0))}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatINR(group.rows.reduce((a, r) => a + r.collected_total, 0))}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatINR(group.rows.reduce((a, r) => a + r.returned_total, 0))}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatINR(group.rows.reduce((a, r) => a + r.held_now, 0))}
                </td>
                <td />
              </tr>,
            ])}
            {(data?.rows.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-muted-foreground">
                  No enrolled students yet.
                </td>
              </tr>
            ) : null}
          </tbody>

          {(data?.rows.length ?? 0) > 0 ? (
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="px-3 py-2 print:hidden" />
                <td className="px-3 py-2" colSpan={5}>
                  Total
                </td>
                <td className="px-3 py-2 text-right">
                  {formatINR((data?.rows ?? []).reduce((a, r) => a + r.advance_limit, 0))}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatINR(
                    (data?.rows ?? []).reduce((a, r) => a + r.collected_total, 0),
                  )}
                </td>
                <td className="px-3 py-2 text-right">{formatINR(data?.returned ?? 0)}</td>
                <td className="px-3 py-2 text-right">{formatINR(data?.held ?? 0)}</td>
                <td />
              </tr>
            </tfoot>
          ) : null}

        </table>
      </div>

      {picked ? (
        <AdvanceHistoryDialog student={picked} onClose={() => setPicked(null)} />
      ) : null}
    </div>
  );
}

/** Every advance movement for one student, with a running held balance. */
function AdvanceHistoryDialog({
  student,
  onClose,
}: {
  student: NonNullable<Picked>;
  onClose: () => void;
}) {
  const fetchHistory = useServerFn(listStudentAdvances);
  const { data, isLoading } = useQuery({
    queryKey: ["advance-history", student.id],
    queryFn: () => fetchHistory({ data: { id: student.id } }),
  });

  let running = 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Advance transactions</DialogTitle>
          <DialogDescription>
            {student.full_name}
            {student.roll_number ? ` · Roll ${student.roll_number}` : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (data?.rows.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            No advance transactions recorded yet for this student.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Time</th>
                  <th className="px-2 py-2">Transaction</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Mode</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                  <th className="px-2 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((r) => {
                  const amount = Number(r.amount);
                  if (!r.voided_at) running += r.kind === "return" ? -amount : amount;
                  return (
                    <tr
                      key={r.id}
                      className={`border-t border-border ${r.voided_at ? "text-muted-foreground line-through" : ""}`}
                    >
                      <td className="px-2 py-2">{formatDate(r.entry_date)}</td>
                      <td className="px-2 py-2">
                        {new Date(r.created_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-2 py-2 text-xs">{r.txn_no ?? "—"}</td>
                      <td className="px-2 py-2">
                        {r.kind === "return" ? "Returned" : "Collected"}
                      </td>
                      <td className="px-2 py-2 uppercase">{r.mode}</td>
                      <td className="px-2 py-2 text-right">
                        {r.kind === "return" ? "- " : ""}
                        {formatINR(amount)}
                      </td>
                      <td className="px-2 py-2 text-right">{formatINR(running)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(data?.rows ?? []).some((r) => r.note) ? (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {(data?.rows ?? [])
                  .filter((r) => r.note)
                  .map((r) => (
                    <li key={`note-${r.id}`}>
                      {formatDate(r.entry_date)} — {r.note}
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
