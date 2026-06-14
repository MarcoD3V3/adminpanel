import type { HubLayout } from "@/types/hub-builder";

/** URL del admin que guarda hub/perfiles (Railway). Si está definida, este servidor delega ahí. */
export function hubDataAuthorityUrl(): string | null {
  const raw = process.env.HUB_DATA_AUTHORITY_URL?.trim().replace(/\/$/, "");
  return raw || null;
}

export function usesRemoteHubData(): boolean {
  return Boolean(hubDataAuthorityUrl());
}

function adminKey(): string | null {
  const key = process.env.LAUNCHER_ADMIN_SECRET?.trim();
  return key && key.length >= 16 ? key : null;
}

async function authorityFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  const base = hubDataAuthorityUrl();
  const key = adminKey();
  if (!base || !key) return null;

  const headers = new Headers(init.headers);
  headers.set("X-Admin-Key", key);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    return await fetch(`${base}${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    return null;
  }
}

export async function remoteGetPublishedLayout(): Promise<HubLayout | null> {
  const res = await authorityFetch("/api/hub-builder");
  if (!res?.ok) return null;
  try {
    const data = (await res.json()) as { layout?: HubLayout };
    return data.layout ?? null;
  } catch {
    return null;
  }
}

export async function remoteGetLayoutFile(name: string): Promise<{
  layout: HubLayout | null;
  verified: boolean;
}> {
  const res = await authorityFetch(`/api/hub-builder/files/${encodeURIComponent(name)}`);
  if (!res?.ok) return { layout: null, verified: false };
  try {
    const data = (await res.json()) as { layout?: HubLayout; verified?: boolean };
    return { layout: data.layout ?? null, verified: Boolean(data.verified) };
  } catch {
    return { layout: null, verified: false };
  }
}

export async function remoteSaveLayoutFile(name: string, layout: HubLayout): Promise<boolean> {
  const res = await authorityFetch("/api/hub-builder/files", {
    method: "POST",
    body: JSON.stringify({ name, layout }),
  });
  return Boolean(res?.ok);
}

export async function remotePublishLayout(layout: HubLayout): Promise<boolean> {
  const res = await authorityFetch("/api/hub-builder", {
    method: "POST",
    body: JSON.stringify(layout),
  });
  return Boolean(res?.ok);
}

export async function remoteHubLockGet(editorId: string): Promise<Response | null> {
  return authorityFetch(`/api/hub-builder/lock?editorId=${encodeURIComponent(editorId)}`);
}

export async function remoteHubLockPost(body: unknown): Promise<Response | null> {
  return authorityFetch("/api/hub-builder/lock", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function remoteHubLockDelete(editorId: string): Promise<Response | null> {
  return authorityFetch(`/api/hub-builder/lock?editorId=${encodeURIComponent(editorId)}`, {
    method: "DELETE",
  });
}
