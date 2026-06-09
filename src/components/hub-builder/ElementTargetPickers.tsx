"use client";

import { useMemo } from "react";
import {
  buildVisibilityConstants,
  collectHubGroups,
  collectHubVisibilityTargets,
  hubGroupTargetOptions,
  hubRefTargetOptions,
  parseVisibilityActions,
  type VisibilityAction,
  type VisibilityActionOp,
} from "@craftlauncher/shared";
import type { HubElement, HubLayout, LogicTrigger } from "@/types/hub-builder";
import { Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Props = {
  layout: HubLayout;
  element: HubElement;
  onPatchConstants: (patch: Record<string, string | number | boolean>) => void;
};

const EVENT_TRIGGERS = new Set<LogicTrigger>([
  "phase-change",
  "launch-idle",
  "launch-active",
  "launch-running",
  "launch-error",
  "launch-ended",
  "selector-change",
  "any-click",
]);

function buildPickerOptions(
  layout: HubLayout,
  targets: ReturnType<typeof collectHubVisibilityTargets>
): { value: string; label: string }[] {
  const groups = hubGroupTargetOptions(collectHubGroups(layout));
  const refs = hubRefTargetOptions(targets).filter((o) => o.value);
  return [{ value: "", label: "— Elegir objetivo —" }, ...groups, ...refs];
}

function triggerHint(trigger: LogicTrigger | undefined, clickMode: boolean): string {
  if (clickMode) {
    return "Se ejecuta al hacer clic en este elemento (antes de lanzar el juego, si es Jugar).";
  }
  switch (trigger) {
    case "launch-active":
      return "Cuando empieza la descarga o preparación (al pulsar Jugar).";
    case "launch-running":
      return "Cuando Minecraft ya está en ejecución.";
    case "launch-idle":
    case "launch-ended":
      return "Cuando el juego está parado o se cerró la sesión.";
    case "launch-error":
      return "Si falla el lanzamiento.";
    case "phase-change":
      return "En cada cambio de fase del lanzamiento.";
    case "any-click":
      return "Cuando se hace clic en cualquier elemento de la pantalla.";
    default:
      return "Elige el disparador arriba en Lógica.";
  }
}

function defaultActionsForElement(element: HubElement): VisibilityAction[] {
  if (element.type === "hide-on-condition") return [{ op: "hide", target: "" }];
  if (element.type === "show-on-condition") return [{ op: "show", target: "" }];
  return [{ op: "show", target: "" }];
}

function allowedOps(element: HubElement): VisibilityActionOp[] {
  if (element.type === "show-on-condition") return ["show"];
  if (element.type === "hide-on-condition") return ["hide"];
  return ["show", "hide"];
}

/** Lista de acciones (mostrar/ocultar) — no usa el cuadro JSON. */
export function ElementTargetPickers({ layout, element, onPatchConstants }: Props) {
  const targets = useMemo(() => collectHubVisibilityTargets(layout), [layout]);
  const options = useMemo(() => buildPickerOptions(layout, targets), [layout, targets]);

  const clickMode =
    element.type === "show-on-click" ||
    element.type === "play-show-bind" ||
    element.type === "play-button" ||
    element.action === "play";

  const eventMode =
    element.type === "show-on-condition" ||
    element.type === "hide-on-condition" ||
    Boolean(element.logic?.trigger && EVENT_TRIGGERS.has(element.logic.trigger));

  const toggleOnly = element.type === "toggle-visible";
  const showPickers = clickMode || eventMode || toggleOnly;

  const actions = useMemo(() => {
    if (!showPickers) return [] as VisibilityAction[];
    const parsed = parseVisibilityActions(element.logic?.constants);
    return parsed.length ? parsed : defaultActionsForElement(element);
  }, [element.logic?.constants, element.type, showPickers]);

  if (!showPickers) return null;

  const ops = allowedOps(element);
  const patchActions = (next: VisibilityAction[]) => {
    onPatchConstants(buildVisibilityConstants(next.filter((a) => a.target)));
  };

  const setAction = (index: number, patch: Partial<VisibilityAction>) => {
    const rows = [...actions];
    rows[index] = { ...rows[index], ...patch };
    patchActions(rows);
  };

  const addAction = () => patchActions([...actions, { op: ops[0], target: "" }]);

  const removeAction = (index: number) => {
    const rows = actions.filter((_, i) => i !== index);
    patchActions(rows.length ? rows : defaultActionsForElement(element));
  };

  if (toggleOnly) {
    const target = actions.find((a) => a.target)?.target ?? "";
    return (
      <div className="space-y-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-2">
        <p className="text-[10px] font-medium text-[var(--color-text)]">Alternar al clic</p>
        <Select
          compact
          label="Elemento"
          value={target}
          onChange={(e) => patchActions([{ op: "show", target: e.target.value }])}
          options={options}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-2">
      <p className="text-[10px] font-medium text-[var(--color-text)]">
        {clickMode ? "Acciones al clic" : "Acciones al cumplir la condición"}
      </p>
      <p className="text-[9px] leading-snug text-[var(--color-muted)]">
        {triggerHint(element.logic?.trigger, clickMode)}
      </p>

      <ul className="space-y-1.5">
        {actions.map((action, i) => (
          <li
            key={`vis-${i}-${action.op}`}
            className="flex flex-wrap items-center gap-1 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg)] p-1"
          >
            {ops.length > 1 ? (
              <Select
                compact
                className="w-[88px] shrink-0"
                value={action.op}
                onChange={(e) => setAction(i, { op: e.target.value as VisibilityActionOp })}
                options={[
                  { value: "show", label: "Mostrar" },
                  { value: "hide", label: "Ocultar" },
                ]}
              />
            ) : (
              <span className="w-[72px] shrink-0 px-1 text-[10px] text-[var(--color-text-soft)]">
                {action.op === "hide" ? "Ocultar" : "Mostrar"}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <Select
                compact
                value={action.target}
                onChange={(e) => setAction(i, { target: e.target.value })}
                options={options}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 px-2 text-[10px]"
              onClick={() => removeAction(i)}
              disabled={actions.length <= 1 && !action.target}
              title="Quitar"
            >
              ×
            </Button>
          </li>
        ))}
      </ul>

      <Button type="button" size="sm" variant="outline" className="h-7 w-full text-[10px]" onClick={addAction}>
        + Añadir acción
      </Button>

      {element.logic?.trigger === "selector-change" && (
        <Select
          compact
          label="Solo si cambia este selector"
          value={String(element.logic?.constants?.SELECTOR_REF ?? "")}
          onChange={(e) => onPatchConstants({ SELECTOR_REF: e.target.value, RULE_VISIBILITY: true })}
          options={[
            { value: "", label: "— Cualquier selector —" },
            ...targets
              .filter((t) =>
                ["instance-selector", "installed-version-selector", "version-selector"].includes(t.type)
              )
              .map((t) => ({ value: t.refId, label: t.label })),
          ]}
        />
      )}
    </div>
  );
}
