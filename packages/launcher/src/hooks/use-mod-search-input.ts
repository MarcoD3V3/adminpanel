import { useCallback, useEffect, useRef } from "react";
import type { ModCatalogTab } from "@craftlauncher/shared";
import { useLauncherDataStore } from "@/lib/launcher-data-store";

const MOD_SEARCH_DEBOUNCE_MS = 400;

export function modSearchPlaceholder(tab: ModCatalogTab): string {
  if (tab === "featured") return "Destacados (sin búsqueda)";
  if (tab === "resourcepacks") return "Buscar texture packs…";
  if (tab === "modpacks") return "Buscar modpacks…";
  return "Buscar mods…";
}

/** Búsqueda al escribir (debounce) y al pulsar Enter. */
export function useModSearchInput() {
  const modQuery = useLauncherDataStore((s) => s.modQuery);
  const modTab = useLauncherDataStore((s) => s.modTab);
  const searchMods = useLauncherDataStore((s) => s.searchMods);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setQuery = useCallback(
    (value: string) => {
      useLauncherDataStore.setState({ modQuery: value });
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void searchMods(value);
      }, MOD_SEARCH_DEBOUNCE_MS);
    },
    [searchMods]
  );

  const submitSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    void searchMods(modQuery);
  }, [modQuery, searchMods]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  return { modQuery, modTab, placeholder: modSearchPlaceholder(modTab), setQuery, submitSearch };
}
