import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp } from "lucide-react";
import { driverRoster, setPickupOrder } from "@/lib/bus.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { periodLabel } from "@/lib/fee-rules";

type Row = {
  id: string;
  full_name: string;
  branch: string | null;
  boarding_point: string | null;
  photo_path: string | null;
  blacklisted: boolean;
  paid: boolean;
};

export function DriverTab() {
  const fetchRoster = useServerFn(driverRoster);
  const saveOrder = useServerFn(setPickupOrder);
  const qc = useQueryClient();

  const roster = useQuery({ queryKey: ["driver-roster"], queryFn: () => fetchRoster() });
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (roster.data?.rows) setRows(roster.data.rows as Row[]);
  }, [roster.data]);

  const save = useMutation({
    mutationFn: saveOrder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["driver-roster"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function move(index: number, delta: number) {
    const next = rows.slice();
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const a = next[index]!;
    const b = next[target]!;
    next[index] = b;
    next[target] = a;
    setRows(next);
    save.mutate({ data: { ids: next.map((r) => r.id) } });
  }

  const photos = roster.data?.photoUrls ?? {};
  const paidCount = rows.filter((r) => r.paid).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Pickup list</h2>
          <p className="text-sm text-muted-foreground">
            {roster.data ? periodLabel(roster.data.period) : "—"} · {rows.length} students ·{" "}
            {paidCount} paid · {rows.length - paidCount} not paid
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Use the arrows to set the pickup sequence. It saves automatically.
        </p>
      </div>

      {roster.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          No approved students yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li
              key={r.id}
              className={`flex items-center gap-4 rounded-xl border p-3 ${
                r.paid
                  ? "border-border bg-card"
                  : "border-destructive/40 bg-destructive/5"
              }`}
            >
              <span className="w-6 text-center text-sm font-semibold text-muted-foreground">
                {i + 1}
              </span>
              {r.photo_path && photos[r.photo_path] ? (
                <img
                  src={photos[r.photo_path]}
                  alt={`Passport photo of ${r.full_name}`}
                  className="h-12 w-10 rounded object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-12 w-10 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                  —
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{r.full_name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {r.branch ?? "—"} · {r.boarding_point ?? "No boarding point"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {r.blacklisted ? <Badge variant="destructive">Blacklisted</Badge> : null}
                <Badge variant={r.paid ? "secondary" : "destructive"}>
                  {r.paid ? "Paid" : "Not paid"}
                </Badge>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={`Move ${r.full_name} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={`Move ${r.full_name} down`}
                  disabled={i === rows.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
