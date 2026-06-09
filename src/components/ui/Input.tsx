import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  compact?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, compact, className, id, ...props },
  ref
) {
  return (
    <div className={cn(compact ? "space-y-1" : "space-y-1.5")}>
      {label && (
        <label
          htmlFor={id}
          className={cn(
            "font-medium text-[var(--color-text-soft)]",
            compact ? "text-[10px]" : "text-xs"
          )}
        >
          {label}
        </label>
      )}
      <input
        id={id}
        ref={ref}
        className={cn(
          "w-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-muted)] outline-none focus:border-[var(--color-accent-muted)]",
          compact
            ? "rounded-lg px-2 py-1.5 text-xs"
            : "rounded-xl px-3.5 py-2.5 text-sm",
          className
        )}
        {...props}
      />
      {hint && <p className="text-[11px] text-[var(--color-muted)]">{hint}</p>}
    </div>
  );
});

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  compact?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, compact, className, ...props },
  ref
) {
  return (
    <div className={cn(compact ? "space-y-1" : "space-y-1.5")}>
      {label && (
        <label
          className={cn(
            "font-medium text-[var(--color-text-soft)]",
            compact ? "text-[10px]" : "text-xs"
          )}
        >
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={cn(
          "w-full resize-none border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-muted)] outline-none focus:border-[var(--color-accent-muted)]",
          compact
            ? "rounded-lg px-2 py-1.5 text-xs"
            : "rounded-xl px-3.5 py-2.5 text-sm",
          className
        )}
        {...props}
      />
      {hint && <p className="text-[11px] text-[var(--color-muted)]">{hint}</p>}
    </div>
  );
});

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  compact?: boolean;
}

export function Select({ label, options, compact, className, ...props }: SelectProps) {
  return (
    <div className={cn(compact ? "space-y-1" : "space-y-1.5")}>
      {label && (
        <label
          className={cn(
            "font-medium text-[var(--color-text-soft)]",
            compact ? "text-[10px]" : "text-xs"
          )}
        >
          {label}
        </label>
      )}
      <select
        className={cn(
          "w-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent-muted)]",
          compact
            ? "rounded-lg px-2 py-1.5 text-xs"
            : "rounded-xl px-3.5 py-2.5 text-sm",
          className
        )}
        {...props}
      >
        {options.map((opt, i) => (
          <option key={`${opt.value || "empty"}-${i}`} value={opt.value} title={opt.label}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
