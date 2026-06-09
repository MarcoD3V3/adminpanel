"use client";

import { cn } from "@/lib/utils";

interface TabsProps {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="inline-flex gap-1 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors",
            active === tab.id
              ? "bg-[var(--color-surface-raised)] text-[var(--color-text)]"
              : "text-[var(--color-text-soft)] hover:text-[var(--color-text)]"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
