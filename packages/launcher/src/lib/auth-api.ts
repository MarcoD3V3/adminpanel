import type { LauncherAccessSettingsState } from "./access-settings";
import { ADMIN_API_URL_LOCAL, getAdminApiUrl } from "./config";

const AUTH_API_BASE_KEY = "cl_auth_api_base";

let cachedAccessSettings: LauncherAccessSettingsState | null = null;

export function setCachedAccessSettings(state: LauncherAccessSettingsState): void {
  cachedAccessSettings = state;
}

export function getCachedAccessSettings(): LauncherAccessSettingsState | null {
  return cachedAccessSettings;
}

export function getStoredAuthApiBase(): string | null {
  const value = localStorage.getItem(AUTH_API_BASE_KEY)?.trim();
  return value || null;
}

export function setStoredAuthApiBase(url: string): void {
  localStorage.setItem(AUTH_API_BASE_KEY, url.replace(/\/$/, ""));
}

export function clearStoredAuthApiBase(): void {
  localStorage.removeItem(AUTH_API_BASE_KEY);
}

/** Verificación de sesión y login de cuenta → servidor donde se creó la sesión. */
export function resolveVerifyAuthApiUrl(): string {
  return getStoredAuthApiBase() ?? getAdminApiUrl();
}

/** Auth, Live Ops, notificaciones — mismo servidor que la sesión activa. */
export function getSessionAuthApiUrl(): string {
  return resolveVerifyAuthApiUrl();
}

/** Login con usuario/contraseña — en dev las cuentas viven en el admin local. */
export function resolveLoginAuthApiUrl(): string {
  if (import.meta.env.DEV) {
    return ADMIN_API_URL_LOCAL;
  }
  return getAdminApiUrl();
}

/**
 * Activación con token tester en dev: si el modo testeo solo existe en local,
 * validar el token contra el admin local aunque el hub use producción.
 */
export function resolveTokenActivationApiUrl(): string {
  const state = cachedAccessSettings;
  if (
    import.meta.env.DEV &&
    state?.settingsSource === "local-fallback" &&
    state.testerModeEnabled
  ) {
    return ADMIN_API_URL_LOCAL;
  }
  return getAdminApiUrl();
}

export function usesLocalTesterAuth(): boolean {
  const state = cachedAccessSettings;
  return (
    import.meta.env.DEV &&
    state?.settingsSource === "local-fallback" &&
    state.testerModeEnabled === true
  );
}
