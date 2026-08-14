import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getAppSettings, setAppSettings } from "@/lib/bus.functions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** Admin-only switches deciding which tabs students and the driver may open. */
export function TabVisibilityToggles() {
  const fetchSettings = useServerFn(getAppSettings);
  const save = useServerFn(setAppSettings);
  const qc = useQueryClient();

  const settings = useQuery({ queryKey: ["app-settings"], queryFn: () => fetchSettings() });

  const update = useMutation({
    mutationFn: save,
    onSuccess: () => {
      toast.success("Tab access updated");
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const s = settings.data;

  const items = [
    { key: "expenses_visible", label: "Expense tracker" },
    { key: "statement_visible", label: "Monthly statement" },
    { key: "driver_visible", label: "Driver" },
  ] as const;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-semibold text-card-foreground">Tab access for students and driver</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Turn a tab off to hide it from students and the driver. Admin access is unaffected.
      </p>
      <div className="mt-4 flex flex-wrap gap-6">
        {items.map((it) => (
          <div key={it.key} className="flex items-center gap-2">
            <Switch
              id={it.key}
              checked={s ? s[it.key] : false}
              disabled={!s || update.isPending}
              onCheckedChange={(v) => update.mutate({ data: { [it.key]: v } })}
            />
            <Label htmlFor={it.key}>{it.label}</Label>
          </div>
        ))}
      </div>
    </div>
  );
}
