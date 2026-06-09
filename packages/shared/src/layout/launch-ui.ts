import type { HubLayout } from "../types/hub-layout";

/** Ventana de escritorio separada para descarga/lanzamiento (OFF por defecto). */
export function resolveLaunchDesktopWindow(layout: HubLayout | null | undefined): boolean {
  return Boolean(layout?.ui?.launchDesktopWindow);
}
