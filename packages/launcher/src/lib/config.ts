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

/**
 * Elige el admin activo: primero producción, si no responde → local.
 * Llamar una vez al arrancar el launcher (antes de auth/sync).
 */
export async function resolveAdminApiUrl(): Promise<string> {
  if (resolvePromise) return resolvePromise;

  resolvePromise = (async () => {
    const prod = ADMIN_API_URL_PRODUCTION;
    const local = ADMIN_API_URL_LOCAL;

    if (prod && (await pingAdmin(prod))) {
      activeAdminApiUrl = prod;
      activeSource = "production";
      console.info("[CraftLauncher] API admin → producción:", prod);
      return prod;
    }

    if (local && local !== prod && (await pingAdmin(local))) {
      activeAdminApiUrl = local;
      activeSource = "local";
      console.info("[CraftLauncher] API admin → local:", local);
      return local;
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
