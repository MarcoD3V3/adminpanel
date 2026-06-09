import type { HubElementAction, HubLayout } from "@/types/hub-builder";

const ACTION_SCREEN_IDS: Partial<Record<HubElementAction, string[]>> = {
  play: ["screen-play"],
  settings: ["screen-settings"],
  mods: ["screen-mods", "screen-modpacks"],
  news: ["screen-news"],
  profile: ["screen-profile"],
  chat: ["screen-chat"],
  store: ["screen-store"],
  instances: ["screen-instances", "screen-profiles"],
};

const ACTION_LABELS: Partial<Record<HubElementAction, string>> = {
  settings: "Ajustes",
  mods: "Modpacks",
  news: "Noticias",
  profile: "Perfil",
  skin: "Mi skin",
  chat: "Chat",
  store: "Tienda",
  instances: "Perfiles",
  back: "Volver atrás",
  play: "Juego",
};

export function resolveActionTargetScreen(
  action: HubElementAction,
  layout: HubLayout,
  targetScreenId?: string
): string | null {
  if (action === "open-screen") {
    if (targetScreenId && layout.screens.some((s) => s.id === targetScreenId)) {
      return targetScreenId;
    }
    return null;
  }

  if (action === "none" || action === "external" || action === "play" || action === "back") return null;

  const candidates = ACTION_SCREEN_IDS[action] ?? [];
  for (const id of candidates) {
    if (layout.screens.some((s) => s.id === id)) return id;
  }

  const keyword = action === "mods" ? "modpack" : action;
  const match = layout.screens.find((s) => {
    const id = s.id.toLowerCase();
    const name = s.name.toLowerCase();
    if (id.includes(keyword) || name.includes(keyword)) return true;
    if (action === "profile") {
      return (
        name === "perfil" ||
        name === "cuenta" ||
        /^(perfil|cuenta|profile|account)(\s|$|-)/i.test(name.trim())
      );
    }
    if (action === "settings") {
      return name === "ajustes" || name.includes("ajustes") || name.includes("settings");
    }
    if (action === "instances") {
      return name === "perfiles" || name.includes("perfiles") || name.includes("instances");
    }
    return false;
  });
  return match?.id ?? null;
}

export function actionFallbackLabel(action: HubElementAction): string {
  return ACTION_LABELS[action] ?? action;
}

const previewIntervals = new Map<string, ReturnType<typeof setInterval>>();

export function clearPreviewIntervals() {
  for (const timer of previewIntervals.values()) clearInterval(timer);
  previewIntervals.clear();
}

export function registerPreviewInterval(key: string, timer: ReturnType<typeof setInterval>) {
  const existing = previewIntervals.get(key);
  if (existing) clearInterval(existing);
  previewIntervals.set(key, timer);
}
