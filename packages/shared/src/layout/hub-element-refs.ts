import type { HubElement, HubLayout } from "../types/hub-layout";

export type HubRefTarget = { refId: string; label: string; elementId: string; type: string };

/** Lista elementos con refId en todo el layout (para selectores de “mostrar/ocultar”). */
export function collectHubRefTargets(layout: HubLayout, screenId?: string): HubRefTarget[] {
  const out: HubRefTarget[] = [];
  const screens = screenId
    ? layout.screens.filter((s) => s.id === screenId)
    : layout.screens;

  for (const screen of screens) {
    for (const el of screen.elements) {
      const refId = el.logic?.refId?.trim();
      if (!refId) continue;
      out.push({
        refId,
        label: el.label?.trim() ? `${refId} · ${el.label.trim()}` : refId,
        elementId: el.id,
        type: el.type,
      });
    }
  }

  for (const screen of layout.screens) {
    for (const el of screen.chrome?.elements ?? []) {
      const refId = el.logic?.refId?.trim();
      if (!refId) continue;
      out.push({
        refId,
        label: el.label?.trim() ? `${refId} · ${el.label.trim()}` : refId,
        elementId: el.id,
        type: el.type,
      });
    }
  }
  const legacyChrome = layout.launcherChrome?.elements ?? [];
  for (const el of legacyChrome) {
    const refId = el.logic?.refId?.trim();
    if (!refId) continue;
    out.push({
      refId,
      label: el.label?.trim() ? `${refId} · ${el.label.trim()}` : refId,
      elementId: el.id,
      type: el.type,
    });
  }

  return out.sort((a, b) => a.refId.localeCompare(b.refId));
}

/** Un refId por entrada (varios elementos con el mismo ref → una opción). */
export function dedupeHubRefTargets(targets: HubRefTarget[]): HubRefTarget[] {
  const byRef = new Map<string, HubRefTarget>();
  for (const t of targets) {
    const prev = byRef.get(t.refId);
    if (!prev) {
      byRef.set(t.refId, t);
      continue;
    }
    byRef.set(t.refId, {
      ...prev,
      label: `${t.refId} · ${prev.type} (+ más en layout)`,
    });
  }
  return [...byRef.values()].sort((a, b) => a.refId.localeCompare(b.refId));
}

const VISIBILITY_TARGET_TYPES = new Set([
  "container",
  "surface-box",
  "visibility-zone",
  "launch-panel",
  "launch-progress-bar",
  "launch-log-panel",
  "launch-structured-log",
  "launch-phase-label",
  "launch-detail-text",
  "launch-version-title",
  "launch-error-block",
  "launch-ok-hint",
  "launch-hint-text",
  "launch-dismiss-button",
  "banner",
  "text",
  "button",
  "play-button",
  "play-show-bind",
]);

/** Objetivos típicos para mostrar/ocultar (paneles), sin campos instance.* duplicados. */
export function collectHubVisibilityTargets(layout: HubLayout, screenId?: string): HubRefTarget[] {
  const all = collectHubRefTargets(layout, screenId);
  const filtered = all.filter(
    (t) =>
      VISIBILITY_TARGET_TYPES.has(t.type) ||
      (!t.refId.startsWith("instance.") &&
        !["instance-selector", "instance-name-input", "instance-version-select", "installed-version-selector"].includes(
          t.type
        ))
  );
  return dedupeHubRefTargets(filtered.length > 0 ? filtered : all);
}

export function hubRefTargetOptions(targets: HubRefTarget[]): { value: string; label: string }[] {
  const unique = dedupeHubRefTargets(targets);
  return [{ value: "", label: "— Ninguno —" }, ...unique.map((t) => ({ value: t.refId, label: t.label }))];
}
