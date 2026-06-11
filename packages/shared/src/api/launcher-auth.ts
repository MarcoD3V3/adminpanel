import type {
  ActivateResponse,
  GeneratedTokenResponse,
  LauncherAuthHeaders,
  LauncherTier,
  LoginResponse,
  VerifyResponse,
} from "../types/launcher-auth";

function apiUrl(apiBase: string, path: string): string {
  const base = apiBase.replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

function authHeaders(auth: LauncherAuthHeaders): HeadersInit {
  return {
    Authorization: auth.authorization,
    "X-Device-Id": auth.deviceId,
    "X-Device-Fingerprint": auth.fingerprint,
  };
}

const FETCH_TIMEOUT_MS = 12_000;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function loginLauncherAccount(
  apiBase: string,
  username: string,
  password: string,
  deviceId: string,
  fingerprint: string
): Promise<LoginResponse> {
  try {
    return await fetchJson<LoginResponse>(apiUrl(apiBase, "/api/launcher-auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, deviceId, fingerprint }),
    });
  } catch {
    return { success: false, error: "No se pudo conectar con el servidor (¿admin en :3000?)" };
  }
}

export type LauncherAccessSettingsResult = {
  testerModeEnabled: boolean;
  ok: boolean;
  status?: number;
};

export async function fetchLauncherAccessSettings(
  apiBase: string
): Promise<LauncherAccessSettingsResult> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(apiUrl(apiBase, "/api/launcher-auth/access-settings"), {
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { testerModeEnabled: false, ok: false, status: res.status };
    }
    const data = (await res.json()) as { testerModeEnabled?: boolean };
    return { testerModeEnabled: data.testerModeEnabled === true, ok: true, status: res.status };
  } catch {
    return { testerModeEnabled: false, ok: false };
  }
}

export async function activateLauncherToken(
  apiBase: string,
  activationToken: string,
  deviceId: string,
  fingerprint: string
): Promise<ActivateResponse> {
  try {
    return await fetchJson<ActivateResponse>(apiUrl(apiBase, "/api/launcher-auth/activate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: activationToken, deviceId, fingerprint }),
    });
  } catch {
    return { success: false, error: "No se pudo conectar con el servidor (¿admin en :3000?)" };
  }
}

export async function verifyLauncherSession(
  apiBase: string,
  auth: LauncherAuthHeaders
): Promise<VerifyResponse> {
  try {
    return await fetchJson<VerifyResponse>(apiUrl(apiBase, "/api/launcher-auth/verify"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(auth) },
    });
  } catch {
    return { valid: false, reason: "network" };
  }
}

export async function generateActivationTokenAdmin(
  apiBase: string,
  adminKey: string,
  label?: string
): Promise<GeneratedTokenResponse> {
  try {
    const res = await fetch(apiUrl(apiBase, "/api/launcher-auth/tokens"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
      body: JSON.stringify(label ? { label } : {}),
    });
    return (await res.json()) as GeneratedTokenResponse;
  } catch {
    return { success: false, error: "Error de red" };
  }
}

export async function listLauncherAuthAdmin(apiBase: string, adminKey: string) {
  const res = await fetch(apiUrl(apiBase, "/api/launcher-auth/tokens"), {
    headers: { "X-Admin-Key": adminKey },
  });
  if (!res.ok) throw new Error("No autorizado");
  return res.json() as Promise<{ tokens: unknown[]; sessions: unknown[] }>;
}

export async function revokeLauncherAuthAdmin(
  apiBase: string,
  adminKey: string,
  action: "revoke-token" | "revoke-session",
  id: string
) {
  const res = await fetch(apiUrl(apiBase, "/api/launcher-auth/tokens"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
    body: JSON.stringify({ action, id }),
  });
  return res.ok;
}

export { authHeaders };
