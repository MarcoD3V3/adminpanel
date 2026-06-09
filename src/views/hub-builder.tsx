"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { HubCanvas } from "@/components/hub-builder/HubCanvas";
import { HubEditorToolbar } from "@/components/hub-builder/HubEditorToolbar";
import { getHubSyncStatus } from "@/lib/hub-builder-persistence";
import { ElementPalette } from "@/components/hub-builder/ElementPalette";
import { HubElementOutlinePanel } from "@/components/hub-builder/HubElementOutlinePanel";
import { HubElementTreeBubble } from "@/components/hub-builder/HubElementTreeBubble";
import { ElementToolbar } from "@/components/hub-builder/ElementToolbar";
import { PropertiesPanel } from "@/components/hub-builder/PropertiesPanel";
import { HubContextMenu } from "@/components/hub-builder/HubContextMenu";
import { useHubBuilderShortcuts } from "@/components/hub-builder/useHubBuilderShortcuts";
import { useHubBuilderStore } from "@/lib/hub-builder-store";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Grid3X3 } from "lucide-react";
import { HubBuilderPreviewProvider } from "@/components/hub-builder/hub-builder-preview-context";
import { GAME_MENU_SCREEN_ID, exportGameUi } from "@/lib/game-ui-export";
import { GAME_LOADING_SCREEN_ID, exportLoadingUi } from "@/lib/loading-ui-export";
import { MinecraftVersionPicker } from "@/components/hub-builder/MinecraftVersionPicker";

const MINECRAFT_EDITOR_SCREEN_IDS = new Set([GAME_MENU_SCREEN_ID, GAME_LOADING_SCREEN_ID]);

const PALETTE_WIDTH_KEY = "hub-builder-palette-width";
const DEFAULT_PALETTE_WIDTH = 148;
const MIN_PALETTE_WIDTH = 120;
const MAX_PALETTE_WIDTH = 480;

function readStoredPaletteWidth(): number {
  if (typeof window === "undefined") return DEFAULT_PALETTE_WIDTH;
  const raw = window.localStorage.getItem(PALETTE_WIDTH_KEY);
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_PALETTE_WIDTH;
  return Math.min(MAX_PALETTE_WIDTH, Math.max(MIN_PALETTE_WIDTH, n));
}

export default function HubBuilderPage() {
  const pathname = usePathname();
  const isActivePage = pathname === "/hub-builder";
  const {
    layout,
    showGrid,
    zoom,
    autoFit,
    historyIndex,
    history,
    setShowGrid,
    setZoom,
    setAutoFit,
    undo,
    redo,
    resetLayout,
    saveLayout,
    loadSavedLayout,
    publishLayout,
    previewMode,
    setPreviewMode,
    editTarget,
    openGameMenuScreen,
    openLoadingScreen,
    setActiveScreen,
    minecraftEditVersion,
    storageHydrated,
    savedFingerprint,
    publishedFingerprint,
  } = useHubBuilderStore();

  const { needsSave, needsPublish } = useMemo(
    () =>
      getHubSyncStatus({
        layout,
        savedFingerprint,
        publishedFingerprint,
        storageHydrated,
      }),
    [layout, savedFingerprint, publishedFingerprint, storageHydrated]
  );

  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishError, setPublishError] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [gameApplied, setGameApplied] = useState(false);
  const [loadingApplied, setLoadingApplied] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [paletteWidth, setPaletteWidth] = useState(DEFAULT_PALETTE_WIDTH);
  const [resizingPalette, setResizingPalette] = useState(false);
  const paletteWidthRef = useRef(paletteWidth);

  useEffect(() => {
    setPaletteWidth(readStoredPaletteWidth());
  }, []);

  useEffect(() => {
    paletteWidthRef.current = paletteWidth;
  }, [paletteWidth]);

  const startPaletteResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = paletteWidthRef.current;
    setResizingPalette(true);

    const onMove = (ev: PointerEvent) => {
      const next = Math.min(
        MAX_PALETTE_WIDTH,
        Math.max(MIN_PALETTE_WIDTH, startWidth + (ev.clientX - startX))
      );
      paletteWidthRef.current = next;
      setPaletteWidth(next);
    };

    const onUp = () => {
      setResizingPalette(false);
      window.localStorage.setItem(PALETTE_WIDTH_KEY, String(paletteWidthRef.current));
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  useEffect(() => {
    if (!isActivePage) return;
    void loadSavedLayout();
  }, [isActivePage, loadSavedLayout]);

  // Si la hidratación falla o queda colgada, reintenta sin bloquear toda la sesión.
  useEffect(() => {
    if (!isActivePage || storageHydrated) return;
    const watchdog = window.setTimeout(() => {
      if (!useHubBuilderStore.getState().storageHydrated) {
        void useHubBuilderStore.getState().loadSavedLayout();
      }
    }, 2500);
    return () => window.clearTimeout(watchdog);
  }, [isActivePage, storageHydrated, loadSavedLayout]);

  useEffect(() => {
    if (!previewMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewMode, setPreviewMode]);

  const handleSave = () => {
    const ok = saveLayout();
    setSaveError(!ok);
    setSaved(ok);
    if (ok) setTimeout(() => setSaved(false), 2000);
  };

  const handlePublish = async () => {
    setPublished(false);
    setPublishError(false);
    saveLayout();
    const ok = await publishLayout();
    if (ok) {
      setPublished(true);
      window.setTimeout(() => setPublished(false), 2200);
    } else {
      setPublishError(true);
      window.setTimeout(() => setPublishError(false), 2800);
    }
  };

  const handleSaveFile = async () => {
    const name = prompt("Nombre de archivo (ej: ajustes-v1)");
    if (!name) return;
    try {
      const res = await fetch("/api/hub-builder/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, layout }),
      });
      if (!res.ok) alert("No se pudo guardar el archivo");
      else alert("Guardado en data/hub-layouts/" + name.replace(/\\.json$/i, "") + ".json");
    } catch {
      alert("Error de red");
    }
  };

  const handleLoadFile = async () => {
    try {
      const listRes = await fetch("/api/hub-builder/files");
      const data = (await listRes.json()) as { files?: string[] };
      const files = data.files ?? [];
      const pick = prompt("Nombre a cargar:\n" + files.join("\n"));
      if (!pick) return;
      const res = await fetch(`/api/hub-builder/files/${encodeURIComponent(pick)}`);
      if (!res.ok) {
        alert("No se pudo cargar");
        return;
      }
      const loaded = (await res.json()) as typeof layout;
      useHubBuilderStore.setState({
        layout: loaded,
        history: [loaded],
        historyIndex: 0,
        selectedId: null,
        selectedIds: [],
        editSessionActive: false,
      } as never);
      alert("Cargado: " + pick);
    } catch {
      alert("Error de red");
    }
  };

  const handleDownloadCurrent = () => {
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hub-layout-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFit = () => {
    setAutoFit(true);
  };

  useHubBuilderShortcuts({ onSave: handleSave, disabled: previewMode });

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isActivePage || !storageHydrated || previewMode || !needsSave) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveLayout();
    }, 500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [isActivePage, storageHydrated, previewMode, needsSave, layout, saveLayout]);

  useEffect(() => {
    if (!isActivePage) return;
    const flushSilentSave = () => {
      const state = useHubBuilderStore.getState();
      if (!state.storageHydrated) return;
      if (getHubSyncStatus(state).needsSave) {
        state.saveLayout();
      }
    };
    const onPageHide = () => flushSilentSave();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushSilentSave();
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isActivePage]);

  const isGameMenu = layout.activeScreenId === GAME_MENU_SCREEN_ID;
  const isLoadingScreen = layout.activeScreenId === GAME_LOADING_SCREEN_ID;
  const isMinecraftEditor = isGameMenu || isLoadingScreen;
  const firstLauncherScreenId = layout.screens.find(
    (s) => !MINECRAFT_EDITOR_SCREEN_IDS.has(s.id)
  )?.id;
  const applyGameUi = async () => {
    try {
      const res = await fetch(`/api/game-ui?version=${encodeURIComponent(minecraftEditVersion)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportGameUi(layout)),
      });
      setGameApplied(res.ok);
      if (res.ok) setTimeout(() => setGameApplied(false), 2000);
    } catch {
      setGameApplied(false);
    }
  };
  const applyLoadingUi = async () => {
    try {
      const res = await fetch(`/api/loading-ui?version=${encodeURIComponent(minecraftEditVersion)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportLoadingUi(layout)),
      });
      setLoadingApplied(res.ok);
      if (res.ok) setTimeout(() => setLoadingApplied(false), 2000);
    } catch {
      setLoadingApplied(false);
    }
  };

  return (
    <HubBuilderPreviewProvider>
    <div className="flex h-[calc(100dvh)] max-h-[calc(100dvh)] flex-col overflow-hidden">
      {!previewMode && <HubContextMenu />}
      {!previewMode && <HubElementTreeBubble />}
      <HubEditorToolbar
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => setLeftOpen(!leftOpen)}
        onToggleRight={() => setRightOpen(!rightOpen)}
        showGrid={showGrid}
        onToggleGrid={setShowGrid}
        previewMode={previewMode}
        onTogglePreview={() => setPreviewMode(!previewMode)}
        autoFit={autoFit}
        onFit={handleFit}
        zoom={zoom}
        onZoomIn={() =>
          setZoom(zoom + (editTarget === "launcher-chrome" ? 0.15 : 0.05))
        }
        onZoomOut={() =>
          setZoom(zoom - (editTarget === "launcher-chrome" ? 0.15 : 0.05))
        }
        historyIndex={historyIndex}
        historyLength={history.length}
        onUndo={undo}
        onRedo={redo}
        onReset={resetLayout}
        showJson={showJson}
        onToggleJson={() => setShowJson(!showJson)}
        onSave={handleSave}
        onPublish={handlePublish}
        onSaveFile={handleSaveFile}
        onLoadFile={handleLoadFile}
        onDownloadJson={handleDownloadCurrent}
        saved={saved}
        saveError={saveError}
        published={published}
        publishError={publishError}
        publishing={publishing}
        needsSave={needsSave}
        needsPublish={needsPublish}
      />

      {/* Apartados del editor */}
      <div className="flex shrink-0 items-center gap-1 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-1.5">
        <button
          type="button"
          onClick={() => {
            if (isMinecraftEditor && firstLauncherScreenId) setActiveScreen(firstLauncherScreenId);
          }}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium",
            !isMinecraftEditor
              ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
              : "text-[var(--color-muted)] hover:text-[var(--color-text-soft)]"
          )}
        >
          Launcher (Hub)
        </button>
        <button
          type="button"
          onClick={() => openGameMenuScreen()}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium",
            isGameMenu
              ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
              : "text-[var(--color-muted)] hover:text-[var(--color-text-soft)]"
          )}
        >
          Menú del juego (Minecraft)
        </button>
        <button
          type="button"
          onClick={() => openLoadingScreen()}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium",
            isLoadingScreen
              ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
              : "text-[var(--color-muted)] hover:text-[var(--color-text-soft)]"
          )}
        >
          Pantalla de carga
        </button>
        {isMinecraftEditor && (
          <div className="ml-2 w-44">
            <MinecraftVersionPicker compact />
          </div>
        )}
        {isGameMenu && (
          <button
            type="button"
            onClick={() => void applyGameUi()}
            className="ml-auto rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
          >
            {gameApplied ? "Aplicado ✓" : "Aplicar al juego"}
          </button>
        )}
        {isLoadingScreen && (
          <button
            type="button"
            onClick={() => void applyLoadingUi()}
            className="ml-auto rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
          >
            {loadingApplied ? "Aplicado ✓" : "Aplicar al juego"}
          </button>
        )}
      </div>

      {/* Cinta de herramientas contextual — solo en modo edición */}
      {!previewMode && <ElementToolbar />}

      {/* Área principal — ocupa todo el alto restante */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Paleta izquierda */}
        {!previewMode && (
        <aside
          className={cn(
            "relative hidden shrink-0 flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-surface)] lg:flex",
            !resizingPalette && "transition-[width] duration-200",
            !leftOpen && "w-8"
          )}
          style={leftOpen ? { width: paletteWidth } : undefined}
        >
          {leftOpen ? (
            <>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
                <HubElementOutlinePanel />
                <div className="hub-scroll-hidden min-h-0 flex-1 overflow-y-auto pt-2">
                  <ElementPalette compact />
                </div>
              </div>
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Redimensionar paleta de componentes"
                title="Arrastra para cambiar el ancho"
                onPointerDown={startPaletteResize}
                className={cn(
                  "absolute right-0 top-0 z-20 h-full w-2 -translate-x-1/2 cursor-col-resize touch-none",
                  resizingPalette
                    ? "bg-[var(--color-accent)]/35"
                    : "bg-transparent hover:bg-[var(--color-accent)]/20"
                )}
              />
            </>
          ) : (
            <button
              type="button"
              onClick={() => setLeftOpen(true)}
              className="flex h-full w-full items-start justify-center pt-3 text-[var(--color-muted)] hover:text-[var(--color-text-soft)]"
              title="Abrir paleta"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
        </aside>
        )}

        {/* Canvas central */}
        <main className={cn("flex min-w-0 flex-1 flex-col overflow-hidden", previewMode ? "p-1" : "p-3")}>
          <div className="min-h-0 flex-1">
            {!storageHydrated ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[#0a0c0f] px-4 text-center text-xs text-[var(--color-muted)]">
                <span>Cargando editor…</span>
                <button
                  type="button"
                  onClick={() => void loadSavedLayout()}
                  className="rounded-lg border border-[var(--color-border-subtle)] px-3 py-1.5 text-[11px] text-[var(--color-text-soft)] hover:border-[var(--color-accent-muted)] hover:text-[var(--color-accent)]"
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <HubCanvas />
            )}
          </div>

          {showJson && !previewMode && (
            <pre className="mt-2 max-h-32 shrink-0 overflow-auto rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-3 text-[10px] text-[var(--color-text-soft)]">
              {JSON.stringify(layout, null, 2)}
            </pre>
          )}
        </main>

        {/* Propiedades derecha — scroll independiente */}
        {!previewMode && (
        <aside
          className={cn(
            "flex shrink-0 flex-col border-l border-[var(--color-border-subtle)] bg-[var(--color-surface)] transition-[width] duration-200",
            rightOpen ? "w-72" : "w-10"
          )}
        >
          {rightOpen ? (
            <>
              <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border-subtle)] px-3 py-2">
                <span className="text-xs font-medium text-[var(--color-text-soft)]">Propiedades</span>
                <button
                  type="button"
                  onClick={() => setRightOpen(false)}
                  className="rounded-lg p-1 text-[var(--color-muted)] hover:bg-[var(--color-surface-hover)]"
                  title="Ocultar panel"
                >
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <PropertiesPanel />
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setRightOpen(true)}
              className="flex h-full w-full items-start justify-center pt-3 text-[var(--color-muted)] hover:text-[var(--color-text-soft)]"
              title="Abrir propiedades"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
        </aside>
        )}
      </div>

      {/* Paleta móvil */}
      {!previewMode && (
      <div className="shrink-0 border-t border-[var(--color-border-subtle)] p-3 lg:hidden">
        <div className="mb-2 flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <Grid3X3 className="h-3.5 w-3.5" strokeWidth={1.5} /> Componentes
        </div>
        <div className="max-h-36 overflow-y-auto">
          <ElementPalette />
        </div>
      </div>
      )}
    </div>
    </HubBuilderPreviewProvider>
  );
}
