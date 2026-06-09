import {
  shouldRunLogicTrigger,
  type LaunchAutomationPhase,
  type HubElement,
  type HubLayout,
  type LogicTrigger,
  isVisibilityRuleElement,
  visibilityHideTargets,
  visibilityShowTargets,
} from "@craftlauncher/shared";
import type { LaunchPhase } from "./launcher-store";

export function toAutomationPhase(phase: LaunchPhase): LaunchAutomationPhase {
  return phase as LaunchAutomationPhase;
}

function logicElementActive(el: HubElement): boolean {
  if (!el.logic?.enabled) return false;
  return Boolean(el.logic.script.trim()) || isVisibilityRuleElement(el);
}

export function collectLogicElements(layout: HubLayout): HubElement[] {
  const out: HubElement[] = [];
  for (const screen of layout.screens) {
    for (const el of screen.elements) {
      if (logicElementActive(el)) out.push(el);
    }
  }
  for (const screen of layout.screens) {
    for (const el of screen.chrome?.elements ?? []) {
      if (logicElementActive(el)) out.push(el);
    }
  }
  for (const el of layout.launcherChrome?.elements ?? []) {
    if (logicElementActive(el)) out.push(el);
  }
  return out;
}

const SELECTOR_TYPES = new Set([
  "instance-selector",
  "installed-version-selector",
  "instance-version-select",
  "version-selector",
  "dropdown",
  "panel-visibility-select",
]);

export function isSelectorElementType(type: string): boolean {
  return SELECTOR_TYPES.has(type);
}

export function collectSelectorChangeWatchers(
  layout: HubLayout,
  sourceRefId: string | undefined
): HubElement[] {
  const want = sourceRefId?.trim() ?? "";
  return collectLogicElements(layout).filter((el) => {
    if (!el.logic?.trigger || el.logic.trigger !== "selector-change") return false;
    const bind = String(el.logic?.constants?.SELECTOR_REF ?? "").trim();
    if (!bind) return true;
    return bind === want;
  });
}

export function collectAnyClickWatchers(layout: HubLayout, screenId: string): HubElement[] {
  const screen = layout.screens.find((s) => s.id === screenId);
  if (!screen) return [];
  return screen.elements.filter(
    (el) => logicElementActive(el) && el.logic?.trigger === "any-click"
  );
}

export function runBuiltinClickAction(
  el: HubElement,
  patchVisible: (refId: string, visible: boolean) => void
): boolean {
  if (el.type === "show-on-click" || el.type === "play-show-bind" || el.type === "play-button") {
    for (const ref of visibilityShowTargets(el)) patchVisible(ref, true);
    for (const ref of visibilityHideTargets(el)) patchVisible(ref, false);
    return el.type === "show-on-click";
  }
  return false;
}

export function triggersForPhaseChange(
  prev: LaunchAutomationPhase,
  next: LaunchAutomationPhase
): LogicTrigger[] {
  const eventTriggers: LogicTrigger[] = [
    "phase-change",
    "launch-idle",
    "launch-active",
    "launch-running",
    "launch-error",
    "launch-ended",
  ];
  return eventTriggers.filter((t) => shouldRunLogicTrigger(t, prev, next));
}
