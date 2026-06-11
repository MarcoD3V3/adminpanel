"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const AUTO_HIDE_MS = 15_000;

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  className?: string;
  id?: string;
  holdToReveal?: boolean;
};

export function SecurePasswordInput({
  label,
  value,
  onChange,
  placeholder,
  autoComplete = "new-password",
  className,
  id,
  holdToReveal = false,
}: Props) {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    setVisible(false);
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(hide, AUTO_HIDE_MS);
  }, [hide]);

  const reveal = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    const onBlur = () => hide();
    const onVis = () => {
      if (document.hidden) hide();
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [hide]);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-[var(--color-text-soft)]">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          spellCheck={false}
          data-1p-ignore={visible ? undefined : "true"}
          data-lpignore="true"
          onCopy={(e) => {
            if (!visible) e.preventDefault();
          }}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-3.5 pr-10 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent-muted)]"
        />
        <button
          type="button"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          title={
            holdToReveal
              ? "Mantén pulsado para ver"
              : visible
                ? "Ocultar"
                : "Mostrar contraseña"
          }
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)]"
          onClick={
            holdToReveal
              ? undefined
              : () => {
                  if (visible) hide();
                  else reveal();
                }
          }
          onPointerDown={holdToReveal ? reveal : undefined}
          onPointerUp={holdToReveal ? hide : undefined}
          onPointerLeave={holdToReveal ? hide : undefined}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/** Texto sensible en bloques de copia — oculto por defecto. */
export function SecureRevealText({
  text,
  label = "Contraseña",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    setVisible(false);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const show = () => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(hide, AUTO_HIDE_MS);
  };

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="font-mono">{visible ? text : "••••••••••••"}</span>
      <button
        type="button"
        className="rounded p-0.5 text-[var(--color-muted)] hover:text-[var(--color-text)]"
        onClick={() => (visible ? hide() : show())}
        aria-label={visible ? `Ocultar ${label}` : `Mostrar ${label}`}
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
