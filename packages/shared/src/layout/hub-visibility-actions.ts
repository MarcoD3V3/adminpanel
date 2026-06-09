import type { HubElement } from "../types/hub-layout";
import { joinTargetList, parseTargetList } from "./hub-element-targets";

export type VisibilityActionOp = "show" | "hide";

export type VisibilityAction = {
  op: VisibilityActionOp;
  target: string;
};

export function parseVisibilityActions(
  constants?: Record<string, string | number | boolean>
): VisibilityAction[] {
  const c = constants ?? {};
  const raw = String(c.VIS_ACTIONS ?? "").trim();
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const out: VisibilityAction[] = [];
        for (const item of parsed) {
          if (!item || typeof item !== "object") continue;
          const op = (item as { op?: string }).op === "hide" ? "hide" : "show";
          const target = String((item as { target?: string }).target ?? "").trim();
          if (target) out.push({ op, target });
        }
        if (out.length) return out;
      }
    } catch {
      /* legacy */
    }
  }

  const out: VisibilityAction[] = [];
  for (const target of parseTargetList(c.SHOW_LIST ?? c.SHOW ?? c.SHOW_REF ?? c.TARGET)) {
    out.push({ op: "show", target });
  }
  for (const target of parseTargetList(c.HIDE_LIST ?? c.HIDE ?? c.HIDE_REF)) {
    out.push({ op: "hide", target });
  }
  return out;
}

export function visibilityActionsToShowHide(actions: VisibilityAction[]): {
  show: string[];
  hide: string[];
} {
  const show: string[] = [];
  const hide: string[] = [];
  const seen = new Set<string>();
  for (const a of actions) {
    const key = `${a.op}:${a.target}`;
    if (!a.target || seen.has(key)) continue;
    seen.add(key);
    if (a.op === "hide") hide.push(a.target);
    else show.push(a.target);
  }
  return { show, hide };
}

/** Constantes limpias: una sola lista VIS_ACTIONS (sin SHOW/SHOW_REF duplicados). */
export function buildVisibilityConstants(actions: VisibilityAction[]): Record<string, string | number | boolean> {
  const { show, hide } = visibilityActionsToShowHide(actions);
  const compact = actions.filter((a) => a.target);
  return {
    RULE_VISIBILITY: true,
    VIS_ACTIONS: JSON.stringify(compact),
    SHOW_LIST: joinTargetList(show),
    HIDE_LIST: joinTargetList(hide),
  };
}

export function hasVisibilityActions(el: HubElement): boolean {
  return parseVisibilityActions(el.logic?.constants).length > 0;
}

export function usesVisibilityActionsEditor(el: HubElement): boolean {
  if (el.type === "show-on-condition" || el.type === "hide-on-condition") return true;
  if (el.type === "show-on-click" || el.type === "play-show-bind" || el.type === "play-button") return true;
  if (el.action === "play") return true;
  if (el.type === "toggle-visible") return true;
  if (Boolean(el.logic?.constants?.RULE_VISIBILITY) || Boolean(el.logic?.constants?.VIS_ACTIONS)) {
    return true;
  }
  return false;
}
