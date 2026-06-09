import type { HubLayout } from "@/types/hub-builder";

/** v2: layout en blanco por defecto (sin ventanas/elementos de fábrica) */
export const HUB_LAYOUT_STORAGE_KEY = "craftlauncher-hub-layout-v2";

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

export async function fetchHubLayoutFromApi(opts?: { timeoutMs?: number }): Promise<HubLayout | null> {
  const timeoutMs = opts?.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("/api/hub-builder", {
      cache: "no-store",
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
      body: JSON.stringify(layout),
    });
    return res.ok;
  } catch {
    return false;
  }
}
