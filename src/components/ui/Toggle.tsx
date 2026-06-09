"use client";

import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  compact?: boolean;
  id?: string;
}

export function Toggle({ checked, onChange, label, description, compact, id }: ToggleProps) {
  const switchId = id ?? label?.replace(/\s+/g, "-").toLowerCase();

  const switchEl = (
    <button
      type="button"
      id={switchId}
      role="switch"
      aria-checked={checked}
      aria-label={label ?? "Toggle"}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center overflow-hidden rounded-full border transition-colors",
        compact ? "h-5 w-9" : "h-6 w-11",
        checked
          ? "border-[var(--color-accent-hover)] bg-[var(--color-accent-soft)]"
          : "border-[var(--color-border)] bg-[var(--color-surface-hover)]"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0.5 top-1/2 -translate-y-1/2 rounded-full transition-transform duration-200 ease-out",
          compact ? "h-3.5 w-3.5" : "h-4 w-4",
          checked
            ? cn(
                "bg-[var(--color-accent)]",
                compact ? "translate-x-4" : "translate-x-5"
              )
            : "translate-x-0 bg-[var(--color-muted)]"
        )}
      />
    </button>
  );

  if (!label && !description) {
    return switchEl;
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        {label && (
          <label htmlFor={switchId} className="cursor-pointer text-sm text-[var(--color-text)]">
            {label}
          </label>
        )}
        {description && <p className="text-xs text-[var(--color-text-soft)]">{description}</p>}
      </div>
      {switchEl}
    </div>
  );
}
