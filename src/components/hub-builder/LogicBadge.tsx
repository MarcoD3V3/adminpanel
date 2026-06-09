import type { HubElement } from "@/types/hub-builder";
import { logicBadgeIcon } from "@/components/hub-builder/palette-icons";

/** Muestra el badge si el elemento tiene ref ID, lógica activa o script. */
export function hasLogicBadge(element: HubElement): boolean {
  const logic = element.logic;
  if (!logic) return false;
  if (logic.refId?.trim()) return true;
  if (logic.enabled) return true;
  if (logic.script?.trim()) return true;
  return false;
}

export function logicBadgeLabel(element: HubElement): string | undefined {
  const ref = element.logic?.refId?.trim();
  if (ref) return ref;
  return undefined;
}

export function LogicBadge({ label }: { label?: string }) {
  const BadgeIcon = logicBadgeIcon;

  return (
    <span
      className="pointer-events-none absolute left-1/2 top-0 z-20 flex max-w-[min(100%,72px)] -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 rounded-full border border-[var(--color-accent-muted)] bg-[var(--color-surface-raised)] px-1.5 py-0.5 shadow-sm"
      title={label ? `ID: ${label}` : "Lógica asignada"}
    >
      <BadgeIcon className="h-2.5 w-2.5 shrink-0 text-[var(--color-accent)]" strokeWidth={2} />
      {label && (
        <span className="truncate font-mono text-[8px] text-[var(--color-accent)]">{label}</span>
      )}
    </span>
  );
}
