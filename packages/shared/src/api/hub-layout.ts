import type { HubLayout } from "../types/hub-layout";
import type { LauncherAuthHeaders } from "../types/launcher-auth";
import { isHubLayout } from "../layout/validate";
import { authHeaders } from "./launcher-auth";

export class LauncherAuthError extends Error {
  constructor() {
    super("Sesión del launcher inválida");
    this.name = "LauncherAuthError";
  }
}

export async function fetchHubLayout(
  apiBase: string,
  auth?: LauncherAuthHeaders
): Promise<HubLayout | null> {
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/hub-builder`, {
      cache: "no-store",
      headers: auth ? authHeaders(auth) : undefined,
    });
    if (res.status === 401) throw new LauncherAuthError();
    if (!res.ok) return null;
    const data = (await res.json()) as { layout?: unknown };
    return isHubLayout(data.layout) ? data.layout : null;
  } catch (err) {
    if (err instanceof LauncherAuthError) throw err;
    return null;
  }
}
export async function publishHubLayout(apiBase: string, layout: HubLayout): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/hub-builder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(layout),
    });
    return res.ok;
  } catch {
    return false;
  }
}
