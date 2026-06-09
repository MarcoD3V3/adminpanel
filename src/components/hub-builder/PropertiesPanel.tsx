"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Eye, EyeOff, Lock, LockOpen, RefreshCw } from "lucide-react";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { HubSelect } from "@/components/ui/HubSelect";
import { Button } from "@/components/ui/Button";
import { actionLabels, LOGIC_ELEMENT_TYPES, LOGIC_SCRIPT_TEMPLATES } from "@/lib/hub-builder-data";
import {
  GRID_CONFIG_ELEMENT_TYPES,
  HUB_CONTENT_ALIGN_X_OPTIONS,
  HUB_CONTENT_ALIGN_Y_OPTIONS,
  HUB_ICON_ELEMENT_TYPES,
  HUB_SURFACE_BLEND_OPTIONS,
  HUB_SURFACE_BORDER_STYLE_OPTIONS,
  HUB_SURFACE_PRESET_OPTIONS,
  HUB_UI_CONSTANT_KEYS,
  CONTROL_STYLE_OPTIONS,
  TEXT_STYLE_OPTIONS,
  hubElementSupportsTextStyle,
  hubElementSupportsVisualStyle,
  hubStyleEditorConfigsForElement,
  INSTANCE_AVATAR_CONFIG_ELEMENT_TYPES,
  INSTANCE_AVATAR_ALIGN_OPTIONS,
  INSTANCE_AVATAR_DISTRIBUTE_OPTIONS,
  INSTANCE_AVATAR_LAYOUT_OPTIONS,
  INSTANCE_SORT_OPTIONS,
  resolveHubElementIconName,
  surfaceBoxPresetPatch,
  type HubSurfacePreset,
} from "@craftlauncher/shared";
import { IconPicker } from "@/components/hub-builder/IconPicker";
import { ElementTargetPickers } from "@/components/hub-builder/ElementTargetPickers";
import {
  collectHubRefTargets,
  countChromeCopiesById,
  findElementsByRef,
  HUB_BACKGROUND_CHROME_STYLE_OPTIONS,
  HUB_BACKGROUND_IMAGE_FIT_OPTIONS,
  HUB_CHROME_BLUR_STYLE_MODES,
  HUB_CHROME_OPACITY_STYLE_MODES,
  hubRefTargetOptions,
  hubScreenBackgroundStyle,
  resolveBackgroundChromeStyle,
  isVisibilityRuleElement,
  listPositionClassPeers,
  looksLikeDirectImageUrl,
  normalizeHubBackgroundImageUrl,
  normalizePositionClass,
  positionClassSurfaceLabel,
  resolveElementScreenId,
  resolveHubBackgroundImageUrl,
  resolvePositionClassSurface,
  ensureAccountProfileScreen,
  resolvePrimaryAccountScreen,
  usesVisibilityActionsEditor,
  getHubCssChildSuggestions,
  hubElementCssMatchKeys,
  serializeHubCssRaw,
  type ParsedHubAdvancedCss,
} from "@craftlauncher/shared";
import {
  collectRefIds,
  constantsToJson,
  isValidRefId,
  normalizeRefId,
  parseConstantsJson,
} from "@/lib/hub-logic-utils";
import { compileSimpleToHub, SIMPLE_SCRIPT_TEMPLATE } from "@/lib/hub-script-simple";
import { LogicScriptEditor } from "@/components/hub-builder/LogicScriptEditor";
import { HubAdvancedCssEditor } from "@/components/hub-builder/HubAdvancedCssEditor";
import { HubColorPicker } from "@/components/hub-builder/HubColorPicker";
import { HubNumberField, LauncherWindowSizeControls } from "@/components/hub-builder/WindowDimensionField";
import { useHubBuilderStore } from "@/lib/hub-builder-store";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PLAY_BG,
  DEFAULT_SURFACE_BG,
  DEFAULT_TEXT_COLOR,
  TEXT_COLOR_TYPES,
  useActiveScreen,
  useSelectedElement,
} from "@/components/hub-builder/hub-builder-hooks";
import {
  isScreenChromeVirtualId,
  parseScreenChromeVirtualId,
  resolveLauncherChromeWidth,
  resolveLayoutChromeHeight,
} from "@craftlauncher/shared";
import { SCRIPT_API_GROUPS, triggerLabel } from "@/lib/hub-script-runner";
import type { HubElement, HubElementAction, HubScreen, HubScriptMode, LogicTrigger } from "@/types/hub-builder";
import { GAME_MENU_SCREEN_ID, GAME_MENU_W, GAME_MENU_H } from "@/lib/game-ui-export";
import { GAME_LOADING_SCREEN_ID, GAME_LOADING_W, GAME_LOADING_H } from "@/lib/loading-ui-export";
import { GameMenuElementProperties } from "@/components/hub-builder/GameMenuElementProperties";
import { GameLoadingElementProperties } from "@/components/hub-builder/GameLoadingElementProperties";

function numOr(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function PropertySection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-[var(--color-border-subtle)]/70 pb-3 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-1.5 text-left"
      >
        <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-muted)]">
          {title}
        </span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-[var(--color-muted)] transition-transform", open && "rotate-180")}
          strokeWidth={1.5}
        />
      </button>
      {open && <div className="space-y-2 pt-0.5">{children}</div>}
    </section>
  );
}

function ToggleChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border text-[10px] transition-colors",
        active
          ? "border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
          : "border-[var(--color-border-subtle)] text-[var(--color-muted)] hover:border-[var(--color-border)] hover:text-[var(--color-text-soft)]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ScreenBackgroundPreview({ screen }: { screen: HubScreen }) {
  const url = normalizeHubBackgroundImageUrl(screen.backgroundImage);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  useEffect(() => {
    if (!url) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("idle");
    const probe = new Image();
    probe.onload = () => {
      if (!cancelled) setStatus("ok");
    };
    probe.onerror = () => {
      if (!cancelled) setStatus("error");
    };
    probe.src = resolveHubBackgroundImageUrl(url, "editor") ?? url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url) return null;

  return (
    <div className="space-y-1">
      <div
        className="h-20 w-full overflow-hidden rounded-lg border border-[var(--color-border-subtle)]"
        style={hubScreenBackgroundStyle(screen, "editor")}
        aria-hidden
      />
      {status === "error" && (
        <p className="text-[9px] leading-snug text-[var(--color-danger-text)]">
          No se pudo cargar la imagen. Usa un enlace directo a .jpg / .png / .webp (clic derecho → copiar
          dirección de imagen), o una ruta local como <span className="font-mono">/fondos/inicio.jpg</span> en{" "}
          <span className="font-mono">public/</span>.
        </p>
      )}
      {status === "ok" && (
        <p className="text-[9px] text-[var(--color-accent-muted)]">Vista previa del fondo cargada correctamente.</p>
      )}
      {url && !looksLikeDirectImageUrl(url) && status !== "ok" && (
        <p className="text-[9px] leading-snug text-[var(--color-muted)]">
          Parece una página web, no un archivo de imagen. En sitios como XtraFondos, abre el wallpaper y copia la URL
          de la imagen (termina en .jpg o .png).
        </p>
      )}
    </div>
  );
}

function ScreenProperties({ screen }: { screen: HubScreen }) {
  const layout = useHubBuilderStore((s) => s.layout);
  const updateScreen = useHubBuilderStore((s) => s.updateScreen);
  const setLauncherWindowSize = useHubBuilderStore((s) => s.setLauncherWindowSize);
  const duplicateScreen = useHubBuilderStore((s) => s.duplicateScreen);
  const removeScreen = useHubBuilderStore((s) => s.removeScreen);
  const isLauncherChrome = isScreenChromeVirtualId(screen.id);
  const chromeOwnerId = parseScreenChromeVirtualId(screen.id);
  const chromeOwnerName =
    chromeOwnerId != null
      ? layout.screens.find((s) => s.id === chromeOwnerId)?.name
      : undefined;
  const barWidth = resolveLauncherChromeWidth(layout);

  return (
    <div className="space-y-3">
      <PropertySection
        title={
          isLauncherChrome
            ? chromeOwnerName
              ? `Barra superior · ${chromeOwnerName}`
              : "Barra superior"
            : "Ventana"
        }
      >
        <Input compact label="Nombre" value={screen.name} onChange={(e) => updateScreen(screen.id, { name: e.target.value })} />
        <Input compact label="ID script" value={screen.id} readOnly className="font-mono text-[10px] opacity-70" />
        {!isLauncherChrome && (
          <label className="flex flex-col gap-1 rounded-lg border border-[var(--color-accent-muted)]/40 bg-[var(--color-accent-soft)]/30 px-2 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium text-[var(--color-text-soft)]">
                Abrir en ventana aparte (escritorio)
              </span>
              <input
                type="checkbox"
                checked={Boolean(screen.desktopWindow)}
                onChange={(e) => updateScreen(screen.id, { desktopWindow: e.target.checked })}
              />
            </div>
            <p className="text-[9px] text-[var(--color-muted)]">
              Para botones con «Ir a ventana» hacia {screen.name}. No confundir con «al lanzar» (Jugar), que está más
              arriba en Launcher.
            </p>
          </label>
        )}
        {isLauncherChrome && (
          <p className="text-[10px] leading-snug text-[var(--color-muted)]">
            El ancho sigue la ventana del launcher ({barWidth}px). Cámbialo en «Ventana del launcher» arriba.
          </p>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          <HubNumberField
            label="Ancho"
            value={isLauncherChrome ? barWidth : screen.width}
            min={320}
            max={3840}
            step={10}
            onCommit={(w) => {
              if (isLauncherChrome) {
                setLauncherWindowSize({ width: w });
                return;
              }
              updateScreen(screen.id, { width: w });
            }}
          />
          <HubNumberField
            label="Alto"
            value={screen.height}
            min={240}
            max={2160}
            step={10}
            onCommit={(h) => updateScreen(screen.id, { height: h })}
          />
        </div>
        <HubColorPicker
          label="Color fondo"
          value={screen.backgroundColor ?? ""}
          fallback={DEFAULT_SURFACE_BG}
          onChange={(v) => updateScreen(screen.id, { backgroundColor: v ?? "" })}
        />
        {!isLauncherChrome && (
          <>
            <Input
              compact
              label="Imagen fondo"
              value={screen.backgroundImage ?? ""}
              onChange={(e) => {
                const next = normalizeHubBackgroundImageUrl(e.target.value);
                updateScreen(screen.id, { backgroundImage: next });
              }}
              placeholder="https://.../fondo.jpg o /mi-fondo.png"
            />
            <Select
              compact
              label="Ajuste del fondo"
              value={screen.backgroundImageFit ?? "cover"}
              onChange={(e) =>
                updateScreen(screen.id, {
                  backgroundImageFit: e.target.value as HubScreen["backgroundImageFit"],
                })
              }
              options={HUB_BACKGROUND_IMAGE_FIT_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
            />
            <Select
              compact
              label="Barra superior y fondo"
              value={screen.backgroundChromeStyle ?? "solid"}
              onChange={(e) =>
                updateScreen(screen.id, {
                  backgroundChromeStyle: e.target.value as HubScreen["backgroundChromeStyle"],
                })
              }
              options={HUB_BACKGROUND_CHROME_STYLE_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
            />
            {resolveBackgroundChromeStyle(screen) !== "solid" && (
              <>
                {HUB_CHROME_BLUR_STYLE_MODES.has(resolveBackgroundChromeStyle(screen)) && (
                  <HubNumberField
                    label="Desenfoque barra (px)"
                    value={screen.backgroundChromeBlur ?? 12}
                    min={0}
                    max={48}
                    step={1}
                    onCommit={(v) => updateScreen(screen.id, { backgroundChromeBlur: v })}
                  />
                )}
                {HUB_CHROME_OPACITY_STYLE_MODES.has(resolveBackgroundChromeStyle(screen)) && (
                  <HubNumberField
                    label="Intensidad velo (%)"
                    value={screen.backgroundChromeOpacity ?? 55}
                    min={0}
                    max={100}
                    step={5}
                    onCommit={(v) => updateScreen(screen.id, { backgroundChromeOpacity: v })}
                  />
                )}
              </>
            )}
            <ScreenBackgroundPreview screen={screen} />
            {screen.backgroundImage && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-full text-[10px] text-[var(--color-danger-text)]"
                onClick={() =>
                  updateScreen(screen.id, {
                    backgroundImage: undefined,
                    backgroundImageFit: undefined,
                    backgroundImagePosition: undefined,
                  })
                }
              >
                Quitar imagen de fondo
              </Button>
            )}
          </>
        )}
        <label className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)] px-2 py-2">
          <span className="text-[10px] font-medium text-[var(--color-text-soft)]">
            Scroll (ventana con desplazamiento)
          </span>
          <input
            type="checkbox"
            checked={Boolean(screen.scroll)}
            onChange={(e) => updateScreen(screen.id, { scroll: e.target.checked })}
          />
        </label>
        <div className="flex gap-1.5 pt-1">
          <Button size="sm" variant="secondary" className="flex-1 text-[10px]" onClick={() => duplicateScreen(screen.id)}>
            Duplicar
          </Button>
          {layout.screens.length > 1 && (
            <Button size="sm" variant="ghost" className="flex-1 text-[10px]" onClick={() => removeScreen(screen.id)}>
              Eliminar
            </Button>
          )}
        </div>
      </PropertySection>
    </div>
  );
}

function ElementPropertiesForm({ element, screen }: { element: HubElement; screen: HubScreen }) {
  const updateElement = useHubBuilderStore((s) => s.updateElement);
  const syncPositionClassFromElement = useHubBuilderStore((s) => s.syncPositionClassFromElement);
  const runElementLogic = useHubBuilderStore((s) => s.runElementLogic);
  const toggleVisible = useHubBuilderStore((s) => s.toggleVisible);
  const toggleLock = useHubBuilderStore((s) => s.toggleLock);
  const scriptConsole = useHubBuilderStore((s) => s.scriptConsole);
  const layout = useHubBuilderStore((s) => s.layout);
  const setActiveScreen = useHubBuilderStore((s) => s.setActiveScreen);
  const updateLayout = useHubBuilderStore((s) => s.updateLayout);
  const allScreens = layout.screens;
  const accountScreen = resolvePrimaryAccountScreen(layout);
  const activeElements = useHubBuilderStore((s) => s.getActiveScreen().elements);
  const refTargetOptions = useMemo(() => hubRefTargetOptions(collectHubRefTargets(layout)), [layout]);

  const [showApi, setShowApi] = useState(false);
  const [showAdvScript, setShowAdvScript] = useState(() => Boolean(element.logic?.script?.trim()));
  const [constantsRaw, setConstantsRaw] = useState(() => constantsToJson(element.logic?.constants));
  const [constantsError, setConstantsError] = useState<string | null>(null);
  const visibilityActionsUi = usesVisibilityActionsEditor(element);

  useEffect(() => {
    if (!visibilityActionsUi) setConstantsRaw(constantsToJson(element.logic?.constants));
    setConstantsError(null);
    setShowAdvScript(Boolean(element.logic?.script?.trim()));
  }, [element.id, element.logic?.constants, visibilityActionsUi]);

  const refIdNormalized = normalizeRefId(element.logic?.refId ?? "");
  const refInvalid = refIdNormalized.length > 0 && !isValidRefId(refIdNormalized);
  const refDuplicate = useMemo(() => {
    if (!refIdNormalized) return null;
    const hits = findElementsByRef(layout, refIdNormalized).filter((e) => e.id !== element.id);
    return hits[0] ?? null;
  }, [layout, refIdNormalized, element.id]);
  const positionClassNormalized = normalizePositionClass(element.positionClass ?? "") ?? "";
  const elementOwnerScreenId = useMemo(
    () => resolveElementScreenId(layout, element.id, layout.activeScreenId),
    [layout, element.id, layout.activeScreenId]
  );
  const positionClassSurface = useMemo(
    () => resolvePositionClassSurface(layout, element.id, layout.activeScreenId),
    [layout, element.id, layout.activeScreenId]
  );
  const positionClassPeers = useMemo(() => {
    if (!positionClassNormalized || !positionClassSurface) return [];
    return listPositionClassPeers(layout, positionClassNormalized, positionClassSurface, {
      excludeScreenId: elementOwnerScreenId ?? undefined,
      excludeElementId: element.id,
    });
  }, [layout, positionClassNormalized, positionClassSurface, element.id, elementOwnerScreenId]);
  const positionClassPeersOtherSurface = useMemo(() => {
    if (!positionClassNormalized || !positionClassSurface) return [];
    const other: "chrome" | "content" = positionClassSurface === "chrome" ? "content" : "chrome";
    return listPositionClassPeers(layout, positionClassNormalized, other);
  }, [layout, positionClassNormalized, positionClassSurface]);
  const chromeLinkedCopies = useMemo(() => {
    if (positionClassSurface !== "chrome") return 0;
    return countChromeCopiesById(layout, element.id);
  }, [layout, element.id, positionClassSurface]);
  const [positionClassSyncNote, setPositionClassSyncNote] = useState<string | null>(null);
  const availableRefs = useMemo(() => collectRefIds(screen), [screen]);

  useEffect(() => {
    setPositionClassSyncNote(null);
  }, [element.id, positionClassNormalized]);

  const patch = (data: Parameters<typeof updateElement>[1]) => updateElement(element.id, data);
  const bgFallback = element.type === "play-button" ? DEFAULT_PLAY_BG : DEFAULT_SURFACE_BG;
  const textFallback = DEFAULT_TEXT_COLOR;

  const applyStyle = (stylePatch: Partial<HubElement["style"]>) =>
    patch({ style: { ...element.style, ...stylePatch } });

  const patchSurface = (surfacePatch: Partial<NonNullable<HubElement["surface"]>>) =>
    patch({ surface: { ...element.surface, ...surfacePatch } });

  const parentMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const el of activeElements) {
      if (!el.parentId) continue;
      const arr = map.get(el.parentId) ?? [];
      arr.push(el.id);
      map.set(el.parentId, arr);
    }
    return map;
  }, [activeElements]);

  const isDescendantOf = useMemo(() => {
    const dfs = (candidateParentId: string, targetId: string) => {
      const kids = parentMap.get(candidateParentId) ?? [];
      for (const kidId of kids) {
        if (kidId === targetId) return true;
        if (dfs(kidId, targetId)) return true;
      }
      return false;
    };
    return dfs;
  }, [parentMap]);

  const cssChildSuggestions = useMemo(
    () => getHubCssChildSuggestions(element.id, activeElements),
    [element.id, activeElements]
  );

  const applyAdvancedCss = (result: ParsedHubAdvancedCss) => {
    patch({
      cssRaw: result.raw || undefined,
      css: Object.keys(result.self).length ? result.self : undefined,
      cssChildRules: Object.keys(result.childRules).length ? result.childRules : undefined,
      cssChildPseudo: Object.keys(result.childPseudo).length ? result.childPseudo : undefined,
      cssSelfPseudo: Object.keys(result.selfPseudo).length ? result.selfPseudo : undefined,
    });
  };

  const applyLogic = (logicPatch: Partial<NonNullable<HubElement["logic"]>>) =>
    patch({
      logic: {
        enabled: element.logic?.enabled ?? false,
        trigger: element.logic?.trigger ?? "click",
        script: element.logic?.script ?? "",
        ...element.logic,
        ...logicPatch,
      },
    });

  const showLogic =
    LOGIC_ELEMENT_TYPES.has(element.type) || Boolean(element.logic?.enabled || element.logic?.script);

  const saveConstants = (raw: string) => {
    setConstantsRaw(raw);
    const parsed = parseConstantsJson(raw);
    if (!parsed.ok) {
      setConstantsError(parsed.error ?? "Error");
      return;
    }
    setConstantsError(null);
    applyLogic({ constants: parsed.data });
  };

  const displayName = element.label?.trim() || element.type;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-[var(--color-text)]">Propiedades</p>
          <span className="shrink-0 rounded bg-[var(--color-surface-hover)] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[var(--color-muted)]">
            {element.type}
          </span>
        </div>
        <p className="line-clamp-2 text-[10px] leading-snug text-[var(--color-muted)]" title={displayName}>
          {displayName}
        </p>
      </div>


      <PropertySection title="General" defaultOpen>
        <Input
          compact
          label="ID"
          value={element.id}
          readOnly
          className="font-mono text-[10px] opacity-80"
        />
        {positionClassSurface === "chrome" && chromeLinkedCopies > 1 && (
          <p className="text-[9px] leading-snug text-[var(--color-muted)]">
            Este ID se repite en {chromeLinkedCopies} barras de ventana (comportamiento normal en la barra
            superior).
          </p>
        )}

        <Input
          compact
          label="Ref ID"
          value={element.logic?.refId ?? ""}
          onChange={(e) => {
            const raw = e.target.value.split(",")[0] ?? e.target.value;
            const next = normalizeRefId(raw);
            applyLogic({ refId: next || undefined });
          }}
          placeholder="btnJugar"
          className="font-mono text-[10px]"
        />
        {refInvalid && (
          <p className="text-[10px] text-[var(--color-danger-text)]">ID inválido — letras, números o _</p>
        )}
        {refDuplicate && (
          <p className="text-[10px] text-[var(--color-danger-text)]">
            Duplicado en el layout: &quot;{refDuplicate.label}&quot; — cada elemento debe tener Ref ID único
          </p>
        )}

        <Input
          compact
          label="Clase (sincroniza entre ventanas)"
          value={element.positionClass ?? ""}
          onChange={(e) => {
            const next = normalizePositionClass(e.target.value);
            patch({ positionClass: next });
          }}
          placeholder="header-btn-sync"
          className="font-mono text-[10px]"
        />
        <p className="text-[9px] leading-snug text-[var(--color-muted)]">
          Misma clase en la misma superficie comparte posición, tamaño, estilos, icono y apariencia. Superficies:{" "}
          <span className="font-mono">barra superior</span> o <span className="font-mono">contenido</span>.
          {positionClassSurface && (
            <>
              {" "}
              Este elemento está en{" "}
              <span className="text-[var(--color-text-soft)]">
                {positionClassSurfaceLabel(positionClassSurface)}
              </span>
              .
            </>
          )}
        </p>

        {positionClassNormalized && positionClassPeersOtherSurface.length > 0 && (
          <p className="text-[9px] leading-snug text-[var(--color-muted)]">
            Hay {positionClassPeersOtherSurface.length} con clase{" "}
            <span className="font-mono">{positionClassNormalized}</span> en la otra superficie (no se sincronizan
            desde aquí).
          </p>
        )}

        {positionClassPeers.length > 0 && (
          <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)]/50 px-2 py-1.5 text-[9px] text-[var(--color-text-soft)]">
            <span className="font-medium">Vinculados en esta superficie:</span>{" "}
            {positionClassPeers.length} en otra{positionClassPeers.length === 1 ? "" : "s"} ventana
            {positionClassPeers.length === 1 ? "" : "s"}
            <ul className="mt-1 space-y-0.5 text-[var(--color-muted)]">
              {positionClassPeers.slice(0, 6).map((peer) => (
                <li
                  key={`${peer.screenId}:${peer.element.id}`}
                  className="truncate"
                  title={`${peer.screenName} · ${peer.element.label || peer.element.type}`}
                >
                  · <span className="text-[var(--color-text-soft)]">{peer.screenName}</span>
                  {" — "}
                  <span className="font-mono">{peer.element.label?.trim() || peer.element.type}</span>
                </li>
              ))}
              {positionClassPeers.length > 6 && (
                <li className="text-[var(--color-muted)]">· +{positionClassPeers.length - 6} más</li>
              )}
            </ul>
          </div>
        )}

        <Button
          size="sm"
          variant="secondary"
          className="h-8 w-full text-[10px]"
          disabled={!positionClassNormalized || positionClassPeers.length === 0}
          onClick={() => {
            const count = syncPositionClassFromElement(element.id);
            if (count > 0) {
              setPositionClassSyncNote(
                `Apariencia aplicada a ${count} elemento${count === 1 ? "" : "s"} en la ${positionClassSurface ? positionClassSurfaceLabel(positionClassSurface) : "superficie"}.`
              );
            }
          }}
        >
          <RefreshCw className="mr-1.5 h-3 w-3" strokeWidth={1.5} />
          Aplicar a la clase
        </Button>
        {positionClassSyncNote && (
          <p className="text-[9px] text-[var(--color-accent-muted)]">{positionClassSyncNote}</p>
        )}

        <Input
          compact
          label="Grupo lógica"
          value={element.hubGroup ?? ""}
          onChange={(e) => {
            const g = e.target.value.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_.-]/g, "");
            patch({ hubGroup: g || undefined });
          }}
          placeholder="lanzamiento, perfil"
          className="font-mono text-[10px]"
        />
        <p className="text-[9px] leading-snug text-[var(--color-muted)]">
          Para reglas de visibilidad con <span className="font-mono">@group:nombre</span>.
        </p>

        <Input compact label="Etiqueta" value={element.label} onChange={(e) => patch({ label: e.target.value })} />

        {HUB_ICON_ELEMENT_TYPES.has(element.type) && (
          <div className="space-y-1">
            <IconPicker
              value={resolveHubElementIconName(element)}
              previewElement={element}
              onChange={(iconId) =>
                patch({
                  logic: {
                    enabled: element.logic?.enabled ?? false,
                    trigger: element.logic?.trigger ?? "click",
                    script: element.logic?.script ?? "",
                    ...element.logic,
                    constants: {
                      ...(element.logic?.constants ?? {}),
                      [HUB_UI_CONSTANT_KEYS.ICON_NAME]: iconId,
                    },
                  },
                })
              }
            />
          </div>
        )}

        <Select
          compact
          label="Dentro de (padre)"
          value={element.parentId ?? ""}
          onChange={(e) => patch({ parentId: e.target.value || undefined })}
          options={[
            { value: "", label: "Sin contenedor" },
            ...activeElements
              .filter((p) => {
                if (p.id === element.id) return false;
                // Evitar bucles: no puedes meter un elemento dentro de su propio hijo.
                if (isDescendantOf(element.id, p.id)) return false;
                return true;
              })
              .sort((a, b) => (a.label || a.type).localeCompare(b.label || b.type))
              .map((p) => {
                const prefix =
                  p.type === "container" || p.type === "surface-box" ? "📦" : "↳";
                const name = p.label?.trim() ? p.label.trim() : p.type;
                return { value: p.id, label: `${prefix} ${name}` };
              }),
          ]}
        />

        <div className="flex gap-1.5">
          <ToggleChip
            active={element.visible !== false}
            onClick={() => toggleVisible(element.id)}
            icon={
              element.visible !== false ? (
                <Eye className="h-3 w-3" strokeWidth={1.5} />
              ) : (
                <EyeOff className="h-3 w-3" strokeWidth={1.5} />
              )
            }
            label="Visible"
          />
          <ToggleChip
            active={element.locked}
            onClick={() => toggleLock(element.id)}
            icon={
              element.locked ? (
                <Lock className="h-3 w-3" strokeWidth={1.5} />
              ) : (
                <LockOpen className="h-3 w-3" strokeWidth={1.5} />
              )
            }
            label="Bloqueado"
          />
        </div>

        {(element.type === "image" || element.type === "banner" || element.type === "modpack-slot") && (
          <Input
            compact
            label="URL imagen"
            value={element.imageUrl ?? ""}
            onChange={(e) => patch({ imageUrl: e.target.value })}
            placeholder="https://..."
          />
        )}
      </PropertySection>

      <PropertySection title="CSS (avanzado)">
        <div className="text-[10px] text-[var(--color-muted)]">
          Estilos del elemento y de sus hijos. El CSS del hijo gana si define la misma propiedad. Usa{" "}
          <span className="font-mono">.ref</span>, <span className="font-mono">$ref</span> o{" "}
          <span className="font-mono">#ref</span> para apuntar a hijos.
        </div>

        <HubAdvancedCssEditor
          cssRaw={serializeHubCssRaw(element)}
          selfMatchKeys={hubElementCssMatchKeys(element)}
          childSuggestions={cssChildSuggestions}
          elementLabel={displayName}
          onApply={applyAdvancedCss}
        />
      </PropertySection>

      {(element.type === "container" || element.type === "surface-box") && (
        <PropertySection title={element.type === "surface-box" ? "Layout interno" : "Navbar / Contenedor"}>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 text-[10px]"
              onClick={() => {
                const order: NonNullable<HubElement["container"]>["display"][] = [
                  "absolute",
                  "flex",
                  "block",
                  "grid",
                  "inline-flex",
                ];
                const current = element.container?.display ?? "absolute";
                const idx = Math.max(0, order.indexOf(current));
                const next = order[(idx + 1) % order.length] ?? "absolute";
                patch({ container: { ...element.container, display: next } });
              }}
            >
              Cambiar display
            </Button>
          </div>

          <Select
            compact
            label="Display"
            value={element.container?.display ?? "absolute"}
            onChange={(e) =>
              patch({
                container: {
                  ...element.container,
                  display: e.target.value as NonNullable<HubElement["container"]>["display"],
                },
              })
            }
            options={[
              { value: "absolute", label: "absolute (libre)" },
              { value: "flex", label: "flex" },
              { value: "block", label: "block (columna)" },
              { value: "grid", label: "grid" },
              { value: "inline-flex", label: "inline-flex" },
            ]}
          />

          <Select
            compact
            label="Position"
            value={element.container?.position ?? "absolute"}
            onChange={(e) =>
              patch({
                container: {
                  ...element.container,
                  position: e.target.value as NonNullable<HubElement["container"]>["position"],
                },
              })
            }
            options={[
              { value: "absolute", label: "absolute" },
              { value: "fixed", label: "fixed" },
              { value: "sticky", label: "sticky (top)" },
            ]}
          />

          {(element.container?.position ?? "absolute") === "sticky" && (
            <HubNumberField
              label="Sticky top (px)"
              value={element.container?.stickyTop ?? 0}
              min={0}
              max={800}
              step={1}
              onCommit={(stickyTop) =>
                patch({
                  container: { ...element.container, stickyTop },
                })
              }
            />
          )}

          <div className="grid grid-cols-2 gap-1.5">
            <Select
              compact
              label="Direction"
              value={element.container?.direction ?? "row"}
              onChange={(e) =>
                patch({
                  container: {
                    ...element.container,
                    direction: e.target.value as NonNullable<HubElement["container"]>["direction"],
                  },
                })
              }
              options={[
                { value: "row", label: "row" },
                { value: "column", label: "column" },
              ]}
            />
            <Select
              compact
              label="Wrap"
              value={String(Boolean(element.container?.wrap ?? true))}
              onChange={(e) =>
                patch({
                  container: { ...element.container, wrap: e.target.value === "true" },
                })
              }
              options={[
                { value: "true", label: "wrap" },
                { value: "false", label: "nowrap" },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <Select
              compact
              label="Align"
              value={element.container?.align ?? "center"}
              onChange={(e) =>
                patch({
                  container: {
                    ...element.container,
                    align: e.target.value as NonNullable<HubElement["container"]>["align"],
                  },
                })
              }
              options={[
                { value: "start", label: "start" },
                { value: "center", label: "center" },
                { value: "end", label: "end" },
                { value: "stretch", label: "stretch" },
              ]}
            />
            <Select
              compact
              label="Justify"
              value={element.container?.justify ?? "start"}
              onChange={(e) =>
                patch({
                  container: {
                    ...element.container,
                    justify: e.target.value as NonNullable<HubElement["container"]>["justify"],
                  },
                })
              }
              options={[
                { value: "start", label: "start" },
                { value: "center", label: "center" },
                { value: "end", label: "end" },
                { value: "between", label: "space-between" },
                { value: "around", label: "space-around" },
                { value: "evenly", label: "space-evenly" },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <HubNumberField
              label="Gap"
              value={element.container?.gap ?? 10}
              min={0}
              max={200}
              step={1}
              onCommit={(gap) => patch({ container: { ...element.container, gap } })}
            />
            <HubNumberField
              label="Padding"
              value={element.container?.padding ?? 10}
              min={0}
              max={200}
              step={1}
              onCommit={(padding) => patch({ container: { ...element.container, padding } })}
            />
          </div>
        </PropertySection>
      )}

      <PropertySection title="Acción">
        <Select
          compact
          label="Al pulsar"
          value={element.action}
          onChange={(e) => {
            const action = e.target.value as HubElementAction;
            const data: Partial<HubElement> = { action };
            if (action === "open-screen" && !element.targetScreenId && allScreens[1]) {
              data.targetScreenId = allScreens[1].id;
            }
            if (action === "profile") {
              const ensured = ensureAccountProfileScreen(layout);
              updateLayout(ensured);
              const profileScreen = resolvePrimaryAccountScreen(ensured);
              if (profileScreen) setActiveScreen(profileScreen.id);
            }
            patch(data);
          }}
          options={Object.entries(actionLabels).map(([value, label]) => ({ value, label }))}
        />

        {(element.action === "open-screen" || element.action === "play") && (
          <Select
            compact
            label="Ventana destino"
            value={element.targetScreenId ?? ""}
            onChange={(e) => patch({ targetScreenId: e.target.value })}
            options={allScreens.map((s) => ({
              value: s.id,
              label: s.name.length > 18 ? `${s.name.slice(0, 16)}…` : s.name,
            }))}
          />
        )}

        {element.action === "external" && (
          <Input
            compact
            label="URL externa"
            value={element.externalUrl ?? ""}
            onChange={(e) => patch({ externalUrl: e.target.value })}
          />
        )}

        {element.action === "profile" && (
          <div className="space-y-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)]/40 px-2 py-2">
            <p className="text-[10px] leading-relaxed text-[var(--color-text-soft)]">
              Edita la ventana que se abre al pulsar en la pestaña{" "}
              <strong>{accountScreen?.name ?? "Perfil"}</strong> (icono de usuario en Ventanas).
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => {
                const ensured = ensureAccountProfileScreen(layout);
                updateLayout(ensured);
                const profileScreen = resolvePrimaryAccountScreen(ensured);
                if (profileScreen) setActiveScreen(profileScreen.id);
              }}
            >
              Ir a ventana Perfil
            </Button>
          </div>
        )}
      </PropertySection>

      <PropertySection title="Posición">
        <div className="grid grid-cols-2 gap-1.5">
          <HubNumberField
            label="X"
            value={element.x}
            min={0}
            max={4000}
            step={1}
            onCommit={(x) => patch({ x })}
          />
          <HubNumberField
            label="Y"
            value={element.y}
            min={0}
            max={4000}
            step={1}
            onCommit={(y) => patch({ y })}
          />
          <HubNumberField
            label="Ancho"
            value={element.width}
            min={24}
            max={4000}
            step={10}
            onCommit={(width) => patch({ width })}
          />
          <HubNumberField
            label="Alto"
            value={element.height}
            min={16}
            max={4000}
            step={10}
            onCommit={(height) => patch({ height })}
          />
        </div>
        <HubNumberField
          label="Capa (z-index)"
          value={element.zIndex}
          min={0}
          max={999}
          step={1}
          onCommit={(zIndex) => patch({ zIndex })}
        />
      </PropertySection>

      <PropertySection title="Estilo">
        {hubElementSupportsVisualStyle(element.type) && (
          <HubSelect
            compact
            label="Estilo visual"
            value={String(element.logic?.constants?.[HUB_UI_CONSTANT_KEYS.CONTROL_STYLE] ?? "1")}
            onChange={(next) =>
              applyLogic({
                constants: {
                  ...element.logic?.constants,
                  [HUB_UI_CONSTANT_KEYS.CONTROL_STYLE]: next,
                },
              })
            }
            options={CONTROL_STYLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        )}

        {hubElementSupportsTextStyle(element.type) && (
          <HubSelect
            compact
            label="Estilo del texto"
            value={String(element.logic?.constants?.[HUB_UI_CONSTANT_KEYS.TEXT_STYLE] ?? "1")}
            onChange={(next) =>
              applyLogic({
                constants: {
                  ...element.logic?.constants,
                  [HUB_UI_CONSTANT_KEYS.TEXT_STYLE]: next,
                },
              })
            }
            options={TEXT_STYLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        )}

        <div className="grid grid-cols-2 gap-1.5">
          <HubNumberField
            label="Texto px"
            value={element.style.fontSize ?? 13}
            min={8}
            max={72}
            step={1}
            onCommit={(fontSize) => applyStyle({ fontSize })}
          />
          <HubNumberField
            label="Radio"
            value={element.style.borderRadius ?? 10}
            min={0}
            max={100}
            step={1}
            onCommit={(borderRadius) => applyStyle({ borderRadius })}
          />
          <Select
            compact
            label="Peso"
            value={element.style.fontWeight ?? "normal"}
            onChange={(e) => applyStyle({ fontWeight: e.target.value as HubElement["style"]["fontWeight"] })}
            options={[
              { value: "normal", label: "Normal" },
              { value: "medium", label: "Medio" },
              { value: "bold", label: "Bold" },
            ]}
          />
        </div>

        <HubColorPicker
          label="Fondo"
          value={element.style.backgroundColor ?? ""}
          fallback={bgFallback}
          onChange={(v) => applyStyle({ backgroundColor: v })}
        />

        <div className="space-y-1.5 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)]/40 px-2 py-2">
          <p className="text-[10px] font-medium text-[var(--color-text-soft)]">Posición del contenido</p>
          <p className="text-[9px] leading-snug text-[var(--color-muted)]">
            Dónde se coloca lo de dentro respecto al tamaño del elemento (no mueve el elemento en el canvas).
            {INSTANCE_AVATAR_CONFIG_ELEMENT_TYPES.has(element.type)
              ? " En avatares también combina con Alineación y Distribución."
              : ""}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <Select
              compact
              label="Horizontal"
              value={element.style.contentAlignX ?? "center"}
              onChange={(e) =>
                applyStyle({
                  contentAlignX: e.target.value as HubElement["style"]["contentAlignX"],
                })
              }
              options={HUB_CONTENT_ALIGN_X_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <Select
              compact
              label="Vertical"
              value={element.style.contentAlignY ?? "center"}
              onChange={(e) =>
                applyStyle({
                  contentAlignY: e.target.value as HubElement["style"]["contentAlignY"],
                })
              }
              options={HUB_CONTENT_ALIGN_Y_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </div>
        </div>

        {TEXT_COLOR_TYPES.has(element.type) && (
          <HubColorPicker
            label="Texto"
            value={element.style.textColor ?? ""}
            fallback={textFallback}
            onChange={(v) => applyStyle({ textColor: v })}
            allowTransparent={false}
          />
        )}

        {(element.type === "slider" || element.type === "progress-bar") && (
          <HubNumberField
            label="Valor 0–100"
            value={typeof element.value === "number" ? element.value : 50}
            min={0}
            max={100}
            step={1}
            onCommit={(value) => patch({ value })}
          />
        )}
      </PropertySection>

      {element.type === "surface-box" && (
        <PropertySection title="Superficie (blur y efectos)">
          <p className="text-[9px] leading-snug text-[var(--color-muted)]">
            Combina con el color de fondo del bloque Estilo. El blur desenfoca lo que hay detrás del contenedor.
          </p>

          <Select
            compact
            label="Preset"
            value={element.surface?.preset ?? "custom"}
            onChange={(e) => {
              const preset = e.target.value as HubSurfacePreset;
              patch({ surface: surfaceBoxPresetPatch(preset) });
            }}
            options={HUB_SURFACE_PRESET_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />

          <div className="grid grid-cols-2 gap-1.5">
            <HubNumberField
              label="Blur fondo px"
              value={element.surface?.backdropBlur ?? 0}
              min={0}
              max={48}
              step={1}
              onCommit={(backdropBlur) => patchSurface({ backdropBlur, preset: "custom" })}
            />
            <HubNumberField
              label="Saturación %"
              value={element.surface?.backdropSaturate ?? 100}
              min={50}
              max={200}
              step={5}
              onCommit={(backdropSaturate) => patchSurface({ backdropSaturate, preset: "custom" })}
            />
            <HubNumberField
              label="Opacidad fondo %"
              value={element.surface?.backgroundOpacity ?? 100}
              min={0}
              max={100}
              step={1}
              onCommit={(backgroundOpacity) => patchSurface({ backgroundOpacity, preset: "custom" })}
            />
            <Select
              compact
              label="Mezcla"
              value={element.surface?.blendMode ?? "normal"}
              onChange={(e) =>
                patchSurface({
                  blendMode: e.target.value as NonNullable<HubElement["surface"]>["blendMode"],
                  preset: "custom",
                })
              }
              options={HUB_SURFACE_BLEND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <HubNumberField
              label="Borde px"
              value={element.surface?.borderWidth ?? 0}
              min={0}
              max={8}
              step={1}
              onCommit={(borderWidth) => patchSurface({ borderWidth, preset: "custom" })}
            />
            <Select
              compact
              label="Estilo borde"
              value={element.surface?.borderStyle ?? "solid"}
              onChange={(e) =>
                patchSurface({
                  borderStyle: e.target.value as NonNullable<HubElement["surface"]>["borderStyle"],
                  preset: "custom",
                })
              }
              options={HUB_SURFACE_BORDER_STYLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </div>

          <HubColorPicker
            label="Color borde"
            value={element.surface?.borderColor ?? ""}
            fallback="rgba(255,255,255,0.12)"
            onChange={(borderColor) => patchSurface({ borderColor, preset: "custom" })}
            allowTransparent
          />

          <p className="text-[10px] font-medium text-[var(--color-text-soft)]">Sombra</p>
          <div className="grid grid-cols-2 gap-1.5">
            <HubNumberField
              label="X px"
              value={element.surface?.shadowX ?? 0}
              min={-40}
              max={40}
              step={1}
              onCommit={(shadowX) => patchSurface({ shadowX, preset: "custom" })}
            />
            <HubNumberField
              label="Y px"
              value={element.surface?.shadowY ?? 0}
              min={-40}
              max={40}
              step={1}
              onCommit={(shadowY) => patchSurface({ shadowY, preset: "custom" })}
            />
            <HubNumberField
              label="Blur px"
              value={element.surface?.shadowBlur ?? 0}
              min={0}
              max={64}
              step={1}
              onCommit={(shadowBlur) => patchSurface({ shadowBlur, preset: "custom" })}
            />
            <HubNumberField
              label="Spread px"
              value={element.surface?.shadowSpread ?? 0}
              min={-24}
              max={24}
              step={1}
              onCommit={(shadowSpread) => patchSurface({ shadowSpread, preset: "custom" })}
            />
          </div>

          <HubColorPicker
            label="Color sombra"
            value={element.surface?.shadowColor ?? ""}
            fallback="rgba(0,0,0,0.35)"
            onChange={(shadowColor) => patchSurface({ shadowColor, preset: "custom" })}
            allowTransparent
          />

          <label className="flex items-center gap-2 text-[10px] text-[var(--color-text-soft)]">
            <input
              type="checkbox"
              checked={element.surface?.clipContent !== false}
              onChange={(e) => patchSurface({ clipContent: e.target.checked, preset: "custom" })}
              className="rounded border-[var(--color-border)]"
            />
            Recortar contenido al radio del contenedor
          </label>
        </PropertySection>
      )}

      <PropertySection title="Contenido y scroll">
        <HubNumberField
          label="Escala contenido %"
          value={Math.round(
            (Number(element.logic?.constants?.[HUB_UI_CONSTANT_KEYS.CONTENT_SCALE] ?? 1) || 1) * 100
          )}
          min={45}
          max={100}
          step={5}
          onCommit={(pct) =>
            applyLogic({
              constants: {
                ...element.logic?.constants,
                [HUB_UI_CONSTANT_KEYS.CONTENT_SCALE]: String(pct / 100),
              },
            })
          }
        />
        <label className="flex items-center gap-2 text-[10px] text-[var(--color-text-soft)]">
          <input
            type="checkbox"
            checked={element.logic?.constants?.[HUB_UI_CONSTANT_KEYS.HIDE_SCROLLBAR] === "true"}
            onChange={(e) =>
              applyLogic({
                constants: {
                  ...element.logic?.constants,
                  [HUB_UI_CONSTANT_KEYS.HIDE_SCROLLBAR]: e.target.checked ? "true" : "false",
                },
              })
            }
            className="rounded border-[var(--color-border)]"
          />
          Ocultar barra de scroll (sigue scrolleando)
        </label>

        {hubStyleEditorConfigsForElement(element.type).map((styleConfig) => (
          <Select
            key={styleConfig.constantKey}
            compact
            label={styleConfig.label}
            value={String(element.logic?.constants?.[styleConfig.constantKey] ?? "1")}
            onChange={(e) =>
              applyLogic({
                constants: {
                  ...element.logic?.constants,
                  [styleConfig.constantKey]: e.target.value,
                },
              })
            }
            options={styleConfig.options.map((o) => ({ value: o.value, label: o.label }))}
          />
        ))}

        {GRID_CONFIG_ELEMENT_TYPES.has(element.type) &&
          (element.type !== "instance-avatar-grid" ||
            element.logic?.constants?.[HUB_UI_CONSTANT_KEYS.AVATAR_LAYOUT] === "grid") && (
          <>
            <HubNumberField
              label="Columnas grid (0 = auto)"
              value={Number(element.logic?.constants?.[HUB_UI_CONSTANT_KEYS.GRID_COLUMNS] ?? 0) || 0}
              min={0}
              max={8}
              step={1}
              onCommit={(gridColumns) =>
                applyLogic({
                  constants: {
                    ...element.logic?.constants,
                    [HUB_UI_CONSTANT_KEYS.GRID_COLUMNS]: String(gridColumns),
                  },
                })
              }
            />
            <div className="grid grid-cols-2 gap-1.5">
              <HubNumberField
                label="Gap px"
                value={Number(element.logic?.constants?.[HUB_UI_CONSTANT_KEYS.GRID_GAP] ?? 8) || 8}
                min={2}
                max={32}
                step={1}
                onCommit={(gridGap) =>
                  applyLogic({
                    constants: {
                      ...element.logic?.constants,
                      [HUB_UI_CONSTANT_KEYS.GRID_GAP]: String(gridGap),
                    },
                  })
                }
              />
              <HubNumberField
                label="Ancho mín. tarjeta"
                value={Number(element.logic?.constants?.[HUB_UI_CONSTANT_KEYS.GRID_MIN_WIDTH] ?? 140) || 140}
                min={80}
                max={320}
                step={10}
                onCommit={(gridMinWidth) =>
                  applyLogic({
                    constants: {
                      ...element.logic?.constants,
                      [HUB_UI_CONSTANT_KEYS.GRID_MIN_WIDTH]: String(gridMinWidth),
                    },
                  })
                }
              />
            </div>
          </>
        )}

        {INSTANCE_AVATAR_CONFIG_ELEMENT_TYPES.has(element.type) && (
          <>
            <HubNumberField
              label="Tamaño avatar px (0 = auto)"
              value={Number(element.logic?.constants?.[HUB_UI_CONSTANT_KEYS.AVATAR_SIZE] ?? 0) || 0}
              min={0}
              max={128}
              step={4}
              onCommit={(avatarSize) =>
                applyLogic({
                  constants: {
                    ...element.logic?.constants,
                    [HUB_UI_CONSTANT_KEYS.AVATAR_SIZE]: String(avatarSize),
                  },
                })
              }
            />
            {element.type === "instance-avatar-grid" && (
              <>
                <Select
                  label="Disposición"
                  value={String(element.logic?.constants?.[HUB_UI_CONSTANT_KEYS.AVATAR_LAYOUT] ?? "column")}
                  onChange={(e) =>
                    applyLogic({
                      constants: {
                        ...element.logic?.constants,
                        [HUB_UI_CONSTANT_KEYS.AVATAR_LAYOUT]: e.target.value,
                      },
                    })
                  }
                  options={INSTANCE_AVATAR_LAYOUT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <Select
                    compact
                    label="Alineación ítems"
                    value={String(element.logic?.constants?.[HUB_UI_CONSTANT_KEYS.AVATAR_ITEM_ALIGN] ?? "center")}
                    onChange={(e) =>
                      applyLogic({
                        constants: {
                          ...element.logic?.constants,
                          [HUB_UI_CONSTANT_KEYS.AVATAR_ITEM_ALIGN]: e.target.value,
                        },
                      })
                    }
                    options={INSTANCE_AVATAR_ALIGN_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  />
                  <Select
                    compact
                    label="Distribución"
                    value={String(element.logic?.constants?.[HUB_UI_CONSTANT_KEYS.AVATAR_DISTRIBUTE] ?? "start")}
                    onChange={(e) =>
                      applyLogic({
                        constants: {
                          ...element.logic?.constants,
                          [HUB_UI_CONSTANT_KEYS.AVATAR_DISTRIBUTE]: e.target.value,
                        },
                      })
                    }
                    options={INSTANCE_AVATAR_DISTRIBUTE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  />
                </div>
                <Select
                  label="Orden perfiles"
                  value={String(element.logic?.constants?.[HUB_UI_CONSTANT_KEYS.INSTANCE_SORT] ?? "name")}
                  onChange={(e) =>
                    applyLogic({
                      constants: {
                        ...element.logic?.constants,
                        [HUB_UI_CONSTANT_KEYS.INSTANCE_SORT]: e.target.value,
                      },
                    })
                  }
                  options={INSTANCE_SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
                {element.logic?.constants?.[HUB_UI_CONSTANT_KEYS.INSTANCE_SORT] === "custom" && (
                  <Input
                    label="Orden personalizado (ids separados por coma)"
                    value={String(element.logic?.constants?.[HUB_UI_CONSTANT_KEYS.INSTANCE_ORDER] ?? "")}
                    onChange={(e) =>
                      applyLogic({
                        constants: {
                          ...element.logic?.constants,
                          [HUB_UI_CONSTANT_KEYS.INSTANCE_ORDER]: e.target.value,
                        },
                      })
                    }
                    placeholder="legendary,create,vanilla"
                  />
                )}
                <Textarea
                  label="Agrupación (opcional)"
                  value={String(element.logic?.constants?.[HUB_UI_CONSTANT_KEYS.INSTANCE_GROUPS] ?? "")}
                  onChange={(e) =>
                    applyLogic({
                      constants: {
                        ...element.logic?.constants,
                        [HUB_UI_CONSTANT_KEYS.INSTANCE_GROUPS]: e.target.value,
                      },
                    })
                  }
                  placeholder={"principal: id1, id2\notros: id3, id4"}
                  rows={3}
                  className="font-mono text-[10px]"
                />
                <p className="text-[9px] leading-snug text-[var(--color-muted)]">
                  Separa grupos con línea nueva o punto y coma. Opcional: nombre del grupo antes de dos puntos.
                  Los perfiles no listados van al final.
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <HubNumberField
                    label="Espacio px"
                    value={Number(element.logic?.constants?.[HUB_UI_CONSTANT_KEYS.GRID_GAP] ?? 8) || 8}
                    min={2}
                    max={32}
                    step={1}
                    onCommit={(gridGap) =>
                      applyLogic({
                        constants: {
                          ...element.logic?.constants,
                          [HUB_UI_CONSTANT_KEYS.GRID_GAP]: String(gridGap),
                        },
                      })
                    }
                  />
                  <HubNumberField
                    label="Separación grupos px"
                    value={Number(element.logic?.constants?.[HUB_UI_CONSTANT_KEYS.AVATAR_GROUP_GAP] ?? 12) || 12}
                    min={0}
                    max={48}
                    step={2}
                    onCommit={(groupGap) =>
                      applyLogic({
                        constants: {
                          ...element.logic?.constants,
                          [HUB_UI_CONSTANT_KEYS.AVATAR_GROUP_GAP]: String(groupGap),
                        },
                      })
                    }
                  />
                </div>
              </>
            )}
          </>
        )}
      </PropertySection>

      {showLogic && (
        <PropertySection title="Lógica">
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-[10px] text-[var(--color-text-soft)]">
              <input
                type="checkbox"
                checked={element.logic?.enabled ?? false}
                onChange={(e) => applyLogic({ enabled: e.target.checked })}
                className="rounded border-[var(--color-border)]"
              />
              Activa
            </label>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[10px]"
              onClick={() => void runElementLogic(element.id)}
              disabled={!element.logic?.script?.trim() && !isVisibilityRuleElement(element)}
            >
              Probar
            </Button>
          </div>

          {(element.logic?.refId ?? "").includes(",") && (
            <p className="text-[10px] text-[var(--color-danger-text)]">
              Un solo Ref ID por elemento (sin comas). Las acciones de mostrar/ocultar van en la lista de abajo.
            </p>
          )}

          <Select
            compact
            label="Disparador"
            value={element.logic?.trigger ?? "click"}
            onChange={(e) => applyLogic({ trigger: e.target.value as LogicTrigger })}
            options={(
              [
                "click",
                "change",
                "submit",
                "load",
                "interval",
                "any-click",
                "phase-change",
                "launch-idle",
                "launch-active",
                "launch-running",
                "launch-error",
                "launch-ended",
                "selector-change",
              ] as LogicTrigger[]
            ).map((t) => ({
              value: t,
              label: triggerLabel(t),
            }))}
          />

          {element.logic?.trigger === "interval" && (
            <HubNumberField
              label="Intervalo ms"
              value={element.logic?.intervalMs ?? 1000}
              min={100}
              max={60000}
              step={100}
              onCommit={(intervalMs) => applyLogic({ intervalMs })}
            />
          )}

          {element.type === "api-call" && (
            <>
              <Input
                compact
                label="URL API"
                value={element.logic?.apiUrl ?? ""}
                onChange={(e) => applyLogic({ apiUrl: e.target.value })}
                placeholder="https://..."
              />
              <Select
                compact
                label="Método"
                value={element.logic?.apiMethod ?? "POST"}
                onChange={(e) =>
                  applyLogic({ apiMethod: e.target.value as NonNullable<HubElement["logic"]>["apiMethod"] })
                }
                options={[
                  { value: "GET", label: "GET" },
                  { value: "POST", label: "POST" },
                  { value: "PUT", label: "PUT" },
                  { value: "DELETE", label: "DELETE" },
                ]}
              />
            </>
          )}

          <ElementTargetPickers
            layout={layout}
            element={element}
            onPatchConstants={(patch) => {
              const merged: Record<string, string | number | boolean> = {
                ...(element.logic?.constants ?? {}),
                ...patch,
              };
              if (merged.VIS_ACTIONS) {
                delete merged.SHOW;
                delete merged.SHOW_REF;
                delete merged.HIDE;
                delete merged.HIDE_REF;
              }
              setConstantsError(null);
              applyLogic({ constants: merged });
            }}
          />

          {element.type === "panel-visibility-select" && (
            <>
              <Select
                compact
                label="Panel por defecto"
                value={String(element.value ?? "")}
                onChange={(e) => patch({ value: e.target.value })}
                options={refTargetOptions}
              />
              <label className="flex items-center gap-2 text-[10px] text-[var(--color-text-soft)]">
                <input
                  type="checkbox"
                  checked={Boolean(element.logic?.constants?.HIDE_OTHERS)}
                  onChange={(e) => {
                    const parsed = parseConstantsJson(constantsRaw);
                    const merged = {
                      ...(parsed.ok ? parsed.data : {}),
                      HIDE_OTHERS: e.target.checked,
                    };
                    setConstantsRaw(JSON.stringify(merged, null, 2));
                    applyLogic({ constants: merged });
                  }}
                />
                Ocultar otros paneles al elegir
              </label>
            </>
          )}

          {element.type === "visibility-zone" && (
            <Select
              compact
              label="Visible cuando fase MC"
              value={String(element.value ?? "any")}
              onChange={(e) => patch({ value: e.target.value })}
              options={[
                { value: "any", label: "Siempre" },
                { value: "idle", label: "Parado / cerrado" },
                { value: "launching", label: "Descargando" },
                { value: "running", label: "En juego" },
                { value: "error", label: "Error" },
              ]}
            />
          )}

          {!visibilityActionsUi && (
            <>
              <Textarea
                compact
                label="Constantes JSON"
                value={constantsRaw}
                onChange={(e) => saveConstants(e.target.value)}
                rows={3}
                className="font-mono text-[10px]"
                placeholder={'{"MAX": 10}'}
              />
              {constantsError && (
                <p className="text-[10px] text-[var(--color-danger-text)]">{constantsError}</p>
              )}
            </>
          )}

          {visibilityActionsUi && (
            <p className="text-[9px] leading-snug text-[var(--color-muted)]">
              No hace falta JSON ni script si solo usas la lista de acciones de arriba.
            </p>
          )}

          {visibilityActionsUi && (
            <button
              type="button"
              className="text-left text-[10px] font-medium text-[var(--color-accent)] hover:underline"
              onClick={() => setShowAdvScript((v) => !v)}
            >
              {showAdvScript ? "▾ Ocultar script avanzado" : "▸ Script avanzado (opcional)"}
            </button>
          )}

          {(!visibilityActionsUi || showAdvScript) && (
            <>
              <Select
                compact
                label="Plantilla"
                value=""
                onChange={(e) => {
                  const tpl = LOGIC_SCRIPT_TEMPLATES.find((t) => t.label === e.target.value);
                  if (tpl) applyLogic({ enabled: true, script: tpl.script });
                }}
                options={[
                  { value: "", label: "— Elegir —" },
                  ...LOGIC_SCRIPT_TEMPLATES.map((t) => ({ value: t.label, label: t.label })),
                ]}
              />

              <LogicScriptEditor
            value={element.logic?.script ?? ""}
            onChange={(script) => applyLogic({ script, enabled: true })}
            refId={element.logic?.refId}
            elementType={element.type}
            trigger={element.logic?.trigger ?? "click"}
            scriptMode={element.logic?.scriptMode ?? "simple"}
            onScriptModeChange={(mode: HubScriptMode) => {
              if (mode === "hub" && (element.logic?.scriptMode ?? "simple") === "simple" && element.logic?.script?.trim()) {
                applyLogic({ scriptMode: mode, script: compileSimpleToHub(element.logic.script) });
              } else {
                applyLogic({ scriptMode: mode });
              }
            }}
            constants={element.logic?.constants}
            availableRefs={availableRefs}
            screens={allScreens.map((s) => ({ id: s.id, name: s.name }))}
            showAdvancedApi
            onToggleAdvancedApi={() => setShowApi(!showApi)}
            advancedApiOpen={showApi}
            advancedApiPanel={
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-2">
                {SCRIPT_API_GROUPS.map((group) => (
                  <div key={group.title}>
                    <p className="text-[10px] font-medium text-[var(--color-text-soft)]">{group.title}</p>
                    <ul className="mt-0.5 space-y-0.5">
                      {group.items.map((item) => (
                        <li key={item} className="font-mono text-[9px] text-[var(--color-muted)]">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            }
          />
            </>
          )}

          {scriptConsole[0]?.elementId === element.id && (
            <div
              className={cn(
                "rounded-lg border px-2 py-1.5 text-[10px]",
                scriptConsole[0].success
                  ? "border-[var(--color-border)] text-[var(--color-text-soft)]"
                  : "border-[var(--color-border)] text-[var(--color-danger-text)]"
              )}
            >
              {scriptConsole[0].message}
            </div>
          )}
        </PropertySection>
      )}

      {!showLogic && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-full text-[10px]"
          onClick={() =>
            applyLogic({
              enabled: true,
              trigger: "click",
              scriptMode: "simple",
              script: SIMPLE_SCRIPT_TEMPLATE,
            })
          }
        >
          + Añadir lógica
        </Button>
      )}
    </div>
  );
}

export function PropertiesPanel() {
  const element = useSelectedElement();
  const screen = useActiveScreen();
  const layout = useHubBuilderStore((s) => s.layout);
  const updateLayout = useHubBuilderStore((s) => s.updateLayout);
  const setLauncherWindowSize = useHubBuilderStore((s) => s.setLauncherWindowSize);

  const isGameMenu = screen.id === GAME_MENU_SCREEN_ID;
  const isLoadingScreen = screen.id === GAME_LOADING_SCREEN_ID;
  const isMinecraftEditor = isGameMenu || isLoadingScreen;

  if (!element) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-xs text-[var(--color-text-soft)]">Selecciona un elemento</p>
          <p className="mt-1 text-[10px] text-[var(--color-muted)]">Clic en el canvas o desde la paleta</p>
        </div>
        {isGameMenu ? (
          <PropertySection title="Menú Minecraft (diseño)" defaultOpen>
            <p className="text-[10px] leading-relaxed text-[var(--color-muted)]">
              El canvas usa el espacio <b>GUI</b> de Minecraft (p. ej. 480×270 en ventana maximizada), no los
              píxeles del monitor. Detecta tu pantalla y coincide con el juego al abrir en ventana completa.
            </p>
            <p className="mt-2 text-[10px] text-[var(--color-muted)]">
              Pantalla de diseño: {screen.width}×{screen.height}
              {screen.width !== GAME_MENU_W || screen.height !== GAME_MENU_H
                ? " — se reparará al reabrir la pestaña Menú del juego"
                : ""}
            </p>
            <p className="mt-2 text-[10px] text-[var(--color-muted)]">
              Usa <b>Probar</b> para simular otra ventana (p. ej. 854×480) y comprobar el escalado.
            </p>
          </PropertySection>
        ) : isLoadingScreen ? (
          <PropertySection title="Pantalla de carga (diseño)" defaultOpen>
            <p className="text-[10px] leading-relaxed text-[var(--color-muted)]">
              Resolución de diseño fija: <b>{GAME_LOADING_W}×{GAME_LOADING_H}</b>.
              Texto y barra de progreso usan anclas como en el juego real.
            </p>
            <p className="mt-2 text-[10px] text-[var(--color-muted)]">
              Pantalla actual: {screen.width}×{screen.height}
              {screen.width !== GAME_LOADING_W || screen.height !== GAME_LOADING_H
                ? " — se reparará al reabrir la pestaña Pantalla de carga"
                : ""}
            </p>
            <p className="mt-2 text-[10px] text-[var(--color-muted)]">
              Opcional: imagen de fondo con blur (estilo Lunar). Usa <b>Probar</b> para simular distintos tamaños.
            </p>
          </PropertySection>
        ) : (
        <PropertySection title="Ventana del launcher (fijo)" defaultOpen>
          <LauncherWindowSizeControls
            width={layout.window?.width}
            height={layout.window?.height}
            borderlessFullscreen={Boolean(layout.window?.borderlessFullscreen)}
            screenWidth={screen.width}
            screenHeight={screen.height}
            screenName={screen.name}
            chromeHeight={resolveLayoutChromeHeight(layout)}
            onWidth={(width) =>
              setLauncherWindowSize({
                width,
                borderlessFullscreen: false,
              })
            }
            onHeight={(height) =>
              setLauncherWindowSize({
                height,
                borderlessFullscreen: false,
              })
            }
            onApplyPreset={(preset) =>
              setLauncherWindowSize({
                width: preset.width,
                height: preset.height,
                borderlessFullscreen: preset.borderlessFullscreen,
                ...(preset.borderlessFullscreen ? { lockSize: true } : {}),
              })
            }
          />
          <label className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)] px-2 py-2">
            <span className="text-[10px] font-medium text-[var(--color-text-soft)]">
              Bloquear tamaño (no redimensionable)
            </span>
            <input
              type="checkbox"
              checked={Boolean(layout.window?.lockSize) || Boolean(layout.window?.borderlessFullscreen)}
              disabled={Boolean(layout.window?.borderlessFullscreen)}
              onChange={(e) => updateLayout({ window: { lockSize: e.target.checked } })}
            />
          </label>
        </PropertySection>
        )}
        {!isMinecraftEditor && (
        <PropertySection title="Launcher (pantallas internas)">
          <Select
            compact
            label="Transición al cambiar ventana"
            value={layout.ui?.screenTransition ?? "fade"}
            onChange={(e) =>
              updateLayout({
                ui: {
                  screenTransition: (e.target.value as "none" | "fade" | "slide") ?? "fade",
                },
              })
            }
            options={[
              { value: "none", label: "Sin animación" },
              { value: "fade", label: "Desvanecer" },
              { value: "slide", label: "Deslizar" },
            ]}
          />
          <HubNumberField
            label="Duración transición (ms)"
            value={layout.ui?.transitionMs ?? 180}
            min={0}
            max={2000}
            step={10}
            onCommit={(transitionMs) => updateLayout({ ui: { transitionMs } })}
          />
          <label className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)] px-2 py-2">
            <span className="text-[10px] font-medium text-[var(--color-text-soft)]">Modo rendimiento</span>
            <input
              type="checkbox"
              checked={Boolean(layout.ui?.performanceMode)}
              onChange={(e) => updateLayout({ ui: { performanceMode: e.target.checked } })}
            />
          </label>
          <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)] px-2 py-2">
            <p className="text-[10px] font-medium text-[var(--color-text-soft)]">Ventana principal al abrir</p>
            <p className="mt-1 text-[11px] text-[var(--color-text)]">
              {layout.screens.find((s) => s.id === (layout.ui?.homeScreenId ?? "screen-home"))?.name ??
                "Inicio"}
            </p>
            <p className="mt-0.5 text-[9px] text-[var(--color-muted)]">
              Clic derecho en una pestaña → Establecer como ventana principal
            </p>
          </div>
          <label className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)] px-2 py-2">
            <span className="text-[10px] font-medium text-[var(--color-text-soft)]">Recordar última ventana</span>
            <input
              type="checkbox"
              checked={Boolean(layout.ui?.rememberLastScreen)}
              onChange={(e) => updateLayout({ ui: { rememberLastScreen: e.target.checked } })}
            />
          </label>
          <label className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)] px-2 py-2">
            <span className="text-[10px] font-medium text-[var(--color-text-soft)]">Scroll suave</span>
            <input
              type="checkbox"
              checked={Boolean(layout.ui?.smoothScroll)}
              onChange={(e) => updateLayout({ ui: { smoothScroll: e.target.checked } })}
            />
          </label>
          <label className="flex flex-col gap-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)] px-2 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium text-[var(--color-text-soft)]">
                Ventana de escritorio al lanzar
              </span>
              <input
                type="checkbox"
                checked={Boolean(layout.ui?.launchDesktopWindow)}
                onChange={(e) => updateLayout({ ui: { launchDesktopWindow: e.target.checked } })}
              />
            </div>
            <p className="text-[9px] text-[var(--color-muted)]">
              Abre una ventana Electron aparte para descarga/registro (el Hub principal sigue igual). También
              puedes añadir el widget «Ventana escritorio» en el lienzo.
            </p>
          </label>
        </PropertySection>
        )}
        {!isMinecraftEditor && <ScreenProperties screen={screen} />}
      </div>
    );
  }

  return isGameMenu ? (
    <GameMenuElementProperties key={element.id} element={element} />
  ) : isLoadingScreen ? (
    <GameLoadingElementProperties key={element.id} element={element} />
  ) : (
    <ElementPropertiesForm key={element.id} element={element} screen={screen} />
  );
}
