import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
}

const variants = {
  primary:
    "bg-[var(--color-accent)] text-[var(--color-text)] hover:bg-[var(--color-accent-hover)] border border-transparent",
  secondary:
    "bg-[var(--color-surface-hover)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface-raised)]",
  outline:
    "bg-transparent text-[var(--color-text-soft)] border border-[var(--color-border)] hover:text-[var(--color-text)] hover:border-[var(--color-muted)]",
  danger: "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]",
  ghost: "text-[var(--color-text-soft)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2 text-sm rounded-xl",
  lg: "px-5 py-2.5 text-sm rounded-xl",
};

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium disabled:opacity-40 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
