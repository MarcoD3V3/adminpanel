import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useLauncherDataStore } from "@/lib/launcher-data-store";
import { InfiniteScrollSentinel } from "@/hooks/use-infinite-scroll";
import { ensureModsBootstrapped } from "./mods-hub-bootstrap";
import {
  InstalledModContextMenu,
  type InstalledModMenuAnchor,
} from "./InstalledModContextMenu";
import type { InstalledModRow } from "@/lib/electron-api";

function formatBytes(n: number) {
  if (!Number.isFinite(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function matchesInstalledModQuery(
  row: { displayName?: string; fileName: string },
  query: string
) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = (row.displayName ?? row.fileName).toLowerCase();
  return name.includes(q) || row.fileName.toLowerCase().includes(q);
}

export function ModsInstalledListHub() {
  const activeInstance = useLauncherDataStore((s) => s.activeInstance);
  const rows = useLauncherDataStore((s) => s.installedMods);
  const installedModsQuery = useLauncherDataStore((s) => s.installedModsQuery);
  const total = useLauncherDataStore((s) => s.installedModsTotal);
  const hasMore = useLauncherDataStore((s) => s.installedModsHasMore);
  const loading = useLauncherDataStore((s) => s.installedModsLoading);
  const refreshing = useLauncherDataStore((s) => s.installedModsRefreshing);
  const loadingMore = useLauncherDataStore((s) => s.installedModsLoadingMore);
  const refreshInstalledMods = useLauncherDataStore((s) => s.refreshInstalledMods);
  const loadMoreInstalledMods = useLauncherDataStore((s) => s.loadMoreInstalledMods);
  const deleteInstalledMod = useLauncherDataStore((s) => s.deleteInstalledMod);
  const updateInstalledMod = useLauncherDataStore((s) => s.updateInstalledMod);
  const setInstalledModEnabled = useLauncherDataStore((s) => s.setInstalledModEnabled);
  const loadInstalledModPreview = useLauncherDataStore((s) => s.loadInstalledModPreview);
  const selectedInstalledModFile = useLauncherDataStore((s) => s.selectedInstalledModFile);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<InstalledModMenuAnchor | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureModsBootstrapped();
  }, []);

  useEffect(() => {
    void refreshInstalledMods();
  }, [activeInstance?.id, refreshInstalledMods]);

  const handleLoadMore = useCallback(() => {
    void loadMoreInstalledMods();
  }, [loadMoreInstalledMods]);

  const closeMenu = useCallback(() => setMenuAnchor(null), []);

  const openMenu = useCallback((e: React.MouseEvent, row: InstalledModRow) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuAnchor({ x: e.clientX, y: e.clientY, row });
  }, []);

  const runBusyAction = useCallback((fileName: string, action: () => Promise<void>) => {
    setBusyFile(fileName);
    void action().finally(() => setBusyFile(null));
  }, []);

  const initialLoading = loading && rows.length === 0;
  const canLoadMore =
    Boolean(activeInstance) && hasMore && !initialLoading && !loadingMore && !busyFile;

  const sorted = useMemo(
    () =>
      [...rows]
        .sort((a, b) => (a.displayName ?? a.fileName).localeCompare(b.displayName ?? b.fileName))
        .filter((r) => matchesInstalledModQuery(r, installedModsQuery)),
    [rows, installedModsQuery]
  );

  const countLabel =
    installedModsQuery.trim() && total > 0
      ? `${sorted.length}/${total}`
      : total > 0
        ? `${rows.length}/${total}`
        : String(sorted.length);

  return (
    <div ref={scrollRef} className="hub-inner-scroll installed-mods-list" style={{ height: "100%", overflow: "auto" }}>
      <div className="installed-mods-list__header">
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <strong style={{ fontSize: 12, color: "#e8e9eb" }}>Mods instalados</strong>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{countLabel}</span>
        </div>
        <button
          type="button"
          className={`lp-btn-sm installed-mods-list__refresh${refreshing ? " is-refreshing" : ""}`}
          disabled={initialLoading || refreshing || Boolean(busyFile) || !activeInstance}
          onClick={() => void refreshInstalledMods({ checkUpdates: true })}
          title="Actualizar lista"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {!activeInstance && <p className="lp-empty">Selecciona un perfil activo.</p>}
      {activeInstance && initialLoading && <p className="lp-status">Cargando mods instalados…</p>}

      {activeInstance && !initialLoading && rows.length === 0 && (
        <p className="lp-empty">Aún no hay mods instalados en este perfil.</p>
      )}

      {activeInstance && !initialLoading && rows.length > 0 && sorted.length === 0 && (
        <p className="lp-empty">Ningún mod coincide con el filtro.</p>
      )}

      {activeInstance && !initialLoading && sorted.length > 0 && (
        <ul className="installed-mods-list__items">
          {sorted.map((r) => {
            const hasUpdate = Boolean(r.updateAvailable);
            return (
              <li
                key={r.fileName}
                className={[
                  "installed-mod-card",
                  r.disabled ? "installed-mod-card--disabled" : "",
                  selectedInstalledModFile === r.fileName ? "installed-mod-card--selected" : "",
                  menuAnchor?.row.fileName === r.fileName ? "installed-mod-card--menu-open" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onContextMenu={(e) => openMenu(e, r)}
              >
                <button
                  type="button"
                  className="installed-mod-card__hit"
                  onClick={() => {
                    closeMenu();
                    void loadInstalledModPreview(r);
                  }}
                  title="Clic: ver detalles · Clic derecho: opciones"
                >
                  <div className="installed-mod-card__main">
                    <div className="installed-mod-card__text" style={{ minWidth: 0 }}>
                      <div className="installed-mod-card__title-row">
                        <span className="installed-mod-card__title" title={r.fileName}>
                          {r.displayName ?? r.fileName}
                        </span>
                        {hasUpdate && !r.disabled && (
                          <span className="installed-mod-card__badge installed-mod-card__badge--update">
                            Actualización
                          </span>
                        )}
                        {r.disabled && (
                          <span className="installed-mod-card__badge installed-mod-card__badge--off">
                            Off
                          </span>
                        )}
                      </div>
                      {r.displayName && r.displayName !== r.fileName && (
                        <div className="installed-mod-card__file">{r.fileName}</div>
                      )}
                    </div>
                    <span className="installed-mod-card__size">{formatBytes(r.size)}</span>
                  </div>
                </button>
              </li>
            );
          })}
          {loadingMore && (
            <li className="lp-status installed-mods-list__loading-more">Cargando más mods…</li>
          )}
          <li style={{ listStyle: "none" }}>
            <InfiniteScrollSentinel onLoadMore={handleLoadMore} enabled={canLoadMore} />
          </li>
        </ul>
      )}

      <InstalledModContextMenu
        anchor={menuAnchor}
        busy={Boolean(busyFile)}
        onClose={closeMenu}
        onPreview={(row) => void loadInstalledModPreview(row)}
        onToggleEnabled={(fileName, disabled) =>
          runBusyAction(fileName, () => setInstalledModEnabled(fileName, disabled))
        }
        onUpdate={(fileName) => runBusyAction(fileName, () => updateInstalledMod(fileName))}
        onDelete={(fileName) => runBusyAction(fileName, () => deleteInstalledMod(fileName))}
      />
    </div>
  );
}
