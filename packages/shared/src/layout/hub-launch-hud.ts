import type { HubElement, HubLayout } from "../types/hub-layout";
import { getActiveScreen } from "./validate";
import { LAUNCH_UI_ELEMENT_TYPES } from "./hub-launch-panel-bundle";

/** @deprecated Usa LAUNCH_UI_ELEMENT_TYPES */
export const LAUNCH_HUD_ELEMENT_TYPES = LAUNCH_UI_ELEMENT_TYPES;

export function collectLaunchHudElements(layout: HubLayout, screenId?: string): HubElement[] {
  const screen = screenId
    ? layout.screens.find((s) => s.id === screenId) ?? getActiveScreen(layout)
    : getActiveScreen(layout);
  const out: HubElement[] = [];
  for (const el of screen.elements) {
    if (LAUNCH_UI_ELEMENT_TYPES.has(el.type)) out.push(el);
  }
  return out;
}

/** Hijos modulares dentro de un launch-panel (para mostrar/ocultar el bloque entero). */
export function collectLaunchPanelDescendants(layout: HubLayout, panelId: string): HubElement[] {
  const screen = getActiveScreen(layout);
  return screen.elements.filter((el) => el.parentId === panelId);
}
