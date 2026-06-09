"use client";

import { useMemo } from "react";
import type { HubElement } from "@craftlauncher/shared";
import { collectHubRefTargets, hubRefTargetOptions, resolvePillSelectStyle } from "@craftlauncher/shared";
import { HubPillSelect } from "@/components/hub/HubPillSelect";
import { launcherActions, useLauncherStore } from "@/lib/launcher-store";

/** Selector en runtime: elige qué panel (por refId) mostrar. */
export function PanelVisibilitySelectHub({
  element,
  label,
}: {
  element: HubElement;
  label?: string;
}) {
  const layout = useLauncherStore((s) => s.layout);
  const live = useLauncherStore((s) => {
    for (const screen of s.layout.screens) {
      const hit = screen.elements.find((e) => e.id === element.id);
      if (hit) return hit;
    }
    return element;
  });

  const hideOthers = Boolean(live.logic?.constants?.HIDE_OTHERS);
  const value = String(live.value ?? "");

  const options = useMemo(() => {
    const targets = collectHubRefTargets(layout).filter(
      (t) =>
        t.elementId !== element.id &&
        t.type !== "panel-visibility-select" &&
        t.type !== "automation-node"
    );
    return hubRefTargetOptions(targets).filter((o) => o.value);
  }, [layout, element.id]);

  const selected = value || options[0]?.value || "";

  return (
    <div className="panel-vis-select">
      {label ? <span className="panel-vis-select-label">{label}</span> : null}
      <HubPillSelect
        value={selected}
        options={options}
        styleVariant={resolvePillSelectStyle(element)}
        placeholder="Sin paneles (añade refId a un contenedor)"
        onChange={(refId) => {
          void launcherActions.applyPanelVisibilitySelect(element.id, refId, { hideOthers });
        }}
      />
    </div>
  );
}
