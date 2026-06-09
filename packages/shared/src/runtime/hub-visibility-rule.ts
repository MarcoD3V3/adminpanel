import type { HubElement, HubLayout, LogicTrigger } from "../types/hub-layout";
import {
  findElementsByGroup,
  findElementsByRef,
  hubGroupFromToken,
  isHubGroupToken,
} from "../layout/hub-element-targets";
import {
  parseVisibilityActions,
  visibilityActionsToShowHide,
} from "../layout/hub-visibility-actions";

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

/** Regla sin script: solo mostrar/ocultar por refId cuando se cumple el disparador. */
export function isVisibilityRuleElement(el: HubElement): boolean {
  if (el.type === "show-on-condition" || el.type === "hide-on-condition") return true;
  if (Boolean(el.logic?.constants?.RULE_VISIBILITY)) return true;
  return false;
}

export function usesConditionVisibilityUi(el: HubElement): boolean {
  if (isVisibilityRuleElement(el)) return true;
  const t = el.logic?.trigger;
  return Boolean(t && EVENT_TRIGGERS.has(t));
}

export function visibilityShowRef(el: HubElement): string {
  const list = visibilityShowTargets(el);
  if (list.length) return list[0];
  return String(el.logic?.constants?.SHOW ?? el.logic?.constants?.SHOW_REF ?? "").trim();
}

export function visibilityHideRef(el: HubElement): string {
  const list = visibilityHideTargets(el);
  if (list.length) return list[0];
  return String(el.logic?.constants?.HIDE ?? el.logic?.constants?.HIDE_REF ?? "").trim();
}

export function visibilityShowTargets(el: HubElement): string[] {
  const { show } = visibilityActionsToShowHide(parseVisibilityActions(el.logic?.constants));
  return show;
}

export function visibilityHideTargets(el: HubElement): string[] {
  const { hide } = visibilityActionsToShowHide(parseVisibilityActions(el.logic?.constants));
  return hide;
}

export type VisibilityPatchFn = (elementId: string, visible: boolean) => void;

/** Aplica mostrar/ocultar a varios refId y/o @group:… */
export function applyVisibilityTargetList(
  layout: HubLayout,
  targets: string[],
  visible: boolean,
  patch: VisibilityPatchFn
): void {
  const seen = new Set<string>();
  for (const token of targets) {
    if (!token || seen.has(token)) continue;
    seen.add(token);
    if (isHubGroupToken(token)) {
      for (const el of findElementsByGroup(layout, hubGroupFromToken(token))) {
        patch(el.id, visible);
      }
      continue;
    }
    for (const el of findElementsByRef(layout, token)) {
      patch(el.id, visible);
    }
  }
}

