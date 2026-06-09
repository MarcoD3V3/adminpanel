import type { HubElement } from "../types/hub-layout";

/** Lista de IDs de ventana (coma-separados). Vacío = visible en todas. */
export const CHROME_VISIBLE_SCREENS_KEY = "CHROME_VISIBLE_SCREENS";

export function isNativeChromeElementType(type: string): boolean {
  return type.startsWith("chrome-");
}

export function parseChromeVisibleScreens(element: HubElement): string[] | null {
  const raw = element.logic?.constants?.[CHROME_VISIBLE_SCREENS_KEY];
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const ids = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : null;
}

export function formatChromeVisibleScreens(screenIds: string[]): string {
  return screenIds.filter(Boolean).join(",");
}

export function chromeElementVisibleOnScreen(element: HubElement, screenId: string): boolean {
  if (!element.visible) return false;
  const allowed = parseChromeVisibleScreens(element);
  if (!allowed) return true;
  return allowed.includes(screenId);
}
