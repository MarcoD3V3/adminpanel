import type { HubLayout, HubScreen } from "../types/hub-layout";

/** Altura aproximada de la barra superior en ventanas Hub secundarias. */
export const HUB_SCREEN_WINDOW_CHROME_H = 40;

export function screenUsesDesktopWindow(screen: HubScreen | null | undefined): boolean {
  return Boolean(screen?.desktopWindow);
}

export function findHubScreen(layout: HubLayout, screenId: string): HubScreen | null {
  return layout.screens.find((s) => s.id === screenId) ?? null;
}

export function parseHubScreenIdFromHash(hash: string): string | null {
  const raw = hash.replace(/^#/, "").trim();
  const m = raw.match(/^\/?hub-screen\/([^/?#]+)/i);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

export function hubScreenWindowHash(screenId: string): string {
  return `#/hub-screen/${encodeURIComponent(screenId)}`;
}
