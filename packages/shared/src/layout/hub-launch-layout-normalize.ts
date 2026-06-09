import type { HubElement, HubLayout, HubScreen } from "../types/hub-layout";
import { LAUNCH_UI_ELEMENT_TYPES } from "./hub-launch-panel-bundle";

/** Piezas de lanzamiento que deben empezar ocultas en el Hub (salvo toggle de ventana). */
const LAUNCH_TYPES_HIDE_BY_DEFAULT = new Set<HubElement["type"]>(
  [...LAUNCH_UI_ELEMENT_TYPES].filter((t) => t !== "launch-desktop-window-toggle")
);

function promoteOrphanChildren(elements: HubElement[]): HubElement[] {
  const ids = new Set(elements.map((e) => e.id));
  return elements.map((el) => {
    if (el.parentId && !ids.has(el.parentId)) {
      return { ...el, parentId: undefined };
    }
    return el;
  });
}

/** Si hay varios elementos con el mismo refId, deja uno canónico (top-level sin padre). */
function dedupeLaunchRefs(elements: HubElement[]): HubElement[] {
  const byRef = new Map<string, HubElement[]>();
  for (const el of elements) {
    const ref = el.logic?.refId?.trim();
    if (!ref || !LAUNCH_TYPES_HIDE_BY_DEFAULT.has(el.type)) continue;
    const list = byRef.get(ref) ?? [];
    list.push(el);
    byRef.set(ref, list);
  }

  const dropIds = new Set<string>();
  for (const [, list] of byRef) {
    if (list.length < 2) continue;
    const canonical =
      list.find((e) => !e.parentId) ??
      list.sort((a, b) => b.width * b.height - a.width * a.height)[0];
    for (const el of list) {
      if (el.id !== canonical.id) dropIds.add(el.id);
    }
  }

  if (!dropIds.size) return elements;
  return elements.filter((e) => !dropIds.has(e.id));
}

function normalizeLaunchScreen(
  screen: HubScreen,
  opts?: { resetLaunchVisibility?: boolean }
): HubScreen {
  let elements = promoteOrphanChildren(screen.elements);
  elements = dedupeLaunchRefs(elements);

  if (opts?.resetLaunchVisibility) {
    elements = elements.map((el) => {
      if (!LAUNCH_TYPES_HIDE_BY_DEFAULT.has(el.type)) return el;
      if (!el.visible) return el;
      return { ...el, visible: false };
    });
  }

  return { ...screen, elements };
}

/** Repara huérfanos, refs duplicados y visibilidad inicial del HUD de lanzamiento. */
export function normalizeLaunchLayout(
  layout: HubLayout,
  opts?: { resetLaunchVisibility?: boolean }
): HubLayout {
  return {
    ...layout,
    screens: layout.screens.map((s) => normalizeLaunchScreen(s, opts)),
  };
}
