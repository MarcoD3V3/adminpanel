"use client";

import { AlertCircle, X } from "lucide-react";
import { useAppErrorsStore } from "@/lib/app-errors-store";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function FloatingErrorBubble() {
  const errors = useAppErrorsStore((s) => s.errors);
  const expanded = useAppErrorsStore((s) => s.expanded);
  const toggleExpanded = useAppErrorsStore((s) => s.toggleExpanded);
  const removeError = useAppErrorsStore((s) => s.removeError);
  const clearErrors = useAppErrorsStore((s) => s.clearErrors);

  if (errors.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2"
      aria-live="polite"
    >
      {expanded && (
        <div
          className={cn(
            "w-[min(calc(100vw-3rem),22rem)] overflow-hidden rounded-xl border border-red-500/40",
            "bg-[#141418]/95 shadow-2xl shadow-black/50 backdrop-blur-md"
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-red-500/20 px-3 py-2">
            <p className="text-xs font-medium text-red-300">
              {errors.length === 1 ? "Error" : `${errors.length} errores`}
            </p>
            <button
              type="button"
              onClick={clearErrors}
              className="rounded-md p-1 text-[var(--color-muted)] transition hover:bg-white/5 hover:text-red-300"
              aria-label="Cerrar todos los errores"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="max-h-56 overflow-y-auto p-2">
            {errors.map((entry) => (
              <li
                key={entry.id}
                className="group flex gap-2 rounded-lg px-2 py-2 text-sm text-red-100/90 hover:bg-red-500/10"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <p className="break-words leading-snug">{entry.message}</p>
                  <p className="mt-1 text-[10px] text-[var(--color-muted)]">
                    {formatRelativeTime(new Date(entry.at).toISOString())}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeError(entry.id)}
                  className="shrink-0 rounded p-1 opacity-0 transition group-hover:opacity-100 hover:bg-white/5"
                  aria-label="Descartar error"
                >
                  <X className="h-3 w-3 text-[var(--color-muted)]" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={toggleExpanded}
        className={cn(
          "relative flex h-12 w-12 items-center justify-center rounded-full border shadow-lg transition",
          "border-red-500/50 bg-red-600/90 text-white hover:bg-red-500",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
        )}
        aria-label={expanded ? "Ocultar errores" : "Ver errores"}
        aria-expanded={expanded}
      >
        <AlertCircle className="h-5 w-5" strokeWidth={2} />
        {errors.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-red-600">
            {errors.length > 9 ? "9+" : errors.length}
          </span>
        )}
      </button>
    </div>
  );
}
