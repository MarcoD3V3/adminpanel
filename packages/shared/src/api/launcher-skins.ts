import type {
  LauncherAuthHeaders,
  PlayerSkinInfo,
  PlayerSkinRegistryEntry,
  PlayerSkinUploadResponse,
} from "../types/launcher-auth";
import { authHeaders } from "./launcher-auth";

function apiUrl(apiBase: string, path: string): string {
  const base = apiBase.replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

const FETCH_TIMEOUT_MS = 20_000;

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

export async function fetchPlayerSkin(
  apiBase: string,
  auth: LauncherAuthHeaders,
  opts?: { includeImage?: boolean }
): Promise<PlayerSkinInfo> {
  const q = opts?.includeImage ? "?include=image" : "";
  try {
    return await fetchJson<PlayerSkinInfo>(apiUrl(apiBase, `/api/launcher-auth/skins${q}`), {
      headers: authHeaders(auth),
    });
  } catch {
    return { hasSkin: false, error: "No se pudo conectar con el servidor" };
  }
}

export async function uploadPlayerSkin(
  apiBase: string,
  auth: LauncherAuthHeaders,
  imageDataUrl: string
): Promise<PlayerSkinUploadResponse> {
  try {
    return await fetchJson<PlayerSkinUploadResponse>(apiUrl(apiBase, "/api/launcher-auth/skins"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(auth) },
      body: JSON.stringify({ image: imageDataUrl }),
    });
  } catch {
    return { success: false, error: "No se pudo conectar con el servidor" };
  }
}

export async function deletePlayerSkin(
  apiBase: string,
  auth: LauncherAuthHeaders
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(apiUrl(apiBase, "/api/launcher-auth/skins"), {
      method: "DELETE",
      headers: authHeaders(auth),
    });
    return (await res.json()) as { success: boolean; error?: string };
  } catch {
    return { success: false, error: "No se pudo conectar con el servidor" };
  }
}

export async function fetchPlayerSkinRegistry(
  apiBase: string,
  auth: LauncherAuthHeaders
): Promise<{ entries: PlayerSkinRegistryEntry[] }> {
  try {
    return await fetchJson<{ entries: PlayerSkinRegistryEntry[] }>(
      apiUrl(apiBase, "/api/launcher-auth/skins?action=registry"),
      { headers: authHeaders(auth) }
    );
  } catch {
    return { entries: [] };
  }
}
