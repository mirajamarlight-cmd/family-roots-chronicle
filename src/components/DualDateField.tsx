import { formatEthiopianDate, gregorianToEthiopian, ethiopianToGregorianIso, ethiopianMonthOptions } from "@/lib/ethiopian-calendar";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (iso: string) => void;
  className?: string;
};

export function DualDateField({ id, label, value, onChange, className }: Props) {
  const ec = value ? gregorianToEthiopian(value) : null;
  const ecLabel = value ? formatEthiopianDate(value) : null;
  const draftEc = ec ?? { year: 2017, month: 1, day: 1 };

  const setEc = (patch: Partial<{ year: number; month: number; day: number }>) => {
    const next = { ...draftEc, ...patch };
    const iso = ethiopianToGregorianIso(next);
    if (iso) onChange(iso);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {ecLabel && (
        <p className="text-xs text-muted-foreground">EC: {ecLabel}</p>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none hover:text-foreground">Enter Ethiopian date</summary>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Input
            type="number"
            placeholder="Year"
            aria-label={`${label} EC year`}
            value={ec?.year ?? draftEc.year}
            onChange={(e) => setEc({ year: Number(e.target.value) })}
          />
          <select
            aria-label={`${label} EC month`}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={ec?.month ?? draftEc.month}
            onChange={(e) => setEc({ month: Number(e.target.value) })}
          >
            <option value="">Month</option>
            {ethiopianMonthOptions().map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <Input
            type="number"
            placeholder="Day"
            min={1}
            max={30}
            aria-label={`${label} EC day`}
            value={ec?.day ?? draftEc.day}
            onChange={(e) => setEc({ day: Number(e.target.value) })}
          />
        </div>
      </details>
    </div>
  );
}
