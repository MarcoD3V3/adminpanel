import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
}

export function StatCard({ title, value, change, icon: Icon, trend = "neutral" }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-[var(--color-muted)]">{title}</p>
          <p className="mt-3 text-2xl font-light tracking-tight text-[var(--color-text)]">{value}</p>
          {change && (
            <p
              className={cn(
                "mt-1.5 text-xs",
                trend === "up" && "text-[var(--color-accent)]",
                trend === "down" && "text-[var(--color-text-soft)]",
                trend === "neutral" && "text-[var(--color-text-soft)]"
              )}
            >
              {change}
            </p>
          )}
        </div>
        <div className="rounded-xl bg-[var(--color-accent-soft)] p-2.5">
          <Icon className="h-4 w-4 text-[var(--color-accent)]" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}
