import { actionLabels, elementPalette } from "@/lib/hub-builder-data";
import type { HubElement, PaletteItem } from "@/types/hub-builder";
type HubElementSurface = "chrome" | "content";

const PALETTE_BY_ID = new Map(elementPalette.map((item) => [item.id, item]));

const PALETTE_BY_REF = new Map<string, PaletteItem>();
for (const item of elementPalette) {
  const ref = item.preset?.logic?.refId?.trim();
  if (ref) PALETTE_BY_REF.set(ref, item);
}

const PALETTE_BY_TYPE_ACTION = new Map<string, PaletteItem[]>();
for (const item of elementPalette) {
  const key = `${item.type}::${item.defaultAction}`;
  const list = PALETTE_BY_TYPE_ACTION.get(key) ?? [];
  list.push(item);
  PALETTE_BY_TYPE_ACTION.set(key, list);
}

const CHROME_ACTION_PALETTE_ID: Partial<Record<string, string>> = {
  "close-window": "chrome.close",
  "minimize-window": "chrome.minimize",
  "sync-layout": "chrome.syncBtn",
};

function paletteInChrome(item: PaletteItem): boolean {
  return item.category === "chrome" || Boolean(item.chromeTarget);
}

function scorePaletteMatch(
  el: HubElement,
  item: PaletteItem,
  surface?: HubElementSurface
): number {
  if (el.type !== item.type) return 0;

  let score = 12;

  if (el.action === item.defaultAction) score += 36;

  const elRef = el.logic?.refId?.trim();
  const presetRef = item.preset?.logic?.refId?.trim();
  if (elRef && presetRef) {
    if (elRef === presetRef) score += 80;
    else if (elRef.startsWith(presetRef) || presetRef.startsWith(elRef)) score += 24;
  }

  const elLabel = (el.label ?? "").trim().toLowerCase();
  const paletteLabel = (item.defaultLabel ?? "").trim().toLowerCase();
  if (elLabel && paletteLabel) {
    if (elLabel === paletteLabel) score += 28;
    else if (elLabel.includes(paletteLabel) || paletteLabel.includes(elLabel)) score += 12;
  }

  if (surface === "chrome" && paletteInChrome(item)) score += 18;
  if (surface === "content" && !paletteInChrome(item)) score += 8;
  if (el.type.startsWith("mods-") && item.category === "mods") score += 22;

  return score;
}

function resolveByHeuristics(el: HubElement, surface?: HubElementSurface): PaletteItem | null {
  const actionPaletteId = CHROME_ACTION_PALETTE_ID[el.action];
  if (actionPaletteId) {
    const hit = PALETTE_BY_ID.get(actionPaletteId);
    if (hit && hit.type === el.type) return hit;
  }

  const elRef = el.logic?.refId?.trim();
  if (elRef) {
    const byRef = PALETTE_BY_REF.get(elRef);
    if (byRef && byRef.type === el.type) return byRef;
  }

  const typeActionList = PALETTE_BY_TYPE_ACTION.get(`${el.type}::${el.action}`);
  if (typeActionList?.length === 1) return typeActionList[0];

  let best: PaletteItem | null = null;
  let bestScore = 0;
  for (const item of elementPalette) {
    const score = scorePaletteMatch(el, item, surface);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return bestScore >= 20 ? best : null;
}

export function resolveElementPaletteItem(
  el: HubElement,
  surface?: HubElementSurface
): PaletteItem | null {
  return resolveByHeuristics(el, surface);
}

const ACTION_NAMED_TYPES = new Set([
  "chrome-button",
  "button",
  "icon-button",
  "chrome-icon-button",
  "nav-item",
  "script-button",
]);

/** Nombre corto del catálogo (ej. «Ventana actual», «Campo búsqueda»). */
export function elementCatalogLabel(el: HubElement, surface?: HubElementSurface): string {
  const item = resolveElementPaletteItem(el, surface);
  if (item) return item.label;

  const fallback = elementPalette.find((p) => p.type === el.type);
  if (fallback) return fallback.label;

  if (el.action && el.action !== "none" && ACTION_NAMED_TYPES.has(el.type)) {
    const actionName = actionLabels[el.action];
    if (actionName) return actionName;
  }

  return el.type;
}

/** Descripción del catálogo para tooltip (ej. «Nombre de la pantalla activa»). */
export function elementCatalogDescription(el: HubElement, surface?: HubElementSurface): string {
  const item = resolveElementPaletteItem(el, surface);
  if (item) return item.description;

  const fallback = elementPalette.find((p) => p.type === el.type);
  if (fallback) return fallback.description;

  return el.label?.trim() || el.type;
}
