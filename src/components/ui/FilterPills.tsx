"use client";

import { cn } from "@/lib/utils";

interface FilterPillsProps {
  options: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}

export function FilterPills({ options, active, onChange }: FilterPillsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium",
            active === opt.id
              ? "bg-[var(--color-surface-raised)] text-[var(--color-text)]"
              : "text-[var(--color-text-soft)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
