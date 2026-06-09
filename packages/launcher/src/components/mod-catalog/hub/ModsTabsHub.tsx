import { useEffect } from "react";
import type { ModCatalogTab } from "@craftlauncher/shared";
import { useLauncherDataStore } from "@/lib/launcher-data-store";
import { ensureModsBootstrapped } from "./mods-hub-bootstrap";

const TABS: { id: ModCatalogTab; label: string }[] = [
  { id: "mods", label: "Mods" },
  { id: "modpacks", label: "Modpacks" },
  { id: "resourcepacks", label: "Texturas" },
  { id: "featured", label: "Destacados" },
];

export function ModsTabsHub() {
  const tab = useLauncherDataStore((s) => s.modTab);

  useEffect(() => {
    ensureModsBootstrapped();
  }, []);

  return (
    <div className="lp-tabs">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={tab === t.id ? "lp-tab active" : "lp-tab"}
          onClick={() => useLauncherDataStore.getState().setModTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

