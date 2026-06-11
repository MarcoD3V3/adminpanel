"use client";

import { validatePassword, type PasswordValidationResult } from "@/lib/password-policy";
import { cn } from "@/lib/utils";

const STRENGTH_LABEL: Record<PasswordValidationResult["strength"], string> = {
  muy_debil: "Muy débil",
  debil: "Débil",
  media: "Aceptable",
  fuerte: "Fuerte",
  muy_fuerte: "Muy fuerte",
};

const STRENGTH_COLOR: Record<PasswordValidationResult["strength"], string> = {
  muy_debil: "bg-red-500",
  debil: "bg-orange-500",
  media: "bg-amber-500",
  fuerte: "bg-emerald-500",
  muy_fuerte: "bg-emerald-400",
};

type PasswordStrengthProps = {
  password: string;
  username?: string;
  displayName?: string;
};

export function PasswordStrength({ password, username, displayName }: PasswordStrengthProps) {
  if (!password) return null;

  const result = validatePassword(password, { username, displayName });
  const barWidth = `${result.score}%`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-[var(--color-muted)]">Fortaleza</span>
        <span
          className={cn(
            result.valid ? "text-emerald-300" : "text-[var(--color-text-soft)]"
          )}
        >
          {STRENGTH_LABEL[result.strength]}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-[var(--color-surface-hover)]">
        <div
          className={cn("h-full transition-all", STRENGTH_COLOR[result.strength])}
          style={{ width: barWidth }}
        />
      </div>
      {result.errors.length > 0 && (
        <ul className="space-y-0.5 text-[10px] text-red-400">
          {result.errors.map((err) => (
            <li key={err}>• {err}</li>
          ))}
        </ul>
      )}
      {result.valid && result.hints[0] && (
        <p className="text-[10px] text-emerald-300/90">{result.hints[0]}</p>
      )}
    </div>
  );
}
