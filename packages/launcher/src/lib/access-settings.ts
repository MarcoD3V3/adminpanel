import { fetchLauncherAccessSettings } from "@craftlauncher/shared";
import { setCachedAccessSettings } from "./auth-api";
import { ADMIN_API_URL_LOCAL, getAdminApiUrl } from "./config";

export type LauncherAccessSettingsState = {
  testerModeEnabled: boolean;
  /** De dónde se leyó el flag de modo testeo */
  settingsSource: "primary" | "local-fallback" | "unavailable";
  /** El admin principal (p. ej. Railway) aún no tiene /access-settings desplegado */
  apiMissingOnPrimary?: boolean;
};

export async function loadLauncherAccessSettings(): Promise<LauncherAccessSettingsState> {
  const primary = getAdminApiUrl();
  const primaryResult = await fetchLauncherAccessSettings(primary);

  if (primaryResult.ok) {
    const state: LauncherAccessSettingsState = {
      testerModeEnabled: primaryResult.testerModeEnabled,
      settingsSource: "primary",
    };
    setCachedAccessSettings(state);
    return state;
  }

  const local = ADMIN_API_URL_LOCAL;
  if (import.meta.env.DEV && local && local.replace(/\/$/, "") !== primary.replace(/\/$/, "")) {
    const fallback = await fetchLauncherAccessSettings(local);
    if (fallback.ok) {
      const state: LauncherAccessSettingsState = {
        testerModeEnabled: fallback.testerModeEnabled,
        settingsSource: "local-fallback",
        apiMissingOnPrimary: primaryResult.status === 404,
      };
      setCachedAccessSettings(state);
      return state;
    }
  }

  const state: LauncherAccessSettingsState = {
    testerModeEnabled: false,
    settingsSource: "unavailable",
    apiMissingOnPrimary: primaryResult.status === 404,
  };
  setCachedAccessSettings(state);
  return state;
}

export function accessSettingsFootnote(state: LauncherAccessSettingsState): string | null {
  if (state.settingsSource === "local-fallback" && state.testerModeEnabled) {
    if (state.apiMissingOnPrimary) {
      return "Modo testeo activo en tu admin local. Railway aún no tiene esta función desplegada: usa npm run launcher:dev o despliega y activa allí.";
    }
    return `Tokens tester → admin local (${ADMIN_API_URL_LOCAL}). Hub y catálogo → producción.`;
  }
  if (state.settingsSource === "unavailable" && state.apiMissingOnPrimary) {
    return "El servidor de producción no tiene modo testeo desplegado. Despliega los últimos cambios en Railway o usa npm run launcher:dev.";
  }
  if (!state.testerModeEnabled && state.settingsSource === "primary") {
    return "Modo testeo desactivado en este servidor. Actívalo en Admin → Acceso Launcher (el mismo URL que aparece abajo).";
  }
  return null;
}
