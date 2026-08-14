import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

/** Month selector that emits a period string (YYYY-MM-01). */
export function MonthPicker({
  period,
  onChange,
  label = "Month",
  max,
}: {
  period: string;
  onChange: (period: string) => void;
  label?: string;
  /** Latest selectable period (YYYY-MM-01). */
  max?: string | undefined;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="month" className="text-sm text-muted-foreground">
        {label}
      </Label>
      <Input
        id="month"
        type="month"
        className="w-[170px]"
        max={max ? max.slice(0, 7) : undefined}
        value={period.slice(0, 7)}
        onChange={(e) => {
          if (e.target.value) onChange(`${e.target.value}-01`);
        }}
      />
    </div>
  );
}
