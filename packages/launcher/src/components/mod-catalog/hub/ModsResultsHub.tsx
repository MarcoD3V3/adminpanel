import { useCallback, useEffect, useMemo, useRef } from "react";
import type { CurseForgeModSummary, FeaturedModpack, HubElement } from "@craftlauncher/shared";
import { hubGridStyle, resolveHubElementUi } from "@craftlauncher/shared";
import { Download, Lock } from "lucide-react";
import { useLauncherDataStore } from "@/lib/launcher-data-store";
import { useAuthStore } from "@/lib/auth-store";
import { modInstallBadge } from "@/lib/mod-install-status";
import { ModCatalogCard } from "../ModPreviewPane";
import { ensureModsBootstrapped } from "./mods-hub-bootstrap";
import { InfiniteScrollSentinel, useAutoFillScrollArea } from "@/hooks/use-infinite-scroll";

export function ModsResultsHub({ element }: { element?: HubElement }) {
  const gridStyle = useMemo(() => hubGridStyle(resolveHubElementUi(element ?? ({} as HubElement))), [element]);
  const modTab = useLauncherDataStore((s) => s.modTab);
  const loading = useLauncherDataStore((s) => s.loading);
  const error = useLauncherDataStore((s) => s.error);
  const modResults = useLauncherDataStore((s) => s.modResults);
  const modSearchHasMore = useLauncherDataStore((s) => s.modSearchHasMore);
  const modSearchLoadingMore = useLauncherDataStore((s) => s.modSearchLoadingMore);
  const loadMoreMods = useLauncherDataStore((s) => s.loadMoreMods);
  const featuredModpacks = useLauncherDataStore((s) => s.featuredModpacks);
  const gridRef = useRef<HTMLDivElement>(null);
  const installing = useLauncherDataStore((s) => s.installing);
  const modPreview = useLauncherDataStore((s) => s.modPreview);
  const installedMods = useLauncherDataStore((s) => s.installedMods);
  const isPremium = useAuthStore((s) => s.isPremium);

  useEffect(() => {
    ensureModsBootstrapped();
  }, []);

  useEffect(() => {
    const store = useLauncherDataStore.getState();
    if (modTab === "featured") void store.loadFeaturedModpacks();
    if (modTab !== "featured") {
      void store.searchMods(store.modQuery);
    }
  }, [modTab]);

  const selectedId = modPreview.mod?.id ?? null;
  const canInstallFeatured = (premiumOnly: boolean) => !premiumOnly || isPremium;

  const handleLoadMore = useCallback(() => {
    void loadMoreMods();
  }, [loadMoreMods]);

  const initialLoading = loading && modResults.length === 0;
  const canLoadMore = modTab !== "featured" && modSearchHasMore && !initialLoading && !modSearchLoadingMore;

  useAutoFillScrollArea(gridRef, handleLoadMore, {
    enabled: canLoadMore,
    deps: [modResults.length, modSearchHasMore, loading, modSearchLoadingMore],
  });

  if (error && modResults.length === 0) return <p className="lp-error lp-error-inline">{error}</p>;

  if (modTab === "featured") {
    return (
      <div className="mc-grid" style={gridStyle}>
        {featuredModpacks.map((pack: FeaturedModpack) => {
          const locked = !canInstallFeatured(pack.premiumOnly);
          return (
            <div key={pack.id} className={`mc-card mc-card-featured${locked ? " locked" : ""}`}>
              <div className="mc-card-body">
                <strong className="mc-card-name">
                  {pack.name}
                  {pack.premiumOnly && <span className="lp-premium-tag">Premium</span>}
                </strong>
                <p className="mc-card-summary">{pack.description.slice(0, 100)}</p>
                <small className="mc-card-meta">
                  {pack.mcVersion} · {pack.loader} · {pack.author}
                </small>
              </div>
              <div className="mc-card-actions">
                {pack.curseForgeId && (
                  <button
                    type="button"
                    className="lp-btn-sm"
                    onClick={() => void useLauncherDataStore.getState().loadModPreview(pack.curseForgeId)}
                  >
                    Ver
                  </button>
                )}
                <button
                  type="button"
                  className={`lp-btn-sm${locked ? " locked" : ""}`}
                  disabled={installing || !pack.curseForgeId || locked}
                  onClick={() => void useLauncherDataStore.getState().installFeatured(pack)}
                >
                  {locked ? (
                    <>
                      <Lock size={12} /> Premium
                    </>
                  ) : (
                    <>
                      <Download size={12} /> Instalar
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
        {!loading && featuredModpacks.length === 0 && (
          <p className="lp-empty">
            No hay modpacks destacados. Añádelos en Admin → Modpacks (activados y tipo modpack). El admin
            debe estar en marcha (npm run dev).
          </p>
        )}
      </div>
    );
  }

  return (
    <div ref={gridRef} className="mc-grid" style={{ ...gridStyle, width: "100%", minWidth: 0 }}>
      {initialLoading && (
        <p className="lp-status" style={{ gridColumn: "1 / -1" }}>
          Buscando en CurseForge…
        </p>
      )}
      {loading && modResults.length > 0 && (
        <p className="lp-status lp-status-inline" style={{ gridColumn: "1 / -1" }}>
          Actualizando resultados…
        </p>
      )}
      {modResults.map((mod) => (
        <ModCatalogCard
          key={mod.id}
          mod={mod}
          selected={selectedId === mod.id}
          badge={modInstallBadge(mod.id, installedMods)}
          onSelect={() => void useLauncherDataStore.getState().loadModPreview(mod.id, mod)}
        />
      ))}
      {modSearchLoadingMore && (
        <p className="lp-status" style={{ gridColumn: "1 / -1" }}>
          Cargando más resultados…
        </p>
      )}
      <InfiniteScrollSentinel onLoadMore={handleLoadMore} enabled={canLoadMore} />
      {!initialLoading && modResults.length === 0 && !error && (
        <p className="lp-empty" style={{ gridColumn: "1 / -1" }}>
          Sin resultados. Prueba otra búsqueda.
        </p>
      )}
    </div>
  );
}

