"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useHubBuilderStore } from "@/lib/hub-builder-store";

/** Alertas flotantes en modo probar — igual posición que el launcher */
export function HubPreviewToasts() {
  const toasts = useHubBuilderStore((s) => s.previewToasts);
  const dismissPreviewToast = useHubBuilderStore((s) => s.dismissPreviewToast);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((t) => setTimeout(() => dismissPreviewToast(t.id), 7000));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismissPreviewToast]);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[100] flex w-[min(280px,calc(100%-24px))] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto rounded-[10px] border px-3 py-2 text-[11px] leading-snug shadow-lg backdrop-blur-sm",
            t.type === "error" && "border-red-500/30 bg-red-950/90 text-red-200",
            t.type === "success" && "border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
            t.type === "warning" && "border-amber-500/30 bg-amber-950/90 text-amber-100",
            t.type !== "error" && t.type !== "success" && t.type !== "warning" &&
              "border-[var(--color-border)] bg-[var(--color-surface-raised)]/95 text-[var(--color-text)]"
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
