import type { ModCatalogTab } from "@craftlauncher/shared";
import { useLauncherDataStore } from "./launcher-data-store";

/** Normaliza pestañas del Hub Builder (p. ej. "textures") al catálogo real. */
export function normalizeModCatalogTab(raw: unknown): ModCatalogTab {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "textures" || s === "texturepacks" || s === "resourcepacks" || s === "texturas") {
    return "resourcepacks";
  }
  if (s === "modpacks" || s === "modpack") return "modpacks";
  if (s === "mods" || s === "mod") return "mods";
  if (s === "featured" || s === "destacados") return "featured";
  return "mods";
}

export function applyModsCatalogFromScript(data: unknown) {
  if (!data || typeof data !== "object") return;
  const payload = data as { tab?: unknown; query?: unknown };
  const store = useLauncherDataStore.getState();

  if (payload.tab !== undefined) {
    store.setModTab(normalizeModCatalogTab(payload.tab));
  }

  if (payload.query !== undefined) {
    const q = String(payload.query ?? "");
    useLauncherDataStore.setState({ modQuery: q });
    if (store.modTab !== "featured") {
      void store.searchMods(q);
    }
  }
}
