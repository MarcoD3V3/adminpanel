import { create } from "zustand";
import {
  activateLauncherToken,
  loginLauncherAccount,
  verifyLauncherSession,
  type LauncherAuthHeaders,
  type LauncherTier,
} from "@craftlauncher/shared";
import { ADMIN_API_URL } from "./config";
import * as storage from "./auth-storage";

const TIER_KEY = "cl_tier";
const USERNAME_KEY = "cl_username";
const DISPLAY_KEY = "cl_display_name";

function readCachedTier(): LauncherTier {
  const t = localStorage.getItem(TIER_KEY);
  return t === "premium" ? "premium" : "free";
}

function persistTier(tier: LauncherTier) {
  localStorage.setItem(TIER_KEY, tier);
}

function clearTier() {
  localStorage.removeItem(TIER_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(DISPLAY_KEY);
}

function persistProfile(username: string | null, displayName: string | null) {
  if (username) localStorage.setItem(USERNAME_KEY, username);
  else localStorage.removeItem(USERNAME_KEY);
  if (displayName) localStorage.setItem(DISPLAY_KEY, displayName);
  else localStorage.removeItem(DISPLAY_KEY);
}

function readCachedProfile() {
  return {
    username: localStorage.getItem(USERNAME_KEY),
    displayName: localStorage.getItem(DISPLAY_KEY),
  };
}

type AuthStatus = "checking" | "locked" | "ready";

interface AuthState {
  status: AuthStatus;
  error: string | null;
  authHeaders: LauncherAuthHeaders | null;
  tier: LauncherTier;
  isPremium: boolean;
  username: string | null;
  displayName: string | null;
  bootstrap: () => Promise<void>;
  loginWithCredentials: (username: string, password: string) => Promise<boolean>;
  activateWithToken: (activationToken: string) => Promise<boolean>;
  logout: () => void;
  invalidateSession: (message?: string) => void;
  resolveHeaders: (force?: boolean) => Promise<LauncherAuthHeaders | null>;
}

function reasonMessage(reason?: string): string {
  switch (reason) {
    case "expirada":
      return "La sesión expiró. Genera un token nuevo en Admin → Acceso Launcher.";
    case "dispositivo":
    case "huella":
      return "Este launcher no coincide con el dispositivo autorizado. Activa de nuevo.";
    case "desconocida":
      return "Sesión inválida. Pega un token nuevo de activación.";
    case "rate":
      return "Demasiadas verificaciones. Espera un momento.";
    case "network":
      return "No se pudo verificar la sesión. Comprueba que el admin esté en marcha.";
    case "sin_credenciales":
      return "Inicia sesión con tu cuenta de CraftLauncher.";
    default:
      return "Inicia sesión para continuar.";
  }
}

function applySessionReady(
  set: (partial: Partial<AuthState>) => void,
  headers: LauncherAuthHeaders,
  tier: LauncherTier,
  profile?: { username?: string; displayName?: string }
) {
  const username = profile?.username ?? readCachedProfile().username;
  const displayName = profile?.displayName ?? readCachedProfile().displayName ?? username;
  persistTier(tier);
  persistProfile(username ?? null, displayName ?? null);
  set({
    status: "ready",
    authHeaders: headers,
    tier,
    isPremium: tier === "premium",
    username: username ?? null,
    displayName: displayName ?? null,
    error: null,
  });
}

async function verifyWithDiskRetry(): Promise<{
  headers: LauncherAuthHeaders | null;
  result: Awaited<ReturnType<typeof verifyLauncherSession>>;
}> {
  await storage.hydrateAuthFromDisk();
  let headers = await storage.buildAuthHeaders();
  if (!headers) return { headers: null, result: { valid: false, reason: "sin_credenciales" } };

  let result = await verifyLauncherSession(ADMIN_API_URL, headers);
  if (result.valid || result.reason === "network" || result.reason === "rate") {
    return { headers, result };
  }

  await storage.hydrateAuthFromDisk();
  headers = await storage.buildAuthHeaders();
  if (!headers) return { headers: null, result };

  result = await verifyLauncherSession(ADMIN_API_URL, headers);
  return { headers, result };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "checking",
  error: null,
  authHeaders: null,
  tier: readCachedTier(),
  isPremium: readCachedTier() === "premium",
  username: readCachedProfile().username,
  displayName: readCachedProfile().displayName,

  invalidateSession: (message) => {
    storage.clearSession();
    clearTier();
    set({
      status: "locked",
      authHeaders: null,
      tier: "free",
      isPremium: false,
      username: null,
      displayName: null,
      error: message ?? "Sesión inválida. Vuelve a iniciar sesión.",
    });
  },

  logout: () => {
    storage.clearSession();
    clearTier();
    set({
      status: "locked",
      authHeaders: null,
      tier: "free",
      isPremium: false,
      username: null,
      displayName: null,
      error: null,
    });
  },

  resolveHeaders: async (force = false) => {
    if (!force) {
      const cached = get().authHeaders;
      if (cached) return cached;
    }
    const built = await storage.buildAuthHeaders();
    if (built) set({ authHeaders: built });
    else set({ authHeaders: null });
    return built;
  },

  bootstrap: async () => {
    set({ status: "checking", error: null });
    try {
      const { headers, result } = await verifyWithDiskRetry();
      if (!headers) {
        set({ status: "locked", authHeaders: null, error: reasonMessage() });
        return;
      }

      if (result.valid) {
        const session = storage.getSession();
        if (session && result.username) {
          await storage.setSession(session, { username: result.username });
        } else {
          await storage.ensureDiskBackup();
        }
        const cached = readCachedProfile();
        applySessionReady(set, headers, result.tier ?? "free", {
          username: result.username ?? cached.username ?? undefined,
          displayName: result.displayName ?? cached.displayName ?? cached.username ?? undefined,
        });
        return;
      }

      if (result.reason === "network" || result.reason === "rate") {
        const tier = result.tier ?? readCachedTier();
        const profile = readCachedProfile();
        applySessionReady(set, headers, tier, profile);
        return;
      }

      storage.clearSession();
      set({ status: "locked", authHeaders: null, error: reasonMessage(result.reason) });
    } catch (err) {
      console.error("[auth] bootstrap failed", err);
      set({
        status: "locked",
        authHeaders: null,
        error: "No se pudo verificar la sesión. ¿Está el admin en marcha (npm run dev)?",
      });
    }
  },

  loginWithCredentials: async (username, password) => {
    set({ error: null });
    const deviceId = storage.getOrCreateDeviceId();
    const fingerprint = await storage.getDeviceFingerprint();
    const result = await loginLauncherAccount(
      ADMIN_API_URL,
      username.trim(),
      password,
      deviceId,
      fingerprint
    );

    if (!result.success || !result.sessionToken) {
      set({ error: result.error ?? "Usuario o contraseña incorrectos" });
      return false;
    }

    const normalizedUsername = (result.username ?? username.trim()).toLowerCase();
    await storage.setSession(result.sessionToken, { username: normalizedUsername });
    const headers = await get().resolveHeaders(true);
    if (!headers) {
      set({ error: "No se pudo guardar la sesión local" });
      return false;
    }
    applySessionReady(set, headers, result.tier ?? "free", {
      username: normalizedUsername,
      displayName: username.trim(),
    });
    return true;
  },

  activateWithToken: async (activationToken) => {
    set({ error: null });
    const deviceId = storage.getOrCreateDeviceId();
    const fingerprint = await storage.getDeviceFingerprint();
    const result = await activateLauncherToken(
      ADMIN_API_URL,
      activationToken.trim(),
      deviceId,
      fingerprint
    );

    if (!result.success || !result.sessionToken) {
      set({ error: result.error ?? "Token incorrecto o ya usado" });
      return false;
    }

    await storage.setSession(result.sessionToken);
    const headers = await get().resolveHeaders(true);
    if (!headers) {
      set({ error: "No se pudo guardar la sesión" });
      return false;
    }
    applySessionReady(set, headers, result.tier ?? "free");
    return true;
  },
}));
