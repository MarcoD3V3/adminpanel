import { Download, Lock, Search, User, AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CurseForgeModSummary, FeaturedModpack, ModCatalogTab } from "@craftlauncher/shared";
import { useLauncherDataStore } from "@/lib/launcher-data-store";
import { useAuthStore } from "@/lib/auth-store";
import { getLauncherApi } from "@/lib/electron-api";
import { modInstallBadge } from "@/lib/mod-install-status";
import { ModCatalogCard, ModPreviewPane } from "./ModPreviewPane";
import { InfiniteScrollSentinel, useAutoFillScrollArea } from "@/hooks/use-infinite-scroll";
import { useModSearchInput } from "@/hooks/use-mod-search-input";

const TABS: { id: ModCatalogTab; label: string }[] = [
  { id: "mods", label: "Mods" },
  { id: "modpacks", label: "Modpacks" },
  { id: "resourcepacks", label: "Texturas" },
  { id: "featured", label: "featured" },
];

export function ModsCatalogSurface() {
  const { modQuery, placeholder, setQuery, submitSearch } = useModSearchInput();
  const modResults = useLauncherDataStore((s) => s.modResults);
  const modSearchHasMore = useLauncherDataStore((s) => s.modSearchHasMore);
  const modSearchLoadingMore = useLauncherDataStore((s) => s.modSearchLoadingMore);
  const loadMoreMods = useLauncherDataStore((s) => s.loadMoreMods);
  const modTab = useLauncherDataStore((s) => s.modTab);
  const catalogGridRef = useRef<HTMLDivElement>(null);
  const modPreview = useLauncherDataStore((s) => s.modPreview);
  const featuredModpacks = useLauncherDataStore((s) => s.featuredModpacks);
  const curatedMods = useLauncherDataStore((s) => s.curatedMods);
  const tabHasUpdate = useLauncherDataStore((s) => s.tabHasUpdate);
  const featuredTabLabel = useLauncherDataStore((s) => s.featuredTabLabel);
  const activeInstance = useLauncherDataStore((s) => s.activeInstance);
  const loading = useLauncherDataStore((s) => s.loading);
  const installing = useLauncherDataStore((s) => s.installing);
  const error = useLauncherDataStore((s) => s.error);
  const installLogs = useLauncherDataStore((s) => s.installLogs);
  const installedMods = useLauncherDataStore((s) => s.installedMods);
  const isPremium = useAuthStore((s) => s.isPremium);
  const [cfKeyWarning, setCfKeyWarning] = useState<string | null>(null);

  useEffect(() => {
    void useLauncherDataStore.getState().bootstrap();
    void useLauncherDataStore.getState().loadFeaturedModpacks();
    void getLauncherApi()?.curseForgeStatus?.().then((s) => {
      if (s && !s.ok) setCfKeyWarning(s.message);
    });
  }, []);

  const selectedId = modPreview.mod?.id ?? null;
  const canInstallFeatured = (premiumOnly: boolean) => !premiumOnly || isPremium;

  const handleLoadMore = useCallback(() => {
    void loadMoreMods();
  }, [loadMoreMods]);

  const initialCatalogLoading = loading && modResults.length === 0;
  const canLoadMore = modTab !== "featured" && modSearchHasMore && !initialCatalogLoading && !modSearchLoadingMore;

  useAutoFillScrollArea(catalogGridRef, handleLoadMore, {
    enabled: canLoadMore,
    deps: [modResults.length, modSearchHasMore, loading, modSearchLoadingMore],
  });

  const curatedSummaries = useMemo((): CurseForgeModSummary[] => {
    return curatedMods
      .filter((m) => m.curseForgeId)
      .map((p) => ({
        id: p.curseForgeId!,
        name: p.name,
        slug: p.curseForgeSlug ?? p.id,
        summary: p.description,
        downloadCount: p.downloads ?? 0,
        authors: [p.author],
        categories: [p.loader, p.mcVersion],
      }));
  }, [curatedMods]);

  const handleFeaturedClick = (pack: FeaturedModpack) => {
    if (!pack.curseForgeId) {
      useLauncherDataStore.setState({
        modPreview: {
          mod: {
            id: 0,
            name: pack.name,
            slug: pack.id,
            summary: pack.description,
            downloadCount: 0,
            authors: [pack.author],
            categories: [pack.loader, pack.mcVersion],
          },
          files: [],
          loading: false,
          error: "Sin ID CurseForge — solo instalable desde admin",
          filesWarning: null,
        },
      });
      return;
    }
    void useLauncherDataStore.getState().loadModPreview(pack.curseForgeId);
  };

  return (
    <div className="lp-panel lp-panel-catalog" style={{ width: "100%", maxHeight: "100%" }}>
      <header className="lp-header">
        <div>
          <h2 className="lp-title">Catálogo CurseForge</h2>
          <p className="lp-sub">
            {activeInstance ? (
              <>
                <User size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                Perfil activo: <strong>{activeInstance.name}</strong> · MC {activeInstance.mcVersion} ·{" "}
                {activeInstance.loader}
              </>
            ) : (
              "Selecciona un perfil en Perfiles → Mi perfil"
            )}
            {!isPremium && " · Cuenta free"}
          </p>
        </div>
      </header>

      {!isPremium && (
        <p className="lp-free-banner">
          Cuenta free: busca e instala <strong>mods, modpacks y texture packs</strong>. Los destacados premium
          requieren token premium.
        </p>
      )}

      {cfKeyWarning && (
        <div className="lp-cf-warning" role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>API key de CurseForge incorrecta</strong>
            <p>{cfKeyWarning}</p>
          </div>
        </div>
      )}

      <div className="lp-tabs">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={modTab === id ? "lp-tab active" : "lp-tab"}
            onClick={() => useLauncherDataStore.getState().setModTab(id)}
          >
            {id === "featured" ? featuredTabLabel : label}
            {id === "featured" && tabHasUpdate.featured ? (
              <span
                aria-label="Novedades"
                title="Novedades"
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  marginLeft: 6,
                  background: "var(--color-accent)",
                  verticalAlign: "middle",
                }}
              />
            ) : null}
          </button>
        ))}
      </div>

      {modTab !== "featured" && (
        <form
          className="lp-search"
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch();
          }}
        >
          <div className="lp-search-field">
            <Search size={14} className="lp-search-icon" aria-hidden />
            <input
              className="lp-input lp-search-input"
              placeholder={placeholder}
              value={modQuery}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </form>
      )}

      {error && !cfKeyWarning && <p className="lp-error lp-error-inline">{error}</p>}

      <div className="mc-layout" style={{ minHeight: 0 }}>
        <div className="mc-catalog" style={{ maxHeight: "unset" }}>
          {initialCatalogLoading && <p className="lp-status">Buscando en CurseForge…</p>}
          {loading && modResults.length > 0 && modTab !== "featured" && (
            <p className="lp-status lp-status-inline">Actualizando resultados…</p>
          )}

          {modTab === "featured" && (
            <div className="mc-grid">
              {/* Primero: mods curados */ }
              {curatedSummaries.map((mod) => (
                <ModCatalogCard
                  key={`featured-curated-${mod.id}`}
                  mod={mod}
                  selected={selectedId === mod.id}
                  badge={modInstallBadge(mod.id, installedMods)}
                  onSelect={() => void useLauncherDataStore.getState().loadModPreview(mod.id, mod)}
                />
              ))}
              {/* Luego: modpacks destacados */ }
              {featuredModpacks.map((pack) => {
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
                        <button type="button" className="lp-btn-sm" onClick={() => handleFeaturedClick(pack)}>
                          Ver
                        </button>
                      )}
                      <button
                        type="button"
                        className={`lp-btn-sm${locked ? " locked" : ""}`}
                        disabled={installing || !pack.curseForgeId || locked || Boolean(cfKeyWarning)}
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
                  Sin destacados. Configúralos en Admin → Modpacks y deja el admin corriendo (npm run dev).
                </p>
              )}
            </div>
          )}

          {modTab !== "featured" && (
            <>
              <div ref={catalogGridRef} className="mc-grid">
                {modResults.map((mod) => (
                  <ModCatalogCard
                    key={mod.id}
                    mod={mod}
                    selected={selectedId === mod.id}
                    badge={modInstallBadge(mod.id, installedMods)}
                    onSelect={() => void useLauncherDataStore.getState().loadModPreview(mod.id, mod)}
                  />
                ))}
                {modSearchLoadingMore && <p className="lp-status">Cargando más resultados…</p>}
                <InfiniteScrollSentinel onLoadMore={handleLoadMore} enabled={canLoadMore} />
              </div>
              {!initialCatalogLoading &&
                modResults.length === 0 &&
                !error && <p className="lp-empty">Sin resultados. Prueba otra búsqueda.</p>}
            </>
          )}
        </div>

        <ModPreviewPane
          tab={modTab}
          preview={modPreview}
          installing={installing}
          hasActiveInstance={Boolean(activeInstance)}
          installBlocked={Boolean(cfKeyWarning)}
          installedMods={installedMods}
          onClose={() => useLauncherDataStore.getState().clearModPreview()}
          onInstall={() => void useLauncherDataStore.getState().installPreview()}
        />
      </div>

      {installLogs.length > 0 && (
        <div className="lp-install-log">
          <p className="lp-install-log-title">Instalación</p>
          <div className="lp-install-log-body">
            {installLogs.slice(-6).map((log) => (
              <div key={log.id} className={`lp-log-line lp-log-${log.level}`}>
                <span className="lp-log-msg">{log.message}</span>
                {log.detail && <span className="lp-log-detail">{log.detail}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

