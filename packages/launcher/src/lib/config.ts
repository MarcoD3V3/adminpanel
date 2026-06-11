function trimUrl(raw?: string): string {
  return raw?.trim().replace(/\/$/, "") ?? "";
}

/** Admin local (Next.js en tu PC). */
export const ADMIN_API_URL_LOCAL =
  trimUrl(import.meta.env.VITE_ADMIN_API_URL_LOCAL) || "http://localhost:3000";

/** Admin en producción (Railway, VPS, dominio propio). */
export const ADMIN_API_URL_PRODUCTION = trimUrl(import.meta.env.VITE_ADMIN_API_URL);

let activeAdminApiUrl = ADMIN_API_URL_PRODUCTION || ADMIN_API_URL_LOCAL;
let activeSource: "production" | "local" | "unset" = ADMIN_API_URL_PRODUCTION
  ? "production"
  : "local";

let resolvePromise: Promise<string> | null = null;

export function getAdminApiUrl(): string {
  return activeAdminApiUrl;
}

export function getAdminApiSource(): typeof activeSource {
  return activeSource;
}

async function pingAdmin(base: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`${base}/api/stats`, {
      signal: ctrl.signal,
      cache: "no-store",
    });
    window.clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

function preferLocalAdmin(): boolean {
  const pref = import.meta.env.VITE_ADMIN_API_PREFER_LOCAL;
  if (pref === "false") return false;
  if (pref === "true") return true;
  return import.meta.env.DEV;
}

/**
 * Elige el admin activo.
 * En desarrollo: local primero (tokens creados en tu PC no están en Railway).
 * En producción: producción primero, luego local como respaldo.
 */
export async function resolveAdminApiUrl(): Promise<string> {
  if (resolvePromise) return resolvePromise;

  resolvePromise = (async () => {
    const prod = ADMIN_API_URL_PRODUCTION;
    const local = ADMIN_API_URL_LOCAL;
    const order: Array<{ url: string; source: "production" | "local" }> = preferLocalAdmin()
      ? [
          ...(local ? [{ url: local, source: "local" as const }] : []),
          ...(prod && prod !== local ? [{ url: prod, source: "production" as const }] : []),
        ]
      : [
          ...(prod ? [{ url: prod, source: "production" as const }] : []),
          ...(local && local !== prod ? [{ url: local, source: "local" as const }] : []),
        ];

    for (const candidate of order) {
      if (await pingAdmin(candidate.url)) {
        activeAdminApiUrl = candidate.url;
        activeSource = candidate.source;
        console.info(`[CraftLauncher] API admin → ${candidate.source}:`, candidate.url);
        return candidate.url;
      }
    }

    activeAdminApiUrl = prod || local;
    activeSource = prod ? "production" : local ? "local" : "unset";
    console.warn(
      "[CraftLauncher] No hubo respuesta del admin; usando URL por defecto:",
      activeAdminApiUrl
    );
    return activeAdminApiUrl;
  })();

  return resolvePromise;
}

export const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001/ws";

export const LAUNCHER_ID = `launcher-${crypto.randomUUID().slice(0, 8)}`;
