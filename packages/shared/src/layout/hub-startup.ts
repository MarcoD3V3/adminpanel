import type { HubLayout } from "../types/hub-layout";

export const LAUNCHER_LAST_SCREEN_KEY = "craftlauncher-last-screen-v1";
export const LAUNCHER_FULL_RELOAD_KEY = "craftlauncher-full-reload-v1";

export function markLauncherFullReload(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(LAUNCHER_FULL_RELOAD_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function consumeLauncherFullReload(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const hit = sessionStorage.getItem(LAUNCHER_FULL_RELOAD_KEY);
    if (!hit) return false;
    sessionStorage.removeItem(LAUNCHER_FULL_RELOAD_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Pantalla que abre el launcher al iniciar (no la pestaña activa del editor). */
export function resolveHomeScreenId(layout: HubLayout): string {
  const exists = (id: string) => layout.screens.some((s) => s.id === id);
  const home = layout.ui?.homeScreenId?.trim();
  if (home && exists(home)) return home;
  if (exists("screen-home")) return "screen-home";
  return layout.screens[0]?.id ?? layout.activeScreenId;
}

/**
 * Pantalla inicial del launcher.
 * - Con "recordar última ventana": localStorage (sesión anterior).
 * - Si no: ventana principal (`ui.homeScreenId`), nunca la pestaña del editor.
 */
export function resolveLauncherStartupScreenId(
  layout: HubLayout,
  readLastScreen?: () => string | null
): string {
  if (layout.ui?.rememberLastScreen && readLastScreen) {
    try {
      const last = readLastScreen()?.trim();
      if (last && layout.screens.some((s) => s.id === last)) return last;
    } catch {
      /* ignore */
    }
  }
  return resolveHomeScreenId(layout);
}

export function isHomeScreen(layout: HubLayout, screenId: string): boolean {
  return resolveHomeScreenId(layout) === screenId;
}
