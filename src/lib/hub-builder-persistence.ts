import type { HubLayout } from "@/types/hub-builder";

/** v2: layout en blanco por defecto (sin ventanas/elementos de fábrica) */
export const HUB_LAYOUT_STORAGE_KEY = "craftlauncher-hub-layout-v2";
/** Borrador en servidor (data/hub-layouts/_autosave.json) */
export const HUB_LAYOUT_DRAFT_FILE = "_autosave";

function isHubLayout(value: unknown): value is HubLayout {
  if (!value || typeof value !== "object") return false;
  const v = value as HubLayout;
  return (
    typeof v.id === "string" &&
    typeof v.activeScreenId === "string" &&
    Array.isArray(v.screens) &&
    v.screens.length > 0 &&
    (v.window === undefined ||
      (v.window &&
        typeof v.window === "object" &&
        ((v.window as { width?: unknown }).width === undefined ||
          typeof (v.window as { width?: unknown }).width === "number") &&
        ((v.window as { height?: unknown }).height === undefined ||
          typeof (v.window as { height?: unknown }).height === "number") &&
        ((v.window as { lockSize?: unknown }).lockSize === undefined ||
          typeof (v.window as { lockSize?: unknown }).lockSize === "boolean") &&
        ((v.window as { borderlessFullscreen?: unknown }).borderlessFullscreen === undefined ||
          typeof (v.window as { borderlessFullscreen?: unknown }).borderlessFullscreen === "boolean"))) &&
    (v.ui === undefined ||
      (v.ui &&
        typeof v.ui === "object" &&
        ((v.ui as { screenTransition?: unknown }).screenTransition === undefined ||
          ["none", "fade", "slide"].includes(String((v.ui as { screenTransition?: unknown }).screenTransition))) &&
        ((v.ui as { transitionMs?: unknown }).transitionMs === undefined ||
          typeof (v.ui as { transitionMs?: unknown }).transitionMs === "number") &&
        ((v.ui as { performanceMode?: unknown }).performanceMode === undefined ||
          typeof (v.ui as { performanceMode?: unknown }).performanceMode === "boolean") &&
        ((v.ui as { rememberLastScreen?: unknown }).rememberLastScreen === undefined ||
          typeof (v.ui as { rememberLastScreen?: unknown }).rememberLastScreen === "boolean") &&
        ((v.ui as { smoothScroll?: unknown }).smoothScroll === undefined ||
          typeof (v.ui as { smoothScroll?: unknown }).smoothScroll === "boolean"))) &&
    v.screens.every(
      (s) =>
        typeof s.id === "string" &&
        typeof s.name === "string" &&
        Array.isArray(s.elements) &&
        (s.scroll === undefined || typeof s.scroll === "boolean")
    )
  );
}

/** Huella estable del layout (ignora `updatedAt`) para detectar cambios sin guardar/publicar. */
export function layoutFingerprint(layout: HubLayout): string {
  const copy = JSON.parse(JSON.stringify(layout)) as HubLayout;
  copy.updatedAt = "";
  return JSON.stringify(copy);
}

export function getHubSyncStatus(state: {
  layout: HubLayout;
  savedFingerprint: string | null;
  publishedFingerprint: string | null;
  storageHydrated: boolean;
}): { needsSave: boolean; needsPublish: boolean } {
  if (!state.storageHydrated) {
    return { needsSave: false, needsPublish: false };
  }
  const fp = layoutFingerprint(state.layout);
  return {
    needsSave: state.savedFingerprint === null || fp !== state.savedFingerprint,
    needsPublish:
      state.publishedFingerprint === null || fp !== state.publishedFingerprint,
  };
}

export function readHubLayoutFromStorage(): HubLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(HUB_LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isHubLayout(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeHubLayoutToStorage(layout: HubLayout): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(HUB_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    return true;
  } catch {
    return false;
  }
}

export function clearHubLayoutStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(HUB_LAYOUT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function layoutTimestamp(layout: HubLayout): number {
  const t = Date.parse(layout.updatedAt ?? "");
  return Number.isFinite(t) ? t : 0;
}

/** Elige el layout más reciente (local, borrador servidor o publicado). */
export function pickNewestHubLayout(
  ...candidates: (HubLayout | null | undefined)[]
): HubLayout | null {
  let best: HubLayout | null = null;
  let bestTs = -1;
  for (const layout of candidates) {
    if (!layout) continue;
    const ts = layoutTimestamp(layout);
    if (!best || ts >= bestTs) {
      best = layout;
      bestTs = ts;
    }
  }
  return best;
}

export async function fetchHubLayoutFromApi(opts?: { timeoutMs?: number }): Promise<HubLayout | null> {
  const timeoutMs = opts?.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("/api/hub-builder", {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { layout?: unknown };
    return isHubLayout(data.layout) ? data.layout : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function publishHubLayoutToApi(layout: HubLayout): Promise<boolean> {
  try {
    const res = await fetch("/api/hub-builder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(layout),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function saveHubLayoutDraftToApi(layout: HubLayout): Promise<boolean> {
  try {
    const res = await fetch("/api/hub-builder/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: HUB_LAYOUT_DRAFT_FILE, layout }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchHubLayoutDraftFromApi(): Promise<HubLayout | null> {
  try {
    const res = await fetch(`/api/hub-builder/files/${encodeURIComponent(HUB_LAYOUT_DRAFT_FILE)}`, {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { layout?: unknown; verified?: boolean };
    return data.verified && isHubLayout(data.layout) ? data.layout : null;
  } catch {
    return null;
  }
}

export async function verifyHubLayoutRaw(
  raw: string
): Promise<{ valid: boolean; layout?: HubLayout; error?: string; reason?: string }> {
  try {
    const res = await fetch("/api/hub-builder/verify-layout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    const data = (await res.json()) as {
      valid?: boolean;
      layout?: HubLayout;
      error?: string;
      reason?: string;
    };
    if (!res.ok || !data.valid || !data.layout) {
      return { valid: false, error: data.error ?? "Archivo no verificado", reason: data.reason };
    }
    return { valid: true, layout: data.layout };
  } catch {
    return { valid: false, error: "No se pudo contactar al servidor para verificar la firma" };
  }
}

export async function fetchSignedHubLayoutJson(layout: HubLayout): Promise<string | null> {
  try {
    const res = await fetch("/api/hub-builder/verify-layout", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { signedJson?: string };
    return data.signedJson ?? null;
  } catch {
    return null;
  }
}

export async function saveHubLayoutNamedFile(
  name: string,
  layout: HubLayout
): Promise<{ ok: boolean; signedJson?: string; error?: string }> {
  try {
    const res = await fetch("/api/hub-builder/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, layout }),
    });
    const data = (await res.json()) as { success?: boolean; signedJson?: string; error?: string };
    return { ok: res.ok && Boolean(data.success), signedJson: data.signedJson, error: data.error };
  } catch {
    return { ok: false, error: "Error de red" };
  }
}
