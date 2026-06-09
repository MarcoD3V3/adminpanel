import { cn } from "@/lib/utils";

interface MiniBarChartProps {
  data: { label: string; value: number }[];
  className?: string;
}

export function MiniBarChart({ data, className }: MiniBarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn("flex items-end gap-3", className)}>
      {data.map((point) => (
        <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-28 w-full items-end">
            <div
              className="w-full min-h-[4px] rounded-t-sm bg-[var(--color-accent-muted)] opacity-70"
              style={{ height: `${(point.value / max) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-[var(--color-muted)]">{point.label}</span>
        </div>
      ))}
    </div>
  );
}
