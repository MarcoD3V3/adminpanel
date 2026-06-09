import { Search } from "lucide-react";
import { useEffect } from "react";
import type { HubElement } from "@craftlauncher/shared";
import { useLauncherDataStore } from "@/lib/launcher-data-store";
import { ensureModsBootstrapped } from "./mods-hub-bootstrap";

export function ModsInstalledSearchHub({ element }: { element?: HubElement }) {
  const query = useLauncherDataStore((s) => s.installedModsQuery);
  const setInstalledModsQuery = useLauncherDataStore((s) => s.setInstalledModsQuery);

  useEffect(() => {
    ensureModsBootstrapped();
  }, []);

  const placeholder = element?.label?.trim() || "Filtrar mods instalados…";

  return (
    <div className="installed-mods-mini-search-wrap">
      <Search size={13} className="installed-mods-mini-search-icon" aria-hidden />
      <input
        type="search"
        className="lp-input hub-search-field-input installed-mods-mini-search"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setInstalledModsQuery(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
