"use client";

import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DEV_ADMIN_FALLBACK_KEY } from "@/lib/admin-session-client";
import { reportAppError } from "@/lib/app-errors-store";

type AdminLoginFormProps = {
  configured: boolean;
  devFallbackActive: boolean;
  remember: boolean;
  onRememberChange: (value: boolean) => void;
  onLogin: (key: string) => Promise<{ ok: boolean; error?: string }>;
  submitLabel?: string;
};

export function AdminLoginForm({
  configured,
  devFallbackActive,
  remember,
  onRememberChange,
  onLogin,
  submitLabel = "Iniciar sesión",
}: AdminLoginFormProps) {
  const [key, setKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    setSubmitting(true);
    const result = await onLogin(key);
    if (!result.ok) {
      reportAppError(
        result.error === "Clave incorrecta"
          ? `${result.error}. Usa LAUNCHER_ADMIN_SECRET (en Railway o .env.local) y reinicia el servidor si acabas de cambiarla.`
          : (result.error ?? "No se pudo iniciar sesión")
      );
    } else {
      setKey("");
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      {!configured && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Configura <code>LAUNCHER_ADMIN_SECRET</code> (mín. 16 caracteres) en Railway o .env.local
        </p>
      )}

      {devFallbackActive && (
        <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
          Desarrollo: clave por defecto <code className="break-all">{DEV_ADMIN_FALLBACK_KEY}</code>
        </p>
      )}

      <form className="space-y-3" onSubmit={(e) => void handleLogin(e)}>
        <Input
          label="Clave admin"
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="LAUNCHER_ADMIN_SECRET"
          autoComplete="current-password"
          autoFocus
        />

        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--color-text-soft)]">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => onRememberChange(e.target.checked)}
            className="rounded border-[var(--color-border-subtle)]"
          />
          Mantener sesión (30 días o hasta cerrar sesión)
        </label>

        <Button type="submit" className="w-full" disabled={submitting || !key.trim()}>
          <KeyRound className="h-3.5 w-3.5" />
          {submitting ? "Entrando…" : submitLabel}
        </Button>
      </form>

      <p className="text-[10px] leading-relaxed text-[var(--color-muted)]">
        La clave se valida en el servidor. Solo se guarda un token firmado en cookie HttpOnly (no
        localStorage).
      </p>
    </div>
  );
}
