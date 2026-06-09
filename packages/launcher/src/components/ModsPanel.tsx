import { Download, Lock, Search, User, X, AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FeaturedModpack, ModCatalogTab } from "@craftlauncher/shared";
import { useLauncherDataStore } from "@/lib/launcher-data-store";
import { useAuthStore } from "@/lib/auth-store";
import { getLauncherApi } from "@/lib/electron-api";
import { modInstallBadge } from "@/lib/mod-install-status";
import { ModCatalogCard, ModPreviewPane } from "./mod-catalog/ModPreviewPane";
import { InfiniteScrollSentinel, useAutoFillScrollArea } from "@/hooks/use-infinite-scroll";
import { useModSearchInput } from "@/hooks/use-mod-search-input";

const TABS: { id: ModCatalogTab; label: string }[] = [
  { id: "mods", label: "Mods" },
  { id: "modpacks", label: "Modpacks" },
  { id: "resourcepacks", label: "Texturas" },
  { id: "featured", label: "Destacados" },
];

export function ModsPanel() {
  const close = useLauncherDataStore((s) => s.closePanel);
  const { modQuery, placeholder, setQuery, submitSearch } = useModSearchInput();
  const modResults = useLauncherDataStore((s) => s.modResults);
  const modSearchHasMore = useLauncherDataStore((s) => s.modSearchHasMore);
  const modSearchLoadingMore = useLauncherDataStore((s) => s.modSearchLoadingMore);
  const loadMoreMods = useLauncherDataStore((s) => s.loadMoreMods);
  const modTab = useLauncherDataStore((s) => s.modTab);
  const catalogGridRef = useRef<HTMLDivElement>(null);
  const modPreview = useLauncherDataStore((s) => s.modPreview);
  const featuredModpacks = useLauncherDataStore((s) => s.featuredModpacks);
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
    <div className="lp-overlay" role="dialog" aria-modal="true">
      <div className="lp-panel lp-panel-catalog">
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
          <button type="button" className="lp-close" onClick={close} aria-label="Cerrar">
            <X size={16} />
          </button>
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
              <ol>
                <li>
                  Abre{" "}
                  <a href="https://console.curseforge.com/" target="_blank" rel="noreferrer">
                    console.curseforge.com
                  </a>
                </li>
                <li>Inicia sesión → menú <strong>API Keys</strong> → copia el token <strong>completo</strong></li>
                <li>
                  Si empieza por <code>$2a$10$</code>, déjalo — es el formato normal de console.curseforge.com
                </li>
                <li>Pégalo en <code>.env.local</code> como <code>CURSEFORGE_API_KEY=...</code> (sin comillas si puedes)</li>
                <li>Reinicia <code>npm run launcher:dev</code></li>
              </ol>
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
              {label}
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

        <div className="mc-layout">
          <div className="mc-catalog">
            {initialCatalogLoading && <p className="lp-status">Buscando en CurseForge…</p>}
            {loading && modResults.length > 0 && modTab !== "featured" && (
              <p className="lp-status lp-status-inline">Actualizando resultados…</p>
            )}

            {modTab === "featured" && (
              <div className="mc-grid">
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
                {!initialCatalogLoading && modResults.length === 0 && !error && (
                  <p className="lp-empty">Sin resultados. Prueba otra búsqueda.</p>
                )}
              </div>
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
    </div>
  );
}
