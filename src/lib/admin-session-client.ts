export const ADMIN_REMEMBER_STORAGE_KEY = "cl_admin_remember";
export const DEV_ADMIN_FALLBACK_KEY = "dev-insecure-admin-key-min16";

export function readAdminRememberPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(ADMIN_REMEMBER_STORAGE_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function writeAdminRememberPreference(remember: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ADMIN_REMEMBER_STORAGE_KEY, remember ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export async function fetchAdminSessionStatus() {
  const res = await fetch("/api/launcher-auth/admin/session", { credentials: "include" });
  if (!res.ok) {
    return { authenticated: false, configured: false, devFallbackActive: false };
  }
  return res.json() as Promise<{
    authenticated: boolean;
    configured: boolean;
    devFallbackActive?: boolean;
  }>;
}

export async function loginAdminSession(key: string, remember: boolean) {
  const res = await fetch("/api/launcher-auth/admin/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, remember }),
  });
  const data = (await res.json()) as { success?: boolean; error?: string };
  return { ok: res.ok && Boolean(data.success), error: data.error };
}

export async function logoutAdminSession() {
  await fetch("/api/launcher-auth/admin/login", { method: "DELETE", credentials: "include" });
}
